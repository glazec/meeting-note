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

  it("keeps local recorder device login callback paths after Google sign in", async () => {
    const { buildGoogleSignInOptions } = await import("@/lib/google-auth");

    expect(
      buildGoogleSignInOptions(
        "/api/local-recorder/device-login?deviceId=mac_123&callbackUrl=meetingnote-local-recorder%3A%2F%2Flogin",
      ),
    ).toEqual({
      provider: "google",
      callbackURL:
        "/api/local-recorder/device-login?deviceId=mac_123&callbackUrl=meetingnote-local-recorder%3A%2F%2Flogin",
      errorCallbackURL: "/auth/sign-in",
    });
  });

  it("normalizes unencoded local recorder callback query values before Google sign in", async () => {
    const { buildGoogleSignInOptions } = await import("@/lib/google-auth");

    expect(
      buildGoogleSignInOptions(
        "/api/local-recorder/device-login?deviceId=mac_123&callbackUrl=meetingnote-local-recorder://login",
      ),
    ).toEqual({
      provider: "google",
      callbackURL:
        "/api/local-recorder/device-login?deviceId=mac_123&callbackUrl=meetingnote-local-recorder%3A%2F%2Flogin",
      errorCallbackURL: "/auth/sign-in",
    });
  });

  it("falls back to dashboard for external Google callback URLs", async () => {
    const { buildGoogleSignInOptions } = await import("@/lib/google-auth");

    expect(buildGoogleSignInOptions("https://evil.example.com/callback")).toEqual(
      {
        provider: "google",
        callbackURL: "/dashboard",
        errorCallbackURL: "/auth/sign-in",
      },
    );
  });
});
