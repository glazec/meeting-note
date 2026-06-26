import { authClient as defaultAuthClient } from "@/lib/auth/client";

export const GOOGLE_CALENDAR_EVENT_READ_SCOPE =
  "https://www.googleapis.com/auth/calendar.events.readonly";

export function buildGoogleSignInOptions() {
  return {
    provider: "google" as const,
    callbackURL: "/dashboard?syncCalendar=1",
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
    error?: { code?: string; message?: string } | null;
  }>;
};

export async function connectGoogleCalendar({
  authClient = defaultAuthClient,
}: { authClient?: GoogleCalendarAuthClient } = {}) {
  const result = await authClient.linkSocial(buildGoogleCalendarReconnectOptions());

  if (isSessionError(result.error)) {
    return {
      ok: false as const,
      message: "Please sign in again to connect Google Calendar.",
    };
  }

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

function isSessionError(error?: { code?: string; message?: string } | null) {
  const code = error?.code?.toLowerCase() ?? "";
  const message = error?.message?.toLowerCase() ?? "";

  return (
    code.includes("unauthorized") ||
    code.includes("session") ||
    message.includes("unauthorized") ||
    message.includes("session")
  );
}
