import { z } from "zod";

const exaEnvSchema = z.object({
  EXA_API_KEY: z.string().trim().min(1),
});

const exaAnswerResponseSchema = z.object({
  answer: z.string().trim().min(1),
  citations: z
    .array(
      z.object({
        title: z.string().optional().nullable(),
        url: z.string().url(),
        publishedDate: z.string().optional().nullable(),
      }),
    )
    .default([]),
});

export async function searchWebWithExa(query: string) {
  const env = exaEnvSchema.parse(process.env);
  const normalizedQuery = z.string().trim().min(1).parse(query);
  const response = await fetch("https://api.exa.ai/answer", {
    method: "POST",
    signal: AbortSignal.timeout(30_000),
    headers: {
      "x-api-key": env.EXA_API_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      query: normalizedQuery,
      text: false,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Exa answer failed with ${response.status} ${response.statusText}`,
    );
  }

  const result = exaAnswerResponseSchema.parse(await response.json());

  return {
    answer: result.answer,
    citations: result.citations.slice(0, 3),
  };
}
