import { describe, expect, it } from "vitest";

describe("Google Calendar auth", () => {
  it("requests read access to calendar events during Google sign in", async () => {
    const { GOOGLE_CALENDAR_EVENT_READ_SCOPE, buildGoogleSignInOptions } =
      await import("@/lib/google-calendar-auth");

    expect(buildGoogleSignInOptions()).toEqual({
      provider: "google",
      callbackURL: "/dashboard",
      errorCallbackURL: "/auth/sign-in",
      scopes: [GOOGLE_CALENDAR_EVENT_READ_SCOPE],
    });
  });

  it("builds a calendar link flow for existing signed in users", async () => {
    const { GOOGLE_CALENDAR_EVENT_READ_SCOPE, buildGoogleCalendarLinkOptions } =
      await import("@/lib/google-calendar-auth");

    expect(buildGoogleCalendarLinkOptions()).toEqual({
      provider: "google",
      callbackURL: "/dashboard?syncCalendar=1",
      errorCallbackURL: "/dashboard",
      scopes: [GOOGLE_CALENDAR_EVENT_READ_SCOPE],
    });
  });
});
