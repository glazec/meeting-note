import { afterEach, describe, expect, it, vi } from "vitest";

const {
  getCurrentUser,
  getWorkspace,
  insert,
  onConflictDoNothing,
  select,
  values,
} = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getWorkspace: vi.fn(),
  insert: vi.fn(),
  onConflictDoNothing: vi.fn(),
  select: vi.fn(),
  values: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser,
}));

vi.mock("@/lib/workspace", () => ({
  getOrCreateWorkspaceForSessionUser: getWorkspace,
}));

vi.mock("@/db/client", () => ({
  db: {
    insert,
    select,
  },
}));

async function shareMeetingRequest(body: unknown = { email: "teammate@example.com" }) {
  const { POST } = await import("@/app/api/meetings/[meetingId]/share/route");

  return POST(
    new Request(
      "https://app.example.com/api/meetings/11111111-1111-4111-8111-111111111111/share",
      {
        body: JSON.stringify(body),
        method: "POST",
      },
    ),
    {
      params: Promise.resolve({
        meetingId: "11111111-1111-4111-8111-111111111111",
      }),
    },
  );
}

function mockMeetingRows(
  rows: Array<{
    attendeeEmails?: string[];
    id: string;
    ownerUserId?: string;
    title?: string;
  }>,
) {
  select.mockReturnValueOnce({
    from: () => ({
      leftJoin: () => ({
        where: () => ({
          limit: vi.fn().mockResolvedValue(rows),
        }),
      }),
    }),
  });
}

function mockRelatedMeetingRows(rows: unknown[]) {
  select.mockReturnValueOnce({
    from: () => ({
      leftJoin: () => ({
        where: vi.fn().mockResolvedValue(rows),
      }),
    }),
  });
}

function mockTargetRows(
  rows: Array<{
    id: string;
    email: string;
    membershipId: string | null;
    name: string | null;
  }>,
) {
  select.mockReturnValueOnce({
    from: () => ({
      leftJoin: () => ({
        where: () => ({
          limit: vi.fn().mockResolvedValue(rows),
        }),
      }),
    }),
  });
}

