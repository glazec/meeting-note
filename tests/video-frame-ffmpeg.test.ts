import { EventEmitter } from "node:events";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createProcessRunner,
  createVideoFrameFfmpegAdapter,
  extractJpegFrame,
  type ProcessRunner,
} from "@/lib/video-frame-ffmpeg";

const FRAME_BYTE_LENGTH = 160 * 90;
const VIDEO_HOST =
  "ap-northeast-1-recallai-production-bot-data.s3.amazonaws.com";
const VIDEO_URL =
  `https://${VIDEO_HOST}/video.mp4?X-Amz-Signature=secret`;

function rawFrames(values: number[]): Uint8Array {
  const output = new Uint8Array(values.length * FRAME_BYTE_LENGTH);

  values.forEach((value, index) => {
    output.fill(
      value,
      index * FRAME_BYTE_LENGTH,
      (index + 1) * FRAME_BYTE_LENGTH,
    );
  });

  return output;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

function createFakeChildProcess() {
  return Object.assign(new EventEmitter(), {
    kill: vi.fn(() => true),
    stderr: new PassThrough(),
    stdout: new PassThrough(),
  });
}

describe("sampleScreenShareFrames", () => {
  it("passes exact sampling arguments with input seeking before the URL", async () => {
    const calls: Array<{
      binary: string;
      args: string[];
      options: { timeoutMs: number };
    }> = [];
    const runProcess: ProcessRunner = async (binary, args, options) => {
      calls.push({ binary, args, options });
      return new Uint8Array();
    };
    const adapter = createVideoFrameFfmpegAdapter({
      env: { FFMPEG_PATH: "/custom/ffmpeg" },
      runProcess,
    });

    await adapter.sampleScreenShareFrames({
      intervals: [{ startMs: 10_000, endMs: 30_000 }],
      videoUrl: VIDEO_URL,
    });

    expect(calls).toEqual([
      {
        binary: "/custom/ffmpeg",
        options: {
          maxStdoutBytes: 901 * FRAME_BYTE_LENGTH,
          timeoutMs: 30 * 60 * 1_000,
        },
        args: [
          "-hide_banner",
          "-loglevel",
          "error",
          "-ss",
          "10.000",
          "-t",
          "20.000",
          "-rw_timeout",
          "15000000",
          "-tls_verify",
          "1",
          "-verifyhost",
          VIDEO_HOST,
          "-max_redirects",
          "0",
          "-i",
          VIDEO_URL,
          "-an",
          "-vf",
          "fps=1,scale=160:90,format=gray",
          "-pix_fmt",
          "gray",
          "-f",
          "rawvideo",
          "pipe:1",
        ],
      },
    ]);
    const inputIndex = calls[0].args.indexOf("-i");
    for (const option of [
      "-rw_timeout",
      "-tls_verify",
      "-verifyhost",
      "-max_redirects",
    ]) {
      expect(calls[0].args.indexOf(option)).toBeLessThan(inputIndex);
    }
  });

  it("splits raw frames, timestamps them, and preserves interval order", async () => {
    const outputs = [rawFrames([1, 2, 3]), rawFrames([5])];
    const adapter = createVideoFrameFfmpegAdapter({
      runProcess: async () => outputs.shift() ?? new Uint8Array(),
    });

    const frames = await adapter.sampleScreenShareFrames({
      intervals: [
        { startMs: 10_000, endMs: 12_500 },
        { startMs: 20_000, endMs: 21_000 },
      ],
      videoUrl: VIDEO_URL,
    });

    expect(frames.map((frame) => frame.timestampMs)).toEqual([
      10_000, 11_000, 12_000, 20_000,
    ]);
    expect(frames.map((frame) => frame.pixels[0])).toEqual([1, 2, 3, 5]);
    expect(frames.every((frame) => frame.pixels.length === FRAME_BYTE_LENGTH)).toBe(
      true,
    );
  });

  it.each([
    ["1 second", 1_000, 1, [10_000]],
    ["2 seconds", 2_000, 2, [10_000, 11_000]],
    ["2.5 seconds", 2_500, 3, [10_000, 11_000, 12_000]],
  ])(
    "timestamps realistic %s ffmpeg output",
    async (_label, durationMs, frameCount, expectedTimestamps) => {
      const adapter = createVideoFrameFfmpegAdapter({
        runProcess: async () =>
          rawFrames(Array.from({ length: frameCount }, (_, index) => index)),
      });

      const frames = await adapter.sampleScreenShareFrames({
        intervals: [{ startMs: 10_000, endMs: 10_000 + durationMs }],
        videoUrl: VIDEO_URL,
      });

      expect(frames.map((frame) => frame.timestampMs)).toEqual(
        expectedTimestamps,
      );
    },
  );

  it("does not emit an unexpected frame at screenshare_off", async () => {
    const adapter = createVideoFrameFfmpegAdapter({
      runProcess: async () => rawFrames([1, 2]),
    });

    const frames = await adapter.sampleScreenShareFrames({
      intervals: [{ startMs: 10_000, endMs: 11_000 }],
      videoUrl: VIDEO_URL,
    });

    expect(frames.map((frame) => frame.timestampMs)).toEqual([10_000]);
  });

  it("rejects trailing incomplete raw frame bytes", async () => {
    const adapter = createVideoFrameFfmpegAdapter({
      runProcess: async () => new Uint8Array(FRAME_BYTE_LENGTH + 1),
    });

    await expect(
      adapter.sampleScreenShareFrames({
        intervals: [{ startMs: 0, endMs: 2_000 }],
        videoUrl: VIDEO_URL,
      }),
    ).rejects.toThrow(/incomplete/i);
  });

  it.each([
    ["nonfinite start", { startMs: Number.NaN, endMs: 1_000 }],
    ["nonfinite end", { startMs: 0, endMs: Number.POSITIVE_INFINITY }],
    ["negative start", { startMs: -1, endMs: 1_000 }],
    ["negative end", { startMs: 0, endMs: -1 }],
    ["empty", { startMs: 1_000, endMs: 1_000 }],
    ["reversed", { startMs: 2_000, endMs: 1_000 }],
  ])("rejects a %s interval before spawning", async (_label, interval) => {
    const runProcess = vi.fn<ProcessRunner>();
    const adapter = createVideoFrameFfmpegAdapter({ runProcess });

    await expect(
      adapter.sampleScreenShareFrames({
        intervals: [interval],
        videoUrl: VIDEO_URL,
      }),
    ).rejects.toThrow(/interval/i);
    expect(runProcess).not.toHaveBeenCalled();
  });

  it("validates every interval before starting the first process", async () => {
    const runProcess = vi.fn<ProcessRunner>();
    const adapter = createVideoFrameFfmpegAdapter({ runProcess });

    await expect(
      adapter.sampleScreenShareFrames({
        intervals: [
          { startMs: 0, endMs: 1_000 },
          { startMs: 2_000, endMs: 2_000 },
        ],
        videoUrl: VIDEO_URL,
      }),
    ).rejects.toThrow(/interval/i);
    expect(runProcess).not.toHaveBeenCalled();
  });

  it("splits long intervals into scan chunks of at most 15 minutes", async () => {
    const calls: Array<{
      args: string[];
      options: { maxStdoutBytes?: number; timeoutMs: number };
    }> = [];
    const adapter = createVideoFrameFfmpegAdapter({
      runProcess: async (_binary, args, options) => {
        calls.push({ args, options });
        return new Uint8Array();
      },
    });

    await adapter.sampleScreenShareFrames({
      intervals: [{ startMs: 10_000, endMs: 1_810_500 }],
      videoUrl: VIDEO_URL,
    });

    expect(
      calls.map(({ args }) => ({
        duration: args[args.indexOf("-t") + 1],
        start: args[args.indexOf("-ss") + 1],
      })),
    ).toEqual([
      { start: "10.000", duration: "900.000" },
      { start: "910.000", duration: "900.000" },
      { start: "1810.000", duration: "0.500" },
    ]);
    expect(calls.map(({ options }) => options)).toEqual(
      Array(3).fill({
        maxStdoutBytes: 901 * FRAME_BYTE_LENGTH,
        timeoutMs: 30 * 60 * 1_000,
      }),
    );
  });
});

describe("extractJpegFrame", () => {
  it("seeks before input and requests a full resolution high quality JPEG", async () => {
    const calls: Array<{
      binary: string;
      args: string[];
      options: { timeoutMs: number };
    }> = [];
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const adapter = createVideoFrameFfmpegAdapter({
      env: { FFMPEG_PATH: "/custom/ffmpeg" },
      runProcess: async (binary, args, options) => {
        calls.push({ binary, args, options });
        return jpeg;
      },
    });

    await expect(
      adapter.extractJpegFrame({ timestampMs: 12_000, videoUrl: VIDEO_URL }),
    ).resolves.toEqual(jpeg);

    expect(calls).toEqual([
      {
        binary: "/custom/ffmpeg",
        options: { timeoutMs: 60_000 },
        args: [
          "-hide_banner",
          "-loglevel",
          "error",
          "-ss",
          "12.000",
          "-rw_timeout",
          "15000000",
          "-tls_verify",
          "1",
          "-verifyhost",
          VIDEO_HOST,
          "-max_redirects",
          "0",
          "-i",
          VIDEO_URL,
          "-an",
          "-frames:v",
          "1",
          "-q:v",
          "2",
          "-pix_fmt",
          "yuvj444p",
          "-vcodec",
          "mjpeg",
          "-f",
          "image2pipe",
          "pipe:1",
        ],
      },
    ]);
    expect(calls[0].args.join(" ")).not.toContain("scale");
    expect(calls[0].args.indexOf("-ss")).toBeLessThan(
      calls[0].args.indexOf("-i"),
    );
    const inputIndex = calls[0].args.indexOf("-i");
    for (const option of [
      "-rw_timeout",
      "-tls_verify",
      "-verifyhost",
      "-max_redirects",
    ]) {
      expect(calls[0].args.indexOf(option)).toBeLessThan(inputIndex);
    }
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1])(
    "rejects invalid timestamp %s before spawning",
    async (timestampMs) => {
      const runProcess = vi.fn<ProcessRunner>();
      const adapter = createVideoFrameFfmpegAdapter({ runProcess });

      await expect(
        adapter.extractJpegFrame({ timestampMs, videoUrl: VIDEO_URL }),
      ).rejects.toThrow(/timestamp/i);
      expect(runProcess).not.toHaveBeenCalled();
    },
  );

  it("rejects an empty JPEG", async () => {
    const adapter = createVideoFrameFfmpegAdapter({
      runProcess: async () => new Uint8Array(),
    });

    await expect(
      adapter.extractJpegFrame({ timestampMs: 0, videoUrl: VIDEO_URL }),
    ).rejects.toThrow(/empty/i);
  });
});

describe("probeVideoDurationMs", () => {
  it("passes exact ffprobe arguments and rounds duration to milliseconds", async () => {
    const calls: Array<{
      binary: string;
      args: string[];
      options: { timeoutMs: number };
    }> = [];
    const adapter = createVideoFrameFfmpegAdapter({
      env: { FFPROBE_PATH: "/custom/ffprobe" },
      runProcess: async (binary, args, options) => {
        calls.push({ binary, args, options });
        return new TextEncoder().encode('{"format":{"duration":"12.3456"}}');
      },
    });

    await expect(adapter.probeVideoDurationMs(VIDEO_URL)).resolves.toBe(12_346);
    expect(calls).toEqual([
      {
        binary: "/custom/ffprobe",
        options: { timeoutMs: 30_000 },
        args: [
          "-v",
          "error",
          "-show_entries",
          "format=duration",
          "-of",
          "json",
          "-rw_timeout",
          "15000000",
          "-tls_verify",
          "1",
          "-verifyhost",
          VIDEO_HOST,
          "-max_redirects",
          "0",
          VIDEO_URL,
        ],
      },
    ]);
    const urlIndex = calls[0].args.indexOf(VIDEO_URL);
    for (const option of [
      "-rw_timeout",
      "-tls_verify",
      "-verifyhost",
      "-max_redirects",
    ]) {
      expect(calls[0].args.indexOf(option)).toBeLessThan(urlIndex);
    }
  });

  it.each([
    "not json",
    "{}",
    '{"format":{"duration":"nope"}}',
    '{"format":{"duration":true}}',
    '{"format":{"duration":"0"}}',
    '{"format":{"duration":"-1"}}',
  ])("rejects malformed or nonpositive output: %s", async (stdout) => {
    const adapter = createVideoFrameFfmpegAdapter({
      runProcess: async () => new TextEncoder().encode(stdout),
    });

    await expect(adapter.probeVideoDurationMs(VIDEO_URL)).rejects.toThrow(
      /duration/i,
    );
  });
});

describe("video URL validation", () => {
  it.each([
    "http://example.com/video.mp4",
    "https://user:password@example.com/video.mp4",
    "https://localhost/video.mp4",
    "https://worker.localhost/video.mp4",
    "https://127.0.0.1/video.mp4",
    "https://10.2.3.4/video.mp4",
    "https://172.16.0.1/video.mp4",
    "https://192.168.1.1/video.mp4",
    "https://169.254.2.3/video.mp4",
    "https://0.0.0.0/video.mp4",
    "https://100.64.0.1/video.mp4",
    "https://192.0.0.1/video.mp4",
    "https://198.18.0.1/video.mp4",
    "https://224.0.0.1/video.mp4",
    "https://255.255.255.255/video.mp4",
    "https://[::1]/video.mp4",
    "https://[::]/video.mp4",
    "https://[fc00::1]/video.mp4",
    "https://[fe80::1]/video.mp4",
    "https://[ff02::1]/video.mp4",
    "https://[::ffff:127.0.0.1]/video.mp4",
    "https://example.com/video.mp4",
    "https://zz-attacker-1-recallai-production-bot-data.s3.amazonaws.com/video.mp4",
    "https://recallai-production-bot-data.s3.ap-northeast-1.amazonaws.com/video.mp4",
  ])("rejects unsafe URL before spawning: %s", async (videoUrl) => {
    const runProcess = vi.fn<ProcessRunner>();
    const adapter = createVideoFrameFfmpegAdapter({ runProcess });

    await expect(adapter.probeVideoDurationMs(videoUrl)).rejects.toThrow(
      /video URL/i,
    );
    expect(runProcess).not.toHaveBeenCalled();
  });

  it.each([
    "https://recallai-production-bot-data.s3.amazonaws.com/video.mp4?X-Amz-Signature=official",
    "https://ap-northeast-1-recallai-production-bot-data.s3.amazonaws.com/video.mp4?X-Amz-Signature=observed",
  ])("accepts a trusted Recall S3 URL: %s", async (videoUrl) => {
    const runProcess = vi.fn<ProcessRunner>(async () =>
      new TextEncoder().encode('{"format":{"duration":"1"}}'),
    );
    const adapter = createVideoFrameFfmpegAdapter({ runProcess });

    await expect(adapter.probeVideoDurationMs(videoUrl)).resolves.toBe(1_000);
    expect(runProcess).toHaveBeenCalledOnce();
  });

  it("falls back to ffprobe and ffmpeg binary names", async () => {
    const binaries: string[] = [];
    const adapter = createVideoFrameFfmpegAdapter({
      env: {},
      runProcess: async (binary) => {
        binaries.push(binary);
        return binary === "ffprobe"
          ? new TextEncoder().encode('{"format":{"duration":"1"}}')
          : new Uint8Array();
      },
    });

    await adapter.probeVideoDurationMs(VIDEO_URL);
    await adapter.sampleScreenShareFrames({
      intervals: [{ startMs: 0, endMs: 1_000 }],
      videoUrl: VIDEO_URL,
    });

    expect(binaries).toEqual(["ffprobe", "ffmpeg"]);
  });
});

describe("default process runner", () => {
  it("terminates and rejects a process that never exits", async () => {
    vi.useFakeTimers();
    const child = createFakeChildProcess();
    const runProcess = createProcessRunner({
      killGraceMs: 50,
      spawnProcess: () => child as never,
    });
    const result = runProcess("ffmpeg", ["-i", VIDEO_URL], {
      timeoutMs: 100,
    }).catch((reason: unknown) => reason);
    child.stderr.write(`stalled at ${VIDEO_URL}`);

    await vi.advanceTimersByTimeAsync(100);
    expect(child.kill).toHaveBeenCalledWith("SIGTERM");

    await vi.advanceTimersByTimeAsync(50);
    const error = await result;

    expect(child.kill).toHaveBeenLastCalledWith("SIGKILL");
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/timed out/i);
    expect((error as Error).message).not.toContain("X-Amz-Signature");
    expect(child.listenerCount("error")).toBe(0);
    expect(child.listenerCount("close")).toBe(0);
    expect(child.stdout.listenerCount("data")).toBe(0);
    expect(child.stderr.listenerCount("data")).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears the deadline and listeners when a process completes", async () => {
    vi.useFakeTimers();
    const child = createFakeChildProcess();
    const runProcess = createProcessRunner({
      killGraceMs: 50,
      spawnProcess: () => child as never,
    });
    const result = runProcess("ffmpeg", [], { timeoutMs: 100 });
    child.stdout.write(new Uint8Array([1, 2, 3]));
    child.emit("close", 0);

    await expect(result).resolves.toEqual(new Uint8Array([1, 2, 3]));
    await vi.advanceTimersByTimeAsync(1_000);

    expect(child.kill).not.toHaveBeenCalled();
    expect(child.listenerCount("error")).toBe(0);
    expect(child.listenerCount("close")).toBe(0);
    expect(child.stdout.listenerCount("data")).toBe(0);
    expect(child.stderr.listenerCount("data")).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("kills and rejects a process when stdout exceeds its byte limit", async () => {
    vi.useFakeTimers();
    const child = createFakeChildProcess();
    const runProcess = createProcessRunner({
      spawnProcess: () => child as never,
    });
    const result = runProcess("ffmpeg", [], {
      maxStdoutBytes: 3,
      timeoutMs: 1_000,
    }).catch((reason: unknown) => reason);

    child.stdout.write(new Uint8Array([1, 2, 3, 4]));
    const error = await result;

    expect(child.kill).toHaveBeenCalledWith("SIGKILL");
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/stdout|output|byte limit/i);
    expect(child.listenerCount("error")).toBe(0);
    expect(child.listenerCount("close")).toBe(0);
    expect(child.stdout.listenerCount("data")).toBe(0);
    expect(child.stderr.listenerCount("data")).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects spawn failures without exposing the signed URL", async () => {
    vi.stubEnv("FFMPEG_PATH", "/path/that/does/not/exist/ffmpeg");

    const error = await extractJpegFrame({
      timestampMs: 0,
      videoUrl: VIDEO_URL,
    }).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).not.toContain("X-Amz-Signature");
  });

  it("retains bounded stderr on nonzero exit and redacts signed URLs", async () => {
    const directory = await mkdtemp(join(tmpdir(), "video-frame-ffmpeg-"));
    const executable = join(directory, "fake-ffmpeg");
    await writeFile(
      executable,
      [
        "#!/usr/bin/env node",
        'process.stderr.write("x".repeat(4100));',
        'process.stderr.write(" " + process.argv.find((arg) => arg.startsWith("https://")));',
        "process.exit(9);",
      ].join("\n"),
    );
    await chmod(executable, 0o755);
    vi.stubEnv("FFMPEG_PATH", executable);

    try {
      const error = await extractJpegFrame({
        timestampMs: 0,
        videoUrl: VIDEO_URL,
      }).catch((reason: unknown) => reason);

      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain("code 9");
      expect((error as Error).message).toContain("[redacted URL]");
      expect((error as Error).message).not.toContain("X-Amz-Signature");
      expect((error as Error).message.length).toBeLessThan(4_100);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
});
