import { asc, eq, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { teamSpeakerAliases } from "@/db/schema";
import {
  buildTeamSpeakerAliasRows,
  type SpeakerAlias,
} from "@/lib/speaker-alias-normalization";

export async function listTeamSpeakerAliases(
  teamId: string,
): Promise<SpeakerAlias[]> {
  return db
    .select({
      alias: teamSpeakerAliases.alias,
      canonicalName: teamSpeakerAliases.canonicalName,
    })
    .from(teamSpeakerAliases)
    .where(eq(teamSpeakerAliases.teamId, teamId))
    .orderBy(asc(teamSpeakerAliases.canonicalName), asc(teamSpeakerAliases.alias));
}

export async function upsertTeamSpeakerAliases(input: {
  aliases: Array<string | null>;
  canonicalName: string;
  teamId: string;
}) {
  const rows = buildTeamSpeakerAliasRows(input);

  if (rows.length === 0) {
    return;
  }

  await db
    .insert(teamSpeakerAliases)
    .values(rows)
    .onConflictDoUpdate({
      target: [teamSpeakerAliases.teamId, teamSpeakerAliases.aliasKey],
      set: {
        alias: sql`excluded.alias`,
        canonicalName: sql`excluded.canonical_name`,
        updatedAt: new Date(),
      },
    });
}
