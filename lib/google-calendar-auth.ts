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

export function buildGoogleCalendarLinkOptions() {
  return {
    provider: "google" as const,
    callbackURL: "/dashboard?syncCalendar=1",
    errorCallbackURL: "/dashboard",
    scopes: [GOOGLE_CALENDAR_EVENT_READ_SCOPE],
  };
}
