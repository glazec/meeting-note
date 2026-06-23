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
});
