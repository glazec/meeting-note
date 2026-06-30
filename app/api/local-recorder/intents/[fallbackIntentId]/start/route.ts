import { getLocalRecorderWorkspace } from "@/lib/local-recorder-auth";
import { claimLocalRecorderIntent } from "@/lib/local-recorder-records";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ fallbackIntentId: string }> },
) {
  const workspace = await getLocalRecorderWorkspace(request);

  if (!workspace) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deviceId = request.headers.get("x-local-recorder-device-id")?.trim();

  if (!deviceId) {
    return Response.json({ error: "Missing recorder device" }, { status: 400 });
  }

  const { fallbackIntentId } = await context.params;
  const result = await claimLocalRecorderIntent({
    deviceId,
    fallbackIntentId,
    now: new Date(),
    workspace,
  });

  return Response.json(result, { status: result.claimed ? 200 : 409 });
}
