export const GOOGLE_CALENDAR_EVENT_READ_SCOPE =
  "https://www.googleapis.com/auth/calendar.events.readonly";

export function buildGoogleSignInOptions() {
  return {
    provider: "google" as const,
    callbackURL: "/dashboard",
    errorCallbackURL: "/auth/sign-in",
    scopes: [GOOGLE_CALENDAR_EVENT_READ_SCOPE],
  };
}

export function buildGoogleCalendarReconnectOptions() {
  return {
    provider: "google" as const,
    callbackURL: "/dashboard?syncCalendar=1",
    errorCallbackURL: "/dashboard",
    scopes: [GOOGLE_CALENDAR_EVENT_READ_SCOPE],
    disableRedirect: true,
  };
}

type GoogleCalendarAuthClient = {
  linkSocial: (
    options: ReturnType<typeof buildGoogleCalendarReconnectOptions>,
  ) => Promise<{
    data?: { url?: string | null } | null;
    error?: { message?: string } | null;
  }>;
};

export async function connectGoogleCalendar(authClient: GoogleCalendarAuthClient) {
  const result = await authClient.linkSocial(buildGoogleCalendarReconnectOptions());

  if (result.error) {
    return {
      ok: false as const,
      message: result.error.message || "Google Calendar could not connect.",
    };
  }

  const url = result.data?.url;

  if (!url) {
    return {
      ok: false as const,
      message: "Google Calendar could not connect.",
    };
  }

  return { ok: true as const, url };
}
