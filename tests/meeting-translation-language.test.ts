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

  it("does not auto translate mostly English text when English is selected", () => {
    expect(
      shouldAutoTranslateTranscript(
        "We discussed fund performance, OpenAI API costs, and next steps.",
        "en",
      ),
    ).toBe(false);
  });

  it("translates Chinese text when English is selected", () => {
    expect(
      shouldAutoTranslateTranscript(
        "今天我们先聊基金表现，然后讨论下周安排和后续工作。",
        "en",
      ),
    ).toBe(true);
  });

  it("translates Spanish text when English is selected", () => {
    expect(
      shouldAutoTranslateTranscript(
        "Hoy discutimos el rendimiento del fondo y los próximos pasos.",
        "en",
      ),
    ).toBe(true);
  });

  it("translates Traditional Chinese when Simplified Chinese is selected", () => {
    expect(
      shouldAutoTranslateTranscript(
        "今天我們討論基金表現和下一步的工作安排。",
        "zh-CN",
      ),
    ).toBe(true);
  });
});
