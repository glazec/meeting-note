import { spawn } from "node:child_process";

import { createReadUrl, putObject } from "@/lib/r2";

type ConvertVideoObjectToAudioInput = {
  sourceObjectKey: string;
  audioObjectKey: string;
};

export async function convertVideoObjectToAudio(
  input: ConvertVideoObjectToAudioInput,
) {
  const sourceUrl = await createReadUrl({ key: input.sourceObjectKey });
  const body = await runFfmpeg([
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
  ]);

  await putObject({
    key: input.audioObjectKey,
    body,
    contentType: "audio/mpeg",
  });
}

function runFfmpeg(args: string[]) {
  return new Promise<Uint8Array>((resolve, reject) => {
    const ffmpeg = getFfmpegPath();
    const process = spawn(ffmpeg, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdoutChunks: Buffer[] = [];
    let stderr = "";

    process.stdout.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk);
    });

    process.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
      stderr = stderr.slice(-2000);
    });

    process.on("error", reject);
    process.on("close", (code) => {
      if (code === 0) {
        resolve(new Uint8Array(Buffer.concat(stdoutChunks)));
        return;
      }

      reject(new Error(stderr.trim() || `ffmpeg exited with code ${code}`));
    });
  });
}

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
