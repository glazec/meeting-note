import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createNeonAuth = vi.fn(() => ({
  handler: vi.fn(),
  middleware: vi.fn(),
}));

vi.mock("@neondatabase/auth/next/server", () => ({
  createNeonAuth,
}));

describe("Neon Auth server configuration", () => {
  beforeEach(() => {
    vi.resetModules();
    createNeonAuth.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses lax auth cookies so Google OAuth redirects can complete", async () => {
    vi.stubEnv("NEON_AUTH_BASE_URL", "https://auth.example.com/neondb/auth");
    vi.stubEnv("NEON_AUTH_COOKIE_SECRET", "x".repeat(32));

    await import("@/lib/auth/server");

    expect(createNeonAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        cookies: expect.objectContaining({
          sameSite: "lax",
        }),
      }),
    );
  });
});
