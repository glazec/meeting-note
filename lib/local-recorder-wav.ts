type Pcm16Wav = {
  channelCount: number;
  dataOffset: number;
  sampleRate: number;
  samples: number[];
};

export function mixLocalRecorderWavTracks(
  computerAudio: Uint8Array,
  microphoneAudio: Uint8Array,
) {
  const computer = parsePcm16Wav(computerAudio);
  const microphone = parsePcm16Wav(microphoneAudio);

  if (computer.sampleRate !== microphone.sampleRate) {
    throw new Error("Local recorder tracks must have the same sample rate");
  }

  if (computer.channelCount !== microphone.channelCount) {
    throw new Error("Local recorder tracks must have the same channel count");
  }

  const sampleCount = Math.max(
    computer.samples.length,
    microphone.samples.length,
  );
  const mixedSamples = Array.from({ length: sampleCount }, (_, index) =>
    clipPcm16((computer.samples[index] ?? 0) + (microphone.samples[index] ?? 0)),
  );

  return writePcm16Wav({
    channelCount: computer.channelCount,
    sampleRate: computer.sampleRate,
    samples: mixedSamples,
  });
}

export function parsePcm16Wav(input: Uint8Array): Pcm16Wav {
  const buffer = Buffer.from(input);

  if (
    buffer.toString("ascii", 0, 4) !== "RIFF" ||
    buffer.toString("ascii", 8, 12) !== "WAVE"
  ) {
    throw new Error("Local recorder track must be a WAV file");
  }

  let cursor = 12;
  let channelCount: number | null = null;
  let sampleRate: number | null = null;
  let bitsPerSample: number | null = null;
  let audioFormat: number | null = null;
  let dataOffset: number | null = null;
  let dataSize: number | null = null;

  while (cursor + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", cursor, cursor + 4);
    const chunkSize = buffer.readUInt32LE(cursor + 4);
    const chunkStart = cursor + 8;

    if (chunkId === "fmt ") {
      audioFormat = buffer.readUInt16LE(chunkStart);
      channelCount = buffer.readUInt16LE(chunkStart + 2);
      sampleRate = buffer.readUInt32LE(chunkStart + 4);
      bitsPerSample = buffer.readUInt16LE(chunkStart + 14);
    }

    if (chunkId === "data") {
      dataOffset = chunkStart;
      dataSize = chunkSize;
      break;
    }

    cursor = chunkStart + chunkSize + (chunkSize % 2);
  }

  if (
    audioFormat !== 1 ||
    bitsPerSample !== 16 ||
    !channelCount ||
    !sampleRate ||
    dataOffset === null ||
    dataSize === null
  ) {
    throw new Error("Local recorder track must be 16 bit PCM WAV");
  }

  const samples: number[] = [];
  const dataEnd = Math.min(buffer.length, dataOffset + dataSize);

  for (let offset = dataOffset; offset + 2 <= dataEnd; offset += 2) {
    samples.push(buffer.readInt16LE(offset));
  }

  return {
    channelCount,
    dataOffset,
    sampleRate,
    samples,
  };
}

function writePcm16Wav(input: {
  channelCount: number;
  sampleRate: number;
  samples: number[];
}) {
  const dataSize = input.samples.length * 2;
  const byteRate = input.sampleRate * input.channelCount * 2;
  const blockAlign = input.channelCount * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(input.channelCount, 22);
  buffer.writeUInt32LE(input.sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);

  input.samples.forEach((sample, index) => {
    buffer.writeInt16LE(sample, 44 + index * 2);
  });

  return new Uint8Array(buffer);
}

function clipPcm16(sample: number) {
  return Math.max(-32768, Math.min(32767, sample));
}
