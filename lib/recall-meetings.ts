import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import { meetings, transcriptJobs } from "@/db/schema";
import { inngest } from "@/inngest/client";
import { fetchAndPersistRecallParticipantTimeline } from "@/lib/meeting-participant-timeline";
import { createRecallRecordingTranscription } from "@/lib/transcription-records";
import type { normalizeRecallWebhook } from "@/lib/vendors/recall";
import {
  findRecallRecordingMediaUrl,
  findRecallSpeakerTimelineUrl,
  retrieveRecallBot,
} from "@/lib/vendors/recall";

type RecallWebhookEvent = ReturnType<typeof normalizeRecallWebhook>;

type RecallMeetingUpdate =
  | {
      action: "update";
      meetingId: string;
      recallBotId: string | null;
      recallRecordingId: string | null;
      status:
        | "scheduled"
        | "recording"
        | "processing"
        | "failed"
        | "missed"
        | null;
    }
  | {
      action: "skip";
      reason: "missing_meeting_id";
    };

export function buildRecallMeetingUpdate(
  event: RecallWebhookEvent,
): RecallMeetingUpdate {
  const meetingId = getMetadataString(
    event.metadata,
    "meetingId",
    "meeting_id",
  );

  if (!meetingId) {
    return { action: "skip", reason: "missing_meeting_id" };
  }

  return {
    action: "update",
    meetingId,
    recallBotId: event.botId,
    recallRecordingId: event.recordingId,
    status: mapRecallStatus(event),
  };
}

export async function applyRecallMeetingEvent(event: RecallWebhookEvent) {
  const update = buildRecallMeetingUpdate(event);

  if (update.action === "skip") {
    return update;
  }

  const status =
    update.status === "missed" && (await hasRecordingEvidence(update.meetingId))
      ? null
      : update.status;

  await db
    .update(meetings)
    .set({
      recallBotId: update.recallBotId ?? undefined,
      recallRecordingId: update.recallRecordingId ?? undefined,
      status: status ?? undefined,
      updatedAt: new Date(),
    })
    .where(eq(meetings.id, update.meetingId));

  if (
    update.recallBotId &&
    update.recallRecordingId &&
    shouldQueueRecallVideoFrames(event)
  ) {
    await inngest.send({
      id: `video-frames:${update.recallRecordingId}`,
      name: "meeting/extract.video-frames",
      data: {
        meetingId: update.meetingId,
        recallBotId: update.recallBotId,
        recallRecordingId: update.recallRecordingId,
      },
    });
  }

  if (
    status === "processing" &&
    update.recallBotId &&
    shouldQueueRecallRecordingTranscription(event)
  ) {
    await queueRecallRecordingTranscription({
      ...update,
      recallBotId: update.recallBotId,
    });
  }

  return update;
}

function shouldQueueRecallRecordingTranscription(event: RecallWebhookEvent) {
  const eventType = event.eventType.toLowerCase();
  const subCode = event.subCode?.toLowerCase() ?? "";

  return eventType === "recording.done" || subCode === "recording_done";
}

function shouldQueueRecallVideoFrames(event: RecallWebhookEvent) {
  const eventType = event.eventType.toLowerCase();
  const subCode = event.subCode?.toLowerCase() ?? "";

  return (
    eventType === "recording.done" ||
    eventType === "video_mixed.done" ||
    subCode === "recording_done"
  );
}

async function queueRecallRecordingTranscription(
  update: Extract<RecallMeetingUpdate, { action: "update" }> & {
    recallBotId: string;
  },
) {
  if (await hasActiveTranscriptJob(update.meetingId)) {
    return;
  }

  const bot = await retrieveRecallBot(update.recallBotId);
  const audioUrl = findRecallRecordingMediaUrl(bot, update.recallRecordingId);
  const speakerTimelineUrl = findRecallSpeakerTimelineUrl(
    bot,
    update.recallRecordingId,
  );

  if (!audioUrl) {
    return;
  }

  if (speakerTimelineUrl) {
    try {
      await fetchAndPersistRecallParticipantTimeline({
        meetingId: update.meetingId,
        timelineUrl: speakerTimelineUrl,
      });
    } catch {
      // Keep transcription moving when Recall has not finished speaker timeline media.
    }
  }

  const transcription = await createRecallRecordingTranscription({
    meetingId: update.meetingId,
  });

  await inngest.send({
    name: "meeting/transcribe.audio",
    data: {
      audioUrl,
      ...transcription,
    },
  });
}

async function hasActiveTranscriptJob(meetingId: string) {
  const rows = await db
    .select({ id: transcriptJobs.id })
    .from(transcriptJobs)
    .where(
      and(
        eq(transcriptJobs.meetingId, meetingId),
        inArray(transcriptJobs.status, ["queued", "running", "completed"]),
      ),
    )
    .limit(1);

  return Boolean(rows[0]);
}

async function hasRecordingEvidence(meetingId: string) {
  const rows = await db
    .select({ recallRecordingId: meetings.recallRecordingId })
    .from(meetings)
    .where(eq(meetings.id, meetingId))
    .limit(1);

  return Boolean(rows[0]?.recallRecordingId);
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

function mapRecallStatus(event: RecallWebhookEvent) {
  const statusText = [
    event.statusCode,
    event.code,
    event.subCode,
    event.eventType,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (isRecallMissedRecording(event)) {
    return "missed";
  }

  if (/(fatal|fail|error)/.test(statusText)) {
    return "failed";
  }

  if (/recording_done|\bdone\b|complete/.test(statusText)) {
    if (!event.recordingId && event.eventType === "bot.done") {
      return null;
    }

    return "processing";
  }

  if (/recording|in_call|joining|joined/.test(statusText)) {
    return "recording";
  }

  return null;
}

function isRecallMissedRecording(event: RecallWebhookEvent) {
  if (event.recordingId) {
    return false;
  }

  const code = (event.code ?? event.statusCode ?? "").toLowerCase();
  const eventType = event.eventType.toLowerCase();

  return (
    code === "call_ended" ||
    code === "fatal" ||
    eventType === "bot.call_ended" ||
    eventType === "bot.fatal"
  );
}
