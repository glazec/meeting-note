import { describe, expect, it } from "vitest";

import {
  buildExpiredNeonAuthCookie,
  getNeonAuthCookieNames,
} from "@/lib/neon-auth-cookies";

describe("Neon Auth cookies", () => {
  it("selects only Neon Auth cookies from the request cookie header", () => {
    expect(
      getNeonAuthCookieNames(
        "__Secure-neon-auth.session_token=abc; app_theme=dark; __Secure-neon-auth.local.session_data=def",
      ),
    ).toEqual([
      "__Secure-neon-auth.session_token",
      "__Secure-neon-auth.local.session_data",
    ]);
  });

  it("builds an expired secure cookie header", () => {
    expect(
      buildExpiredNeonAuthCookie("__Secure-neon-auth.session_token"),
    ).toBe(
      "__Secure-neon-auth.session_token=; Path=/; Max-Age=0; SameSite=Lax; Secure; HttpOnly",
    );
  });
});
