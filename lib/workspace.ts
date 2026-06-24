import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import {
  allowedDomains,
  teamMemberships,
  teams,
  users,
} from "@/db/schema";
import type { SessionUser } from "@/lib/auth";
import { normalizeEmail, normalizeEmailDomain } from "@/lib/access";

export type WorkspaceContext = {
  userId: string;
  teamId: string;
  domain: string;
};

export async function getOrCreateWorkspaceForSessionUser(
  sessionUser: SessionUser,
): Promise<WorkspaceContext> {
  const email = normalizeEmail(sessionUser.email);
  const domain = normalizeEmailDomain(email);

  if (!domain) {
    throw new Error("Session user email must include a domain");
  }

  const userId = await getOrCreateUserId(sessionUser, email);
  const existingDomain = await db
    .select({ teamId: allowedDomains.teamId })
    .from(allowedDomains)
    .where(eq(allowedDomains.domain, domain))
    .limit(1);

  let teamId = existingDomain[0]?.teamId;
  let createdTeam = false;

  if (!teamId) {
    const [team] = await db
      .insert(teams)
      .values({ name: `${domain} workspace` })
      .returning({ id: teams.id });

    teamId = team.id;
    createdTeam = true;

    await db.insert(allowedDomains).values({ teamId, domain });
  }

  await db
    .insert(teamMemberships)
    .values({
      teamId,
      userId,
      role: createdTeam ? "admin" : "member",
    })
    .onConflictDoNothing({
      target: [teamMemberships.teamId, teamMemberships.userId],
    });

  return { userId, teamId, domain };
}

async function getOrCreateUserId(sessionUser: SessionUser, email: string) {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.authUserId, sessionUser.id))
    .limit(1);

  if (existing[0]) {
    await db
      .update(users)
      .set({
        email,
        name: sessionUser.name,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing[0].id));

    return existing[0].id;
  }

  const [user] = await db
    .insert(users)
    .values({
      authUserId: sessionUser.id,
      email,
      name: sessionUser.name,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        authUserId: sessionUser.id,
        name: sessionUser.name,
        updatedAt: new Date(),
      },
    })
    .returning({ id: users.id });

  return user.id;
}
