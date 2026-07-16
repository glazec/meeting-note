import {
  getExternalParticipantKeys,
  getMeetingSimilarityKeys,
} from "@/lib/meeting-intelligence";

export function getMeetingShareMatchKeys(input: {
  attendeeEmails: unknown;
  title: string;
  workspaceDomain: string;
}) {
  return getMeetingSimilarityKeys(
    {
      title: input.title,
      externalParticipantKeys: getExternalParticipantKeys(
        input.attendeeEmails,
        input.workspaceDomain,
      ),
    },
    {},
  );
}

export function meetingsShareAnyMatchKey(
  leftKeys: string[],
  rightKeys: string[],
) {
  const left = new Set(leftKeys);

  return rightKeys.some((key) => left.has(key));
}
