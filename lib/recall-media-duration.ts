const INITIAL_PROBE_BYTES = 256 * 1024;
const TRAILING_PROBE_BYTES = 1024 * 1024;
const PROBE_TIMEOUT_MS = 10_000;
const TRUSTED_MEDIA_HOSTS = new Set([
  "recallai-production-bot-data.s3.amazonaws.com",
]);
const REGIONAL_TRUSTED_MEDIA_HOST =
  /^[a-z0-9-]+-recallai-production-bot-data\.s3\.amazonaws\.com$/;

export async function probeRecallMediaDurationMs(
  mediaUrl: string,
  fetchMedia: typeof fetch = fetch,
) {
  const url = new URL(mediaUrl);

  if (
    url.protocol !== "https:" ||
    (!TRUSTED_MEDIA_HOSTS.has(url.hostname) &&
      !REGIONAL_TRUSTED_MEDIA_HOST.test(url.hostname))
  ) {
    throw new Error("Untrusted Recall media URL");
  }

  const initial = await fetchRange({
    end: INITIAL_PROBE_BYTES - 1,
    fetchMedia,
    start: 0,
    url,
  });
  const initialDurationMs = parseMp4DurationMs(initial.bytes);

  if (initialDurationMs) {
    return initialDurationMs;
  }

  if (!initial.totalBytes || initial.totalBytes <= INITIAL_PROBE_BYTES) {
    throw new Error("Recall media duration is unavailable");
  }

  const trailingStart = Math.max(
    INITIAL_PROBE_BYTES,
    initial.totalBytes - TRAILING_PROBE_BYTES,
  );
  const trailing = await fetchRange({
    end: initial.totalBytes - 1,
    fetchMedia,
    start: trailingStart,
    url,
  });
  const trailingDurationMs = parseMp4DurationMs(trailing.bytes);

  if (!trailingDurationMs) {
    throw new Error("Recall media duration is unavailable");
  }

  return trailingDurationMs;
}

export function parseMp4DurationMs(bytes: Uint8Array) {
  for (let index = 4; index <= bytes.length - 32; index += 1) {
    if (
      bytes[index] !== 0x6d ||
      bytes[index + 1] !== 0x76 ||
      bytes[index + 2] !== 0x68 ||
      bytes[index + 3] !== 0x64
    ) {
      continue;
    }

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const boxStart = index - 4;
    const boxSize = view.getUint32(boxStart);
    const version = view.getUint8(index + 4);

    if (version !== 0 && version !== 1) {
      continue;
    }

    const timescaleOffset = version === 1 ? index + 24 : index + 16;
    const durationOffset = version === 1 ? index + 28 : index + 20;
    const durationBytes = version === 1 ? 8 : 4;
    const boxEnd = boxStart + boxSize;

    if (
      boxSize < durationOffset + durationBytes - boxStart ||
      boxEnd > bytes.length ||
      timescaleOffset + 4 > bytes.length ||
      durationOffset + durationBytes > bytes.length
    ) {
      continue;
    }

    const timescale = view.getUint32(timescaleOffset);
    const duration =
      version === 1
        ? Number(view.getBigUint64(durationOffset))
        : view.getUint32(durationOffset);
    const durationMs = Math.round((duration / timescale) * 1000);

    if (
      timescale > 0 &&
      Number.isSafeInteger(duration) &&
      Number.isFinite(durationMs) &&
      durationMs > 0
    ) {
      return durationMs;
    }
  }

  return null;
}

async function fetchRange(input: {
  end: number;
  fetchMedia: typeof fetch;
  start: number;
  url: URL;
}) {
  const response = await input.fetchMedia(input.url, {
    credentials: "omit",
    headers: {
      Range: `bytes=${input.start}-${input.end}`,
    },
    redirect: "error",
    signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
  });

  if (response.status !== 206) {
    throw new Error("Recall media range request failed");
  }

  const declaredLength = Number(response.headers.get("content-length"));
  const maximumLength = input.end - input.start + 1;

  if (
    !Number.isFinite(declaredLength) ||
    declaredLength <= 0 ||
    declaredLength > maximumLength
  ) {
    throw new Error("Recall media range response is invalid");
  }

  const bytes = new Uint8Array(await response.arrayBuffer());

  if (bytes.length !== declaredLength) {
    throw new Error("Recall media range response is incomplete");
  }

  const contentRange = parseContentRange(response.headers.get("content-range"));

  if (
    !contentRange ||
    contentRange.start !== input.start ||
    contentRange.end > input.end ||
    contentRange.end - contentRange.start + 1 !== bytes.length ||
    (contentRange.end < input.end &&
      contentRange.end !== contentRange.total - 1)
  ) {
    throw new Error("Recall media range response is invalid");
  }

  return {
    bytes,
    totalBytes: contentRange.total,
  };
}

function parseContentRange(value: string | null) {
  const match = value?.match(/^bytes (\d+)-(\d+)\/(\d+)$/);

  if (!match) {
    return null;
  }

  const start = Number(match[1]);
  const end = Number(match[2]);
  const total = Number(match[3]);

  return Number.isSafeInteger(start) &&
    Number.isSafeInteger(end) &&
    Number.isSafeInteger(total) &&
    start >= 0 &&
    end >= start &&
    total > end
    ? { end, start, total }
    : null;
}
