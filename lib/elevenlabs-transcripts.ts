import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { meetings, transcriptJobs, transcriptSegments } from "@/db/schema";
import type { normalizeElevenLabsWebhook } from "@/lib/vendors/elevenlabs";

type ElevenLabsTranscriptEvent = ReturnType<typeof normalizeElevenLabsWebhook>;

type CompleteTranscriptPersistence = {
  action: "complete";
  meetingId: string;
  providerJobId?: string;
  text: string;
  transcriptJobId: string;
};

type FailTranscriptPersistence = {
  action: "fail";
  providerJobId?: string;
  transcriptJobId: string;
};

type SkipTranscriptPersistence = {
  action: "skip";
  reason:
    | "missing_transcript_job_id"
    | "missing_meeting_id"
    | "missing_transcript_text";
};

type TranscriptPersistence =
  | CompleteTranscriptPersistence
  | FailTranscriptPersistence
  | SkipTranscriptPersistence;

export function buildElevenLabsTranscriptPersistence(
  event: ElevenLabsTranscriptEvent,
): TranscriptPersistence {
  const transcriptJobId = getMetadataString(
    event.metadata,
    "transcriptJobId",
    "transcript_job_id",
  );
  const providerJobId = event.requestId ?? event.transcriptId ?? undefined;

  if (!transcriptJobId) {
    return { action: "skip", reason: "missing_transcript_job_id" };
  }

  if (isFailedStatus(event.status)) {
    return {
      action: "fail",
      providerJobId,
      transcriptJobId,
    };
  }

  const meetingId = getMetadataString(event.metadata, "meetingId", "meeting_id");

  if (!meetingId) {
    return { action: "skip", reason: "missing_meeting_id" };
  }

  const text = event.transcriptionText?.trim();

  if (!text) {
    return { action: "skip", reason: "missing_transcript_text" };
  }

  return {
    action: "complete",
    meetingId,
    providerJobId,
    text,
    transcriptJobId,
  };
}

export async function applyElevenLabsTranscriptEvent(
  event: ElevenLabsTranscriptEvent,
) {
  const persistence = buildElevenLabsTranscriptPersistence(event);

  if (persistence.action === "skip") {
    return persistence;
  }

  const now = new Date();
  const status = persistence.action === "complete" ? "completed" : "failed";
  const jobUpdate: {
    providerJobId?: string;
    status: "completed" | "failed";
    updatedAt: Date;
  } = { status, updatedAt: now };

  if (persistence.providerJobId) {
    jobUpdate.providerJobId = persistence.providerJobId;
  }

  await db
    .update(transcriptJobs)
    .set(jobUpdate)
    .where(eq(transcriptJobs.id, persistence.transcriptJobId));

  if (persistence.action === "fail") {
    return persistence;
  }

  await db
    .insert(transcriptSegments)
    .values({
      meetingId: persistence.meetingId,
      jobId: persistence.transcriptJobId,
      speaker: null,
      startMs: 0,
      text: persistence.text,
    });

  await db
    .update(meetings)
    .set({ status: "ready", updatedAt: now })
    .where(eq(meetings.id, persistence.meetingId));

  return persistence;
}

function getMetadataString(
  metadata: Record<string, unknown>,
  ...keys: string[]
) {
  for (const key of keys) {
    const value = metadata[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function isFailedStatus(status: string | null) {
  if (!status) {
    return false;
  }

  const normalized = status.toLowerCase();

  return normalized.includes("fail") || normalized.includes("error");
}
