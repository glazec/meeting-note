import { z } from "zod";

type SegmentForTranslation = {
  id: string;
  text: string;
};

const translatedRowsSchema = z.array(
  z.object({
    id: z.string().min(1),
    text: z.string().trim().min(1),
  }),
);

export function buildChineseTranslationMessages(
  segments: SegmentForTranslation[],
) {
  return [
    {
      role: "system" as const,
      content:
        "Translate meeting transcript segments into polished, concise Chinese. Remove filler words such as 然后 when they do not change meaning. Preserve speaker intent, team tone, product names, company names, numbers, and tickers. Return only JSON. Do not wrap the JSON in markdown fences.",
    },
    {
      role: "user" as const,
      content: JSON.stringify({
        segments: segments.map((segment) => ({
          id: segment.id,
          text: segment.text,
        })),
      }),
    },
  ];
}

export function parseChineseTranslationResponse(input: {
  content: string;
  segmentIds: string[];
}) {
  const allowedIds = new Set(input.segmentIds);
  const parsedJson = JSON.parse(extractJsonObject(input.content));
  const translatedRows = getTranslatedRows(parsedJson);

  return translatedRows.filter((translation) => allowedIds.has(translation.id));
}

function extractJsonObject(content: string) {
  const trimmedContent = content.trim();

  if (trimmedContent.startsWith("{")) {
    return trimmedContent;
  }

  const fencedJson = trimmedContent.match(
    /^```(?:json)?\s*([\s\S]*?)\s*```$/i,
  );

  if (fencedJson?.[1]) {
    return fencedJson[1].trim();
  }

  const objectMatch = trimmedContent.match(/\{[\s\S]*\}/);

  if (objectMatch?.[0]) {
    return objectMatch[0];
  }

  return trimmedContent;
}

function getTranslatedRows(input: unknown) {
  const parsedObject = z
    .object({
      translations: translatedRowsSchema.optional(),
      segments: translatedRowsSchema.optional(),
    })
    .parse(input);

  return parsedObject.translations ?? parsedObject.segments ?? [];
}
