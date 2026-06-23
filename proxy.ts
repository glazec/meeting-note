import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth/server";

const neonAuthProxy = auth.middleware({ loginUrl: "/auth/sign-in" });

export function proxy(request: NextRequest) {
  return neonAuthProxy(request);
}

export const config = {
  matcher: ["/dashboard/:path*", "/settings/:path*"],
};
