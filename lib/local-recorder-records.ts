import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";

import { db } from "@/db/client";
import {
  localRecorderDevices,
  localRecordingAttempts,
  localRecordings,
  mediaAssets,
  meetings,
  transcriptJobs,
} from "@/db/schema";
import { inngest } from "@/inngest/client";
import {
  canUploadLocalRecorderAttempt,
  getLocalRecorderEligibility,
  type LocalRecorderCandidate,
} from "@/lib/local-recorder-policy";
import {
  buildMeetingObjectKey,
  createUploadUrl,
  getObjectMetadata,
  parseR2Env,
} from "@/lib/r2";
import type { WorkspaceContext } from "@/lib/workspace";

export type LocalRecorderMeetingItem = {
  displayTimeWindow: {
    endsAt: string | null;
    startsAt: string;
  };
  expiresAt: string;
  fallbackIntentId: string;
  title: string;
};

export type LocalRecorderUploadAssetIds = {
  computerAudioAssetId: string;
  microphoneAudioAssetId: string;
  synthesizedAudioAssetId: string;
};

type LocalRecorderTranscriptionEventInput = {
  mediaAssetId: string;
  meetingId: string;
  objectKey: string;
  transcriptJobId: string;
};

const intentTokenBytes = 18;
const activeAttemptStates = ["started", "uploading", "uploaded"];
const localRecorderAudioContentType = "audio/wav";

export function buildLocalRecorderTranscriptionEvent(
  input: LocalRecorderTranscriptionEventInput,
) {
  return {
    id: `local-recorder-transcribe-${input.transcriptJobId}`,
    name: "meeting/transcribe.audio" as const,
    data: {
      mediaAssetId: input.mediaAssetId,
      meetingId: input.meetingId,
      objectKey: input.objectKey,
      transcriptJobId: input.transcriptJobId,
    },
  };
}

export async function listMissedLocalRecorderMeetings(input: {
  deviceId: string;
  now: Date;
  workspace: WorkspaceContext;
}): Promise<LocalRecorderMeetingItem[]> {
  const deviceIdHash = await hashLocalRecorderValue(input.deviceId);

  await db
    .insert(localRecorderDevices)
    .values({
      appVersion: null,
      deviceIdHash,
      lastSeenAt: input.now,
      teamId: input.workspace.teamId,
      userId: input.workspace.userId,
    })
    .onConflictDoUpdate({
      target: [
        localRecorderDevices.teamId,
        localRecorderDevices.userId,
        localRecorderDevices.deviceIdHash,
      ],
      set: {
        lastSeenAt: input.now,
        updatedAt: input.now,
      },
    });

  const rows = await db
    .select({
      activeTranscriptJob: sql<boolean>`exists (
        select 1 from ${transcriptJobs}
        where ${transcriptJobs.meetingId} = ${meetings.id}
          and ${transcriptJobs.status} in ('queued', 'running', 'completed')
      )`,
      endedAt: meetings.endedAt,
      id: meetings.id,
      latestRecallCode: sql<string | null>`null`,
      latestRecallStatus: sql<string | null>`null`,
      meetingUrl: meetings.meetingUrl,
      recallAudioAsset: sql<boolean>`exists (
        select 1 from ${mediaAssets}
        where ${mediaAssets.meetingId} = ${meetings.id}
          and ${mediaAssets.source} = 'recall'
          and ${mediaAssets.type} = 'audio'
      )`,
      recallRecordingId: meetings.recallRecordingId,
      startedAt: meetings.startedAt,
      status: meetings.status,
      title: meetings.title,
    })
    .from(meetings)
    .where(
      and(
        eq(meetings.teamId, input.workspace.teamId),
        isNotNull(meetings.meetingUrl),
      ),
    )
    .orderBy(desc(meetings.startedAt))
    .limit(50);
  const items: LocalRecorderMeetingItem[] = [];

  for (const row of rows) {
    const candidate: LocalRecorderCandidate = {
      activeTranscriptJob: row.activeTranscriptJob,
      endedAt: row.endedAt,
      latestRecallCode: row.latestRecallCode,
      latestRecallStatus: row.latestRecallStatus,
      meetingId: row.id,
      meetingUrl: row.meetingUrl,
      recallAudioAsset: row.recallAudioAsset,
      recallRecordingId: row.recallRecordingId,
      startedAt: row.startedAt,
      status: row.status,
    };
    const eligibility = getLocalRecorderEligibility(candidate, {
      now: input.now,
    });

    if (!eligibility.eligible || !row.startedAt) {
      continue;
    }

    const activeAttempt = await findLocalRecorderAttempt({
      deviceIdHash,
      meetingId: row.id,
      userId: input.workspace.userId,
    });

    if (activeAttempt) {
      continue;
    }

    const fallbackIntentId = createFallbackIntentId();
    const fallbackIntentIdHash =
      await hashLocalRecorderValue(fallbackIntentId);

    await db.insert(localRecordingAttempts).values({
      attemptState: "notified",
      deviceIdHash,
      expiresAt: eligibility.expiresAt,
      fallbackIntentIdHash,
      meetingId: row.id,
      notificationState: "shown",
      userId: input.workspace.userId,
    });

    items.push({
      displayTimeWindow: {
        endsAt: row.endedAt?.toISOString() ?? null,
        startsAt: row.startedAt.toISOString(),
      },
      expiresAt: eligibility.expiresAt.toISOString(),
      fallbackIntentId,
      title: row.title,
    });
  }

  return items;
}

