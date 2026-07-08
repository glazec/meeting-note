import { describe, expect, it } from "vitest";

import { parseManualTranscriptText } from "@/lib/manual-transcript-parser";

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
