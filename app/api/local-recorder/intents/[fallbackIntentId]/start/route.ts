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
  const result = await claimLocalRecorderIntent({
    deviceId: deviceContext.deviceId,
    fallbackIntentId,
    now: new Date(),
    workspace: deviceContext.workspace,
  });

  return Response.json(result, { status: result.claimed ? 200 : 409 });
}
