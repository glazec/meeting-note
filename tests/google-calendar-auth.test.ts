import { describe, expect, it, vi } from "vitest";

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

  it("starts calendar reconnect through the Google link endpoint", async () => {
    const fetchAuth = vi.fn().mockResolvedValue(
      Response.json({
        redirect: false,
        url: "https://accounts.google.com/o/oauth2/v2/auth",
      }),
    );
    const { connectGoogleCalendar, buildGoogleCalendarReconnectOptions } =
      await import("@/lib/google-calendar-auth");

    await expect(
      connectGoogleCalendar({
        fetch: fetchAuth,
      }),
    ).resolves.toEqual({
      ok: true,
      url: "https://accounts.google.com/o/oauth2/v2/auth",
    });
    expect(fetchAuth).toHaveBeenCalledWith("/api/auth/link-social", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildGoogleCalendarReconnectOptions()),
    });
  });

  it("fails reconnect when Google does not return an auth URL", async () => {
    const { connectGoogleCalendar } = await import("@/lib/google-calendar-auth");

    await expect(
      connectGoogleCalendar({
        fetch: vi.fn().mockResolvedValue(Response.json({ url: "" })),
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
        fetch: vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
      }),
    ).resolves.toEqual({
      ok: false,
      message: "Please sign in again to connect Google Calendar.",
    });
  });
});
