import { getLocalRecorderWorkspace } from "@/lib/local-recorder-auth";
import { failLocalRecorderIntent } from "@/lib/local-recorder-records";

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

  const body = await request.json().catch(() => null);
  const errorMessage =
    body && typeof body === "object" && "errorMessage" in body
      ? getOptionalString(body.errorMessage)
      : null;
  const { fallbackIntentId } = await context.params;
  const result = await failLocalRecorderIntent({
    deviceId,
    errorMessage,
    fallbackIntentId,
    now: new Date(),
    workspace,
  });

  return Response.json(result, { status: result.failed ? 200 : 409 });
}

function getOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
