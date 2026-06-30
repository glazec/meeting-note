import { getLocalRecorderWorkspace } from "@/lib/local-recorder-auth";
import { listMissedLocalRecorderMeetings } from "@/lib/local-recorder-records";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const workspace = await getLocalRecorderWorkspace(request);

  if (!workspace) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deviceId = request.headers.get("x-local-recorder-device-id")?.trim();

  if (!deviceId) {
    return Response.json({ error: "Missing recorder device" }, { status: 400 });
  }

  const meetings = await listMissedLocalRecorderMeetings({
    deviceId,
    now: new Date(),
    workspace,
  });

  return Response.json({ meetings });
}
