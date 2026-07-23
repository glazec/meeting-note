import { afterEach, describe, expect, it, vi } from "vitest";

const { execute, select, update } = vi.hoisted(() => ({
  execute: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  db: {
    execute,
    select,
    update,
  },
}));

vi.mock("@/lib/meeting-participant-timeline", () => ({
  listMeetingParticipantTimeline: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/vendors/twenty", () => ({
  getTwentyCrmCompanyDomains: vi.fn().mockResolvedValue([]),
}));

describe("applyElevenLabsTranscriptEvent", () => {
  afterEach(() => {
    select.mockReset();
    execute.mockReset();
    update.mockReset();
    vi.resetModules();
  });

  it("marks the transcript job and meeting failed when ElevenLabs returns no transcript text", async () => {
    execute.mockResolvedValue({
      rows: [{ id: "22222222-2222-4222-8222-222222222222" }],
    });
    const limit = vi.fn().mockResolvedValue([
      {
        attendeeEmails: [],
        calendarMeetingUrl: null,
        meetingUrl: null,
        ownerEmail: null,
      },
    ]);
    select.mockReturnValue({
      from: () => ({
        leftJoin: () => ({
          leftJoin: () => ({
            where: () => ({ limit }),
          }),
        }),
      }),
    });
    const transcriptWhere = vi.fn().mockResolvedValue(undefined);
    const transcriptSet = vi.fn().mockReturnValue({ where: transcriptWhere });
    const meetingWhere = vi.fn().mockResolvedValue(undefined);
    const meetingSet = vi.fn().mockReturnValue({ where: meetingWhere });
    update
      .mockReturnValueOnce({ set: transcriptSet })
      .mockReturnValueOnce({ set: meetingSet });

    const { applyElevenLabsTranscriptEvent } =
      await import("@/lib/elevenlabs-transcripts");

    await expect(
      applyElevenLabsTranscriptEvent({
        eventType: "speech_to_text_transcription",
        type: "speech_to_text_transcription",
        requestId: "req_123",
        transcriptId: null,
        status: "completed",
        transcriptionText: "",
        transcriptionWords: [],
        metadata: {
          meetingId: "11111111-1111-4111-8111-111111111111",
          transcriptJobId: "22222222-2222-4222-8222-222222222222",
        },
      }),
    ).resolves.toMatchObject({ action: "fail" });

    expect(transcriptSet).toHaveBeenCalledWith({
      errorMessage: "No transcript text returned",
      providerJobId: "req_123",
      status: "failed",
      updatedAt: expect.any(Date),
    });
    expect(meetingSet).toHaveBeenCalledWith({
      status: "failed",
      updatedAt: expect.any(Date),
    });
  });

  it("ignores a delayed event for a superseded transcript job", async () => {
    execute.mockResolvedValue({
      rows: [{ id: "33333333-3333-4333-8333-333333333333" }],
    });
    const { applyElevenLabsTranscriptEvent } =
      await import("@/lib/elevenlabs-transcripts");

    await expect(
      applyElevenLabsTranscriptEvent({
        eventType: "speech_to_text_transcription",
        type: "speech_to_text_transcription",
        requestId: "req_old",
        transcriptId: null,
        status: "completed",
        transcriptionText: "Old transcript",
        transcriptionWords: [],
        metadata: {
          meetingId: "11111111-1111-4111-8111-111111111111",
          transcriptJobId: "22222222-2222-4222-8222-222222222222",
        },
      }),
    ).resolves.toEqual({
      action: "skip",
      reason: "superseded_transcript_job",
    });
    expect(select).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});

describe("getTranscriptSegmentOffsetMs", () => {
  it("places a resumed transcript at its recording start within the meeting", async () => {
    const { getTranscriptSegmentOffsetMs } =
      await import("@/lib/elevenlabs-transcripts");

    expect(
      getTranscriptSegmentOffsetMs({
        currentJobId: "22222222-2222-4222-8222-222222222222",
        firstRecordingStartedAt: "2026-07-22T17:00:58.000Z",
        mode: "append",
        recordingStartedAt: "2026-07-22T17:20:58.000Z",
      }),
    ).toBe(1_200_000);
  });
});