export async function claimLocalRecorderIntent(input: {
  deviceId: string;
  fallbackIntentId: string;
  now: Date;
  workspace: WorkspaceContext;
}) {
  const deviceIdHash = await hashLocalRecorderValue(input.deviceId);
  const fallbackIntentIdHash = await hashLocalRecorderValue(
    input.fallbackIntentId,
  );
  const [attempt] = await db
    .select({
      activeTranscriptJob: sql<boolean>`exists (
        select 1 from ${transcriptJobs}
        where ${transcriptJobs.meetingId} = ${meetings.id}
          and ${transcriptJobs.status} in ('queued', 'running', 'completed')
      )`,
      endedAt: meetings.endedAt,
      expiresAt: localRecordingAttempts.expiresAt,
      id: localRecordingAttempts.id,
      meetingUrl: meetings.meetingUrl,
      meetingId: localRecordingAttempts.meetingId,
      recallAudioAsset: sql<boolean>`exists (
        select 1 from ${mediaAssets}
        where ${mediaAssets.meetingId} = ${meetings.id}
          and ${mediaAssets.source} = 'recall'
          and ${mediaAssets.type} = 'audio'
      )`,
      recallRecordingId: meetings.recallRecordingId,
      startedAt: meetings.startedAt,
      status: meetings.status,
      title: meetings.title,
    })
    .from(localRecordingAttempts)
    .innerJoin(meetings, eq(meetings.id, localRecordingAttempts.meetingId))
    .where(
      and(
        eq(localRecordingAttempts.userId, input.workspace.userId),
        eq(localRecordingAttempts.deviceIdHash, deviceIdHash),
        eq(localRecordingAttempts.fallbackIntentIdHash, fallbackIntentIdHash),
      ),
    )
    .limit(1);

  if (!attempt || attempt.expiresAt < input.now) {
    return { claimed: false, reason: "expired_or_missing" as const };
  }

  const eligibility = getLocalRecorderEligibility(
    {
      activeTranscriptJob: attempt.activeTranscriptJob,
      endedAt: attempt.endedAt,
      latestRecallCode: null,
      latestRecallStatus: null,
      meetingId: attempt.meetingId,
      meetingUrl: attempt.meetingUrl,
      recallAudioAsset: attempt.recallAudioAsset,
      recallRecordingId: attempt.recallRecordingId,
      startedAt: attempt.startedAt,
      status: attempt.status,
    },
    { now: input.now },
  );

  if (!eligibility.eligible) {
    return { claimed: false, reason: "no_longer_eligible" as const };
  }

  const activePrimary = await db
    .select({ id: localRecordingAttempts.id })
    .from(localRecordingAttempts)
    .where(
      and(
        eq(localRecordingAttempts.meetingId, attempt.meetingId),
        inArray(localRecordingAttempts.attemptState, activeAttemptStates),
      ),
    )
    .limit(1);

  if (activePrimary[0] && activePrimary[0].id !== attempt.id) {
    return { claimed: false, reason: "already_recording" as const };
  }

  await db
    .update(localRecordingAttempts)
    .set({
      attemptState: "started",
      claimedAt: input.now,
      updatedAt: input.now,
    })
    .where(eq(localRecordingAttempts.id, attempt.id));

  return { claimed: true, meetingTitle: attempt.title };
}

