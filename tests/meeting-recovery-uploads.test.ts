import { afterEach, describe, expect, it, vi } from "vitest";

import { parseManualTranscriptText } from "@/lib/manual-transcript-parser";

const { insert, limit, returning, set, values, where } = vi.hoisted(() => ({
  insert: vi.fn(),
  limit: vi.fn(),
  returning: vi.fn(),
  set: vi.fn(),
  values: vi.fn(),
  where: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  db: {
    delete: () => ({ where }),
    insert,
    select: () => ({ from: () => ({ where: () => ({ limit }) }) }),
    update: () => ({ set }),
  },
}));

vi.mock("@/lib/meeting-write-policy", () => ({
  getManageableMeetingCondition: vi.fn(() => "manageable"),
}));

vi.mock("@/lib/r2", () => ({
  parseR2Env: vi.fn(() => ({ R2_BUCKET: "meeting-audio" })),
}));

const workspace = {
  canCreateMeetings: true,
  domain: "example.com",
  teamId: "team_123",
  userId: "user_123",
};

describe("parseManualTranscriptText", () => {
  it("defaults transcript text without speaker names to Speaker 1", () => {
    expect(parseManualTranscriptText("This transcript has no speaker label.")).toEqual([
      {
        speaker: "Speaker 1",
        startMs: 0,
        text: "This transcript has no speaker label.",
      },
    ]);
  });

  it("keeps speaker labels when they are present", () => {
    expect(parseManualTranscriptText("Alice: Hello\n\nBob: Thanks")).toEqual([
      {
        speaker: "Alice",
        startMs: 0,
        text: "Hello",
      },
      {
        speaker: "Bob",
        startMs: 1000,
        text: "Thanks",
      },
    ]);
  });
});

describe("meeting recovery uploads", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("creates an audio asset and queued transcript job", async () => {
    limit.mockResolvedValue([{ id: "meeting_123" }]);
    values.mockReturnValue({ returning });
    insert.mockReturnValue({ values });
    returning
      .mockResolvedValueOnce([{ id: "asset_123" }])
      .mockResolvedValueOnce([{ id: "job_123" }]);
    set.mockReturnValue({ where });
    where.mockResolvedValue(undefined);
    const { completeMeetingAudioUpload } = await import(
      "@/lib/meeting-recovery-uploads"
    );

    await expect(
      completeMeetingAudioUpload({
        fileSizeBytes: 1234,
        meetingId: "meeting_123",
        mimeType: "audio/mp4",
        objectKey: "uploads/recovery.m4a",
        workspace,
      }),
    ).resolves.toEqual({
      mediaAssetId: "asset_123",
      meetingId: "meeting_123",
      objectKey: "uploads/recovery.m4a",
      transcriptJobId: "job_123",
    });
    expect(values).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        bucket: "meeting-audio",
        meetingId: "meeting_123",
        type: "audio",
      }),
    );
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "processing" }),
    );
  });

  it("replaces transcript segments and marks a manual recovery ready", async () => {
    limit.mockResolvedValue([{ id: "meeting_123" }]);
    values.mockReturnValue({ returning });
    insert.mockReturnValue({ values });
    returning.mockResolvedValueOnce([{ id: "job_123" }]);
    set.mockReturnValue({ where });
    where.mockResolvedValue(undefined);
    const { completeManualTranscriptUpload } = await import(
      "@/lib/meeting-recovery-uploads"
    );

    await expect(
      completeManualTranscriptUpload({
        meetingId: "meeting_123",
        transcriptText: "Alice: Hello\n\nBob: Hi",
        workspace,
      }),
    ).resolves.toEqual({
      meetingId: "meeting_123",
      segmentCount: 2,
      transcriptJobId: "job_123",
    });
    expect(values).toHaveBeenCalledWith([
      expect.objectContaining({ speaker: "Alice", text: "Hello" }),
      expect.objectContaining({ speaker: "Bob", text: "Hi" }),
    ]);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "ready" }),
    );
  });

  it("rejects recovery when the meeting is outside the write boundary", async () => {
    limit.mockResolvedValue([]);
    const { completeMeetingAudioUpload, MeetingRecoveryUploadError } =
      await import("@/lib/meeting-recovery-uploads");

    await expect(
      completeMeetingAudioUpload({
        meetingId: "meeting_123",
        objectKey: "uploads/recovery.mp3",
        workspace,
      }),
    ).rejects.toBeInstanceOf(MeetingRecoveryUploadError);
    expect(insert).not.toHaveBeenCalled();
  });
});
