import { randomBytes } from "crypto";
import { NextResponse } from "next/server";

import { SharedOnlyAccessError } from "@/lib/access-errors";
import { getCurrentUser } from "@/lib/auth";
import {
  buildGoogleCalendarOAuthUrl,
  GOOGLE_CALENDAR_OAUTH_STATE_COOKIE,
  shouldUseSecureCalendarOAuthCookie,
} from "@/lib/google-calendar-oauth";
import {
  assertCanCreateMeetings,
  getOrCreateWorkspaceForSessionUser,
} from "@/lib/workspace";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.redirect(new URL("/auth/sign-in", getAppUrl()));
  }

  try {
    const workspace = await getOrCreateWorkspaceForSessionUser(user);
    await assertCanCreateMeetings(workspace);
  } catch (error) {
    if (error instanceof SharedOnlyAccessError) {
      return NextResponse.redirect(new URL("/dashboard", getAppUrl()));
    }

    throw error;
  }

  const state = randomBytes(32).toString("base64url");
  const response = NextResponse.redirect(buildGoogleCalendarOAuthUrl(state));

  response.cookies.set(GOOGLE_CALENDAR_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    maxAge: 10 * 60,
    path: "/api/calendar/oauth",
    sameSite: "lax",
    secure: shouldUseSecureCalendarOAuthCookie(),
  });

  return response;
}

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
