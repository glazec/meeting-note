import { afterEach, describe, expect, it, vi } from "vitest";

const { getCurrentUser, getWorkspace, syncRecallCalendarEventsForWorkspace } =
  vi.hoisted(() => ({
    getCurrentUser: vi.fn(),
    getWorkspace: vi.fn(),
    syncRecallCalendarEventsForWorkspace: vi.fn(),
  }));

class RecallCalendarConnectionError extends Error {}

vi.mock("@/lib/auth", () => ({
  getCurrentUser,
}));

vi.mock("@/lib/workspace", () => ({
  getOrCreateWorkspaceForSessionUser: getWorkspace,
}));

vi.mock("@/lib/recall-calendar", () => ({
  RecallCalendarConnectionError,
  syncRecallCalendarEventsForWorkspace,
}));

async function postCalendarSync(body: unknown = { autoJoinEnabled: true }) {
  const { POST } = await import("@/app/api/calendar/sync/route");

  return POST(
    new Request("https://app.example.com/api/calendar/sync", {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "content-type": "application/json",
      },
    }),
  );
}

describe("POST /api/calendar/sync", () => {
  afterEach(() => {
    getCurrentUser.mockReset();
    getWorkspace.mockReset();
    syncRecallCalendarEventsForWorkspace.mockReset();
    vi.resetModules();
  });

  it("returns 401 when unauthenticated", async () => {
    getCurrentUser.mockResolvedValue(null);

    const response = await postCalendarSync();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(syncRecallCalendarEventsForWorkspace).not.toHaveBeenCalled();
  });

  it("captures upcoming Recall Calendar events for the authenticated user", async () => {
    const sessionUser = {
      id: "auth_user_123",
      email: "alice@example.com",
      name: null,
    };
    const workspace = {
      userId: "11111111-1111-4111-8111-111111111111",
      teamId: "22222222-2222-4222-8222-222222222222",
      domain: "example.com",
    };

    getCurrentUser.mockResolvedValue(sessionUser);
    getWorkspace.mockResolvedValue(workspace);
    syncRecallCalendarEventsForWorkspace.mockResolvedValue({
      connectionId: "33333333-3333-4333-8333-333333333333",
      syncedEventCount: 2,
    });

    const response = await postCalendarSync({ autoJoinEnabled: true });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      connectionId: "33333333-3333-4333-8333-333333333333",
      syncedEventCount: 2,
    });
    expect(syncRecallCalendarEventsForWorkspace).toHaveBeenCalledWith({
      workspace,
      autoJoinEnabled: true,
    });
  });

  it("returns a reconnect signal when Recall Calendar is missing", async () => {
    const sessionUser = {
      id: "auth_user_123",
      email: "alice@example.com",
      name: null,
    };
    const workspace = {
      userId: "11111111-1111-4111-8111-111111111111",
      teamId: "22222222-2222-4222-8222-222222222222",
      domain: "example.com",
    };

    getCurrentUser.mockResolvedValue(sessionUser);
    getWorkspace.mockResolvedValue(workspace);
    syncRecallCalendarEventsForWorkspace.mockRejectedValue(
      new RecallCalendarConnectionError(),
    );

    const response = await postCalendarSync({ autoJoinEnabled: true });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Recall Calendar is not connected",
      reconnect: true,
    });
  });
});
