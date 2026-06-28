import { describe, expect, it, vi } from "vitest";

import { parseRecallParticipantTimeline } from "@/lib/meeting-participant-timeline";

vi.mock("@/db/client", () => ({
  db: {},
}));

describe("parseRecallParticipantTimeline", () => {
  it("parses Recall speaker timeline download schema", () => {
    expect(
      parseRecallParticipantTimeline([
        {
          participant: {
            id: 7,
            name: "Alice Chen",
            email: "alice@example.com",
          },
          start_timestamp: {
            absolute: "2026-06-27T16:00:12.500Z",
            relative: 12.5,
          },
          end_timestamp: {
            absolute: "2026-06-27T16:00:18.250Z",
            relative: 18.25,
          },
        },
      ]),
    ).toEqual([
      {
        participantId: "7",
        name: "Alice Chen",
        email: "alice@example.com",
        startMs: 12500,
        endMs: 18250,
      },
    ]);
  });
});
