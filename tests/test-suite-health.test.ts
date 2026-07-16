import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const focusedOrSkippedTestPattern =
  /\b(?:describe|it|test)\.(?:only|skip)\s*\(/;

describe("test suite health", () => {
  it("does not leave focused or skipped tests committed", () => {
    const disabledTests = listTestFiles("tests")
      .filter((filePath) =>
        focusedOrSkippedTestPattern.test(readFileSync(filePath, "utf8")),
      )
      .map((filePath) => relative(process.cwd(), filePath));

    expect(disabledTests).toEqual([]);
  });

  it("gives every API route a direct regression test or framework adapter test", () => {
    const testSource = listTestFiles("tests")
      .map((filePath) => readFileSync(filePath, "utf8"))
      .join("\n");
    const frameworkAdapters = new Set([
      "app/api/auth/[...path]/route.ts",
      "app/api/inngest/route.ts",
    ]);
    const untestedRoutes = listRouteFiles("app/api")
      .map((filePath) => relative(process.cwd(), filePath))
      .filter((filePath) => {
        if (frameworkAdapters.has(filePath)) {
          return !testSource.includes(`framework adapter: ${filePath}`);
        }

        const importPath = `@/${filePath.replace(/\.ts$/, "")}`;
        return !testSource.includes(importPath);
      });

    expect(untestedRoutes).toEqual([]);
  });
});

function listTestFiles(directory: string): string[] {
  return readdirSync(directory)
    .flatMap((entry) => {
      const filePath = join(directory, entry);
      const stats = statSync(filePath);

      if (stats.isDirectory()) {
        return listTestFiles(filePath);
      }

      return /\.(test|spec)\.[tj]sx?$/.test(entry) ? [filePath] : [];
    })
    .sort();
}

function listRouteFiles(directory: string): string[] {
  return readdirSync(directory)
    .flatMap((entry) => {
      const filePath = join(directory, entry);
      const stats = statSync(filePath);

      if (stats.isDirectory()) {
        return listRouteFiles(filePath);
      }

      return entry === "route.ts" ? [filePath] : [];
    })
    .sort();
}
