import { getSpeakerIdentityKey } from "@/lib/speaker-labels";

export type SpeakerAlias = {
  alias: string;
  canonicalName: string;
};

export function applySpeakerAliasesToSegments<
  Segment extends { speaker: string | null },
>(segments: Segment[], aliases: SpeakerAlias[]) {
  const aliasMap = buildSpeakerAliasMap(aliases);

  if (aliasMap.size === 0) {
    return segments;
  }

  return segments.map((segment) => {
    const canonicalName = getCanonicalSpeakerName(segment.speaker, aliasMap);

    return canonicalName ? { ...segment, speaker: canonicalName } : segment;
  });
}

export function buildTeamSpeakerAliasRows(input: {
  aliases: Array<string | null>;
  canonicalName: string;
  teamId: string;
}) {
  const canonicalName = input.canonicalName.trim();
  const canonicalKey = getSpeakerAliasKey(canonicalName);

  if (!canonicalName || !canonicalKey || isGenericSpeakerAlias(canonicalName)) {
    return [];
  }

  const meaningfulAlias = input.aliases.some((alias) => {
    const aliasLabel = alias?.trim();
    const aliasKey = aliasLabel ? getSpeakerAliasKey(aliasLabel) : null;

    return (
      aliasLabel &&
      aliasKey &&
      aliasKey !== canonicalKey &&
      !isGenericSpeakerAlias(aliasLabel)
    );
  });

  if (!meaningfulAlias) {
    return [];
  }

  const aliasByKey = new Map<string, string>();
  aliasByKey.set(canonicalKey, canonicalName);

  for (const alias of input.aliases) {
    const aliasLabel = alias?.trim();
    const aliasKey = aliasLabel ? getSpeakerAliasKey(aliasLabel) : null;

    if (!aliasLabel || !aliasKey || isGenericSpeakerAlias(aliasLabel)) {
      continue;
    }

    aliasByKey.set(aliasKey, aliasLabel);
  }

  return Array.from(aliasByKey.entries()).map(([aliasKey, alias]) => ({
    alias,
    aliasKey,
    canonicalName,
    teamId: input.teamId,
  }));
}

export function groupSpeakerAliasesByCanonicalKey(aliases: SpeakerAlias[]) {
  const aliasesByCanonicalKey = new Map<string, string[]>();

  for (const speakerAlias of aliases) {
    const canonicalKey = getSpeakerAliasKey(speakerAlias.canonicalName);
    const alias = speakerAlias.alias.trim();

    if (!canonicalKey || !alias) {
      continue;
    }

    const speakerAliases = aliasesByCanonicalKey.get(canonicalKey) ?? [];
    speakerAliases.push(alias);
    aliasesByCanonicalKey.set(canonicalKey, speakerAliases);
  }

  return aliasesByCanonicalKey;
}

function buildSpeakerAliasMap(aliases: SpeakerAlias[]) {
  const aliasMap = new Map<string, string>();

  for (const alias of aliases) {
    const canonicalName = alias.canonicalName.trim();
    const canonicalKey = getSpeakerAliasKey(canonicalName);
    const aliasKey = getSpeakerAliasKey(alias.alias);

    if (!canonicalName || !canonicalKey || !aliasKey) {
      continue;
    }

    aliasMap.set(aliasKey, canonicalName);
    aliasMap.set(canonicalKey, canonicalName);
  }

  return aliasMap;
}

function getCanonicalSpeakerName(
  speaker: string | null,
  aliasMap: Map<string, string>,
) {
  const speakerKey = getSpeakerAliasKey(speaker);

  return speakerKey ? aliasMap.get(speakerKey) ?? null : null;
}

function getSpeakerAliasKey(speaker: string | null) {
  const speakerKey = getSpeakerIdentityKey(speaker);

  return speakerKey === "__unknown__" ? null : speakerKey;
}

function isGenericSpeakerAlias(label: string) {
  return /^(speaker\s*\d+|unknown speaker)$/i.test(label.trim());
}
