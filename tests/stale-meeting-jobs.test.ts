import { afterEach, describe, expect, it, vi } from "vitest";

const { execute } = vi.hoisted(() => ({
  execute: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  db: { execute },
}));

describe("reconcileStaleMeetingJobs", () => {
  afterEach(() => {
    execute.mockReset();
    vi.resetModules();
  });

  it("fails stale transcript and translation work in one database operation", async () => {
    execute.mockResolvedValue({
      rows: [
        {
          failed_transcript_job_count: 2,
          failed_translation_count: 1,
        },
      ],
    });

    const { reconcileStaleMeetingJobs } = await import(
      "@/lib/stale-meeting-jobs"
    );

    await expect(
      reconcileStaleMeetingJobs({
        now: new Date("2026-07-11T18:00:00.000Z"),
      }),
    ).resolves.toEqual({
      failedTranscriptJobCount: 2,
      failedTranslationCount: 1,
    });
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
