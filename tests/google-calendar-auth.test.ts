import { describe, expect, it, vi } from "vitest";

describe("Google Calendar auth", () => {
  it("requests read access to calendar events during Google sign in", async () => {
    const { GOOGLE_CALENDAR_EVENT_READ_SCOPE, buildGoogleSignInOptions } =
      await import("@/lib/google-calendar-auth");

    expect(buildGoogleSignInOptions()).toEqual({
      provider: "google",
      callbackURL: "/dashboard?syncCalendar=1",
      errorCallbackURL: "/auth/sign-in",
      scopes: [GOOGLE_CALENDAR_EVENT_READ_SCOPE],
    });
  });

  it("builds a calendar reconnect flow for existing signed in users", async () => {
    const {
      GOOGLE_CALENDAR_EVENT_READ_SCOPE,
      buildGoogleCalendarReconnectOptions,
    } =
      await import("@/lib/google-calendar-auth");

    expect(buildGoogleCalendarReconnectOptions()).toEqual({
      provider: "google",
      callbackURL: "/dashboard?syncCalendar=1",
      errorCallbackURL: "/dashboard",
      scopes: [GOOGLE_CALENDAR_EVENT_READ_SCOPE],
      disableRedirect: true,
    });
  });

  it("starts calendar reconnect through the Neon auth client link flow", async () => {
    const linkSocial = vi.fn().mockResolvedValue({
      data: {
        redirect: false,
        url: "https://accounts.google.com/o/oauth2/v2/auth",
      },
      error: null,
    });
    const { connectGoogleCalendar, buildGoogleCalendarReconnectOptions } =
      await import("@/lib/google-calendar-auth");

    await expect(
      connectGoogleCalendar({
        authClient: { linkSocial },
      }),
    ).resolves.toEqual({
      ok: true,
      url: "https://accounts.google.com/o/oauth2/v2/auth",
    });
    expect(linkSocial).toHaveBeenCalledWith(buildGoogleCalendarReconnectOptions());
  });

  it("fails reconnect when Google does not return an auth URL", async () => {
    const { connectGoogleCalendar } = await import("@/lib/google-calendar-auth");

    await expect(
      connectGoogleCalendar({
        authClient: {
          linkSocial: vi.fn().mockResolvedValue({ data: { url: "" } }),
        },
      }),
    ).resolves.toEqual({
      ok: false,
      message: "Google Calendar could not connect.",
    });
  });

  it("asks expired sessions to sign in again before reconnecting", async () => {
    const { connectGoogleCalendar } = await import("@/lib/google-calendar-auth");

    await expect(
      connectGoogleCalendar({
        authClient: {
          linkSocial: vi.fn().mockResolvedValue({
            data: null,
            error: { code: "UNAUTHORIZED", message: "Unauthorized" },
          }),
        },
      }),
    ).resolves.toEqual({
      ok: false,
      message: "Please sign in again to connect Google Calendar.",
    });
  });
});
