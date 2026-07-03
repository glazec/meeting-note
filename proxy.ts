import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth/server";

const neonAuthProxy = auth.middleware({ loginUrl: "/auth/sign-in" });
const localRecorderDeviceLoginPath = "/api/local-recorder/device-login";
const neonAuthSessionVerifierParam = "neon_auth_session_verifier";

export function proxy(request: NextRequest) {
  if (
    request.nextUrl.pathname === localRecorderDeviceLoginPath &&
    !request.nextUrl.searchParams.has(neonAuthSessionVerifierParam)
  ) {
    return NextResponse.next();
  }

  return neonAuthProxy(request);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/settings/:path*",
    "/api/local-recorder/device-login",
  ],
};
