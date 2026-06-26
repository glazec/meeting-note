import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { MeetingTitleEditor } from "@/components/meeting-title-editor";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

describe("MeetingTitleEditor", () => {
  it("renders the meeting title with a rename control", () => {
    const html = renderToStaticMarkup(
      <MeetingTitleEditor
        meetingId="11111111-1111-4111-8111-111111111111"
        meetingTitle="Customer sync"
      />,
    );

    expect(html).toContain("Customer sync");
    expect(html).toContain("Rename meeting");
  });
});
