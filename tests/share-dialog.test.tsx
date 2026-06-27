import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ShareDialog } from "@/components/share-dialog";

describe("ShareDialog", () => {
  it("renders colleague oriented sharing controls without exposing the raw meeting id", () => {
    const html = renderToStaticMarkup(
      <ShareDialog
        meetingId="11111111-1111-4111-8111-111111111111"
        organizationDomain="example.com"
        teamMembers={[
          {
            email: "teammate@example.com",
            name: "Team Mate",
          },
        ]}
      />,
    );

    expect(html).toContain("Share transcript");
    expect(html).toContain("Copy link");
    expect(html).toContain("Anyone signed in with @example.com");
    expect(html).toContain("Select someone in organization");
    expect(html).toContain("Team Mate (teammate@example.com)");
    expect(html).toContain("Add by email");
    expect(html).not.toContain("Meeting ID");
  });
});
