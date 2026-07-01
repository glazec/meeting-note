import { getLocalRecorderDeviceRequestContext } from "@/lib/local-recorder-auth";
import { listMissedLocalRecorderMeetings } from "@/lib/local-recorder-records";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const deviceContext = await getLocalRecorderDeviceRequestContext(request);

  if (!deviceContext.ok) {
    return Response.json(
      { error: deviceContext.error },
      { status: deviceContext.status },
    );
  }

  const meetings = await listMissedLocalRecorderMeetings({
    deviceId: deviceContext.deviceId,
    now: new Date(),
    workspace: deviceContext.workspace,
  });

  return Response.json({ meetings });
}
