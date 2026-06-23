const jwksSuffix = "/.well-known/jwks.json";

export function getNeonAuthBaseUrl(
  source: Record<string, string | undefined> = process.env,
) {
  if (source.NEON_AUTH_BASE_URL) {
    return source.NEON_AUTH_BASE_URL.replace(/\/$/, "");
  }

  if (!source.NEON_AUTH_JWKS_URL) {
    throw new Error("NEON_AUTH_JWKS_URL is required");
  }

  const jwksUrl = new URL(source.NEON_AUTH_JWKS_URL);

  if (!jwksUrl.pathname.endsWith(jwksSuffix)) {
    throw new Error("NEON_AUTH_JWKS_URL must end with /.well-known/jwks.json");
  }

  jwksUrl.pathname = jwksUrl.pathname.slice(0, -jwksSuffix.length);
  jwksUrl.search = "";
  jwksUrl.hash = "";

  return jwksUrl.toString().replace(/\/$/, "");
}

export function getNeonAuthCookieSecret(
  source: Record<string, string | undefined> = process.env,
) {
  const secret = source.NEON_AUTH_COOKIE_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("NEON_AUTH_COOKIE_SECRET must be at least 32 characters");
  }

  return secret;
}
