import { getLocalRecorderDeviceRequestContext } from "@/lib/local-recorder-auth";
import { createManualLocalRecorderIntent } from "@/lib/local-recorder-records";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const deviceContext = await getLocalRecorderDeviceRequestContext(request);

  if (!deviceContext.ok) {
    return Response.json(
      { error: deviceContext.error },
      { status: deviceContext.status },
    );
  }

  const result = await createManualLocalRecorderIntent({
    deviceId: deviceContext.deviceId,
    now: new Date(),
    workspace: deviceContext.workspace,
  });

  return Response.json(result);
}
