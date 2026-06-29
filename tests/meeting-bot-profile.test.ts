import { afterEach, describe, expect, it, vi } from "vitest";

const { insert, select } = vi.hoisted(() => ({
  insert: vi.fn(),
  select: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  db: { insert, select },
}));

describe("meeting bot profile", () => {
  afterEach(() => {
    insert.mockReset();
    select.mockReset();
    vi.resetModules();
  });

  it("returns the saved team bot profile", async () => {
    select.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: vi.fn().mockResolvedValue([
            {
              botName: "Deal Scribe",
              avatarJpegBase64: "custom-avatar",
            },
          ]),
        }),
      }),
    });

    const { getMeetingBotProfile } = await import("@/lib/meeting-bot-profile");

    await expect(getMeetingBotProfile("team_123")).resolves.toEqual({
      botName: "Deal Scribe",
      avatarJpegBase64: "custom-avatar",
    });
  });

  it("normalizes and stores a JPG avatar for the team", async () => {
    const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn().mockReturnValue({ onConflictDoUpdate });
    insert.mockReturnValue({ values });

    const { upsertMeetingBotProfile } = await import(
      "@/lib/meeting-bot-profile"
    );

    await upsertMeetingBotProfile({
      teamId: "team_123",
      botName: " Deal   Scribe ",
      avatarFile: new File([new Uint8Array([1, 2, 3])], "avatar.jpg", {
        type: "image/jpeg",
      }),
    });

    expect(values).toHaveBeenCalledWith({
      teamId: "team_123",
      botName: "Deal Scribe",
      avatarJpegBase64: "AQID",
    });
  });

  it("rejects non JPG avatar files", async () => {
    const { upsertMeetingBotProfile } = await import(
      "@/lib/meeting-bot-profile"
    );

    await expect(
      upsertMeetingBotProfile({
        teamId: "team_123",
        botName: "Deal Scribe",
        avatarFile: new File(["not a jpg"], "avatar.png", {
          type: "image/png",
        }),
      }),
    ).rejects.toThrow("Bot avatar must be a JPG image");
  });
});
