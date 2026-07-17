import { verifyDashboardReadiness } from "@/lib/dashboard-readiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const responseOptions = {
  headers: {
    "cache-control": "no-store",
  },
};

export async function GET() {
  try {
    await verifyDashboardReadiness();

    return Response.json({ ok: true }, responseOptions);
  } catch {
    return Response.json({ ok: false }, { ...responseOptions, status: 503 });
  }
}
