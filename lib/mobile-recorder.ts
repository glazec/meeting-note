const mobileRecorderMimeTypes = [
  "audio/mp4",
  "audio/webm;codecs=opus",
  "audio/webm",
] as const;

export function selectMobileRecorderMimeType(
  isTypeSupported: (mimeType: string) => boolean,
) {
  return mobileRecorderMimeTypes.find(isTypeSupported) ?? null;
}

export function getMobileRecordingFileType(mimeType: string) {
  const contentType = mimeType.split(";", 1)[0]?.trim().toLowerCase();

  if (contentType === "audio/mp4") {
    return { contentType, extension: "m4a" };
  }

  if (contentType === "audio/webm") {
    return { contentType, extension: "webm" };
  }

  return null;
}