export async function failLocalRecorderIntent(input: {
  deviceId: string;
  errorMessage: string | null;
  fallbackIntentId: string;
  now: Date;
  workspace: WorkspaceContext;
}) {
  const deviceIdHash = await hashLocalRecorderValue(input.deviceId);
  const fallbackIntentIdHash = await hashLocalRecorderValue(
    input.fallbackIntentId,
  );
  const [attempt] = await db
    .select({ id: localRecordingAttempts.id })
    .from(localRecordingAttempts)
    .where(
      and(
        eq(localRecordingAttempts.userId, input.workspace.userId),
        eq(localRecordingAttempts.deviceIdHash, deviceIdHash),
        eq(localRecordingAttempts.fallbackIntentIdHash, fallbackIntentIdHash),
        inArray(localRecordingAttempts.attemptState, ["started", "uploading"]),
      ),
    )
    .limit(1);

  if (!attempt) {
    return { failed: false, reason: "expired_or_missing" as const };
  }

  await db
    .update(localRecordingAttempts)
    .set({
      attemptState: "failed",
      errorMessage: input.errorMessage?.slice(0, 500) ?? null,
      updatedAt: input.now,
    })
    .where(eq(localRecordingAttempts.id, attempt.id));

  return { failed: true };
}

export async function prepareLocalRecorderRecordingUpload(input: {
  clientRecordingId: string;
  deviceId: string;
  fallbackIntentId: string;
  manifest: unknown;
  recordingStartedAt: Date;
  recordingStoppedAt: Date;
  workspace: WorkspaceContext;
}) {
  const now = new Date();
  const attempt = await getUploadableLocalRecorderAttempt(input);

  if (await findExistingLocalRecording({
    clientRecordingId: input.clientRecordingId,
    ownerUserId: input.workspace.userId,
  })) {
    throw new LocalRecorderUploadError("Local recording already uploaded");
  }

  await db
    .update(localRecordingAttempts)
    .set({ attemptState: "uploading", updatedAt: now })
    .where(eq(localRecordingAttempts.id, attempt.id));

  const assetIds = createLocalRecorderAssetIds();
  const keys = buildLocalRecorderObjectKeys({
    assetIds,
    meetingId: attempt.meetingId,
    teamId: input.workspace.teamId,
  });

  const [computerUploadUrl, microphoneUploadUrl, synthesizedUploadUrl] =
    await Promise.all([
      createUploadUrl({
        contentType: localRecorderAudioContentType,
        key: keys.computerAudioKey,
      }),
      createUploadUrl({
        contentType: localRecorderAudioContentType,
        key: keys.microphoneAudioKey,
      }),
      createUploadUrl({
        contentType: localRecorderAudioContentType,
        key: keys.synthesizedAudioKey,
      }),
    ]);

  return {
    assets: {
      computerAudio: {
        assetId: assetIds.computerAudioAssetId,
        contentType: localRecorderAudioContentType,
        uploadUrl: computerUploadUrl,
      },
      microphoneAudio: {
        assetId: assetIds.microphoneAudioAssetId,
        contentType: localRecorderAudioContentType,
        uploadUrl: microphoneUploadUrl,
      },
      synthesizedAudio: {
        assetId: assetIds.synthesizedAudioAssetId,
        contentType: localRecorderAudioContentType,
        uploadUrl: synthesizedUploadUrl,
      },
    },
  };
}

