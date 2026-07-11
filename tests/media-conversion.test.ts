import { describe, expect, it, vi } from "vitest";

describe("video media conversion", () => {
  it("runs ffmpeg with hard output and execution limits", async () => {
    const mediaConversion = await import("@/lib/media-conversion");
    const candidate = mediaConversion as typeof mediaConversion & {
      createMediaConversionAdapter: (input: {
        createReadUrl: typeof vi.fn;
        ffmpegPath: string;
        putObject: typeof vi.fn;
        runProcess: typeof vi.fn;
      }) => typeof mediaConversion.convertVideoObjectToAudio;
    };
    expect(candidate.createMediaConversionAdapter).toBeTypeOf("function");

    const createReadUrl = vi
      .fn()
      .mockResolvedValue("https://cdn.example.com/source.mp4");
    const putObject = vi.fn().mockResolvedValue(undefined);
    const runProcess = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]));
    const convert = candidate.createMediaConversionAdapter({
      createReadUrl,
      ffmpegPath: "/usr/local/bin/ffmpeg",
      putObject,
      runProcess,
    });

    await convert({
      sourceObjectKey: "users/user_123/uploads/source.mp4",
      audioObjectKey: "teams/team_123/meetings/meeting_123/assets/audio.mp3",
    });

    expect(runProcess).toHaveBeenCalledWith(
      "/usr/local/bin/ffmpeg",
      expect.arrayContaining([
        "-i",
        "https://cdn.example.com/source.mp4",
        "pipe:1",
      ]),
      {
        maxStdoutBytes: 256 * 1024 * 1024,
        timeoutMs: 2 * 60 * 60 * 1_000,
      },
    );
    expect(putObject).toHaveBeenCalledWith({
      key: "teams/team_123/meetings/meeting_123/assets/audio.mp3",
      body: new Uint8Array([1, 2, 3]),
      contentType: "audio/mpeg",
    });
  });
});
