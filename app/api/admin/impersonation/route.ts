import { cookies } from "next/headers";

import {
  ADMIN_IMPERSONATION_COOKIE,
  getAdminImpersonationCookieOptions,
  isAdminSessionUser,
} from "@/lib/admin-access";
import { getAdminImpersonationTarget } from "@/lib/admin-impersonation";
import { getAuthenticatedUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const admin = await getAuthenticatedUser();

  if (!admin || !isAdminSessionUser(admin)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const redirectTo = getSafeRedirectPath(formData.get("redirectTo"));
  const cookieStore = await cookies();

  if (formData.get("action") === "clear") {
    cookieStore.delete(ADMIN_IMPERSONATION_COOKIE);
    return Response.redirect(new URL(redirectTo, request.url), 303);
  }

  const userId = getFormString(formData.get("userId"));

  if (!userId) {
    return Response.json({ error: "User is required" }, { status: 400 });
  }

  const target = await getAdminImpersonationTarget(userId);

  if (!target) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  cookieStore.set({
    ...getAdminImpersonationCookieOptions(),
    name: ADMIN_IMPERSONATION_COOKIE,
    value: target.id,
  });

  return Response.redirect(new URL(redirectTo, request.url), 303);
}

function getFormString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function getSafeRedirectPath(value: FormDataEntryValue | null) {
  const path = getFormString(value);

  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return "/admin";
  }

  return path;
}
