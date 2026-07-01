import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const {
  getAdminImpersonatedUserId,
  getAdminImpersonationTarget,
  listAdminImpersonationTargets,
  requireAdminUser,
} = vi.hoisted(() => ({
  getAdminImpersonatedUserId: vi.fn(),
  getAdminImpersonationTarget: vi.fn(),
  listAdminImpersonationTargets: vi.fn(),
  requireAdminUser: vi.fn(),
}));

vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/lib/admin-access", () => ({
  getAdminImpersonatedUserId,
}));

vi.mock("@/lib/admin-impersonation", () => ({
  getAdminImpersonationTarget,
  listAdminImpersonationTargets,
}));

vi.mock("@/lib/auth-guards", () => ({
  requireAdminUser,
}));

describe("AdminPage", () => {
  afterEach(() => {
    getAdminImpersonatedUserId.mockReset();
    getAdminImpersonationTarget.mockReset();
    listAdminImpersonationTargets.mockReset();
    requireAdminUser.mockReset();
    vi.resetModules();
  });

  it("renders the owner only user selector and current impersonation state", async () => {
    requireAdminUser.mockResolvedValue({
      id: "auth_owner",
      email: "owner@example.com",
      name: "Owner",
    });
    getAdminImpersonatedUserId.mockResolvedValue("target_user_id");
    getAdminImpersonationTarget.mockResolvedValue({
      id: "target_user_id",
      authUserId: "auth_target",
      email: "target@example.com",
      name: "Target",
      role: "member",
      teamName: "IOSG",
    });
    listAdminImpersonationTargets.mockResolvedValue([
      {
        id: "owner_user_id",
        authUserId: "auth_owner",
        email: "owner@example.com",
        name: "Owner",
        role: "admin",
        teamName: "IOSG",
      },
      {
        id: "target_user_id",
        authUserId: "auth_target",
        email: "target@example.com",
        name: "Target",
        role: "member",
        teamName: "IOSG",
      },
    ]);

    const { default: AdminPage } = await import("@/app/admin/page");
    const html = renderToStaticMarkup(await AdminPage());

    expect(html).toContain("Admin");
    expect(html).toContain("Signed in as owner@example.com");
    expect(html).toContain("Currently viewing as target@example.com");
    expect(html).toContain('action="/api/admin/impersonation"');
    expect(html).toContain('name="userId"');
    expect(html).toContain("target@example.com");
    expect(html).toContain("View as user");
    expect(html).toContain("Stop viewing as user");
  });
});
