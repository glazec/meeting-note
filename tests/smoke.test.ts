import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import Home from "@/app/page";

const { getAuthenticatedUser, redirect } = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock("@/lib/auth", () => ({ getAuthenticatedUser }));
vi.mock("next/navigation", () => ({ redirect }));

describe("landing page smoke test", () => {
  it("renders the landing page with hero, social proof, and sign-in path", async () => {
    getAuthenticatedUser.mockResolvedValue(null);
    const html = renderToStaticMarkup(await Home());

    expect(html).toContain("tape-lockup.svg");
    expect(html).toContain("Every meeting, unrolled into");
    expect(html).toContain("Layer 01 · Recording");
    expect(html).toContain("Layer 04 · Insight");
    expect(html).toContain("IOSG Ventures");
    expect(html).toContain("Bcap");
    expect(html).toContain("Maelstrom");
    expect(html).toContain("Anthropic");
    expect(html).toContain("What did we decide?");
    expect(html).toContain('href="/auth/sign-in"');
  });

  it("redirects signed in users to the dashboard", async () => {
    getAuthenticatedUser.mockResolvedValue({
      id: "user_123",
      email: "user@example.com",
    });

    await expect(Home()).rejects.toThrow("redirect:/dashboard");
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });
});
