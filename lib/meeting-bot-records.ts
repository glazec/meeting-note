import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { meetings } from "@/db/schema";
import type { SessionUser } from "@/lib/auth";
import type { SupportedMeetingPlatform } from "@/lib/meeting-links";
import {
  assertCanCreateMeetings,
  getOrCreateWorkspaceForSessionUser,
} from "@/lib/workspace";

type CreateScheduledMeetingBotInput = {
  sessionUser: SessionUser;
  meetingUrl: string;
  platform: SupportedMeetingPlatform;
};

export async function createScheduledMeetingBot(
  input: CreateScheduledMeetingBotInput,
) {
  const workspace = await getOrCreateWorkspaceForSessionUser(input.sessionUser);
  await assertCanCreateMeetings(workspace);

  const [meeting] = await db
    .insert(meetings)
    .values({
      teamId: workspace.teamId,
      ownerUserId: workspace.userId,
      title: defaultMeetingTitle(input.platform),
      platform: input.platform,
      status: "scheduled",
      meetingUrl: input.meetingUrl,
    })
    .returning({ id: meetings.id });

  return { meetingId: meeting.id };
}

export async function markMeetingBotScheduled(input: {
  meetingId: string;
  recallBotId: string;
}) {
  await db
    .update(meetings)
    .set({
      recallBotId: input.recallBotId,
      updatedAt: new Date(),
    })
    .where(eq(meetings.id, input.meetingId));
}

export async function markMeetingBotFailed(input: { meetingId: string }) {
  await db
    .update(meetings)
    .set({
      status: "failed",
      updatedAt: new Date(),
    })
    .where(eq(meetings.id, input.meetingId));
}

function defaultMeetingTitle(platform: SupportedMeetingPlatform) {
  return platform === "google_meet" ? "Google Meet recording" : "Zoom recording";
}
