import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { SignOutButton } from "@/components/sign-out-button";

vi.mock("@/lib/auth/client", () => ({
  authClient: {
    signOut: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    replace: vi.fn(),
  }),
}));

describe("SignOutButton", () => {
  it("renders a button action for signing out", () => {
    const html = renderToStaticMarkup(<SignOutButton />);

    expect(html).toContain('type="button"');
    expect(html).toContain("Sign out");
  });
});
