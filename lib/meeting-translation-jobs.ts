import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { meetings } from "@/db/schema";

export async function markMeetingTranslationQueued(meetingId: string) {
  await db
    .update(meetings)
    .set({
      translationCompletedAt: null,
      translationErrorMessage: null,
      translationStatus: "queued",
      updatedAt: new Date(),
    })
    .where(eq(meetings.id, meetingId));
}

export async function markMeetingTranslationRunning(meetingId: string) {
  await db
    .update(meetings)
    .set({
      translationCompletedAt: null,
      translationErrorMessage: null,
      translationStartedAt: new Date(),
      translationStatus: "running",
      updatedAt: new Date(),
    })
    .where(eq(meetings.id, meetingId));
}

export async function markMeetingTranslationCompleted(meetingId: string) {
  await db
    .update(meetings)
    .set({
      translationCompletedAt: new Date(),
      translationErrorMessage: null,
      translationStatus: "completed",
      updatedAt: new Date(),
    })
    .where(eq(meetings.id, meetingId));
}

export async function markMeetingTranslationFailed(
  meetingId: string,
  error: unknown,
) {
  await db
    .update(meetings)
    .set({
      translationErrorMessage: getTranslationErrorMessage(error),
      translationStatus: "failed",
      updatedAt: new Date(),
    })
    .where(eq(meetings.id, meetingId));
}

function getTranslationErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.slice(0, 500);
  }

  return "Translation failed";
}
