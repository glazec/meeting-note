import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { MeetingRecoveryUploadPanel } from "@/components/meeting-recovery-upload-panel";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    replace: vi.fn(),
  }),
}));

describe("MeetingRecoveryUploadPanel", () => {
  it("renders audio and transcript recovery controls", () => {
    const html = renderToStaticMarkup(
      <MeetingRecoveryUploadPanel meetingId="meeting_123" />,
    );

    expect(html).toContain("Recover meeting");
    expect(html).toContain("audio/mpeg");
    expect(html).toContain("audio/mp4");
    expect(html).toContain(".m4a");
    expect(html).toContain('name="transcriptText"');
    expect(html).toContain('name="transcript-file"');
    expect(html).toContain("Add transcript");
  });
});
