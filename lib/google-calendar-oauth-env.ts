import { z } from "zod";

const requiredString = z.string().trim().min(1);

const googleCalendarOAuthEnvSchema = z.object({
  GOOGLE_CALENDAR_CLIENT_ID: requiredString,
  GOOGLE_CALENDAR_CLIENT_SECRET: requiredString,
});

export function parseGoogleCalendarOAuthEnv(
  source: Record<string, string | undefined>,
) {
  return googleCalendarOAuthEnvSchema.parse(source);
}
