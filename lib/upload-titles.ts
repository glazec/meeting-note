export function titleFromUploadFileName(fileName: string) {
  const title = fileName
    .split(/[\\/]/)
    .pop()
    ?.replace(/\.mp3$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return title || "Uploaded audio";
}
