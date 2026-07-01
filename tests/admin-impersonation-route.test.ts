import { afterEach, describe, expect, it, vi } from "vitest";

const {
  cookies,
  getAdminImpersonationTarget,
  getAuthenticatedUser,
  isAdminSessionUser,
  setCookie,
  deleteCookie,
} = vi.hoisted(() => ({
  cookies: vi.fn(),
  deleteCookie: vi.fn(),
  getAdminImpersonationTarget: vi.fn(),
  getAuthenticatedUser: vi.fn(),
  isAdminSessionUser: vi.fn(),
  setCookie: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies,
}));

vi.mock("@/lib/auth", () => ({
  getAuthenticatedUser,
}));

vi.mock("@/lib/admin-access", () => ({
  ADMIN_IMPERSONATION_COOKIE: "meeting_note_impersonated_user_id",
  getAdminImpersonationCookieOptions: () => ({
    httpOnly: true,
    maxAge: 60 * 60 * 8,
    path: "/",
    sameSite: "lax",
    secure: false,
  }),
  isAdminSessionUser,
}));

vi.mock("@/lib/admin-impersonation", () => ({
  getAdminImpersonationTarget,
}));

function impersonationRequest(body: URLSearchParams) {
  return new Request("https://app.example.com/api/admin/impersonation", {
    body,
    method: "POST",
  });
}

describe("POST /api/admin/impersonation", () => {
  afterEach(() => {
    cookies.mockReset();
    deleteCookie.mockReset();
    getAdminImpersonationTarget.mockReset();
    getAuthenticatedUser.mockReset();
    isAdminSessionUser.mockReset();
    setCookie.mockReset();
    vi.resetModules();
  });

  it("rejects a signed in user who is not the configured admin", async () => {
    getAuthenticatedUser.mockResolvedValue({
      id: "auth_member",
      email: "member@example.com",
      name: "Member",
    });
    isAdminSessionUser.mockReturnValue(false);

    const { POST } = await import("@/app/api/admin/impersonation/route");
    const response = await POST(impersonationRequest(new URLSearchParams()));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" });
    expect(getAdminImpersonationTarget).not.toHaveBeenCalled();
  });

  it("sets the impersonation cookie for a valid target user", async () => {
    getAuthenticatedUser.mockResolvedValue({
      id: "auth_owner",
      email: "owner@example.com",
      name: "Owner",
    });
    isAdminSessionUser.mockReturnValue(true);
    cookies.mockResolvedValue({
      delete: deleteCookie,
      set: setCookie,
    });
    getAdminImpersonationTarget.mockResolvedValue({
      id: "target_user_id",
      authUserId: "auth_target",
      email: "target@example.com",
      name: "Target",
    });

    const { POST } = await import("@/app/api/admin/impersonation/route");
    const response = await POST(
      impersonationRequest(
        new URLSearchParams({
          redirectTo: "/dashboard",
          userId: "target_user_id",
        }),
      ),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://app.example.com/dashboard",
    );
    expect(setCookie).toHaveBeenCalledWith({
      httpOnly: true,
      maxAge: 60 * 60 * 8,
      name: "meeting_note_impersonated_user_id",
      path: "/",
      sameSite: "lax",
      secure: false,
      value: "target_user_id",
    });
  });

  it("clears the impersonation cookie for the configured admin", async () => {
    getAuthenticatedUser.mockResolvedValue({
      id: "auth_owner",
      email: "owner@example.com",
      name: "Owner",
    });
    isAdminSessionUser.mockReturnValue(true);
    cookies.mockResolvedValue({
      delete: deleteCookie,
      set: setCookie,
    });

    const { POST } = await import("@/app/api/admin/impersonation/route");
    const response = await POST(
      impersonationRequest(
        new URLSearchParams({
          action: "clear",
          redirectTo: "/admin",
        }),
      ),
    );

    expect(response.status).toBe(303);
    expect(deleteCookie).toHaveBeenCalledWith(
      "meeting_note_impersonated_user_id",
    );
    expect(response.headers.get("location")).toBe(
      "https://app.example.com/admin",
    );
  });
});
