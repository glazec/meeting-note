import { afterEach, describe, expect, it, vi } from "vitest";

const createLocalRecorderDeviceSession = vi.fn();
const getLocalRecorderDeviceRequestContext = vi.fn();
const listMissedLocalRecorderMeetings = vi.fn();
const claimLocalRecorderIntent = vi.fn();
const failLocalRecorderIntent = vi.fn();
const completeLocalRecorderRecordingUpload = vi.fn();
const prepareLocalRecorderRecordingUpload = vi.fn();

vi.mock("@/lib/local-recorder-auth", () => ({
  createLocalRecorderDeviceSession,
  getLocalRecorderDeviceRequestContext,
}));

vi.mock("@/lib/local-recorder-records", () => ({
  claimLocalRecorderIntent,
  completeLocalRecorderRecordingUpload,
  failLocalRecorderIntent,
  listMissedLocalRecorderMeetings,
  prepareLocalRecorderRecordingUpload,
}));

function mockSignedInDevice() {
  getLocalRecorderDeviceRequestContext.mockResolvedValue({
    ok: true,
    deviceId: "mac_123",
    workspace: {
      teamId: "team_123",
      userId: "user_123",
    },
  });
}

describe("local recorder API routes", () => {
  afterEach(() => {
    createLocalRecorderDeviceSession.mockReset();
    getLocalRecorderDeviceRequestContext.mockReset();
    listMissedLocalRecorderMeetings.mockReset();
    claimLocalRecorderIntent.mockReset();
    failLocalRecorderIntent.mockReset();
    completeLocalRecorderRecordingUpload.mockReset();
    prepareLocalRecorderRecordingUpload.mockReset();
    vi.resetModules();
  });

  it("returns eligible missed meetings for a signed in Mac device", async () => {
    mockSignedInDevice();
    listMissedLocalRecorderMeetings.mockResolvedValue([
      {
        displayTimeWindow: {
          endsAt: "2026-06-30T13:00:00.000Z",
          startsAt: "2026-06-30T12:00:00.000Z",
        },
        expiresAt: "2026-06-30T13:15:00.000Z",
        fallbackIntentId: "intent_123",
        title: "Weekly sync",
      },
    ]);

    const { GET } = await import(
      "@/app/api/local-recorder/missed-meetings/route"
    );
    const response = await GET(
      new Request("https://app.example.com/api/local-recorder/missed-meetings", {
        headers: { "x-local-recorder-device-id": "mac_123" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      meetings: [
        {
          displayTimeWindow: {
            endsAt: "2026-06-30T13:00:00.000Z",
            startsAt: "2026-06-30T12:00:00.000Z",
          },
          expiresAt: "2026-06-30T13:15:00.000Z",
          fallbackIntentId: "intent_123",
          title: "Weekly sync",
        },
      ],
    });
    expect(listMissedLocalRecorderMeetings).toHaveBeenCalledWith({
      deviceId: "mac_123",
      now: expect.any(Date),
      workspace: {
        teamId: "team_123",
        userId: "user_123",
      },
    });
  });

  it("claims a fallback intent before recording starts", async () => {
    mockSignedInDevice();
    claimLocalRecorderIntent.mockResolvedValue({
      claimed: true,
      meetingTitle: "Weekly sync",
    });

    const { POST } = await import(
      "@/app/api/local-recorder/intents/[fallbackIntentId]/start/route"
    );
    const response = await POST(
      new Request(
        "https://app.example.com/api/local-recorder/intents/intent_123/start",
        {
          method: "POST",
          headers: { "x-local-recorder-device-id": "mac_123" },
        },
      ),
      { params: Promise.resolve({ fallbackIntentId: "intent_123" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      claimed: true,
      meetingTitle: "Weekly sync",
    });
  });

  it("marks a claimed fallback intent failed when local capture cannot start", async () => {
    mockSignedInDevice();
    failLocalRecorderIntent.mockResolvedValue({
      failed: true,
    });

    const { POST } = await import(
      "@/app/api/local-recorder/intents/[fallbackIntentId]/fail/route"
    );
    const response = await POST(
      new Request(
        "https://app.example.com/api/local-recorder/intents/intent_123/fail",
        {
          method: "POST",
          body: JSON.stringify({ errorMessage: "Screen recording denied" }),
          headers: { "x-local-recorder-device-id": "mac_123" },
        },
      ),
      { params: Promise.resolve({ fallbackIntentId: "intent_123" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ failed: true });
    expect(failLocalRecorderIntent).toHaveBeenCalledWith({
      deviceId: "mac_123",
      errorMessage: "Screen recording denied",
      fallbackIntentId: "intent_123",
      now: expect.any(Date),
      workspace: {
        teamId: "team_123",
        userId: "user_123",
      },
    });
  });

  it("prepares direct upload URLs for all local recorder audio assets", async () => {
    mockSignedInDevice();
    prepareLocalRecorderRecordingUpload.mockResolvedValue({
      assets: {
        computerAudio: {
          assetId: "asset_computer",
          contentType: "audio/wav",
          uploadUrl: "https://r2.example.com/computer",
        },
        microphoneAudio: {
          assetId: "asset_microphone",
          contentType: "audio/wav",
          uploadUrl: "https://r2.example.com/microphone",
        },
        synthesizedAudio: {
          assetId: "asset_synthesized",
          contentType: "audio/wav",
          uploadUrl: "https://r2.example.com/synthesized",
        },
      },
    });

    const { POST } = await import(
      "@/app/api/local-recorder/recordings/prepare/route"
    );
    const response = await POST(
      new Request("https://app.example.com/api/local-recorder/recordings/prepare", {
        method: "POST",
        body: JSON.stringify({
          fallbackIntentId: "intent_123",
          clientRecordingId: "recording_123",
          recordingStartedAt: "2026-06-30T12:02:00.000Z",
          recordingStoppedAt: "2026-06-30T13:00:00.000Z",
          manifest: { appVersion: "0.1.0" },
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      assets: {
        computerAudio: {
          assetId: "asset_computer",
          contentType: "audio/wav",
          uploadUrl: "https://r2.example.com/computer",
        },
        microphoneAudio: {
          assetId: "asset_microphone",
          contentType: "audio/wav",
          uploadUrl: "https://r2.example.com/microphone",
        },
        synthesizedAudio: {
          assetId: "asset_synthesized",
          contentType: "audio/wav",
          uploadUrl: "https://r2.example.com/synthesized",
        },
      },
    });
    expect(prepareLocalRecorderRecordingUpload).toHaveBeenCalledWith({
      clientRecordingId: "recording_123",
      deviceId: "mac_123",
      fallbackIntentId: "intent_123",
      manifest: { appVersion: "0.1.0" },
      recordingStartedAt: new Date("2026-06-30T12:02:00.000Z"),
      recordingStoppedAt: new Date("2026-06-30T13:00:00.000Z"),
      workspace: {
        teamId: "team_123",
        userId: "user_123",
      },
    });
  });

  it("completes a direct local recorder upload and queues processing", async () => {
    mockSignedInDevice();
    completeLocalRecorderRecordingUpload.mockResolvedValue({
      meetingId: "11111111-1111-4111-8111-111111111111",
      queued: true,
    });

    const { POST } = await import(
      "@/app/api/local-recorder/recordings/complete/route"
    );
    const response = await POST(
      new Request("https://app.example.com/api/local-recorder/recordings/complete", {
        method: "POST",
        body: JSON.stringify({
          fallbackIntentId: "intent_123",
          clientRecordingId: "recording_123",
          recordingStartedAt: "2026-06-30T12:02:00.000Z",
          recordingStoppedAt: "2026-06-30T13:00:00.000Z",
          manifest: { appVersion: "0.1.0" },
          assets: {
            computerAudioAssetId: "asset_computer",
            microphoneAudioAssetId: "asset_microphone",
            synthesizedAudioAssetId: "asset_synthesized",
          },
        }),
      }),
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      meetingId: "11111111-1111-4111-8111-111111111111",
      queued: true,
    });
    expect(completeLocalRecorderRecordingUpload).toHaveBeenCalledWith({
      assets: {
        computerAudioAssetId: "asset_computer",
        microphoneAudioAssetId: "asset_microphone",
        synthesizedAudioAssetId: "asset_synthesized",
      },
      clientRecordingId: "recording_123",
      deviceId: "mac_123",
      fallbackIntentId: "intent_123",
      manifest: { appVersion: "0.1.0" },
      recordingStartedAt: new Date("2026-06-30T12:02:00.000Z"),
      recordingStoppedAt: new Date("2026-06-30T13:00:00.000Z"),
      workspace: {
        teamId: "team_123",
        userId: "user_123",
      },
    });
  });

  it("returns 400 when direct local recorder upload completion is invalid", async () => {
    mockSignedInDevice();

    const { POST } = await import(
      "@/app/api/local-recorder/recordings/complete/route"
    );
    const response = await POST(
      new Request("https://app.example.com/api/local-recorder/recordings/complete", {
        method: "POST",
        body: JSON.stringify({
          fallbackIntentId: "intent_123",
          clientRecordingId: "recording_123",
          recordingStartedAt: "2026-06-30T12:02:00.000Z",
          recordingStoppedAt: "2026-06-30T13:00:00.000Z",
          assets: {
            computerAudioAssetId: "asset_computer",
          },
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid local recording completion",
    });
    expect(completeLocalRecorderRecordingUpload).not.toHaveBeenCalled();
  });

  it("redirects signed in web users back to the Mac app with a device token", async () => {
    createLocalRecorderDeviceSession.mockResolvedValue({
      redirectUrl:
        "meetingnote-local-recorder://login?token=token_123&server=https%3A%2F%2Fapp.example.com",
    });

    const { GET } = await import(
      "@/app/api/local-recorder/device-login/route"
    );
    const response = await GET(
      new Request(
        "https://app.example.com/api/local-recorder/device-login?deviceId=mac_123&callbackUrl=meetingnote-local-recorder%3A%2F%2Flogin",
      ),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "meetingnote-local-recorder://login?token=token_123&server=https%3A%2F%2Fapp.example.com",
    );
  });
});
