import { afterEach, describe, expect, it, vi } from "vitest";

const getCookie = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: getCookie,
  })),
}));

describe("getCurrentUser", () => {
  afterEach(() => {
    getCookie.mockReset();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("returns null without requiring env when no session cookie exists", async () => {
    getCookie.mockReturnValue(undefined);
    vi.stubEnv("NEON_AUTH_JWKS_URL", "");
    vi.stubEnv("NEON_AUTH_ISSUER", "");

    const { getCurrentUser } = await import("@/lib/auth");

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("returns null for malformed session tokens without requiring unrelated env", async () => {
    getCookie.mockReturnValue({ value: "not-a-jwt" });
    vi.stubEnv("NEON_AUTH_JWKS_URL", "https://auth.example.com/.well-known/jwks.json");
    vi.stubEnv("NEON_AUTH_ISSUER", "https://auth.example.com");
    vi.stubEnv("DATABASE_URL", "");

    const { getCurrentUser } = await import("@/lib/auth");

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("maps verified payloads with sub and email to a session user", async () => {
    const { sessionUserFromPayload } = await import("@/lib/auth");

    expect(
      sessionUserFromPayload({
        sub: "user-1",
        email: "alice@example.com",
        name: "Alice",
      }),
    ).toEqual({
      id: "user-1",
      email: "alice@example.com",
      name: "Alice",
    });
  });

  it("returns null when verified payloads lack sub or email", async () => {
    const { sessionUserFromPayload } = await import("@/lib/auth");

    expect(sessionUserFromPayload({ sub: "user-1" })).toBeNull();
    expect(sessionUserFromPayload({ email: "alice@example.com" })).toBeNull();
  });
});
