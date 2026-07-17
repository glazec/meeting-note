import { afterEach, describe, expect, it, vi } from "vitest";

const { verifyDashboardReadiness } = vi.hoisted(() => ({
  verifyDashboardReadiness: vi.fn(),
}));

vi.mock("@/lib/dashboard-readiness", () => ({
  verifyDashboardReadiness,
}));

describe("GET /api/health/dashboard", () => {
  afterEach(() => {
    verifyDashboardReadiness.mockReset();
    vi.resetModules();
  });

  it("returns 200 when the dashboard database query succeeds", async () => {
    verifyDashboardReadiness.mockResolvedValue(undefined);
    const { GET } = await import("@/app/api/health/dashboard/route");

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("returns 503 when the dashboard database query fails", async () => {
    verifyDashboardReadiness.mockRejectedValue(new Error("schema drift"));
    const { GET } = await import("@/app/api/health/dashboard/route");

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ ok: false });
  });
});
