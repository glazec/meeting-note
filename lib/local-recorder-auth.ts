import { and, eq, gt, isNull } from "drizzle-orm";

import { db } from "@/db/client";
import { localRecorderDeviceSessions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import {
  getOrCreateWorkspaceForSessionUser,
  type WorkspaceContext,
} from "@/lib/workspace";

const deviceSessionTtlMs = 30 * 24 * 60 * 60 * 1000;
const deviceTokenBytes = 32;

export async function getLocalRecorderWorkspace(
  request: Request,
): Promise<WorkspaceContext | null> {
  const bearerToken = getBearerToken(request);

  if (bearerToken) {
    const tokenHash = await hashLocalRecorderSecret(bearerToken);
    const [session] = await db
      .select({
        teamId: localRecorderDeviceSessions.teamId,
        userId: localRecorderDeviceSessions.userId,
      })
      .from(localRecorderDeviceSessions)
      .where(
        and(
          eq(localRecorderDeviceSessions.tokenHash, tokenHash),
          gt(localRecorderDeviceSessions.expiresAt, new Date()),
          isNull(localRecorderDeviceSessions.revokedAt),
        ),
      )
      .limit(1);

    return session
      ? {
          canCreateMeetings: true,
          domain: "",
          teamId: session.teamId,
          userId: session.userId,
        }
      : null;
  }

  const user = await getCurrentUser();

  return user ? getOrCreateWorkspaceForSessionUser(user) : null;
}

export async function createLocalRecorderDeviceSession(input: {
  callbackUrl: string;
  deviceId: string;
  requestUrl: string;
}) {
  const user = await getCurrentUser();

  if (!user) {
    return { error: "Unauthorized" as const };
  }

  const callbackUrl = new URL(input.callbackUrl);

  if (callbackUrl.protocol !== "meetingnote-local-recorder:") {
    return { error: "Invalid callback" as const };
  }

  const workspace = await getOrCreateWorkspaceForSessionUser(user);
  const token = createDeviceToken();
  const tokenHash = await hashLocalRecorderSecret(token);
  const deviceIdHash = await hashLocalRecorderSecret(input.deviceId);
  const expiresAt = new Date(Date.now() + deviceSessionTtlMs);

  await db.insert(localRecorderDeviceSessions).values({
    deviceIdHash,
    expiresAt,
    teamId: workspace.teamId,
    tokenHash,
    userId: workspace.userId,
  });

  callbackUrl.searchParams.set("token", token);
  callbackUrl.searchParams.set("server", new URL(input.requestUrl).origin);

  return { redirectUrl: callbackUrl.toString() };
}

export async function hashLocalRecorderSecret(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );

  return Buffer.from(digest).toString("base64url");
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization")?.trim();

  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = authorization.slice("bearer ".length).trim();

  return token || null;
}

function createDeviceToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(deviceTokenBytes));

  return Buffer.from(bytes).toString("base64url");
}
