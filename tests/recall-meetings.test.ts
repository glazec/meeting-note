import { describe, expect, it, vi } from "vitest";

import { buildRecallMeetingUpdate } from "@/lib/recall-meetings";

vi.mock("@/db/client", () => ({
  db: {},
}));

describe("buildRecallMeetingUpdate", () => {
  it("marks meetings as processing when Recall reports recording done", () => {
    expect(
      buildRecallMeetingUpdate({
        eventType: "bot.status_change",
        botId: "bot_123",
        recordingId: null,
        meetingUrl: null,
        statusCode: "done",
        code: "done",
        subCode: "recording_done",
        updatedAt: "2026-06-23T12:00:00Z",
        metadata: {
          meetingId: "11111111-1111-4111-8111-111111111111",
        },
      }),
    ).toEqual({
      action: "update",
      meetingId: "11111111-1111-4111-8111-111111111111",
      recallBotId: "bot_123",
      recallRecordingId: null,
      status: "processing",
    });
  });

  it("marks meetings as failed when Recall reports an error", () => {
    expect(
      buildRecallMeetingUpdate({
        eventType: "bot.status_change",
        botId: "bot_123",
        recordingId: null,
        meetingUrl: null,
        statusCode: "fatal",
        code: "fatal",
        subCode: "meeting_not_found",
        updatedAt: null,
        metadata: {
          meetingId: "11111111-1111-4111-8111-111111111111",
        },
      }),
    ).toEqual({
      action: "update",
      meetingId: "11111111-1111-4111-8111-111111111111",
      recallBotId: "bot_123",
      recallRecordingId: null,
      status: "failed",
    });
  });

  it("skips Recall events without local meeting metadata", () => {
    expect(
      buildRecallMeetingUpdate({
        eventType: "bot.status_change",
        botId: "bot_123",
        recordingId: null,
        meetingUrl: null,
        statusCode: "done",
        code: "done",
        subCode: "recording_done",
        updatedAt: null,
        metadata: {},
      }),
    ).toEqual({
      action: "skip",
      reason: "missing_meeting_id",
    });
  });
});
