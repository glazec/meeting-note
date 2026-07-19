import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import Home from "@/app/page";

describe("landing page smoke test", () => {
  it("renders the landing page with hero, social proof, and sign-in path", () => {
    const html = renderToStaticMarkup(Home());

    expect(html).toContain("tape-lockup.svg");
    expect(html).toContain("Every meeting, unrolled into");
    expect(html).toContain("Layer 01 · Recording");
    expect(html).toContain("Layer 04 · Insight");
    expect(html).toContain("IOSG Ventures");
    expect(html).toContain("Bcap");
    expect(html).toContain("Maelstrom");
    expect(html).toContain("Anthropic");
    expect(html).toContain("What did we decide?");
    expect(html).toContain('href="/auth/sign-in"');
  });
});