export async function completeLocalRecorderRecordingUpload(input: {
  assets: LocalRecorderUploadAssetIds;
  clientRecordingId: string;
  deviceId: string;
  fallbackIntentId: string;
  manifest: unknown;
  recordingStartedAt: Date;
  recordingStoppedAt: Date;
  workspace: WorkspaceContext;
}) {
  const now = new Date();
  const attempt = await getUploadableLocalRecorderAttempt(input);
  const existingRecording = await findExistingLocalRecording({
    clientRecordingId: input.clientRecordingId,
    ownerUserId: input.workspace.userId,
  });

  if (existingRecording) {
    if (existingRecording.meetingId !== attempt.meetingId) {
      throw new LocalRecorderUploadError(
        "Local recording already belongs to another meeting",
      );
    }

    await queueLocalRecorderTranscriptionForRecording({
      localRecordingId: existingRecording.id,
    });

    return {
      localRecordingId: existingRecording.id,
      meetingId: existingRecording.meetingId,
      queued: true,
    };
  }

  const keys = buildLocalRecorderObjectKeys({
    assetIds: input.assets,
    meetingId: attempt.meetingId,
    teamId: input.workspace.teamId,
  });
  const [
    computerAudioMetadata,
    microphoneAudioMetadata,
    synthesizedAudioMetadata,
  ] = await Promise.all([
    getObjectMetadata({ key: keys.computerAudioKey }),
    getObjectMetadata({ key: keys.microphoneAudioKey }),
    getObjectMetadata({ key: keys.synthesizedAudioKey }),
  ]).catch(() => {
    throw new LocalRecorderUploadError("Uploaded local recording audio not found");
  });
  const env = parseR2Env(process.env);

  await db.insert(mediaAssets).values([
    {
      bucket: env.R2_BUCKET,
      fileSizeBytes: normalizeLocalRecorderFileSizeBytes(
        computerAudioMetadata.contentLength,
      ),
      id: input.assets.computerAudioAssetId,
      meetingId: attempt.meetingId,
      mimeType:
        computerAudioMetadata.contentType ?? localRecorderAudioContentType,
      objectKey: keys.computerAudioKey,
      source: "local_recorder",
      type: "computer_audio",
    },
    {
      bucket: env.R2_BUCKET,
      fileSizeBytes: normalizeLocalRecorderFileSizeBytes(
        microphoneAudioMetadata.contentLength,
      ),
      id: input.assets.microphoneAudioAssetId,
      meetingId: attempt.meetingId,
      mimeType:
        microphoneAudioMetadata.contentType ?? localRecorderAudioContentType,
      objectKey: keys.microphoneAudioKey,
      source: "local_recorder",
      type: "microphone_audio",
    },
    {
      bucket: env.R2_BUCKET,
      fileSizeBytes: normalizeLocalRecorderFileSizeBytes(
        synthesizedAudioMetadata.contentLength,
      ),
      id: input.assets.synthesizedAudioAssetId,
      meetingId: attempt.meetingId,
      mimeType:
        synthesizedAudioMetadata.contentType ?? localRecorderAudioContentType,
      objectKey: keys.synthesizedAudioKey,
      source: "local_recorder",
      type: "synthesized_audio",
    },
  ]);

  const [recording] = await db
    .insert(localRecordings)
    .values({
      clientRecordingId: input.clientRecordingId,
      computerAudioAssetId: input.assets.computerAudioAssetId,
      isPrimary: true,
      localRecordingAttemptId: attempt.id,
      manifest: input.manifest,
      meetingId: attempt.meetingId,
      microphoneAudioAssetId: input.assets.microphoneAudioAssetId,
      ownerUserId: input.workspace.userId,
      recordingStartedAt: input.recordingStartedAt,
      recordingStoppedAt: input.recordingStoppedAt,
      synthesizedAudioAssetId: input.assets.synthesizedAudioAssetId,
      synthesisStatus: "completed",
    })
    .onConflictDoUpdate({
      target: [localRecordings.ownerUserId, localRecordings.clientRecordingId],
      set: {
        updatedAt: now,
      },
    })
    .returning({ id: localRecordings.id });
  const transcriptionEventInput =
    await getOrCreateLocalRecorderTranscriptionEventInput({
      localRecordingId: recording.id,
    });

  await db
    .update(localRecordingAttempts)
    .set({ attemptState: "uploaded", updatedAt: now })
    .where(eq(localRecordingAttempts.id, attempt.id));

  await queueLocalRecorderTranscription(transcriptionEventInput);

  return {
    localRecordingId: recording.id,
    meetingId: attempt.meetingId,
    queued: true,
  };
}

async function queueLocalRecorderTranscriptionForRecording(input: {
  localRecordingId: string;
}) {
  const eventInput = await getOrCreateLocalRecorderTranscriptionEventInput(input);
  await queueLocalRecorderTranscription(eventInput);
}

async function getOrCreateLocalRecorderTranscriptionEventInput(input: {
  localRecordingId: string;
}): Promise<LocalRecorderTranscriptionEventInput> {
  const [recording] = await db
    .select({
      mediaAssetId: mediaAssets.id,
      meetingId: localRecordings.meetingId,
      objectKey: mediaAssets.objectKey,
      transcriptJobId: transcriptJobs.id,
    })
    .from(localRecordings)
    .innerJoin(
      mediaAssets,
      eq(mediaAssets.id, localRecordings.synthesizedAudioAssetId),
    )
    .leftJoin(
      transcriptJobs,
      and(
        eq(transcriptJobs.mediaAssetId, mediaAssets.id),
        eq(transcriptJobs.meetingId, localRecordings.meetingId),
      ),
    )
    .where(eq(localRecordings.id, input.localRecordingId))
    .orderBy(desc(transcriptJobs.createdAt))
    .limit(1);

  if (!recording) {
    throw new LocalRecorderUploadError("Local recording audio not found");
  }

  if (recording.transcriptJobId) {
    return {
      mediaAssetId: recording.mediaAssetId,
      meetingId: recording.meetingId,
      objectKey: recording.objectKey,
      transcriptJobId: recording.transcriptJobId,
    };
  }

  const [job] = await db
    .insert(transcriptJobs)
    .values({
      mediaAssetId: recording.mediaAssetId,
      meetingId: recording.meetingId,
      provider: "elevenlabs",
      status: "queued",
    })
    .returning({ id: transcriptJobs.id });

  return {
    mediaAssetId: recording.mediaAssetId,
    meetingId: recording.meetingId,
    objectKey: recording.objectKey,
    transcriptJobId: job.id,
  };
}

