import { getLocalRecorderDeviceRequestContext } from "@/lib/local-recorder-auth";
import { claimLocalRecorderIntent } from "@/lib/local-recorder-records";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ fallbackIntentId: string }> },
) {
  const deviceContext = await getLocalRecorderDeviceRequestContext(request);

  if (!deviceContext.ok) {
    return Response.json(
      { error: deviceContext.error },
      { status: deviceContext.status },
    );
  }

  const { fallbackIntentId } = await context.params;
  const body: unknown = await request.json().catch(() => null);
  const explicit =
    body && typeof body === "object" && "explicit" in body &&
    typeof (body as { explicit?: unknown }).explicit === "boolean"
      ? (body as { explicit: boolean }).explicit
      : undefined;
  const result = await claimLocalRecorderIntent({
    deviceId: deviceContext.deviceId,
    explicit,
    fallbackIntentId,
    now: new Date(),
    workspace: deviceContext.workspace,
  });

  return Response.json(result, { status: result.claimed ? 200 : 409 });
}
