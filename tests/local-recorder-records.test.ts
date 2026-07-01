import { afterEach, describe, expect, it, vi } from "vitest";

const { db, getObjectMetadata, inngestSend } = vi.hoisted(() => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    transaction: vi.fn(),
    update: vi.fn(),
  },
  getObjectMetadata: vi.fn(),
  inngestSend: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  db,
}));

vi.mock("@/inngest/client", () => ({
  inngest: {
    send: inngestSend,
  },
}));

vi.mock("@/lib/r2", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/r2")>();

  return {
    ...actual,
    getObjectMetadata,
    parseR2Env: () => ({ R2_BUCKET: "meeting-audio" }),
  };
});

import {
  buildLocalRecorderTranscriptionEvent,
  completeLocalRecorderRecordingUpload,
  isLocalRecorderCandidateVisibleInLookup,
  isLocalRecorderPrimaryClaimConflict,
} from "@/lib/local-recorder-records";

function selectRows(rows: unknown[]) {
  const chain = {
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    limit: vi.fn().mockResolvedValue(rows),
    orderBy: vi.fn(() => chain),
    where: vi.fn(() => chain),
  };

  return chain;
}

describe("local recorder records", () => {
  afterEach(() => {
    db.insert.mockReset();
    db.select.mockReset();
    db.transaction.mockReset();
    db.update.mockReset();
    getObjectMetadata.mockReset();
    inngestSend.mockReset();
  });

  it("builds a deterministic transcription event for completion retries", () => {
    expect(
      buildLocalRecorderTranscriptionEvent({
        mediaAssetId: "11111111-1111-4111-8111-111111111111",
        meetingId: "22222222-2222-4222-8222-222222222222",
        objectKey:
          "teams/team_123/meetings/22222222-2222-4222-8222-222222222222/assets/11111111-1111-4111-8111-111111111111.wav",
        transcriptJobId: "33333333-3333-4333-8333-333333333333",
      }),
    ).toEqual({
      id: "local-recorder-transcribe-33333333-3333-4333-8333-333333333333",
      name: "meeting/transcribe.audio",
      data: {
        mediaAssetId: "11111111-1111-4111-8111-111111111111",
        meetingId: "22222222-2222-4222-8222-222222222222",
        objectKey:
          "teams/team_123/meetings/22222222-2222-4222-8222-222222222222/assets/11111111-1111-4111-8111-111111111111.wav",
        transcriptJobId: "33333333-3333-4333-8333-333333333333",
      },
    });
  });

  it("detects concurrent primary local recorder claim conflicts", () => {
    expect(
      isLocalRecorderPrimaryClaimConflict({
        code: "23505",
        constraint: "local_recording_attempts_primary_active_unique",
      }),
    ).toBe(true);
    expect(
      isLocalRecorderPrimaryClaimConflict({
        code: "23505",
        constraint: "other_unique_index",
      }),
    ).toBe(false);
  });

  it("completes uploaded local recorder rows without a database transaction", async () => {
    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const updateSet = vi.fn(() => ({ where: updateWhere }));
    const insertMediaOnConflictDoNothing = vi
      .fn()
      .mockResolvedValue(undefined);
    const insertMediaValues = vi.fn(() => ({
      onConflictDoNothing: insertMediaOnConflictDoNothing,
    }));
    const recordingReturning = vi
      .fn()
      .mockResolvedValue([{ id: "55555555-5555-4555-8555-555555555555" }]);
    const recordingOnConflictDoUpdate = vi.fn(() => ({
      returning: recordingReturning,
    }));
    const insertRecordingValues = vi.fn(() => ({
      onConflictDoUpdate: recordingOnConflictDoUpdate,
    }));
    const jobReturning = vi
      .fn()
      .mockResolvedValue([{ id: "66666666-6666-4666-8666-666666666666" }]);
    const insertJobValues = vi.fn(() => ({ returning: jobReturning }));

    db.transaction.mockRejectedValue(new Error("transactions are unavailable"));
    db.update.mockReturnValue({ set: updateSet });
    db.insert
      .mockReturnValueOnce({ values: insertMediaValues })
      .mockReturnValueOnce({ values: insertRecordingValues })
      .mockReturnValueOnce({ values: insertJobValues });
    db.select
      .mockReturnValueOnce(
        selectRows([
          {
            attemptState: "uploading",
            expiresAt: new Date("2026-07-01T13:00:00.000Z"),
            id: "44444444-4444-4444-8444-444444444444",
            meetingId: "22222222-2222-4222-8222-222222222222",
          },
        ]),
      )
      .mockReturnValueOnce(selectRows([]))
      .mockReturnValueOnce(
        selectRows([
          {
            mediaAssetId: "33333333-3333-4333-8333-333333333333",
            meetingId: "22222222-2222-4222-8222-222222222222",
            objectKey:
              "teams/team_123/meetings/22222222-2222-4222-8222-222222222222/assets/33333333-3333-4333-8333-333333333333.wav",
            transcriptJobId: null,
          },
        ]),
      );
    getObjectMetadata.mockResolvedValue({
      contentLength: 192044,
      contentType: "audio/wav",
    });

    await expect(
      completeLocalRecorderRecordingUpload({
        assets: {
          computerAudioAssetId: "11111111-1111-4111-8111-111111111111",
          microphoneAudioAssetId: "22222222-2222-4222-8222-222222222222",
          synthesizedAudioAssetId: "33333333-3333-4333-8333-333333333333",
        },
        clientRecordingId: "client_recording_123",
        deviceId: "device_123",
        fallbackIntentId: "intent_123",
        manifest: { appVersion: "0.1.0" },
        recordingStartedAt: new Date("2026-07-01T12:00:00.000Z"),
        recordingStoppedAt: new Date("2026-07-01T12:01:00.000Z"),
        workspace: {
          canCreateMeetings: true,
          domain: "",
          teamId: "team_123",
          userId: "user_123",
        },
      }),
    ).resolves.toEqual({
      localRecordingId: "55555555-5555-4555-8555-555555555555",
      meetingId: "22222222-2222-4222-8222-222222222222",
      queued: true,
    });
    expect(db.transaction).not.toHaveBeenCalled();
    expect(insertMediaValues).toHaveBeenCalledOnce();
    expect(insertMediaOnConflictDoNothing).toHaveBeenCalledOnce();
    expect(updateWhere).toHaveBeenCalledOnce();
    expect(inngestSend).toHaveBeenCalledOnce();
  });

  it("excludes future and unscheduled meetings from the missed recorder lookup", () => {
    const now = new Date("2026-07-01T12:00:00.000Z");

    expect(
      isLocalRecorderCandidateVisibleInLookup({
        now,
        startedAt: new Date("2026-07-01T11:58:00.000Z"),
      }),
    ).toBe(true);
    expect(
      isLocalRecorderCandidateVisibleInLookup({
        now,
        startedAt: new Date("2026-07-01T12:10:00.000Z"),
      }),
    ).toBe(false);
    expect(
      isLocalRecorderCandidateVisibleInLookup({
        now,
        startedAt: null,
      }),
    ).toBe(false);
  });
});
