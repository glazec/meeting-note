import { afterEach, describe, expect, it, vi } from "vitest";

const {
  createElevenLabsTranscriptJob,
  completeUploadedVideoConversion,
  convertVideoObjectToAudio,
  createReadUrl,
  scheduleRecallBot,
  syncRecallCalendarEventsForAllConnectedUsers,
  update,
} =
  vi.hoisted(() => ({
    createElevenLabsTranscriptJob: vi.fn(),
    completeUploadedVideoConversion: vi.fn(),
    convertVideoObjectToAudio: vi.fn(),
    createReadUrl: vi.fn(),
    scheduleRecallBot: vi.fn(),
    syncRecallCalendarEventsForAllConnectedUsers: vi.fn(),
    update: vi.fn(),
  }));

vi.mock("@/db/client", () => ({
  db: {
    update,
  },
}));

vi.mock("@/lib/r2", () => ({
  createReadUrl,
}));

vi.mock("@/lib/media-conversion", () => ({
  convertVideoObjectToAudio,
}));

vi.mock("@/lib/transcription-records", () => ({
  completeUploadedVideoConversion,
}));

vi.mock("@/lib/vendors/elevenlabs", () => ({
  createElevenLabsTranscriptJob,
}));

vi.mock("@/lib/vendors/recall", () => ({
  scheduleRecallBot,
}));

vi.mock("@/lib/recall-calendar-bulk-sync", () => ({
  syncRecallCalendarEventsForAllConnectedUsers,
}));

type RunnableInngestFunction = {
  fn: (input?: unknown) => Promise<unknown>;
};

describe("Inngest functions", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("registers non-calendar background workers", async () => {
    const { functions } = await import("@/inngest/functions");

    expect(
      functions.map((fn) => ({
        id: fn.opts.id,
        triggers: fn.opts.triggers,
      })),
    ).toEqual([
      {
        id: "schedule-meeting-bot",
        triggers: [{ event: "meeting/schedule.bot" }],
      },
      {
        id: "transcribe-audio",
        triggers: [{ event: "meeting/transcribe.audio" }],
      },
      {
        id: "convert-video-to-audio",
        triggers: [{ event: "meeting/convert.video-to-audio" }],
      },
      {
        id: "enrich-transcript",
        triggers: [{ event: "meeting/enrich.transcript" }],
      },
      {
        id: "send-location-reminders",
        triggers: [
          { event: "meeting/send.location-reminders" },
          { cron: "* * * * *" },
        ],
      },
      {
        id: "sync-recall-calendars-hourly",
        triggers: [{ cron: "0 * * * *" }],
      },
      {
        id: "reconcile-stale-meeting-jobs",
        triggers: [{ cron: "*/15 * * * *" }],
      },
    ]);
  });

  it("runs the hourly Recall Calendar repair sync", async () => {
    const syncResult = {
      connectionCount: 2,
      failedConnectionCount: 0,
      failures: [],
      syncedConnectionCount: 2,
      syncedEventCount: 7,
    };
    syncRecallCalendarEventsForAllConnectedUsers.mockResolvedValue(syncResult);

    const { syncRecallCalendarsHourly } = await import("@/inngest/functions");

    await expect(
      (syncRecallCalendarsHourly as unknown as RunnableInngestFunction).fn(),
    ).resolves.toEqual(syncResult);
    expect(syncRecallCalendarEventsForAllConnectedUsers).toHaveBeenCalledTimes(1);
  });

  it("marks the transcript job failed when the final transcription attempt fails", async () => {
    const error = new Error("ElevenLabs transcript job failed with 400 Bad Request");
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where });
    update.mockReturnValue({ set });
    createReadUrl.mockResolvedValue("https://cdn.example.com/audio.mp3");
    createElevenLabsTranscriptJob.mockRejectedValue(error);
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com");

    const { transcribeAudio } = await import("@/inngest/functions");

    await expect(
      (transcribeAudio as unknown as RunnableInngestFunction).fn({
        attempt: 4,
        event: {
          data: {
            objectKey: "users/user_123/uploads/audio.mp3",
            transcriptJobId: "22222222-2222-4222-8222-222222222222",
          },
        },
      }),
    ).rejects.toThrow("ElevenLabs transcript job failed with 400 Bad Request");

    expect(set).toHaveBeenCalledWith({
      errorMessage: "ElevenLabs transcript job failed with 400 Bad Request",
      status: "failed",
      updatedAt: expect.any(Date),
    });
    expect(where).toHaveBeenCalledTimes(1);
  });

  it("converts video to audio before queuing transcription", async () => {
    const send = vi.fn().mockResolvedValue({ ids: ["evt_789"] });
    convertVideoObjectToAudio.mockResolvedValue(undefined);
    completeUploadedVideoConversion.mockResolvedValue({
      meetingId: "22222222-2222-4222-8222-222222222222",
      mediaAssetId: "44444444-4444-4444-8444-444444444444",
      objectKey:
        "teams/team_123/meetings/22222222-2222-4222-8222-222222222222/assets/44444444-4444-4444-8444-444444444444.mp3",
      transcriptJobId: "55555555-5555-4555-8555-555555555555",
    });

    const { convertVideoToAudio } = await import("@/inngest/functions");

    await expect(
      (convertVideoToAudio as unknown as RunnableInngestFunction).fn({
        event: {
          data: {
            meetingId: "22222222-2222-4222-8222-222222222222",
            sourceMediaAssetId: "33333333-3333-4333-8333-333333333333",
            sourceObjectKey: "users/user_123/uploads/video.mp4",
            audioMediaAssetId: "44444444-4444-4444-8444-444444444444",
            audioObjectKey:
              "teams/team_123/meetings/22222222-2222-4222-8222-222222222222/assets/44444444-4444-4444-8444-444444444444.mp3",
            transcriptJobId: "55555555-5555-4555-8555-555555555555",
          },
        },
        step: {
          sendEvent: send,
        },
      }),
    ).resolves.toEqual({ ids: ["evt_789"] });

    expect(convertVideoObjectToAudio).toHaveBeenCalledWith({
      sourceObjectKey: "users/user_123/uploads/video.mp4",
      audioObjectKey:
        "teams/team_123/meetings/22222222-2222-4222-8222-222222222222/assets/44444444-4444-4444-8444-444444444444.mp3",
    });
    expect(completeUploadedVideoConversion).toHaveBeenCalledWith({
      meetingId: "22222222-2222-4222-8222-222222222222",
      audioMediaAssetId: "44444444-4444-4444-8444-444444444444",
      audioObjectKey:
        "teams/team_123/meetings/22222222-2222-4222-8222-222222222222/assets/44444444-4444-4444-8444-444444444444.mp3",
      transcriptJobId: "55555555-5555-4555-8555-555555555555",
    });
    expect(send).toHaveBeenCalledWith("queue-audio-transcription", {
      name: "meeting/transcribe.audio",
      data: {
        meetingId: "22222222-2222-4222-8222-222222222222",
        mediaAssetId: "44444444-4444-4444-8444-444444444444",
        objectKey:
          "teams/team_123/meetings/22222222-2222-4222-8222-222222222222/assets/44444444-4444-4444-8444-444444444444.mp3",
        transcriptJobId: "55555555-5555-4555-8555-555555555555",
      },
    });
  });
});
