import { describe, expect, it } from "vitest";

import { parseGoogleCalendarOAuthEnv } from "@/lib/google-calendar-oauth-env";

describe("parseGoogleCalendarOAuthEnv", () => {
  it("trims copied Google Calendar OAuth credentials", () => {
    expect(
      parseGoogleCalendarOAuthEnv({
        GOOGLE_CALENDAR_CLIENT_ID: "google-client-id\n",
        GOOGLE_CALENDAR_CLIENT_SECRET: "google-client-secret\n",
      }),
    ).toEqual({
      GOOGLE_CALENDAR_CLIENT_ID: "google-client-id",
      GOOGLE_CALENDAR_CLIENT_SECRET: "google-client-secret",
    });
  });

  it("requires Google Calendar OAuth credentials when OAuth is used", () => {
    expect(() => parseGoogleCalendarOAuthEnv({})).toThrow();
  });
});
