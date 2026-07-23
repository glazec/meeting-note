import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { currentTranscriptJobIdsSubquery } from "@/lib/current-transcript-job";

const dialect = new PgDialect();

describe("currentTranscriptJobIdsSubquery", () => {
  it("selects the latest completed replacement and every later append job", () => {
    const query = dialect.sqlToQuery(
      currentTranscriptJobIdsSubquery("11111111-1111-4111-8111-111111111111"),
    );

    expect(query.sql).toContain("mode = 'replace'");
    expect(query.sql).toContain("current_jobs.mode = 'append'");
    expect(query.sql).toContain("current_jobs.created_at >");
    expect(query.sql).toContain("current_jobs.status = 'completed'");
  });
});
