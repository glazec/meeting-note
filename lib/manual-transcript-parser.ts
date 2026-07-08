export type ManualTranscriptSegmentInput = {
  speaker: string;
  startMs: number;
  text: string;
};

export function parseManualTranscriptText(
  transcriptText: string,
): ManualTranscriptSegmentInput[] {
  const paragraphs = transcriptText
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const chunks = paragraphs.length > 0 ? paragraphs : [transcriptText.trim()];

  return chunks
    .map((chunk, index) => {
      const speakerMatch = chunk.match(/^([^:\n]{1,80}):\s+([\s\S]+)$/);
      const speaker = speakerMatch?.[1]?.trim() || "Speaker 1";
      const text = (speakerMatch?.[2] ?? chunk).trim();

      if (!text) {
        return null;
      }

      return {
        speaker,
        startMs: index * 1000,
        text,
      };
    })
    .filter((segment): segment is ManualTranscriptSegmentInput =>
      Boolean(segment),
    );
}
