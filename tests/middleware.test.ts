import { describe, expect, it, vi } from "vitest";

const neonProxyHandler = vi.fn(() => "next-response");
const middleware = vi.fn(() => neonProxyHandler);

vi.mock("@/lib/auth/server", () => ({
  auth: {
    middleware,
  },
}));

describe("Neon Auth middleware", () => {
  it("runs on authenticated app routes so OAuth can exchange verifier tokens", async () => {
    const proxyModule = await import("../proxy");

    expect(middleware).toHaveBeenCalledWith({ loginUrl: "/auth/sign-in" });
    expect(proxyModule.proxy("request")).toBe("next-response");
    expect(neonProxyHandler).toHaveBeenCalledWith("request");
    expect(proxyModule.config.matcher).toEqual([
      "/dashboard/:path*",
      "/settings/:path*",
    ]);
  });
});
