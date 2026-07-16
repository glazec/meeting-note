import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ShareDialog } from "@/components/share-dialog";

describe("ShareDialog", () => {
  it("renders colleague oriented sharing controls without exposing the raw meeting id", () => {
    const html = renderToStaticMarkup(
      <ShareDialog
        instanceId="test"
        meetingId="11111111-1111-4111-8111-111111111111"
        organizationDomain="example.com"
      />,
    );

    expect(html).toContain(">Share<");
    expect(html).toContain("Anyone at @example.com can open this meeting.");
    expect(html).toContain("Copy link");
    expect(html).toContain("Share outside the organization");
    expect(html).toContain("Email address");
    expect(html).toContain("More options");
    expect(html).toContain("Include related meetings");
    expect(html).toContain('name="includeRelated"');
    expect(html).not.toContain("Meeting link");
    expect(html).not.toContain("Select someone in organization");
    expect(html).not.toContain("Add by email");
    expect(html).not.toContain("Sharing grants transcript viewing only");
    expect(html).not.toContain("11111111-1111-4111-8111-111111111111");
    expect(html).not.toContain("Meeting ID");
  });
});
