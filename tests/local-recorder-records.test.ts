import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({
  db: {},
}));

vi.mock("@/inngest/client", () => ({
  inngest: {
    send: vi.fn(),
  },
}));

import { buildLocalRecorderTranscriptionEvent } from "@/lib/local-recorder-records";

describe("local recorder records", () => {
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
});
