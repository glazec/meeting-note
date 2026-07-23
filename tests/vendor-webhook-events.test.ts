import { afterEach, describe, expect, it, vi } from "vitest";

const { insert, select, update } = vi.hoisted(() => ({
  insert: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  db: {
    insert,
    select,
    update,
  },
}));

describe("vendor webhook idempotency", () => {
  afterEach(() => {
    insert.mockReset();
    select.mockReset();
    update.mockReset();
    vi.resetModules();
  });

  it("records a new webhook as unprocessed until side effects complete", async () => {
    const returning = vi.fn().mockResolvedValue([
      {
        id: "11111111-1111-4111-8111-111111111111",
        processedAt: null,
      },
    ]);
    const onConflictDoNothing = vi.fn().mockReturnValue({ returning });
    const values = vi.fn().mockReturnValue({ onConflictDoNothing });

    insert.mockReturnValue({ values });

    const { recordVendorWebhookEvent } =
      await import("@/lib/vendor-webhook-events");

    await expect(
      recordVendorWebhookEvent({
        provider: "recall",
        eventType: "calendar.sync_events",
        idempotencyKey: "msg_calendar_sync",
        payload: { event: "calendar.sync_events" },
      }),
    ).resolves.toEqual({
      id: "11111111-1111-4111-8111-111111111111",
      inserted: true,
      processed: false,
      processingStartedAt: expect.any(Date),
      shouldProcess: true,
    });

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: "msg_calendar_sync",
        processedAt: null,
        processingStartedAt: expect.any(Date),
      }),
    );
  });

  it("skips a duplicate webhook while the stored row is being processed", async () => {
    const returning = vi.fn().mockResolvedValue([]);
    const onConflictDoNothing = vi.fn().mockReturnValue({ returning });
    const values = vi.fn().mockReturnValue({ onConflictDoNothing });
    const processingStartedAt = new Date("2026-06-30T11:58:00.000Z");
    const claimReturning = vi.fn().mockResolvedValue([]);
    const claimWhere = vi.fn().mockReturnValue({ returning: claimReturning });
    const claimSet = vi.fn().mockReturnValue({ where: claimWhere });

    insert.mockReturnValue({ values });
    update.mockReturnValue({ set: claimSet });
    select.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: vi.fn().mockResolvedValue([
            {
              id: "11111111-1111-4111-8111-111111111111",
              processedAt: null,
              processingStartedAt,
            },
          ]),
        }),
      }),
    });

    const { recordVendorWebhookEvent } =
      await import("@/lib/vendor-webhook-events");

    await expect(
      recordVendorWebhookEvent({
        provider: "recall",
        eventType: "calendar.sync_events",
        idempotencyKey: "msg_calendar_sync",
        payload: { event: "calendar.sync_events" },
      }),
    ).resolves.toEqual({
      id: "11111111-1111-4111-8111-111111111111",
      inserted: false,
      processed: false,
      shouldProcess: false,
    });
    expect(claimSet).toHaveBeenCalled();
  });

  it("claims a stale unfinished webhook before retrying it", async () => {
    const returning = vi.fn().mockResolvedValue([]);
    const onConflictDoNothing = vi.fn().mockReturnValue({ returning });
    const values = vi.fn().mockReturnValue({ onConflictDoNothing });
    const claimReturning = vi.fn().mockResolvedValue([
      {
        id: "11111111-1111-4111-8111-111111111111",
        processedAt: null,
        processingStartedAt: new Date("2026-06-30T12:00:00.000Z"),
      },
    ]);
    const claimWhere = vi.fn().mockReturnValue({ returning: claimReturning });
    const claimSet = vi.fn().mockReturnValue({ where: claimWhere });

    insert.mockReturnValue({ values });
    update.mockReturnValue({ set: claimSet });

    const { recordVendorWebhookEvent } =
      await import("@/lib/vendor-webhook-events");

    await expect(
      recordVendorWebhookEvent({
        provider: "recall",
        eventType: "calendar.sync_events",
        idempotencyKey: "msg_calendar_sync",
        payload: { event: "calendar.sync_events" },
      }),
    ).resolves.toEqual({
      id: "11111111-1111-4111-8111-111111111111",
      inserted: false,
      processed: false,
      processingStartedAt: new Date("2026-06-30T12:00:00.000Z"),
      shouldProcess: true,
    });

    expect(claimSet).toHaveBeenCalledWith(
      expect.objectContaining({
        processingStartedAt: expect.any(Date),
        updatedAt: expect.any(Date),
      }),
    );
    expect(select).not.toHaveBeenCalled();
  });

  it("skips a duplicate webhook when the stored row is already processed", async () => {
    const processedAt = new Date("2026-06-30T12:00:00.000Z");
    const returning = vi.fn().mockResolvedValue([]);
    const onConflictDoNothing = vi.fn().mockReturnValue({ returning });
    const values = vi.fn().mockReturnValue({ onConflictDoNothing });
    const claimReturning = vi.fn().mockResolvedValue([]);
    const claimWhere = vi.fn().mockReturnValue({ returning: claimReturning });
    const claimSet = vi.fn().mockReturnValue({ where: claimWhere });

    insert.mockReturnValue({ values });
    update.mockReturnValue({ set: claimSet });
    select.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: vi.fn().mockResolvedValue([
            {
              id: "11111111-1111-4111-8111-111111111111",
              processedAt,
            },
          ]),
        }),
      }),
    });

    const { recordVendorWebhookEvent } =
      await import("@/lib/vendor-webhook-events");

    await expect(
      recordVendorWebhookEvent({
        provider: "recall",
        eventType: "calendar.sync_events",
        idempotencyKey: "msg_calendar_sync",
        payload: { event: "calendar.sync_events" },
      }),
    ).resolves.toEqual({
      id: "11111111-1111-4111-8111-111111111111",
      inserted: false,
      processed: true,
      shouldProcess: false,
    });
  });

  it("marks a webhook processed after side effects finish", async () => {
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where });

    update.mockReturnValue({ set });

    const { markVendorWebhookEventProcessed } =
      await import("@/lib/vendor-webhook-events");

    await markVendorWebhookEventProcessed({
      provider: "recall",
      idempotencyKey: "msg_calendar_sync",
    });

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        processedAt: expect.any(Date),
        processingStartedAt: null,
        updatedAt: expect.any(Date),
      }),
    );
  });
});
