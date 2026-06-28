import { describe, expect, it } from "vitest";

import packageJson from "../package.json" with { type: "json" };

describe("package scripts", () => {
  it("exposes a database migration command for deploys", () => {
    expect(packageJson.scripts).toMatchObject({
      "db:migrate": "drizzle-kit migrate --config=drizzle.config.ts",
    });
  });
});
