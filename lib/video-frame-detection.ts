export type GrayscaleFrame = {
  pixels: Uint8Array;
  timestampMs: number;
};

const CHANGE_MEAN_THRESHOLD = 3;
const CHANGE_PIXEL_RATIO_THRESHOLD = 0.008;
const PIXEL_DELTA_THRESHOLD = 20;
const STABLE_MEAN_THRESHOLD = 1.5;
const STABLE_PIXEL_RATIO_THRESHOLD = 0.005;
const STABLE_DURATION_MS = 2_000;
const MAX_SAMPLE_GAP_MS = 1_500;
const THUMBNAIL_WIDTH = 160;
const THUMBNAIL_HEIGHT = 90;
const INFORMATION_TILE_COLUMNS = 8;
const INFORMATION_TILE_ROWS = 5;
const MINIMUM_INFORMATIVE_TILES = 4;
const VISIBLE_LUMA_THRESHOLD = 24;
const VISIBLE_CONTRAST_THRESHOLD = 24;

type FrameComparison = {
  changedPixelRatio: number;
  meanAbsoluteDifference: number;
};

export function compareGrayscaleFrames(
  left: Uint8Array,
  right: Uint8Array,
): FrameComparison {
  if (left.length === 0 || right.length === 0) {
    throw new Error("Grayscale frames must not be empty");
  }
  if (left.length !== right.length) {
    throw new Error("Grayscale frames must have equal pixel lengths");
  }

  let changedPixelCount = 0;
  let absoluteDifferenceSum = 0;

  for (let index = 0; index < left.length; index += 1) {
    const delta = Math.abs(left[index] - right[index]);
    absoluteDifferenceSum += delta;
    if (delta >= PIXEL_DELTA_THRESHOLD) {
      changedPixelCount += 1;
    }
  }

  return {
    changedPixelRatio: changedPixelCount / left.length,
    meanAbsoluteDifference: absoluteDifferenceSum / left.length,
  };
}

function isVisualChange(comparison: FrameComparison): boolean {
  return (
    comparison.meanAbsoluteDifference >= CHANGE_MEAN_THRESHOLD ||
    comparison.changedPixelRatio >= CHANGE_PIXEL_RATIO_THRESHOLD
  );
}

function isStable(comparison: FrameComparison): boolean {
  return (
    comparison.meanAbsoluteDifference <= STABLE_MEAN_THRESHOLD &&
    comparison.changedPixelRatio <= STABLE_PIXEL_RATIO_THRESHOLD
  );
}

export function selectStableVisualFrames(frames: GrayscaleFrame[]): number[] {
  return analyzeStableVisualFrames(frames).timestamps;
}

export function isInformativeSharedScreenFrame(pixels: Uint8Array): boolean {
  if (pixels.length !== THUMBNAIL_WIDTH * THUMBNAIL_HEIGHT) {
    return true;
  }

  let informativeTileCount = 0;

  for (let tileY = 0; tileY < INFORMATION_TILE_ROWS; tileY += 1) {
    const startY = Math.floor(
      (tileY * THUMBNAIL_HEIGHT) / INFORMATION_TILE_ROWS,
    );
    const endY = Math.floor(
      ((tileY + 1) * THUMBNAIL_HEIGHT) / INFORMATION_TILE_ROWS,
    );

    for (let tileX = 0; tileX < INFORMATION_TILE_COLUMNS; tileX += 1) {
      const startX = Math.floor(
        (tileX * THUMBNAIL_WIDTH) / INFORMATION_TILE_COLUMNS,
      );
      const endX = Math.floor(
        ((tileX + 1) * THUMBNAIL_WIDTH) / INFORMATION_TILE_COLUMNS,
      );
      let minimum = 255;
      let maximum = 0;
      let sum = 0;
      let count = 0;

      for (let y = startY; y < endY; y += 1) {
        for (let x = startX; x < endX; x += 1) {
          const value = pixels[y * THUMBNAIL_WIDTH + x];
          minimum = Math.min(minimum, value);
          maximum = Math.max(maximum, value);
          sum += value;
          count += 1;
        }
      }

      if (
        sum / count >= VISIBLE_LUMA_THRESHOLD ||
        maximum - minimum >= VISIBLE_CONTRAST_THRESHOLD
      ) {
        informativeTileCount += 1;

        if (informativeTileCount >= MINIMUM_INFORMATIVE_TILES) {
          return true;
        }
      }
    }
  }

  return false;
}

export function analyzeStableVisualFrames(
  frames: GrayscaleFrame[],
  options: { requireInformativeSharedScreen?: boolean } = {},
): {
  duplicateCount: number;
  timestamps: number[];
} {
  if (frames.length === 0) {
    return { duplicateCount: 0, timestamps: [] };
  }

  const pixelCount = frames[0].pixels.length;
  let previousTimestampMs = -1;

  for (const frame of frames) {
    if (!Number.isFinite(frame.timestampMs) || frame.timestampMs < 0) {
      throw new Error("Frame timestamps must be finite and nonnegative");
    }
    if (frame.timestampMs < previousTimestampMs) {
      throw new Error("Frame timestamps must be monotonic");
    }
    if (frame.pixels.length === 0 || frame.pixels.length !== pixelCount) {
      throw new Error("Frames must have equal, nonempty pixel dimensions");
    }
    previousTimestampMs = frame.timestampMs;
  }

  const acceptedTimestamps: number[] = [];
  const acceptedStates: Uint8Array[] = [];
  let duplicateCount = 0;
  let currentStableState: Uint8Array | undefined;
  let candidate: GrayscaleFrame | undefined = frames[0];
  let previousSampleTimestampMs = frames[0].timestampMs;

  for (let index = 1; index < frames.length; index += 1) {
    const frame = frames[index];
    if (
      frame.timestampMs - previousSampleTimestampMs >
      MAX_SAMPLE_GAP_MS
    ) {
      candidate = undefined;
    }
    previousSampleTimestampMs = frame.timestampMs;

    if (!candidate) {
      if (
        !currentStableState ||
        isVisualChange(
          compareGrayscaleFrames(currentStableState, frame.pixels),
        )
      ) {
        candidate = frame;
      }
      continue;
    }

    const comparison = compareGrayscaleFrames(candidate.pixels, frame.pixels);

    if (!isStable(comparison)) {
      if (
        !currentStableState ||
        isVisualChange(
          compareGrayscaleFrames(currentStableState, frame.pixels),
        )
      ) {
        candidate = frame;
      } else {
        candidate = undefined;
      }
      continue;
    }

    if (
      frame.timestampMs - candidate.timestampMs < STABLE_DURATION_MS
    ) {
      continue;
    }

    const acceptedCandidate = candidate;
    currentStableState = acceptedCandidate.pixels;

    if (
      options.requireInformativeSharedScreen &&
      !isInformativeSharedScreenFrame(acceptedCandidate.pixels)
    ) {
      candidate = undefined;
      continue;
    }

    const repeatsAcceptedState = acceptedStates.some((acceptedState) =>
      isStable(
        compareGrayscaleFrames(acceptedCandidate.pixels, acceptedState),
      ),
    );

    if (!repeatsAcceptedState) {
      acceptedStates.push(acceptedCandidate.pixels);
      acceptedTimestamps.push(frame.timestampMs);
    } else {
      duplicateCount += 1;
    }
    candidate = undefined;
  }

  return { duplicateCount, timestamps: acceptedTimestamps };
}
