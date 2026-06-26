const NEON_AUTH_COOKIE_PREFIX = "__Secure-neon-auth.";

export function getNeonAuthCookieNames(cookieHeader: string | null) {
  if (!cookieHeader) {
    return [];
  }

  return cookieHeader
    .split(";")
    .map((cookie) => cookie.trim().split("=")[0])
    .filter((name) => name.startsWith(NEON_AUTH_COOKIE_PREFIX));
}

export function buildExpiredNeonAuthCookie(name: string) {
  return `${name}=; Path=/; Max-Age=0; SameSite=Lax; Secure; HttpOnly`;
}
