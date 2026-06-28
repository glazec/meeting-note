import { describe, expect, it } from "vitest";

describe("Google sign in helper", () => {
  it("builds Neon Auth Google sign in options without calendar scopes", async () => {
    const { buildGoogleSignInOptions } = await import("@/lib/google-auth");

    expect(buildGoogleSignInOptions()).toEqual({
      provider: "google",
      callbackURL: "/dashboard",
      errorCallbackURL: "/auth/sign-in",
    });
  });
});
