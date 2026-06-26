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
  fetch: typeof fetch;
};

export async function connectGoogleCalendar({
  fetch: fetchAuth = fetch,
}: Partial<GoogleCalendarAuthClient> = {}) {
  const response = await fetchAuth("/api/auth/link-social", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(buildGoogleCalendarReconnectOptions()),
  });

  if (response.status === 401) {
    return {
      ok: false as const,
      message: "Please sign in again to connect Google Calendar.",
    };
  }

  if (!response.ok) {
    return {
      ok: false as const,
      message: "Google Calendar could not connect.",
    };
  }

  const result = (await response.json().catch(() => ({}))) as {
    url?: string | null;
  };
  const url = result.url;

  if (!url) {
    return {
      ok: false as const,
      message: "Google Calendar could not connect.",
    };
  }

  return { ok: true as const, url };
}
