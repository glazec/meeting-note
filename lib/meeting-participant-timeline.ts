import { asc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { meetingParticipantTimeline } from "@/db/schema";

export type ParticipantTimelineEntry = {
  participantId: string | null;
  name: string | null;
  email: string | null;
  startMs: number;
  endMs: number | null;
};

export async function fetchAndPersistRecallParticipantTimeline(input: {
  meetingId: string;
  timelineUrl: string;
}) {
  const response = await fetch(input.timelineUrl);

  if (!response.ok) {
    throw new Error(
      `Recall speaker timeline fetch failed with ${response.status} ${response.statusText}`,
    );
  }

  const timeline = parseRecallParticipantTimeline(await response.json());

  await persistMeetingParticipantTimeline({
    meetingId: input.meetingId,
    timeline,
  });

  return { count: timeline.length };
}

export function parseRecallParticipantTimeline(
  payload: unknown,
): ParticipantTimelineEntry[] {
  const records = getTimelineRecords(payload);
  const entries: ParticipantTimelineEntry[] = [];

  for (const record of records) {
    if (!record || typeof record !== "object") {
      continue;
    }

    const item = record as Record<string, unknown>;
    const participant = getRecord(item.participant) ?? getRecord(item.speaker);
    const participantId =
      getIdString(item.participant_id) ??
      getIdString(item.participantId) ??
      getIdString(participant?.id) ??
      getIdString(item.id);
    const name =
      getString(item.name) ??
      getString(item.participant_name) ??
      getString(item.participantName) ??
      getString(participant?.name);
    const email =
      getString(item.email) ??
      getString(item.participant_email) ??
      getString(item.participantEmail) ??
      getString(participant?.email);
    const startMs =
      getMilliseconds(item, ["start_ms", "startMs", "start_time_ms"]) ??
      getRelativeTimestampAsMilliseconds(item, [
        "start_timestamp",
        "startTimestamp",
      ]) ??
      getSecondsAsMilliseconds(item, ["start", "start_time", "startTime"]);
    const endMs =
      getMilliseconds(item, ["end_ms", "endMs", "end_time_ms"]) ??
      getRelativeTimestampAsMilliseconds(item, [
        "end_timestamp",
        "endTimestamp",
      ]) ??
      getSecondsAsMilliseconds(item, ["end", "end_time", "endTime"]);

    if (startMs === null || (!participantId && !name && !email)) {
      continue;
    }

    entries.push({
      participantId,
      name,
      email,
      startMs,
      endMs,
    });
  }

  return entries.sort((left, right) => left.startMs - right.startMs);
}

export async function persistMeetingParticipantTimeline(input: {
  meetingId: string;
  timeline: ParticipantTimelineEntry[];
}) {
  await db
    .delete(meetingParticipantTimeline)
    .where(eq(meetingParticipantTimeline.meetingId, input.meetingId));

  if (input.timeline.length === 0) {
    return;
  }

  await db.insert(meetingParticipantTimeline).values(
    input.timeline.map((entry) => ({
      meetingId: input.meetingId,
      recallParticipantId: entry.participantId,
      name: entry.name,
      email: entry.email,
      startMs: entry.startMs,
      endMs: entry.endMs,
      source: "recall",
    })),
  );
}

export async function listMeetingParticipantTimeline(meetingId: string) {
  const rows = await db
    .select({
      participantId: meetingParticipantTimeline.recallParticipantId,
      name: meetingParticipantTimeline.name,
      email: meetingParticipantTimeline.email,
      startMs: meetingParticipantTimeline.startMs,
      endMs: meetingParticipantTimeline.endMs,
    })
    .from(meetingParticipantTimeline)
    .where(eq(meetingParticipantTimeline.meetingId, meetingId))
    .orderBy(asc(meetingParticipantTimeline.startMs));

  return rows;
}

function getTimelineRecords(payload: unknown) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const record = payload as Record<string, unknown>;

  for (const key of ["timeline", "speaker_timeline", "segments", "data"]) {
    const value = record[key];

    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
}

function getRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getIdString(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return getString(value);
}

function getMilliseconds(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = getNumber(record[key]);

    if (value !== null) {
      return Math.max(0, Math.round(value));
    }
  }

  return null;
}

function getSecondsAsMilliseconds(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = getNumber(record[key]);

    if (value !== null) {
      return Math.max(0, Math.round(value * 1000));
    }
  }

  return null;
}

function getRelativeTimestampAsMilliseconds(
  record: Record<string, unknown>,
  keys: string[],
) {
  for (const key of keys) {
    const timestamp = getRecord(record[key]);
    const value = timestamp ? getNumber(timestamp.relative) : null;

    if (value !== null) {
      return Math.max(0, Math.round(value * 1000));
    }
  }

  return null;
}

function getNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}
