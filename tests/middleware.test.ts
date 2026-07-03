import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

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
    const request = new NextRequest("https://app.example.com/dashboard");

    expect(middleware).toHaveBeenCalledWith({ loginUrl: "/auth/sign-in" });
    expect(proxyModule.proxy(request)).toBe("next-response");
    expect(neonProxyHandler).toHaveBeenCalledWith(request);
    expect(proxyModule.config.matcher).toEqual([
      "/dashboard/:path*",
      "/settings/:path*",
      "/api/local-recorder/device-login",
    ]);
  });

  it("lets plain local recorder device login requests reach the route handler", async () => {
    const proxyModule = await import("../proxy");
    const request = new NextRequest(
      "https://app.example.com/api/local-recorder/device-login?deviceId=mac_123&callbackUrl=meetingnote-local-recorder%3A%2F%2Flogin",
    );

    neonProxyHandler.mockClear();

    const response = proxyModule.proxy(request);

    expect(response).not.toBe("next-response");
    expect(neonProxyHandler).not.toHaveBeenCalled();
  });

  it("runs Neon Auth middleware for local recorder OAuth verifier callbacks", async () => {
    const proxyModule = await import("../proxy");
    const request = new NextRequest(
      "https://app.example.com/api/local-recorder/device-login?deviceId=mac_123&callbackUrl=meetingnote-local-recorder%3A%2F%2Flogin&neon_auth_session_verifier=verifier_123",
    );

    neonProxyHandler.mockClear();

    expect(proxyModule.proxy(request)).toBe("next-response");
    expect(neonProxyHandler).toHaveBeenCalledWith(request);
  });
});
