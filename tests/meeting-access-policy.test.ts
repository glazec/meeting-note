import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  getMeetingAccessScope,
  getReadableMeetingsCondition,
} from "@/lib/meeting-access-policy";

const dialect = new PgDialect();

function toQuery(condition: SQL) {
  return dialect.sqlToQuery(condition);
}

describe("meeting access policy", () => {
  it("lets workspace members read organization meetings and explicit shares", () => {
    const query = toQuery(
      getReadableMeetingsCondition({
        teamId: "team_123",
        userId: "user_123",
        domain: "example.com",
        canCreateMeetings: true,
      }),
    );

    expect(query.sql).toContain('"meetings"."team_id" = $1');
    expect(query.sql).toContain('"meeting_access"');
    expect(query.params).toEqual(["team_123", "user_123"]);
  });

  it("limits shared only users to meetings explicitly shared with them", () => {
    const query = toQuery(
      getReadableMeetingsCondition({
        teamId: "guest_team_123",
        userId: "user_123",
        domain: "partner.com",
        canCreateMeetings: false,
      }),
    );

    expect(query.sql).not.toContain('"meetings"."team_id" =');
    expect(query.sql).toContain('"meeting_access"');
    expect(query.params).toEqual(["user_123"]);
  });

  it("treats a shared only user's own guest team as shared access", () => {
    expect(
      getMeetingAccessScope("guest_team_123", {
        teamId: "guest_team_123",
        userId: "user_123",
        domain: "partner.com",
        canCreateMeetings: false,
      }),
    ).toBe("shared");
  });
});
