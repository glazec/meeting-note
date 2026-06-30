import { describe, expect, it } from "vitest";

import {
  buildChineseTranslationMessages,
  parseChineseTranslationResponse,
} from "@/lib/meeting-translation";

describe("meeting translation", () => {
  it("builds a concise polished Chinese translation prompt from transcript rows", () => {
    expect(
      buildChineseTranslationMessages([
        { id: "segment_1", text: "Hello team" },
        { id: "segment_2", text: "We need to check Solana liquidity." },
      ]),
    ).toEqual([
      {
        role: "system",
        content:
          "Translate meeting transcript segments into polished, concise Chinese. Remove filler words such as 然后 when they do not change meaning. Preserve speaker intent, team tone, product names, company names, numbers, and tickers. Return only JSON. Do not wrap the JSON in markdown fences.",
      },
      {
        role: "user",
        content:
          '{"segments":[{"id":"segment_1","text":"Hello team"},{"id":"segment_2","text":"We need to check Solana liquidity."}]}',
      },
    ]);
  });

  it("parses valid JSON translations and ignores unknown segment ids", () => {
    expect(
      parseChineseTranslationResponse({
        content:
          '{"translations":[{"id":"segment_1","text":"大家好"},{"id":"unknown","text":"忽略"}]}',
        segmentIds: ["segment_1"],
      }),
    ).toEqual([{ id: "segment_1", text: "大家好" }]);
  });

  it("parses JSON translations wrapped in a markdown code fence", () => {
    expect(
      parseChineseTranslationResponse({
        content:
          '```json\n{"translations":[{"id":"segment_1","text":"你好。"}]}\n```',
        segmentIds: ["segment_1"],
      }),
    ).toEqual([{ id: "segment_1", text: "你好。" }]);
  });

  it("accepts translated rows returned under the input segments key", () => {
    expect(
      parseChineseTranslationResponse({
        content: '{"segments":[{"id":"segment_1","text":"你好。"}]}',
        segmentIds: ["segment_1"],
      }),
    ).toEqual([{ id: "segment_1", text: "你好。" }]);
  });
});
