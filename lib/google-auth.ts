const defaultCallbackURL = "/dashboard";

export function buildGoogleSignInOptions(callbackURL?: string | string[]) {
  return {
    provider: "google" as const,
    callbackURL: normalizeGoogleSignInCallbackURL(callbackURL),
    errorCallbackURL: "/auth/sign-in",
  };
}

export function normalizeGoogleSignInCallbackURL(
  value?: string | string[],
) {
  const callbackURL = Array.isArray(value) ? value[0] : value;

  if (!callbackURL || callbackURL.startsWith("//")) {
    return defaultCallbackURL;
  }

  try {
    const parsed = new URL(callbackURL, "https://meetingnote.local");

    if (
      parsed.origin !== "https://meetingnote.local" ||
      !callbackURL.startsWith("/")
    ) {
      return defaultCallbackURL;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return defaultCallbackURL;
  }
}
