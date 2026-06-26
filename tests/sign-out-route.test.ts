import { describe, expect, it } from "vitest";

describe("POST /api/sign-out", () => {
  it("expires local Neon Auth cookies", async () => {
    const { POST } = await import("@/app/api/sign-out/route");

    const response = await POST(
      new Request("https://app.example.com/api/sign-out", {
        method: "POST",
        headers: {
          cookie:
            "__Secure-neon-auth.session_token=abc; app_theme=dark; __Secure-neon-auth.local.session_data=def",
        },
      }),
    );

    expect(response.status).toBe(204);
    const setCookie = response.headers.get("set-cookie");

    expect(setCookie).toContain("__Secure-neon-auth.session_token=");
    expect(setCookie).toContain("__Secure-neon-auth.local.session_data=");
    expect(setCookie).not.toContain("app_theme");
  });
});
