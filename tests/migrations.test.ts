import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("database migrations", () => {
  it("backfills existing calendar-backed renamed meetings as manual titles", () => {
    const sql = readFileSync(
      "db/migrations/0020_meeting_title_source.sql",
      "utf8",
    ).replace(/\s+/g, " ");

    expect(sql).toContain(
      'ALTER TABLE "meetings" ADD COLUMN "title_source" text DEFAULT \'calendar\' NOT NULL',
    );
    expect(sql).toContain('UPDATE "meetings"');
    expect(sql).toContain('SET "title_source" = \'manual\'');
    expect(sql).toContain('FROM "calendar_events"');
    expect(sql).toContain(
      '"meetings"."calendar_event_id" = "calendar_events"."id"',
    );
    expect(sql).toContain(
      '"meetings"."title" IS DISTINCT FROM "calendar_events"."title"',
    );
  });
});
