import { afterEach, describe, expect, it, vi } from "vitest";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

const { select, selectWhere, sendOneSignalLocationReminder, update } = vi.hoisted(() => ({
  select: vi.fn(),
  selectWhere: vi.fn(),
  sendOneSignalLocationReminder: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  db: { select, update },
}));

vi.mock("@/lib/vendors/onesignal", () => ({
  sendOneSignalLocationReminder,
}));

describe("location reminders", () => {
  afterEach(() => {
    select.mockReset();
    selectWhere.mockReset();
    sendOneSignalLocationReminder.mockReset();
    update.mockReset();
    vi.resetModules();
  });

  it("sends due location reminders through OneSignal", async () => {
    const now = new Date("2026-06-30T11:58:00.000Z");
    const { claimSet, sentSet } = mockReminderUpdateSequence({
      claimed: true,
    });
    mockDueReminderRows([dueReminder]);
    sendOneSignalLocationReminder.mockResolvedValue({
      id: "notification_123",
    });

    const { sendDueLocationReminders } = await import(
      "@/lib/location-reminders"
    );

    await expect(
      sendDueLocationReminders({
        now,
      }),
    ).resolves.toEqual({ sentCount: 1 });

    expect(claimSet).toHaveBeenCalledWith({
      errorMessage: null,
      status: "sending",
      updatedAt: now,
    });
    expect(sendOneSignalLocationReminder).toHaveBeenCalledWith({
      externalUserId: "11111111-1111-4111-8111-111111111111",
      location: "IOSG 12F",
      meetingId: "22222222-2222-4222-8222-222222222222",
      meetingTitle: "Founder office visit",
    });
    expect(sentSet).toHaveBeenCalledWith({
      providerNotificationId: "notification_123",
      sentAt: now,
      status: "sent",
      updatedAt: now,
    });
    const query = new PgDialect().sqlToQuery(
      selectWhere.mock.calls[0][0] as SQL,
    );
    expect(query.sql).toContain('"meetings"."status"');
    expect(query.params).toContain("scheduled");
  });

  it("does not send a reminder another worker already claimed", async () => {
    mockDueReminderRows([dueReminder]);
    mockReminderUpdateSequence({ claimed: false });

    const { sendDueLocationReminders } = await import(
      "@/lib/location-reminders"
    );

    await expect(
      sendDueLocationReminders({
        now: new Date("2026-06-30T11:58:00.000Z"),
      }),
    ).resolves.toEqual({ sentCount: 0 });

    expect(sendOneSignalLocationReminder).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("does not send a location reminder after the meeting has started", async () => {
    const now = new Date("2026-06-30T12:05:00.000Z");
    mockDueReminderRows([dueReminder]);
    const { failedSet } = mockReminderUpdateSequence({
      claimed: true,
      secondUpdate: "failed",
    });

    const { sendDueLocationReminders } = await import(
      "@/lib/location-reminders"
    );

    await expect(sendDueLocationReminders({ now })).resolves.toEqual({
      sentCount: 0,
    });

    expect(sendOneSignalLocationReminder).not.toHaveBeenCalled();
    expect(failedSet).toHaveBeenCalledWith({
      errorMessage: "Reminder expired after meeting start",
      status: "failed",
      updatedAt: now,
    });
  });
});

const dueReminder = {
  id: "reminder_123",
  meetingId: "22222222-2222-4222-8222-222222222222",
  userId: "11111111-1111-4111-8111-111111111111",
  title: "Founder office visit",
  location: "IOSG 12F",
  startsAt: new Date("2026-06-30T12:00:00.000Z"),
};

function mockDueReminderRows(rows: unknown[]) {
  select.mockReturnValue({
    from: () => ({
      innerJoin: () => ({
        innerJoin: () => ({
          innerJoin: () => ({
            where: selectWhere.mockImplementation(() => ({
              limit: vi.fn().mockResolvedValue(rows),
            })),
          }),
        }),
      }),
    }),
  });
}

function mockReminderUpdateSequence(input: {
  claimed: boolean;
  secondUpdate?: "sent" | "failed";
}) {
  const claimReturning = vi
    .fn()
    .mockResolvedValue(input.claimed ? [{ id: dueReminder.id }] : []);
  const claimWhere = vi.fn().mockReturnValue({ returning: claimReturning });
  const claimSet = vi.fn().mockReturnValue({ where: claimWhere });
  const sentWhere = vi.fn().mockResolvedValue(undefined);
  const sentSet = vi.fn().mockReturnValue({ where: sentWhere });
  const failedWhere = vi.fn().mockResolvedValue(undefined);
  const failedSet = vi.fn().mockReturnValue({ where: failedWhere });

  update.mockReturnValueOnce({ set: claimSet });

  if (input.secondUpdate === "failed") {
    update.mockReturnValueOnce({ set: failedSet });
  } else {
    update
      .mockReturnValueOnce({ set: sentSet })
      .mockReturnValueOnce({ set: failedSet });
  }

  return { claimSet, failedSet, sentSet };
}
