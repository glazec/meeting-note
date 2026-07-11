import { spawn } from "node:child_process";
import { basename } from "node:path";
import type { Readable } from "node:stream";

import type { ScreenShareInterval } from "@/lib/recall-screen-share";
import type { GrayscaleFrame } from "@/lib/video-frame-detection";

const FRAME_BYTE_LENGTH = 160 * 90;
const MAX_SCAN_CHUNK_MS = 15 * 60 * 1_000;
const MAX_RAW_STDOUT_BYTES = 901 * FRAME_BYTE_LENGTH;
const STDERR_CHARACTER_LIMIT = 4_000;
const AWS_REGION_PATTERN = "[a-z]{2}(?:-[a-z0-9]+)+-\\d";
const TRUSTED_VIDEO_HOST_PATTERN = new RegExp(
  `^(?:${AWS_REGION_PATTERN}-)?recallai-production-bot-data\\.s3(?:\\.${AWS_REGION_PATTERN})?\\.amazonaws\\.com$`,
);
const FFMPEG_HTTP_INPUT_ARGS = [
  "-rw_timeout",
  "15000000",
  "-tls_verify",
  "1",
  "-max_redirects",
  "0",
];

export type ProcessRunner = (
  binary: string,
  args: string[],
  options: ProcessRunOptions,
) => Promise<Uint8Array>;

export type ProcessRunOptions = {
  timeoutMs: number;
  maxStdoutBytes?: number;
};

type BinaryEnvironment = Partial<
  Record<"FFMPEG_PATH" | "FFPROBE_PATH", string>
>;

type AdapterDependencies = {
  env?: BinaryEnvironment;
  runProcess: ProcessRunner;
};

type SpawnedProcess = {
  stderr: Readable;
  stdout: Readable;
  kill(signal: NodeJS.Signals): boolean;
  off(event: "close", listener: (code: number | null) => void): unknown;
  off(event: "error", listener: (error: Error) => void): unknown;
  on(event: "close", listener: (code: number | null) => void): unknown;
  on(event: "error", listener: (error: Error) => void): unknown;
};

type SpawnProcess = (binary: string, args: string[]) => SpawnedProcess;

export function createVideoFrameFfmpegAdapter({
  env,
  runProcess,
}: AdapterDependencies) {
  const binaryEnvironment = env ?? (process.env as BinaryEnvironment);

  async function probeVideoDurationMs(videoUrl: string): Promise<number> {
    assertSafeVideoUrl(videoUrl);
    const stdout = await runProcess(
      getBinaryPath(binaryEnvironment.FFPROBE_PATH, "ffprobe"),
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "json",
        videoUrl,
      ],
      { timeoutMs: 30_000 },
    );

    return parseDurationMs(stdout);
  }

  async function sampleScreenShareFrames(input: {
    intervals: ScreenShareInterval[];
    videoUrl: string;
  }): Promise<GrayscaleFrame[]> {
    assertSafeVideoUrl(input.videoUrl);

    for (const interval of input.intervals) {
      assertValidInterval(interval);
    }

    const frames: GrayscaleFrame[] = [];

    for (const interval of input.intervals) {
      for (
        let chunkStartMs = interval.startMs;
        chunkStartMs < interval.endMs;
        chunkStartMs += MAX_SCAN_CHUNK_MS
      ) {
        const chunkEndMs = Math.min(
          chunkStartMs + MAX_SCAN_CHUNK_MS,
          interval.endMs,
        );
        const stdout = await runProcess(
          getBinaryPath(binaryEnvironment.FFMPEG_PATH, "ffmpeg"),
          [
            "-hide_banner",
            "-loglevel",
            "error",
            "-ss",
            formatSeconds(chunkStartMs),
            "-t",
            formatSeconds(chunkEndMs - chunkStartMs),
            ...FFMPEG_HTTP_INPUT_ARGS,
            "-i",
            input.videoUrl,
            "-an",
            "-vf",
            "fps=1,scale=160:90,format=gray",
            "-pix_fmt",
            "gray",
            "-f",
            "rawvideo",
            "pipe:1",
          ],
          {
            maxStdoutBytes: MAX_RAW_STDOUT_BYTES,
            timeoutMs: 30 * 60 * 1_000,
          },
        );

        if (stdout.length % FRAME_BYTE_LENGTH !== 0) {
          throw new Error("ffmpeg returned an incomplete raw video frame");
        }

        const frameCount = stdout.length / FRAME_BYTE_LENGTH;

        for (let index = 0; index < frameCount; index += 1) {
          const timestampMs = chunkStartMs + index * 1_000;

          if (timestampMs >= chunkEndMs) {
            continue;
          }

          const offset = index * FRAME_BYTE_LENGTH;
          frames.push({
            pixels: stdout.slice(offset, offset + FRAME_BYTE_LENGTH),
            timestampMs,
          });
        }
      }
    }

    return frames;
  }

  async function extractJpegFrame(input: {
    timestampMs: number;
    videoUrl: string;
  }): Promise<Uint8Array> {
    assertSafeVideoUrl(input.videoUrl);

    if (!Number.isFinite(input.timestampMs) || input.timestampMs < 0) {
      throw new Error("Frame timestamp must be finite and nonnegative");
    }

    const stdout = await runProcess(
      getBinaryPath(binaryEnvironment.FFMPEG_PATH, "ffmpeg"),
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-ss",
        formatSeconds(input.timestampMs),
        ...FFMPEG_HTTP_INPUT_ARGS,
        "-i",
        input.videoUrl,
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
      { timeoutMs: 60_000 },
    );

    if (stdout.length === 0) {
      throw new Error("ffmpeg returned an empty JPEG frame");
    }

    return stdout;
  }

  return {
    extractJpegFrame,
    probeVideoDurationMs,
    sampleScreenShareFrames,
  };
}

