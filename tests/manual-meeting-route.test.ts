import { afterEach, describe, expect, it, vi } from "vitest";

const {
  assertCanCreateMeetings,
  getCurrentUser,
  getWorkspace,
  deleteMeeting,
  insert,
  reconcileMeetingSharingForMeeting,
  revalidatePath,
  returning,
  values,
  where,
} = vi.hoisted(() => ({
  assertCanCreateMeetings: vi.fn(),
  getCurrentUser: vi.fn(),
  getWorkspace: vi.fn(),
  deleteMeeting: vi.fn(),
  insert: vi.fn(),
  reconcileMeetingSharingForMeeting: vi.fn(),
  revalidatePath: vi.fn(),
  returning: vi.fn(),
  values: vi.fn(),
  where: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));

vi.mock("@/db/client", () => ({
  db: { delete: deleteMeeting, insert },
}));

vi.mock("@/lib/auth", () => ({ getCurrentUser }));

vi.mock("@/lib/meeting-share-rules", () => ({
  reconcileMeetingSharingForMeeting,
}));

vi.mock("@/lib/workspace", () => ({
  assertCanCreateMeetings,
  getOrCreateWorkspaceForSessionUser: getWorkspace,
}));

describe("POST /api/meetings/manual", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("requires a signed in user", async () => {
    getCurrentUser.mockResolvedValue(null);
    const { POST } = await import("@/app/api/meetings/manual/route");

    const response = await POST(request({}));

    expect(response.status).toBe(401);
    expect(insert).not.toHaveBeenCalled();
  });

  it("creates a manageable manual meeting", async () => {
    const user = { email: "member@iosg.vc", id: "auth_user_123" };
    const workspace = { teamId: "team_123", userId: "user_123" };
    getCurrentUser.mockResolvedValue(user);
    getWorkspace.mockResolvedValue(workspace);
    returning.mockResolvedValue([{ id: "meeting_123" }]);
    values.mockReturnValue({ returning });
    insert.mockReturnValue({ values });
    const { POST } = await import("@/app/api/meetings/manual/route");

    const response = await POST(request({ title: " Phone interview " }));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ meetingId: "meeting_123" });
    expect(assertCanCreateMeetings).toHaveBeenCalledWith(workspace);
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerUserId: "user_123",
        platform: "in_person",
        status: "scheduled",
        teamId: "team_123",
        title: "Phone interview",
        titleSource: "manual",
      }),
    );
    expect(reconcileMeetingSharingForMeeting).toHaveBeenCalledWith(
      "meeting_123",
    );
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
  });

  it("rejects invalid meeting details", async () => {
    getCurrentUser.mockResolvedValue({ id: "auth_user_123" });
    const { POST } = await import("@/app/api/meetings/manual/route");

    const response = await POST(request({ title: "x".repeat(101) }));

    expect(response.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it("removes the inserted meeting when sharing reconciliation fails", async () => {
    getCurrentUser.mockResolvedValue({
      email: "member@iosg.vc",
      id: "auth_user_123",
    });
    getWorkspace.mockResolvedValue({ teamId: "team_123", userId: "user_123" });
    returning.mockResolvedValue([{ id: "meeting_123" }]);
    values.mockReturnValue({ returning });
    insert.mockReturnValue({ values });
    reconcileMeetingSharingForMeeting.mockRejectedValue(
      new Error("sharing unavailable"),
    );
    deleteMeeting.mockReturnValue({ where });
    where.mockResolvedValue(undefined);
    const { POST } = await import("@/app/api/meetings/manual/route");

    const response = await POST(request({ title: "Customer interview" }));

    expect(response.status).toBe(500);
    expect(deleteMeeting).toHaveBeenCalled();
    expect(where).toHaveBeenCalled();
  });
});

function request(body: unknown) {
  return new Request("https://app.example.com/api/meetings/manual", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}
