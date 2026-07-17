import { describe, expect, it } from "vitest";

import { getVercelBuildScripts } from "@/scripts/vercel-build.mjs";

describe("Vercel build", () => {
  it("migrates the production database before building", () => {
    expect(getVercelBuildScripts("production")).toEqual([
      "test:deployment-schema",
      "build",
      "db:migrate",
    ]);
  });

  it("does not migrate the production database for preview builds", () => {
    expect(getVercelBuildScripts("preview")).toEqual(["build"]);
  });
});
