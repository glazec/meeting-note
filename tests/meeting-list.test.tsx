import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MeetingList } from "@/components/meeting-list";

describe("MeetingList", () => {
  it("defers Started formatting to the browser timezone", () => {
    const html = renderToStaticMarkup(
      <MeetingList
        meetings={[
          {
            id: "11111111-1111-4111-8111-111111111111",
            title: "Customer sync",
            platform: "google_meet",
            startedAt: "2026-01-01T12:00:00.000Z",
            status: "ready",
          },
        ]}
      />,
    );

    expect(html).toContain('dateTime="2026-01-01T12:00:00.000Z"');
  });
});