describe("POST /api/meetings/[meetingId]/share", () => {
  afterEach(() => {
    getCurrentUser.mockReset();
    getWorkspace.mockReset();
    insert.mockReset();
    onConflictDoNothing.mockReset();
    select.mockReset();
    values.mockReset();
    vi.resetModules();
  });

  it("returns 401 when the request is unauthenticated", async () => {
    getCurrentUser.mockResolvedValue(null);

    const response = await shareMeetingRequest();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(insert).not.toHaveBeenCalled();
  });

  it("shares an authenticated workspace meeting with a teammate", async () => {
    getCurrentUser.mockResolvedValue({
      email: "owner@example.com",
      id: "auth_owner",
      name: null,
    });
    getWorkspace.mockResolvedValue({
      teamId: "team_123",
      userId: "owner_user_id",
    });
    mockMeetingRows([{ id: "11111111-1111-4111-8111-111111111111" }]);
    mockTargetRows([
      {
        email: "teammate@example.com",
        id: "teammate_user_id",
        membershipId: "membership_123",
        name: "Team Mate",
      },
    ]);
    insert.mockReturnValue({ values });
    values.mockReturnValue({ onConflictDoNothing });
    onConflictDoNothing.mockResolvedValue(undefined);

    const response = await shareMeetingRequest({
      email: " Teammate@Example.com ",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      futureMeetings: false,
      meetingCount: 1,
      shared: true,
      user: {
        email: "teammate@example.com",
        name: "Team Mate",
      },
      audience: "organization",
    });
    expect(values).toHaveBeenCalledWith({
      meetingId: "11111111-1111-4111-8111-111111111111",
      role: "shared",
      userId: "teammate_user_id",
    });
    expect(onConflictDoNothing).toHaveBeenCalled();
  });

  it("shares a meeting with an existing external user", async () => {
    getCurrentUser.mockResolvedValue({
      email: "owner@example.com",
      id: "auth_owner",
      name: null,
    });
    getWorkspace.mockResolvedValue({
      teamId: "team_123",
      userId: "owner_user_id",
    });
    mockMeetingRows([{ id: "11111111-1111-4111-8111-111111111111" }]);
    mockTargetRows([
      {
        email: "partner@vendor.com",
        id: "partner_user_id",
        membershipId: null,
        name: "External Partner",
      },
    ]);
    insert.mockReturnValue({ values });
    values.mockReturnValue({ onConflictDoNothing });
    onConflictDoNothing.mockResolvedValue(undefined);

    const response = await shareMeetingRequest({
      email: "partner@vendor.com",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      audience: "external",
      futureMeetings: false,
      meetingCount: 1,
      shared: true,
      user: {
        email: "partner@vendor.com",
        name: "External Partner",
      },
    });
    expect(values).toHaveBeenCalledWith({
      meetingId: "11111111-1111-4111-8111-111111111111",
      role: "shared",
      userId: "partner_user_id",
    });
  });

  it("saves a pending share when the email has not signed in yet", async () => {
    getCurrentUser.mockResolvedValue({
      email: "owner@example.com",
      id: "auth_owner",
      name: null,
    });
    getWorkspace.mockResolvedValue({
      teamId: "team_123",
      userId: "owner_user_id",
    });
    mockMeetingRows([{ id: "11111111-1111-4111-8111-111111111111" }]);
    mockTargetRows([]);
    insert.mockReturnValue({ values });
    values.mockReturnValue({ onConflictDoNothing });
    onConflictDoNothing.mockResolvedValue(undefined);

    const response = await shareMeetingRequest({
      email: "outside@example.com",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      email: "outside@example.com",
      futureMeetings: false,
      meetingCount: 1,
      pending: true,
      shared: true,
    });
    expect(values).toHaveBeenCalledWith({
      createdByUserId: "owner_user_id",
      email: "outside@example.com",
      meetingId: "11111111-1111-4111-8111-111111111111",
      role: "shared",
    });
    expect(onConflictDoNothing).toHaveBeenCalled();
  });

  it("shares related meetings and saves rules for future matches", async () => {
    getCurrentUser.mockResolvedValue({
      email: "owner@example.com",
      id: "auth_owner",
      name: null,
    });
    getWorkspace.mockResolvedValue({
      domain: "example.com",
      teamId: "team_123",
      userId: "owner_user_id",
    });
    mockMeetingRows([
      {
        attendeeEmails: ["partner@vendor.com", "owner@example.com"],
        id: "11111111-1111-4111-8111-111111111111",
        ownerUserId: "owner_user_id",
        title: "Weekly partner sync",
      },
    ]);
    mockRelatedMeetingRows([
      {
        attendeeEmails: ["partner@vendor.com"],
        id: "11111111-1111-4111-8111-111111111111",
        title: "Weekly partner sync",
      },
      {
        attendeeEmails: ["partner@vendor.com"],
        id: "22222222-2222-4222-8222-222222222222",
        title: "Next partner update",
      },
      {
        attendeeEmails: ["other@another.com"],
        id: "33333333-3333-4333-8333-333333333333",
        title: "Unrelated meeting",
      },
    ]);
    mockTargetRows([
      {
        email: "teammate@example.com",
        id: "teammate_user_id",
        membershipId: "membership_123",
        name: "Team Mate",
      },
    ]);
    insert.mockReturnValue({ values });
    values.mockReturnValue({ onConflictDoNothing });
    onConflictDoNothing.mockResolvedValue(undefined);

    const response = await shareMeetingRequest({
      email: "teammate@example.com",
      includeRelated: true,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      futureMeetings: true,
      meetingCount: 2,
      shared: true,
    });
    expect(values).toHaveBeenCalledWith({
      meetingId: "22222222-2222-4222-8222-222222222222",
      role: "shared",
      userId: "teammate_user_id",
    });
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        matchKey: "title:weekly partner sync",
        ownerUserId: "owner_user_id",
        recipientEmail: "teammate@example.com",
        teamId: "team_123",
      }),
    );
  });
});