const defaultAdapter = createVideoFrameFfmpegAdapter({
  runProcess: createProcessRunner(),
});

export async function probeVideoDurationMs(videoUrl: string): Promise<number> {
  return defaultAdapter.probeVideoDurationMs(videoUrl);
}

export async function sampleScreenShareFrames(input: {
  intervals: ScreenShareInterval[];
  videoUrl: string;
}): Promise<GrayscaleFrame[]> {
  return defaultAdapter.sampleScreenShareFrames(input);
}

export async function extractJpegFrame(input: {
  timestampMs: number;
  videoUrl: string;
}): Promise<Uint8Array> {
  return defaultAdapter.extractJpegFrame(input);
}

export function createProcessRunner(
  dependencies: {
    killGraceMs?: number;
    spawnProcess?: SpawnProcess;
  } = {},
): ProcessRunner {
  const killGraceMs = dependencies.killGraceMs ?? 1_000;
  const spawnProcess = dependencies.spawnProcess ?? spawnWithPipes;

  return (binary, args, options) =>
    new Promise<Uint8Array>((resolve, reject) => {
      const child = spawnProcess(binary, args);
      const stdoutChunks: Buffer[] = [];
      const timers: {
        deadline?: ReturnType<typeof setTimeout>;
        kill?: ReturnType<typeof setTimeout>;
      } = {};
      let stdoutByteLength = 0;
      let stderr = "";
      let settled = false;
      let timedOut = false;

      const handleStdout = (chunk: Buffer) => {
        const nextStdoutByteLength = stdoutByteLength + chunk.length;

        if (
          options.maxStdoutBytes !== undefined &&
          nextStdoutByteLength > options.maxStdoutBytes
        ) {
          settleWithError(
            new Error(
              `${basename(binary)} exceeded stdout byte limit of ${options.maxStdoutBytes}`,
            ),
          );
          child.kill("SIGKILL");
          return;
        }

        stdoutChunks.push(chunk);
        stdoutByteLength = nextStdoutByteLength;
      };
      const handleStderr = (chunk: Buffer) => {
        stderr = (stderr + chunk.toString("utf8")).slice(
          -STDERR_CHARACTER_LIMIT,
        );
      };
      const cleanup = () => {
        if (timers.deadline) {
          clearTimeout(timers.deadline);
        }
        if (timers.kill) {
          clearTimeout(timers.kill);
        }
        child.stdout.off("data", handleStdout);
        child.stderr.off("data", handleStderr);
        child.off("error", handleError);
        child.off("close", handleClose);
      };
      const settleWithError = (error: Error) => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        reject(error);
      };
      const timeoutError = () =>
        new Error(`${basename(binary)} timed out after ${options.timeoutMs}ms`);
      const handleError = (error: Error) => {
        settleWithError(
          timedOut
            ? timeoutError()
            : new Error(
                `Failed to start ${basename(binary)}: ${redactUrls(error.message)}`,
              ),
        );
      };
      const handleClose = (code: number | null) => {
        if (timedOut) {
          settleWithError(timeoutError());
          return;
        }

        if (settled) {
          return;
        }

        settled = true;
        cleanup();

        if (code === 0) {
          resolve(
            new Uint8Array(Buffer.concat(stdoutChunks, stdoutByteLength)),
          );
          return;
        }

        const detail = redactUrls(stderr.trim());
        reject(
          new Error(
            `${basename(binary)} exited with code ${code}${detail ? `: ${detail}` : ""}`,
          ),
        );
      };

      child.stdout.on("data", handleStdout);
      child.stderr.on("data", handleStderr);
      child.on("error", handleError);
      child.on("close", handleClose);

      timers.deadline = setTimeout(() => {
        if (settled) {
          return;
        }

        timedOut = true;
        child.kill("SIGTERM");

        if (settled) {
          return;
        }

        timers.kill = setTimeout(() => {
          if (settled) {
            return;
          }

          child.kill("SIGKILL");
          settleWithError(timeoutError());
        }, killGraceMs);
      }, options.timeoutMs);
    });
}

