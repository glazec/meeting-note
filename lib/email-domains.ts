const commonPersonalEmailDomains = new Set([
  "126.com",
  "163.com",
  "aol.com",
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "icloud.com",
  "live.com",
  "mac.com",
  "me.com",
  "msn.com",
  "outlook.com",
  "proton.me",
  "protonmail.com",
  "qq.com",
  "yahoo.com",
]);

export function normalizeEmailAddress(email: string) {
  return email.trim().toLowerCase();
}

export function getEmailDomain(email: string) {
  return normalizeEmailAddress(email).split("@")[1]?.trim() ?? null;
}

export function isCommonPersonalEmailDomain(domain: string) {
  return commonPersonalEmailDomains.has(domain.trim().toLowerCase());
}

export function getExternalOrganizationDomain(
  email: string,
  workspaceDomain?: string | null,
) {
  const domain = getEmailDomain(email);
  const normalizedWorkspaceDomain = workspaceDomain?.trim().toLowerCase();

  if (
    !domain ||
    domain === normalizedWorkspaceDomain ||
    isCommonPersonalEmailDomain(domain)
  ) {
    return null;
  }

  return domain;
}
