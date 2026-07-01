import { asc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { teamMemberships, teams, users } from "@/db/schema";
import type { SessionUser } from "@/lib/auth";

export type AdminImpersonationTarget = {
  id: string;
  authUserId: string;
  email: string;
  name: string | null;
  role?: string | null;
  teamName?: string | null;
};

export async function getAdminImpersonationTarget(
  userId: string,
): Promise<AdminImpersonationTarget | null> {
  const [target] = await db
    .select({
      authUserId: users.authUserId,
      email: users.email,
      id: users.id,
      name: users.name,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return target ?? null;
}

export async function getImpersonatedSessionUser(
  userId: string,
): Promise<SessionUser | null> {
  const target = await getAdminImpersonationTarget(userId);

  if (!target) {
    return null;
  }

  return {
    email: target.email,
    id: target.authUserId,
    name: target.name,
  };
}

export async function listAdminImpersonationTargets() {
  return db
    .select({
      authUserId: users.authUserId,
      email: users.email,
      id: users.id,
      name: users.name,
      role: teamMemberships.role,
      teamName: teams.name,
    })
    .from(users)
    .leftJoin(teamMemberships, eq(teamMemberships.userId, users.id))
    .leftJoin(teams, eq(teams.id, teamMemberships.teamId))
    .orderBy(asc(users.email))
    .limit(200);
}