async function queueLocalRecorderTranscription(
  input: LocalRecorderTranscriptionEventInput,
) {
  await inngest.send(buildLocalRecorderTranscriptionEvent(input));
}

function normalizeLocalRecorderFileSizeBytes(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value;
}

async function getUploadableLocalRecorderAttempt(input: {
  clientRecordingId: string;
  deviceId: string;
  fallbackIntentId: string;
  recordingStartedAt: Date;
  workspace: WorkspaceContext;
}) {
  const deviceIdHash = await hashLocalRecorderValue(input.deviceId);
  const fallbackIntentIdHash = await hashLocalRecorderValue(
    input.fallbackIntentId,
  );
  const [attempt] = await db
    .select({
      attemptState: localRecordingAttempts.attemptState,
      expiresAt: localRecordingAttempts.expiresAt,
      id: localRecordingAttempts.id,
      meetingId: localRecordingAttempts.meetingId,
    })
    .from(localRecordingAttempts)
    .where(
      and(
        eq(localRecordingAttempts.userId, input.workspace.userId),
        eq(localRecordingAttempts.deviceIdHash, deviceIdHash),
        eq(localRecordingAttempts.fallbackIntentIdHash, fallbackIntentIdHash),
      ),
    )
    .limit(1);

  if (!attempt) {
    throw new LocalRecorderUploadError("No matching local recording intent");
  }

  if (
    !canUploadLocalRecorderAttempt({
      attemptState: attempt.attemptState,
      intentExpiresAt: attempt.expiresAt,
      intentMeetingId: attempt.meetingId,
      meetingId: attempt.meetingId,
      recordingStartedAt: input.recordingStartedAt,
    })
  ) {
    throw new LocalRecorderUploadError("No matching local recording intent");
  }

  return attempt;
}

export class LocalRecorderUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LocalRecorderUploadError";
  }
}

async function findLocalRecorderAttempt(input: {
  deviceIdHash: string;
  meetingId: string;
  userId: string;
}) {
  const rows = await db
    .select({ id: localRecordingAttempts.id })
    .from(localRecordingAttempts)
    .where(
      and(
        eq(localRecordingAttempts.meetingId, input.meetingId),
        eq(localRecordingAttempts.userId, input.userId),
        eq(localRecordingAttempts.deviceIdHash, input.deviceIdHash),
        inArray(localRecordingAttempts.attemptState, [
          "notified",
          "started",
          "uploading",
          "uploaded",
        ]),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

async function findExistingLocalRecording(input: {
  clientRecordingId: string;
  ownerUserId: string;
}) {
  const rows = await db
    .select({
      id: localRecordings.id,
      meetingId: localRecordings.meetingId,
    })
    .from(localRecordings)
    .where(
      and(
        eq(localRecordings.ownerUserId, input.ownerUserId),
        eq(localRecordings.clientRecordingId, input.clientRecordingId),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

function createLocalRecorderAssetIds(): LocalRecorderUploadAssetIds {
  return {
    computerAudioAssetId: crypto.randomUUID(),
    microphoneAudioAssetId: crypto.randomUUID(),
    synthesizedAudioAssetId: crypto.randomUUID(),
  };
}

function buildLocalRecorderObjectKeys(input: {
  assetIds: LocalRecorderUploadAssetIds;
  meetingId: string;
  teamId: string;
}) {
  return {
    computerAudioKey: buildMeetingObjectKey({
      assetId: input.assetIds.computerAudioAssetId,
      extension: "wav",
      meetingId: input.meetingId,
      teamId: input.teamId,
    }),
    microphoneAudioKey: buildMeetingObjectKey({
      assetId: input.assetIds.microphoneAudioAssetId,
      extension: "wav",
      meetingId: input.meetingId,
      teamId: input.teamId,
    }),
    synthesizedAudioKey: buildMeetingObjectKey({
      assetId: input.assetIds.synthesizedAudioAssetId,
      extension: "wav",
      meetingId: input.meetingId,
      teamId: input.teamId,
    }),
  };
}

function createFallbackIntentId() {
  const bytes = crypto.getRandomValues(new Uint8Array(intentTokenBytes));

  return Buffer.from(bytes).toString("base64url");
}

async function hashLocalRecorderValue(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );

  return Buffer.from(digest).toString("base64url");
}
