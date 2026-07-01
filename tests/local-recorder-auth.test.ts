import { afterEach, describe, expect, it, vi } from "vitest";

const { getCurrentUser, getWorkspace, limit, select, where } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getWorkspace: vi.fn(),
  limit: vi.fn(),
  select: vi.fn(),
  where: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  db: {
    select,
  },
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser,
}));

vi.mock("@/lib/workspace", () => ({
  getOrCreateWorkspaceForSessionUser: getWorkspace,
}));

describe("local recorder auth", () => {
  afterEach(() => {
    getCurrentUser.mockReset();
    getWorkspace.mockReset();
    limit.mockReset();
    select.mockReset();
    where.mockReset();
    vi.resetModules();
  });

  it("does not allow browser session auth for device API routes", async () => {
    getCurrentUser.mockResolvedValue({
      id: "user_123",
      email: "user@example.com",
      name: null,
    });
    getWorkspace.mockResolvedValue({
      teamId: "team_123",
      userId: "user_123",
    });

    const { getLocalRecorderWorkspace } = await import(
      "@/lib/local-recorder-auth"
    );
    const workspace = await getLocalRecorderWorkspace(
      new Request("https://app.example.com/api/local-recorder/missed-meetings"),
    );

    expect(workspace).toBeNull();
    expect(getCurrentUser).not.toHaveBeenCalled();
    expect(getWorkspace).not.toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
  });

  it("allows valid bearer device sessions for device API routes", async () => {
    select.mockReturnValue({
      from: () => ({
        where,
      }),
    });
    where.mockReturnValue({ limit });
    limit.mockResolvedValue([
      {
        teamId: "team_123",
        userId: "user_123",
      },
    ]);

    const { getLocalRecorderWorkspace } = await import(
      "@/lib/local-recorder-auth"
    );
    const workspace = await getLocalRecorderWorkspace(
      new Request("https://app.example.com/api/local-recorder/missed-meetings", {
        headers: {
          authorization: "Bearer token_123",
        },
      }),
    );

    expect(workspace).toEqual({
      canCreateMeetings: true,
      domain: "",
      teamId: "team_123",
      userId: "user_123",
    });
  });

  it("returns a controlled error for malformed device login callbacks", async () => {
    getCurrentUser.mockResolvedValue({
      id: "user_123",
      email: "user@example.com",
      name: null,
    });

    const { createLocalRecorderDeviceSession } = await import(
      "@/lib/local-recorder-auth"
    );

    await expect(
      createLocalRecorderDeviceSession({
        callbackUrl: "not a url",
        deviceId: "mac_123",
        requestUrl: "https://app.example.com/api/local-recorder/device-login",
      }),
    ).resolves.toEqual({ error: "Invalid callback" });
  });

  it("only redirects device login tokens to the Mac app login callback", async () => {
    getCurrentUser.mockResolvedValue({
      id: "user_123",
      email: "user@example.com",
      name: null,
    });

    const { createLocalRecorderDeviceSession } = await import(
      "@/lib/local-recorder-auth"
    );

    await expect(
      createLocalRecorderDeviceSession({
        callbackUrl: "meetingnote-local-recorder://settings",
        deviceId: "mac_123",
        requestUrl: "https://app.example.com/api/local-recorder/device-login",
      }),
    ).resolves.toEqual({ error: "Invalid callback" });
  });
});
