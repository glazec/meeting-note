import { getLocalRecorderDeviceRequestContext } from "@/lib/local-recorder-auth";
import {
  completeLocalRecorderRecordingUpload,
  LocalRecorderUploadError,
} from "@/lib/local-recorder-records";
import { parseLocalRecorderUploadCompletionRequest } from "@/lib/local-recorder-upload-request";

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

  const body = await request.json().catch(() => null);
  const parsed = parseLocalRecorderUploadCompletionRequest(body);

  if (!parsed.ok) {
    return Response.json(
      { error: "Invalid local recording completion" },
      { status: 400 },
    );
  }

  try {
    const result = await completeLocalRecorderRecordingUpload({
      ...parsed.value,
      deviceId: deviceContext.deviceId,
      workspace: deviceContext.workspace,
    });

    return Response.json(result, { status: 202 });
  } catch (error) {
    if (error instanceof LocalRecorderUploadError) {
      return Response.json({ error: error.message }, { status: 409 });
    }

    return Response.json(
      { error: "Local recording completion unavailable" },
      { status: 500 },
    );
  }
}
