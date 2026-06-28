import { getEmailDomain, normalizeEmailAddress } from "@/lib/email-domains";

type AutoGrantInput = {
  attendeeEmail: string;
  memberEmails: string[];
  allowedDomains: string[];
};

export function normalizeEmail(email: string) {
  return normalizeEmailAddress(email);
}

export function normalizeEmailDomain(email: string) {
  return getEmailDomain(email) ?? "";
}

export function canAutoGrantAttendeeAccess(input: AutoGrantInput) {
  const attendeeEmail = normalizeEmail(input.attendeeEmail);
  const attendeeDomain = normalizeEmailDomain(attendeeEmail);
  const memberEmails = new Set(input.memberEmails.map(normalizeEmail));
  const allowedDomains = new Set(
    input.allowedDomains.map((domain) => domain.trim().toLowerCase()),
  );

  return memberEmails.has(attendeeEmail) && allowedDomains.has(attendeeDomain);
}
