import { describe, expect, it } from "vitest";

import { shouldAutoRefreshMeeting } from "@/components/meeting-auto-refresh";

describe("shouldAutoRefreshMeeting", () => {
  it("polls while a transcript is still processing and empty", () => {
    expect(
      shouldAutoRefreshMeeting({
        meetingStatus: "processing",
        segmentCount: 0,
        transcriptJobStatus: "running",
      }),
    ).toBe(true);
  });

  it("stops polling after transcript segments are available", () => {
    expect(
      shouldAutoRefreshMeeting({
        meetingStatus: "processing",
        segmentCount: 3,
        transcriptJobStatus: "running",
      }),
    ).toBe(false);
  });

  it("does not poll terminal statuses", () => {
    expect(
      shouldAutoRefreshMeeting({
        meetingStatus: "failed",
        segmentCount: 0,
        transcriptJobStatus: "failed",
      }),
    ).toBe(false);
  });
});
