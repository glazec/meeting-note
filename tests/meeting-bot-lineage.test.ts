import { afterEach, describe, expect, it, vi } from "vitest";

const { limit, select } = vi.hoisted(() => ({
  limit: vi.fn(),
  select: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  db: {
    select,
  },
}));

afterEach(() => {
  limit.mockReset();
  select.mockReset();
});

describe("meeting bot lineage", () => {
  it("accepts only the meeting's current Recall bot", async () => {
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    select.mockReturnValue({ from });
    limit.mockResolvedValue([{ recallBotId: "canonical_bot" }]);
    const { isRecallBotAccepted } = await import("@/lib/meeting-bot-lineage");

    await expect(
      isRecallBotAccepted({
        botId: "canonical_bot",
        meetingId: "11111111-1111-4111-8111-111111111111",
      }),
    ).resolves.toBe(true);
    await expect(
      isRecallBotAccepted({
        botId: "displaced_bot",
        meetingId: "11111111-1111-4111-8111-111111111111",
      }),
    ).resolves.toBe(false);
  });

  it("reads the meeting and bot identity from realtime payload metadata", async () => {
    const { getRecallWebhookBotIdentity } =
      await import("@/lib/meeting-bot-lineage");

    expect(
      getRecallWebhookBotIdentity({
        data: {
          bot: {
            id: "bot_123",
            metadata: {
              meetingId: "11111111-1111-4111-8111-111111111111",
            },
          },
        },
      }),
    ).toEqual({
      botId: "bot_123",
      meetingId: "11111111-1111-4111-8111-111111111111",
    });
  });
});
