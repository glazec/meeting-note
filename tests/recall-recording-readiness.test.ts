import { beforeEach, describe, expect, it, vi } from "vitest";

import { getRecallRecordingReadiness } from "@/lib/recall-recording-readiness";

const { probeRecallMediaDurationMs } = vi.hoisted(() => ({
  probeRecallMediaDurationMs: vi.fn(),
}));

vi.mock("@/lib/recall-media-duration", () => ({
  probeRecallMediaDurationMs,
}));

describe("Recall recording readiness", () => {
  beforeEach(() => {
    probeRecallMediaDurationMs.mockReset();
    probeRecallMediaDurationMs.mockResolvedValue(2_571_358);
  });

  it("waits when the recording artifact is shorter than the canonical bot call", async () => {
    await expect(
      getRecallRecordingReadiness(
        {
          status_changes: [
            {
              code: "in_call_recording",
              created_at: "2026-07-22T17:21:27.499Z",
            },
            {
              code: "call_ended",
              created_at: "2026-07-22T18:04:18.857Z",
            },
          ],
          recordings: [
            {
              completed_at: "2026-07-22T18:04:22.306Z",
              id: "recording_123",
              started_at: "2026-07-22T17:45:06.712Z",
              media_shortcuts: {
                video_mixed: {
                  data: {
                    download_url: "https://recall.example.com/short.mp4",
                  },
                },
              },
            },
          ],
        },
        "recording_123",
      ),
    ).resolves.toEqual({
      action: "wait",
      reason: "timing_mismatch",
    });
  });

  it("returns canonical timing and media after Recall becomes consistent", async () => {
    await expect(
      getRecallRecordingReadiness(
        {
          status_changes: [
            {
              code: "in_call_recording",
              created_at: "2026-07-22T17:21:27.499Z",
            },
            {
              code: "call_ended",
              created_at: "2026-07-22T18:04:18.857Z",
            },
          ],
          recordings: [
            {
              completed_at: "2026-07-22T18:04:24.599Z",
              id: "recording_123",
              started_at: "2026-07-22T17:21:27.499Z",
              media_shortcuts: {
                video_mixed: {
                  data: {
                    download_url: "https://recall.example.com/full.mp4",
                  },
                },
              },
            },
          ],
        },
        "recording_123",
      ),
    ).resolves.toEqual({
      action: "ready",
      audioUrl: "https://recall.example.com/full.mp4",
      durationMs: 2_571_358,
      endedAt: new Date("2026-07-22T18:04:18.857Z"),
      startedAt: new Date("2026-07-22T17:21:27.499Z"),
    });
  });

  it("waits when the physical media is shorter than its lifecycle", async () => {
    probeRecallMediaDurationMs.mockResolvedValue(19 * 60_000);

    await expect(
      getRecallRecordingReadiness(
        {
          status_changes: [
            {
              code: "in_call_recording",
              created_at: "2026-07-22T17:21:27.499Z",
            },
            {
              code: "call_ended",
              created_at: "2026-07-22T18:04:18.857Z",
            },
          ],
          recordings: [
            {
              completed_at: "2026-07-22T18:04:24.599Z",
              id: "recording_123",
              started_at: "2026-07-22T17:21:27.499Z",
              media_shortcuts: {
                video_mixed: {
                  data: {
                    download_url: "https://recall.example.com/clipped.mp4",
                  },
                },
              },
            },
          ],
        },
        "recording_123",
      ),
    ).resolves.toEqual({
      action: "wait",
      reason: "media_timing_mismatch",
    });
  });

  it("matches a resumed recording to its own bot lifecycle interval", async () => {
    probeRecallMediaDurationMs.mockResolvedValue(15 * 60_000);

    await expect(
      getRecallRecordingReadiness(
        {
          status_changes: [
            {
              code: "in_call_recording",
              created_at: "2026-07-22T17:00:00.000Z",
            },
            {
              code: "call_ended",
              created_at: "2026-07-22T17:10:00.000Z",
            },
            {
              code: "in_call_recording",
              created_at: "2026-07-22T17:20:00.000Z",
            },
            {
              code: "call_ended",
              created_at: "2026-07-22T17:35:00.000Z",
            },
          ],
          recordings: [
            {
              completed_at: "2026-07-22T17:35:05.000Z",
              id: "recording_456",
              started_at: "2026-07-22T17:20:00.000Z",
              media_shortcuts: {
                video_mixed: {
                  data: {
                    download_url: "https://recall.example.com/part-2.mp4",
                  },
                },
              },
            },
          ],
        },
        "recording_456",
      ),
    ).resolves.toMatchObject({
      action: "ready",
      durationMs: 15 * 60_000,
      startedAt: new Date("2026-07-22T17:20:00.000Z"),
    });
  });
});
