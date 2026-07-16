import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import {
  meetingAccess,
  meetingShareInvites,
  meetingShareRules,
  users,
} from "@/db/schema";
import { getMeetingShareMatchKeys } from "@/lib/meeting-sharing";

export async function applyMeetingShareRules(input: {
  attendeeEmails: unknown;
  meetingId: string;
  ownerUserId: string;
  teamId: string;
  title: string;
  workspaceDomain: string;
}) {
  const matchKeys = getMeetingShareMatchKeys(input);

  if (matchKeys.length === 0) {
    return { sharedCount: 0 };
  }

  const rules = await db
    .select({
      createdByUserId: meetingShareRules.createdByUserId,
      recipientEmail: meetingShareRules.recipientEmail,
      role: meetingShareRules.role,
    })
    .from(meetingShareRules)
    .where(
      and(
        eq(meetingShareRules.teamId, input.teamId),
        eq(meetingShareRules.ownerUserId, input.ownerUserId),
        inArray(meetingShareRules.matchKey, matchKeys),
      ),
    );
  const uniqueRules = Array.from(
    new Map(rules.map((rule) => [rule.recipientEmail, rule])).values(),
  );

  if (uniqueRules.length === 0) {
    return { sharedCount: 0 };
  }

  const recipientRows = await db
    .select({ email: users.email, id: users.id })
    .from(users)
    .where(
      inArray(
        users.email,
        uniqueRules.map((rule) => rule.recipientEmail),
      ),
    );
  const userIdByEmail = new Map(
    recipientRows.map((recipient) => [recipient.email, recipient.id]),
  );

  for (const rule of uniqueRules) {
    const userId = userIdByEmail.get(rule.recipientEmail);

    if (userId) {
      await db
        .insert(meetingAccess)
        .values({ meetingId: input.meetingId, role: rule.role, userId })
        .onConflictDoNothing({
          target: [meetingAccess.meetingId, meetingAccess.userId],
        });
      continue;
    }

    await db
      .insert(meetingShareInvites)
      .values({
        createdByUserId: rule.createdByUserId,
        email: rule.recipientEmail,
        meetingId: input.meetingId,
        role: rule.role,
      })
      .onConflictDoNothing({
        target: [meetingShareInvites.meetingId, meetingShareInvites.email],
      });
  }

  return { sharedCount: uniqueRules.length };
}
