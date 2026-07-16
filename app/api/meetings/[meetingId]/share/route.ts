import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import {
  calendarEvents,
  meetingAccess,
  meetingShareInvites,
  meetingShareRules,
  meetings,
  teamMemberships,
  users,
} from "@/db/schema";
import { normalizeEmail } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { getManageableMeetingCondition } from "@/lib/meeting-write-policy";
import {
  getMeetingShareMatchKeys,
  meetingsShareAnyMatchKey,
} from "@/lib/meeting-sharing";
import { getOrCreateWorkspaceForSessionUser } from "@/lib/workspace";

export const runtime = "nodejs";

const meetingIdSchema = z.uuid();
const shareRequestSchema = z.strictObject({
  email: z
    .string()
    .trim()
    .pipe(z.email().max(320))
    .transform(normalizeEmail),
  includeRelated: z.boolean().optional().default(false),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ meetingId: string }> },
) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { meetingId } = await context.params;
  const parsedMeetingId = meetingIdSchema.safeParse(meetingId);

  if (!parsedMeetingId.success) {
    return Response.json({ error: "Meeting not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const result = shareRequestSchema.safeParse(body);

  if (!result.success) {
    return Response.json({ error: "Invalid coworker email" }, { status: 400 });
  }

  const workspace = await getOrCreateWorkspaceForSessionUser(user);
  const meetingRows = await db
    .select({
      attendeeEmails: calendarEvents.attendeeEmails,
      id: meetings.id,
      ownerUserId: meetings.ownerUserId,
      title: meetings.title,
    })
    .from(meetings)
    .leftJoin(calendarEvents, eq(calendarEvents.id, meetings.calendarEventId))
    .where(getManageableMeetingCondition(workspace, parsedMeetingId.data))
    .limit(1);

  if (!meetingRows[0]) {
    return Response.json({ error: "Meeting not found" }, { status: 404 });
  }

  const meeting = meetingRows[0];
  const matchKeys = result.data.includeRelated
    ? getMeetingShareMatchKeys({
        attendeeEmails: meeting.attendeeEmails,
        title: meeting.title,
        workspaceDomain: workspace.domain,
      })
    : [];
  let meetingIds = [meeting.id];

  if (matchKeys.length > 0) {
    const candidates = await db
      .select({
        attendeeEmails: calendarEvents.attendeeEmails,
        id: meetings.id,
        title: meetings.title,
      })
      .from(meetings)
      .leftJoin(calendarEvents, eq(calendarEvents.id, meetings.calendarEventId))
      .where(
        and(
          eq(meetings.teamId, workspace.teamId),
          eq(meetings.ownerUserId, meeting.ownerUserId),
          ne(meetings.status, "cancelled"),
        ),
      );

    meetingIds = candidates
      .filter((candidate) =>
        meetingsShareAnyMatchKey(
          matchKeys,
          getMeetingShareMatchKeys({
            attendeeEmails: candidate.attendeeEmails,
            title: candidate.title,
            workspaceDomain: workspace.domain,
          }),
        ),
      )
      .map((candidate) => candidate.id);

    if (!meetingIds.includes(meeting.id)) {
      meetingIds.unshift(meeting.id);
    }
  }

  const targetRows = await db
    .select({
      id: users.id,
      email: users.email,
      membershipId: teamMemberships.id,
      name: users.name,
    })
    .from(users)
    .leftJoin(
      teamMemberships,
      and(
        eq(teamMemberships.userId, users.id),
        eq(teamMemberships.teamId, workspace.teamId),
      ),
    )
    .where(eq(users.email, result.data.email))
    .limit(1);
  const targetUser = targetRows[0];

  if (targetUser && targetUser.id !== workspace.userId) {
    for (const id of meetingIds) {
      await db
        .insert(meetingAccess)
        .values({ meetingId: id, role: "shared", userId: targetUser.id })
        .onConflictDoNothing({
          target: [meetingAccess.meetingId, meetingAccess.userId],
        });
    }
  }

  if (!targetUser) {
    for (const id of meetingIds) {
      await db
        .insert(meetingShareInvites)
        .values({
          createdByUserId: workspace.userId,
          email: result.data.email,
          meetingId: id,
          role: "shared",
        })
        .onConflictDoNothing({
          target: [meetingShareInvites.meetingId, meetingShareInvites.email],
        });
    }

    await saveFutureShareRules({
      createdByUserId: workspace.userId,
      matchKeys,
      ownerUserId: meeting.ownerUserId,
      recipientEmail: result.data.email,
      teamId: workspace.teamId,
    });

    return Response.json({
      email: result.data.email,
      meetingCount: meetingIds.length,
      pending: true,
      shared: true,
      futureMeetings: matchKeys.length > 0,
    });
  }

  if (targetUser.id !== workspace.userId) {
    await saveFutureShareRules({
      createdByUserId: workspace.userId,
      matchKeys,
      ownerUserId: meeting.ownerUserId,
      recipientEmail: result.data.email,
      teamId: workspace.teamId,
    });
  }

  return Response.json({
    audience: targetUser.membershipId ? "organization" : "external",
    meetingCount: meetingIds.length,
    shared: true,
    futureMeetings: matchKeys.length > 0,
    user: {
      email: targetUser.email,
      name: targetUser.name,
    },
  });
}

async function saveFutureShareRules(input: {
  createdByUserId: string;
  matchKeys: string[];
  ownerUserId: string;
  recipientEmail: string;
  teamId: string;
}) {
  for (const matchKey of input.matchKeys) {
    await db
      .insert(meetingShareRules)
      .values({
        createdByUserId: input.createdByUserId,
        matchKey,
        ownerUserId: input.ownerUserId,
        recipientEmail: input.recipientEmail,
        role: "shared",
        teamId: input.teamId,
      })
      .onConflictDoNothing({
        target: [
          meetingShareRules.teamId,
          meetingShareRules.ownerUserId,
          meetingShareRules.recipientEmail,
          meetingShareRules.matchKey,
        ],
      });
  }
}
