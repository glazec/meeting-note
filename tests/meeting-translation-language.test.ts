import { describe, expect, it } from "vitest";

import { shouldAutoTranslateTranscript } from "@/lib/meeting-translation-language";

describe("meeting translation language gate", () => {
  it("auto translates non-Chinese transcript text", () => {
    expect(
      shouldAutoTranslateTranscript(
        "We discussed fund performance, OpenAI API costs, and next steps.",
      ),
    ).toBe(true);
  });

  it("does not auto translate mostly Chinese transcript text", () => {
    expect(
      shouldAutoTranslateTranscript(
        "今天我们先聊 IOSG portfolio，然后看 OpenAI API 成本和下周安排。",
      ),
    ).toBe(false);
  });
});
