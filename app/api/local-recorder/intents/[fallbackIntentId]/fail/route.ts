import { getLocalRecorderDeviceRequestContext } from "@/lib/local-recorder-auth";
import { failLocalRecorderIntent } from "@/lib/local-recorder-records";

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

  const body = await request.json().catch(() => null);
  const errorMessage =
    body && typeof body === "object" && "errorMessage" in body
      ? getOptionalString(body.errorMessage)
      : null;
  const { fallbackIntentId } = await context.params;
  const result = await failLocalRecorderIntent({
    deviceId: deviceContext.deviceId,
    errorMessage,
    fallbackIntentId,
    now: new Date(),
    workspace: deviceContext.workspace,
  });

  return Response.json(result, { status: result.failed ? 200 : 409 });
}

function getOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
