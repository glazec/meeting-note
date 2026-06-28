import { z } from "zod";

const databaseEnvSchema = z.object({
  DATABASE_URL: z.string().trim().url(),
});

export function parseDatabaseEnv(source: Record<string, string | undefined>) {
  return databaseEnvSchema.parse(source);
}

export const databaseEnv = parseDatabaseEnv(process.env);
