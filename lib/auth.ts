import { cookies } from "next/headers";
import type { JWTPayload } from "jose";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
};

const authEnvSchema = z.object({
  NEON_AUTH_JWKS_URL: z.string().url(),
  NEON_AUTH_ISSUER: z.string().url(),
});

export function parseAuthEnv(source: Record<string, string | undefined>) {
  return authEnvSchema.parse(source);
}

export function sessionUserFromPayload(payload: JWTPayload): SessionUser | null {
  if (typeof payload.sub !== "string" || typeof payload.email !== "string") {
    return null;
  }

  return {
    id: payload.sub,
    email: payload.email,
    name: typeof payload.name === "string" ? payload.name : null,
  };
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;

  if (!token) {
    return null;
  }

  const authEnv = parseAuthEnv(process.env);
  const jwks = createRemoteJWKSet(new URL(authEnv.NEON_AUTH_JWKS_URL));

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: authEnv.NEON_AUTH_ISSUER,
    });

    return sessionUserFromPayload(payload);
  } catch {
    return null;
  }
}