function spawnWithPipes(binary: string, args: string[]): SpawnedProcess {
  return spawn(binary, args, {
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function getBinaryPath(override: string | undefined, fallback: string) {
  return override?.trim() || fallback;
}

function assertValidInterval(interval: ScreenShareInterval) {
  if (
    !Number.isFinite(interval.startMs) ||
    !Number.isFinite(interval.endMs) ||
    interval.startMs < 0 ||
    interval.endMs < 0 ||
    interval.endMs <= interval.startMs
  ) {
    throw new Error(
      "Screen share interval bounds must be finite, nonnegative, and increasing",
    );
  }
}

function formatSeconds(milliseconds: number) {
  return (milliseconds / 1_000).toFixed(3);
}

function parseDurationMs(stdout: Uint8Array) {
  let output: unknown;

  try {
    output = JSON.parse(new TextDecoder().decode(stdout));
  } catch {
    throw new Error("ffprobe returned an invalid video duration");
  }

  const format = getRecord(output)?.format;
  const rawDuration = getRecord(format)?.duration;

  if (typeof rawDuration !== "string" && typeof rawDuration !== "number") {
    throw new Error("ffprobe returned an invalid video duration");
  }

  const duration = Number(rawDuration);

  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("ffprobe returned an invalid video duration");
  }

  return Math.round(duration * 1_000);
}

function assertSafeVideoUrl(videoUrl: string) {
  let parsed: URL;

  try {
    parsed = new URL(videoUrl);
  } catch {
    throw new Error("Video URL must be a valid public HTTPS URL");
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.username.length > 0 ||
    parsed.password.length > 0
  ) {
    throw new Error("Video URL must be a valid public HTTPS URL");
  }

  const hostname = parsed.hostname
    .replace(/^\[|\]$/g, "")
    .replace(/\.+$/, "")
    .toLowerCase();

  if (!TRUSTED_VIDEO_HOST_PATTERN.test(hostname)) {
    throw new Error("Video URL must use a trusted Recall S3 hostname");
  }
}

function redactUrls(value: string) {
  return value.replace(/https:\/\/[^\s"'<>]+/gi, "[redacted URL]");
}

function getRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}
