import {
  findRecallRecordingMediaUrl,
  findRecallRecordingTiming,
  findRecallRecordingVideoUrl,
} from "@/lib/vendors/recall";
import { probeRecallMediaDurationMs } from "@/lib/recall-media-duration";

const MINIMUM_TIMING_TOLERANCE_MS = 30_000;

type RecallRecordingReadiness =
  | {
      action: "ready";
      audioUrl: string;
      durationMs: number;
      endedAt: Date;
      startedAt: Date;
    }
  | {
      action: "wait";
      reason:
        | "lifecycle_unavailable"
        | "media_duration_unavailable"
        | "media_unavailable"
        | "media_timing_mismatch"
        | "recording_timing_unavailable"
        | "timing_mismatch";
    };

export async function getRecallRecordingReadiness(
  artifact: unknown,
  recordingId: string,
): Promise<RecallRecordingReadiness> {
  const recordingTiming = findRecallRecordingTiming(artifact, recordingId);

  if (!recordingTiming) {
    return { action: "wait", reason: "recording_timing_unavailable" };
  }

  const lifecycleTiming = findRecallBotCallTiming(
    artifact,
    recordingTiming.startedAt,
  );

  if (!lifecycleTiming) {
    return { action: "wait", reason: "lifecycle_unavailable" };
  }

  const toleranceMs = MINIMUM_TIMING_TOLERANCE_MS;
  const startDifferenceMs = Math.abs(
    recordingTiming.startedAt.getTime() - lifecycleTiming.startedAt.getTime(),
  );
  const durationDifferenceMs = Math.abs(
    recordingTiming.durationMs - lifecycleTiming.durationMs,
  );

  if (startDifferenceMs > toleranceMs || durationDifferenceMs > toleranceMs) {
    return { action: "wait", reason: "timing_mismatch" };
  }

  const audioUrl = findRecallRecordingMediaUrl(artifact, recordingId);

  if (!audioUrl) {
    return { action: "wait", reason: "media_unavailable" };
  }

  const videoUrl = findRecallRecordingVideoUrl(artifact, recordingId);

  if (!videoUrl) {
    return { action: "wait", reason: "media_duration_unavailable" };
  }

  let mediaDurationMs: number;

  try {
    mediaDurationMs = await probeRecallMediaDurationMs(videoUrl);
  } catch {
    return { action: "wait", reason: "media_duration_unavailable" };
  }

  if (Math.abs(mediaDurationMs - lifecycleTiming.durationMs) > toleranceMs) {
    return { action: "wait", reason: "media_timing_mismatch" };
  }

  return {
    action: "ready",
    audioUrl,
    durationMs: lifecycleTiming.durationMs,
    endedAt: lifecycleTiming.endedAt,
    startedAt: lifecycleTiming.startedAt,
  };
}

function findRecallBotCallTiming(artifact: unknown, recordingStartedAt: Date) {
  const record = getRecord(artifact);
  const statusChanges = Array.isArray(record?.status_changes)
    ? record.status_changes
    : [];
  let startedAt: Date | null = null;
  const intervals: Array<{
    durationMs: number;
    endedAt: Date;
    startedAt: Date;
  }> = [];

  for (const value of statusChanges) {
    const status = getRecord(value);
    const code = getString(status?.code)?.toLowerCase();
    const createdAt = getString(status?.created_at);

    if (!createdAt) {
      continue;
    }

    const timestamp = new Date(createdAt);

    if (!Number.isFinite(timestamp.getTime())) {
      continue;
    }

    if (code === "in_call_recording" && !startedAt) {
      startedAt = timestamp;
      continue;
    }

    if (code !== "call_ended" || !startedAt) {
      continue;
    }

    const durationMs = timestamp.getTime() - startedAt.getTime();

    if (durationMs > 0) {
      intervals.push({
        durationMs: Math.round(durationMs),
        endedAt: timestamp,
        startedAt,
      });
    }

    startedAt = null;
  }

  return (
    intervals.sort(
      (left, right) =>
        Math.abs(left.startedAt.getTime() - recordingStartedAt.getTime()) -
        Math.abs(right.startedAt.getTime() - recordingStartedAt.getTime()),
    )[0] ?? null
  );
}

function getRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
