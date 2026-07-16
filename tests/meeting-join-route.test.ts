import { afterEach, describe, expect, it, vi } from "vitest";

const { getCurrentUser, joinScheduledMeetingBotNow } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  joinScheduledMeetingBotNow: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentUser }));

vi.mock("@/lib/meeting-bot-join", () => ({
  MeetingBotJoinUnavailableError: class extends Error {
    constructor() {
      super("Meeting bot is no longer scheduled");
    }
  },
  joinScheduledMeetingBotNow,
}));

async function postJoin(meetingId: string) {
  const { POST } = await import(
    "@/app/api/meetings/[meetingId]/join/route"
  );

  return POST(
    new Request(`https://app.example.com/api/meetings/${meetingId}/join`, {
      method: "POST",
    }),
    { params: Promise.resolve({ meetingId }) },
  );
}

describe("POST /api/meetings/[meetingId]/join", () => {
  afterEach(() => {
    getCurrentUser.mockReset();
    joinScheduledMeetingBotNow.mockReset();
    vi.resetModules();
  });

  it("asks a scheduled bot to join now", async () => {
    const user = {
      email: "test@iosg.vc",
      id: "user_123",
      name: null,
    };
    getCurrentUser.mockResolvedValue(user);
    joinScheduledMeetingBotNow.mockResolvedValue({
      meetingId: "11111111-1111-4111-8111-111111111111",
    });

    const response = await postJoin(
      "11111111-1111-4111-8111-111111111111",
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      meetingId: "11111111-1111-4111-8111-111111111111",
      status: "joining",
    });
    expect(joinScheduledMeetingBotNow).toHaveBeenCalledWith({
      meetingId: "11111111-1111-4111-8111-111111111111",
      sessionUser: user,
    });
  });

  it("returns 404 for an invalid meeting id", async () => {
    getCurrentUser.mockResolvedValue({
      email: "test@iosg.vc",
      id: "user_123",
      name: null,
    });

    const response = await postJoin("not-a-meeting-id");

    expect(response.status).toBe(404);
    expect(joinScheduledMeetingBotNow).not.toHaveBeenCalled();
  });

  it("returns 409 when the scheduled bot is no longer available", async () => {
    getCurrentUser.mockResolvedValue({
      email: "test@iosg.vc",
      id: "user_123",
      name: null,
    });
    const { MeetingBotJoinUnavailableError } = await import(
      "@/lib/meeting-bot-join"
    );
    joinScheduledMeetingBotNow.mockRejectedValue(
      new MeetingBotJoinUnavailableError(),
    );

    const response = await postJoin(
      "11111111-1111-4111-8111-111111111111",
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Meeting bot is no longer scheduled",
    });
  });
});
