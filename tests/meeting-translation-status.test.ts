import { describe, expect, it } from "vitest";

import { buildMeetingTranslationSummary } from "@/lib/meeting-translation-status";

describe("meeting translation status", () => {
  it("marks active translation work with visible progress", () => {
    expect(
      buildMeetingTranslationSummary({
        status: "running",
        totalSegments: 672,
        translatedSegments: 0,
      }),
    ).toEqual({
      hasTranslations: false,
      status: "running",
      totalSegments: 672,
      translatedSegments: 0,
    });
  });

  it("marks translation complete when all segments have translations", () => {
    expect(
      buildMeetingTranslationSummary({
        status: null,
        totalSegments: 2,
        translatedSegments: 2,
      }),
    ).toMatchObject({
      hasTranslations: true,
      status: "completed",
    });
  });

  it("keeps old ready meetings honest when translation has not started", () => {
    expect(
      buildMeetingTranslationSummary({
        status: null,
        totalSegments: 672,
        translatedSegments: 0,
      }),
    ).toMatchObject({
      hasTranslations: false,
      status: "not_started",
    });
  });

  it("marks Chinese transcripts as not needing translation", () => {
    expect(
      buildMeetingTranslationSummary({
        status: "completed",
        totalSegments: 672,
        translatedSegments: 0,
      }),
    ).toMatchObject({
      hasTranslations: false,
      status: "not_needed",
    });
  });
});
