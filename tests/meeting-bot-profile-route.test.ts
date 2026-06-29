import { afterEach, describe, expect, it, vi } from "vitest";

const {
  getCurrentUser,
  getWorkspace,
  getWorkspaceAccessSummary,
  insert,
} = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getWorkspace: vi.fn(),
  getWorkspaceAccessSummary: vi.fn(),
  insert: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  db: { insert },
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser,
}));

vi.mock("@/lib/workspace", () => ({
  getOrCreateWorkspaceForSessionUser: getWorkspace,
  getWorkspaceAccessSummary,
}));

describe("POST /api/team/bot-profile", () => {
  afterEach(() => {
    getCurrentUser.mockReset();
    getWorkspace.mockReset();
    getWorkspaceAccessSummary.mockReset();
    insert.mockReset();
    vi.resetModules();
  });

  it("saves a team bot name and avatar for internal members", async () => {
    getCurrentUser.mockResolvedValue({
      id: "auth_user_123",
      email: "member@iosg.vc",
      name: "Member",
    });
    getWorkspace.mockResolvedValue({
      userId: "user_123",
      teamId: "team_123",
      domain: "iosg.vc",
      canCreateMeetings: true,
    });
    getWorkspaceAccessSummary.mockResolvedValue({
      canCreateMeetings: true,
      hasExternalShares: false,
      hasWorkspaceMeetings: true,
      isSharedOnly: false,
    });
    const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn().mockReturnValue({ onConflictDoUpdate });
    insert.mockReturnValue({ values });

    const { POST } = await import("@/app/api/team/bot-profile/route");
    const form = new FormData();
    form.set("botName", " Deal   Scribe ");
    form.set(
      "avatar",
      new File([new Uint8Array([1, 2, 3])], "avatar.jpg", {
        type: "image/jpeg",
      }),
    );

    const response = await POST(
      new Request("https://app.example.com/settings/team", {
        method: "POST",
        body: form,
      }),
    );

    expect(response.status).toBe(303);
    expect(values).toHaveBeenCalledWith({
      teamId: "team_123",
      botName: "Deal Scribe",
      avatarJpegBase64: "AQID",
    });
  });

  it("blocks shared only users from changing the bot profile", async () => {
    getCurrentUser.mockResolvedValue({
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

    const { POST } = await import("@/app/api/team/bot-profile/route");
    const form = new FormData();
    form.set("botName", "Deal Scribe");

    const response = await POST(
      new Request("https://app.example.com/settings/team", {
        method: "POST",
        body: form,
      }),
    );

    expect(response.status).toBe(403);
    expect(insert).not.toHaveBeenCalled();
  });
});
