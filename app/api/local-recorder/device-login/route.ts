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
    if (result.error === "Unauthorized") {
      return Response.redirect(buildSignInRedirectUrl(request.url));
    }

    return Response.json(
      { error: result.error },
      { status: "status" in result ? result.status : 401 },
    );
  }

  return Response.redirect(result.redirectUrl);
}

function buildSignInRedirectUrl(requestUrl: string) {
  const url = new URL(requestUrl);
  const signInUrl = new URL("/auth/sign-in", url.origin);

  signInUrl.searchParams.set("callbackUrl", `${url.pathname}${url.search}`);
  return signInUrl;
}
