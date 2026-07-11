import { createReadUrl, putObject } from "@/lib/r2";
import {
  createProcessRunner,
  type ProcessRunner,
} from "@/lib/video-frame-ffmpeg";

type ConvertVideoObjectToAudioInput = {
  sourceObjectKey: string;
  audioObjectKey: string;
};

type MediaConversionDependencies = {
  createReadUrl: (input: { key: string }) => Promise<string>;
  ffmpegPath: string;
  putObject: (input: {
    key: string;
    body: Uint8Array;
    contentType: string;
  }) => Promise<void>;
  runProcess: ProcessRunner;
};

const MEDIA_CONVERSION_TIMEOUT_MS = 2 * 60 * 60 * 1_000;
const MAX_CONVERTED_AUDIO_BYTES = 256 * 1024 * 1024;

export function createMediaConversionAdapter(
  dependencies: MediaConversionDependencies,
) {
  return async function convertVideoObjectToAudio(
    input: ConvertVideoObjectToAudioInput,
  ) {
    const sourceUrl = await dependencies.createReadUrl({
      key: input.sourceObjectKey,
    });
    const body = await dependencies.runProcess(
      dependencies.ffmpegPath,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        sourceUrl,
        "-vn",
        "-map",
        "0:a:0",
        "-acodec",
        "libmp3lame",
        "-ar",
        "44100",
        "-ac",
        "2",
        "-b:a",
        "128k",
        "-f",
        "mp3",
        "pipe:1",
      ],
      {
        maxStdoutBytes: MAX_CONVERTED_AUDIO_BYTES,
        timeoutMs: MEDIA_CONVERSION_TIMEOUT_MS,
      },
    );

    await dependencies.putObject({
      key: input.audioObjectKey,
      body,
      contentType: "audio/mpeg",
    });
  };
}

export const convertVideoObjectToAudio = createMediaConversionAdapter({
  createReadUrl,
  ffmpegPath: getFfmpegPath(),
  putObject,
  runProcess: createProcessRunner(),
});

function getFfmpegPath() {
  return (
    process.env.FFMPEG_PATH?.trim() ||
    process.env.FFMPEG_BIN?.trim() ||
    resolveBundledFfmpegPath() ||
    "ffmpeg"
  );
}

function resolveBundledFfmpegPath() {
  return process.platform === "win32"
    ? "node_modules/ffmpeg-static/ffmpeg.exe"
    : "node_modules/ffmpeg-static/ffmpeg";
}
