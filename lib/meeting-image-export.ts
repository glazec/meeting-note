const imageExtensionByMimeType: Record<string, string> = {
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function buildImageEntryName(
  index: number,
  timestampMs: number | null,
  mimeType: string,
) {
  const extension =
    imageExtensionByMimeType[mimeType.trim().toLowerCase()] ?? "bin";
  const sequence = String(index + 1).padStart(2, "0");

  if (timestampMs === null) {
    return `image-${sequence}.${extension}`;
  }

  const totalSeconds = Math.floor(timestampMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");

  return `image-${sequence}-${minutes}m${seconds}s.${extension}`;
}
