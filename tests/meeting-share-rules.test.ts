import { afterEach, describe, expect, it, vi } from "vitest";

const { insert, onConflictDoNothing, select, values } = vi.hoisted(() => ({
  insert: vi.fn(),
  onConflictDoNothing: vi.fn(),
  select: vi.fn(),
  values: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  db: { insert, select },
}));

describe("meeting share rules", () => {
  afterEach(() => {
    insert.mockReset();
    onConflictDoNothing.mockReset();
    select.mockReset();
    values.mockReset();
    vi.resetModules();
  });

  it("grants a future matching meeting to the saved recipient", async () => {
    select
      .mockReturnValueOnce({
        from: () => ({
          where: vi.fn().mockResolvedValue([
            {
              createdByUserId: "owner_user_id",
              recipientEmail: "partner@vendor.com",
              role: "shared",
            },
          ]),
        }),
      })
      .mockReturnValueOnce({
        from: () => ({
          where: vi.fn().mockResolvedValue([
            { email: "partner@vendor.com", id: "partner_user_id" },
          ]),
        }),
      });
    insert.mockReturnValue({ values });
    values.mockReturnValue({ onConflictDoNothing });
    onConflictDoNothing.mockResolvedValue(undefined);

    const { applyMeetingShareRules } = await import(
      "@/lib/meeting-share-rules"
    );

    await expect(
      applyMeetingShareRules({
        attendeeEmails: ["partner@vendor.com", "owner@example.com"],
        meetingId: "22222222-2222-4222-8222-222222222222",
        ownerUserId: "owner_user_id",
        teamId: "team_123",
        title: "Weekly partner sync",
        workspaceDomain: "example.com",
      }),
    ).resolves.toEqual({ sharedCount: 1 });
    expect(values).toHaveBeenCalledWith({
      meetingId: "22222222-2222-4222-8222-222222222222",
      role: "shared",
      userId: "partner_user_id",
    });
    expect(onConflictDoNothing).toHaveBeenCalled();
  });
});
