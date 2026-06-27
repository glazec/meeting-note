import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const {
  getWorkspace,
  getWorkspaceAccessSummary,
  redirect,
  requireCurrentUser,
} = vi.hoisted(() => ({
  getWorkspace: vi.fn(),
  getWorkspaceAccessSummary: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  requireCurrentUser: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect,
}));

vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/lib/auth-guards", () => ({
  requireCurrentUser,
}));

vi.mock("@/lib/workspace", () => ({
  getOrCreateWorkspaceForSessionUser: getWorkspace,
  getWorkspaceAccessSummary,
}));

describe("TeamSettingsPage", () => {
  afterEach(() => {
    getWorkspace.mockReset();
    getWorkspaceAccessSummary.mockReset();
    redirect.mockClear();
    requireCurrentUser.mockReset();
    vi.resetModules();
  });

  it("redirects shared only users away from creator settings", async () => {
    requireCurrentUser.mockResolvedValue({
      id: "auth_user_123",
      email: "reader@partner.com",
      name: null,
    });
    getWorkspace.mockResolvedValue({
      userId: "user_123",
      teamId: "team_123",
      domain: "partner.com",
      canCreateMeetings: false,
    });
    getWorkspaceAccessSummary.mockResolvedValue({
      canCreateMeetings: false,
      hasExternalShares: true,
      hasWorkspaceMeetings: false,
      isSharedOnly: true,
    });

    const { default: TeamSettingsPage } = await import(
      "@/app/settings/team/page"
    );

    await expect(TeamSettingsPage()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });
});
