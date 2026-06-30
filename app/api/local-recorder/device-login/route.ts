import { createLocalRecorderDeviceSession } from "@/lib/local-recorder-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const deviceId = url.searchParams.get("deviceId")?.trim();
  const callbackUrl = url.searchParams.get("callbackUrl")?.trim();

  if (!deviceId || !callbackUrl) {
    return Response.json({ error: "Invalid device login" }, { status: 400 });
  }

  const result = await createLocalRecorderDeviceSession({
    callbackUrl,
    deviceId,
    requestUrl: request.url,
  });

  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 401 });
  }

  return Response.redirect(result.redirectUrl);
}
