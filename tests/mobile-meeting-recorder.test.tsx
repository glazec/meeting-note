import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { MobileMeetingRecorder } from "@/components/mobile-meeting-recorder";
import {
  getMobileRecordingFileType,
  selectMobileRecorderMimeType,
} from "@/lib/mobile-recorder";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    replace: vi.fn(),
  }),
}));

describe("mobile meeting recorder", () => {
  it("shows a focused recording surface for the notified meeting", () => {
    const html = renderToStaticMarkup(
      <MobileMeetingRecorder
        meetingId="11111111-1111-4111-8111-111111111111"
        meetingTitle="Founder office visit"
      />,
    );

    expect(html).toContain("Founder office visit");
    expect(html).toContain("Start recording");
    expect(html).toContain("Keep this page open while recording");
  });

  it("prefers mobile audio formats accepted by transcription", () => {
    expect(selectMobileRecorderMimeType((type) => type === "audio/mp4")).toBe(
      "audio/mp4",
    );
    expect(
      selectMobileRecorderMimeType(
        (type) => type === "audio/webm;codecs=opus",
      ),
    ).toBe("audio/webm;codecs=opus");
    expect(getMobileRecordingFileType("audio/webm;codecs=opus")).toEqual({
      contentType: "audio/webm",
      extension: "webm",
    });
  });
});
