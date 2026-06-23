import { describe, expect, it } from "vitest";

import { buildMeetingObjectKey } from "@/lib/r2";

describe("buildMeetingObjectKey", () => {
  it("builds the R2 object key for a meeting asset", () => {
    expect(
      buildMeetingObjectKey({
        teamId: "team_123",
        meetingId: "meeting_456",
        assetId: "asset_789",
        extension: "mp3",
      }),
    ).toBe("teams/team_123/meetings/meeting_456/assets/asset_789.mp3");
  });

  it("rejects traversal shaped segments", () => {
    expect(() =>
      buildMeetingObjectKey({
        teamId: "../other",
        meetingId: "meeting_456",
        assetId: "asset_789",
        extension: "mp3",
      }),
    ).toThrow("Unsafe object key segment");
  });

  it("rejects slash separated segments", () => {
    expect(() =>
      buildMeetingObjectKey({
        teamId: "team_123",
        meetingId: "a/b",
        assetId: "asset_789",
        extension: "mp3",
      }),
    ).toThrow("Unsafe object key segment");
  });
});
