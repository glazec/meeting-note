import {
  buildExpiredNeonAuthCookie,
  getNeonAuthCookieNames,
} from "@/lib/neon-auth-cookies";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const headers = new Headers();

  for (const cookieName of getNeonAuthCookieNames(
    request.headers.get("cookie"),
  )) {
    headers.append("set-cookie", buildExpiredNeonAuthCookie(cookieName));
  }

  return new Response(null, { status: 204, headers });
}
