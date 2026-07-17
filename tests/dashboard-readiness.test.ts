import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, describe, expect, it, vi } from "vitest";

const { execute } = vi.hoisted(() => ({
  execute: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  db: { execute },
}));

describe("dashboard readiness", () => {
  afterEach(() => {
    execute.mockReset();
    vi.resetModules();
  });

  it("checks every invite column needed while the dashboard starts", async () => {
    execute.mockResolvedValue({ rows: [] });
    const { verifyDashboardReadiness } = await import(
      "@/lib/dashboard-readiness"
    );

    await verifyDashboardReadiness();

    const query = new PgDialect().sqlToQuery(execute.mock.calls[0]![0]).sql;
    expect(query).toContain("from meeting_share_invites");
    expect(query).toContain("source");
    expect(query).toContain("source_id");
    expect(query).toContain("revoked_at");
  });
});
