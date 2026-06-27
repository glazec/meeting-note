import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TranscriptViewer } from "@/components/transcript-viewer";

const segments = [
  {
    id: "segment_123",
    speaker: "Speaker 1",
    startMs: 0,
    endMs: 1000,
    text: "Hello team",
  },
];

describe("TranscriptViewer", () => {
  it("hides speaker editing when no meeting id is provided", () => {
    const html = renderToStaticMarkup(<TranscriptViewer segments={segments} />);

    expect(html).toContain("Speaker 1");
    expect(html).not.toContain("Edit speaker");
  });

  it("shows speaker editing for workspace meeting pages", () => {
    const html = renderToStaticMarkup(
      <TranscriptViewer
        meetingId="11111111-1111-4111-8111-111111111111"
        segments={segments}
      />,
    );

    expect(html).toContain("Edit speaker");
  });
});
