import { describe, expect, it } from "vitest";

import {
  mixLocalRecorderWavTracks,
  parsePcm16Wav,
} from "@/lib/local-recorder-wav";

describe("local recorder WAV synthesis", () => {
  it("mixes two 16 bit mono WAV tracks into one clipped 16 bit WAV", () => {
    const computer = makeMonoWav([1000, 2000]);
    const microphone = makeMonoWav([3000, 4000]);

    const mixed = parsePcm16Wav(mixLocalRecorderWavTracks(computer, microphone));

    expect(mixed.sampleRate).toBe(16_000);
    expect(mixed.channelCount).toBe(1);
    expect(mixed.samples).toEqual([4000, 6000]);
  });

  it("rejects mismatched sample rates", () => {
    const computer = makeMonoWav([1000], 16_000);
    const microphone = makeMonoWav([1000], 48_000);

    expect(() => mixLocalRecorderWavTracks(computer, microphone)).toThrow(
      "Local recorder tracks must have the same sample rate",
    );
  });
});

function makeMonoWav(samples: number[], sampleRate = 16_000) {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);

  samples.forEach((sample, index) => {
    buffer.writeInt16LE(sample, 44 + index * 2);
  });

  return new Uint8Array(buffer);
}
