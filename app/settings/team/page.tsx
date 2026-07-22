import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { requireCurrentUser } from "@/lib/auth-guards";
import {
  getDefaultMeetingBotAvatarJpegBase64,
  getMeetingBotProfile,
} from "@/lib/meeting-bot-profile";
import { getTeamConfiguration } from "@/lib/team-configuration";
import { listTeamVocabularyTerms } from "@/lib/team-vocabulary";
import {
  canManageTeamSettings,
  getOrCreateWorkspaceForSessionUser,
  getWorkspaceAccessSummary,
  listWorkspaceMembers,
} from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function TeamSettingsPage() {
  const user = await requireCurrentUser();
  const workspace = await getOrCreateWorkspaceForSessionUser(user);
  const accessSummary = await getWorkspaceAccessSummary(workspace);

  if (!accessSummary.canCreateMeetings) {
    redirect("/dashboard");
  }

  const [
    canEditTeamSettings,
    vocabularyTerms,
    botProfile,
    teamConfiguration,
    teamMembers,
  ] = await Promise.all([
    canManageTeamSettings(workspace),
    listTeamVocabularyTerms(workspace.teamId),
    getMeetingBotProfile(workspace.teamId),
    getTeamConfiguration(workspace.teamId),
    listWorkspaceMembers(workspace),
  ]);
  const botAvatarJpegBase64 =
    botProfile.avatarJpegBase64 ?? getDefaultMeetingBotAvatarJpegBase64();

  return (
    <AppShell
      activeHref="/settings/team"
      canCreateMeetings
      oneSignalExternalId={workspace.userId}
    >
      <section className="flex max-w-3xl flex-col gap-6">
        <div>
          <p className="text-sm font-medium uppercase tracking-normal text-primary">
            Team settings
          </p>
          <h1 className="mt-3 text-3xl font-semibold">
            {teamConfiguration.name}
          </h1>
          {!canEditTeamSettings ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Only team administrators can edit these settings.
            </p>
          ) : null}
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Workspace identity and sharing</CardTitle>
            <CardDescription>
              Set the team name and an optional group that appears in meeting
              sharing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canEditTeamSettings ? (
              <form
                action="/api/team/configuration"
                className="flex flex-col gap-4"
                method="post"
              >
                <div className="grid gap-2">
                  <label
                    className="text-sm leading-none font-medium"
                    htmlFor="teamName"
                  >
                    Team name
                  </label>
                  <Input
                    defaultValue={teamConfiguration.name}
                    id="teamName"
                    maxLength={100}
                    name="teamName"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <label
                    className="text-sm leading-none font-medium"
                    htmlFor="shareAudienceName"
                  >
                    Sharing group name
                  </label>
                  <Input
                    defaultValue={teamConfiguration.shareAudience?.name ?? ""}
                    id="shareAudienceName"
                    maxLength={100}
                    name="shareAudienceName"
                    placeholder="Investment committee"
                  />
                </div>
                <div className="grid gap-2">
                  <label
                    className="text-sm leading-none font-medium"
                    htmlFor="shareAudienceEmails"
                  >
                    Sharing group member emails
                  </label>
                  <textarea
                    className="border-input bg-background min-h-28 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                    defaultValue={
                      teamConfiguration.shareAudience?.emails.join("\n") ?? ""
                    }
                    id="shareAudienceEmails"
                    name="shareAudienceEmails"
                    placeholder={"person@example.com\ncolleague@example.com"}
                  />
                  <p className="text-xs leading-5 text-muted-foreground">
                    Add one email per line. Leave both sharing group fields
                    empty to hide the group.
                  </p>
                </div>
                <Button className="self-start" type="submit">
                  Save team settings
                </Button>
              </form>
            ) : (
              <div className="flex flex-col gap-2 text-sm">
                <p className="font-medium">{teamConfiguration.name}</p>
                {teamConfiguration.shareAudience ? (
                  <p className="text-muted-foreground">
                    {teamConfiguration.shareAudience.name} ·{" "}
                    {teamConfiguration.shareAudience.emails.length} members
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    No team sharing group configured.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Meeting capture</CardTitle>
            <CardDescription>
              Set the team bot name and JPG avatar people see when it joins
              calls.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canEditTeamSettings ? (
              <form
                action="/api/team/bot-profile"
                className="flex flex-col gap-4"
                encType="multipart/form-data"
                method="post"
              >
                <div className="grid gap-2">
                  <label
                    className="text-sm leading-none font-medium"
                    htmlFor="botName"
                  >
                    Team bot name
                  </label>
                  <Input
                    defaultValue={botProfile.botName}
                    id="botName"
                    maxLength={100}
                    name="botName"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <label
                    className="text-sm leading-none font-medium"
                    htmlFor="avatar"
                  >
                    Team meeting bot avatar
                  </label>
                  <Input
                    accept="image/jpeg"
                    id="avatar"
                    name="avatar"
                    type="file"
                  />
                  <p className="text-xs leading-5 text-muted-foreground">
                    Upload a JPG image under 1 MB.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div
                    aria-label="Current team meeting bot avatar"
                    className="size-16 rounded-lg border bg-muted bg-cover bg-center"
                    role="img"
                    style={
                      botAvatarJpegBase64
                        ? {
                            backgroundImage: `url(data:image/jpeg;base64,${botAvatarJpegBase64})`,
                          }
                        : undefined
                    }
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {botProfile.avatarJpegBase64
                        ? "Custom avatar saved"
                        : "Default avatar"}
                    </p>
                    <label className="mt-2 flex items-center gap-2 text-xs font-normal text-muted-foreground">
                      <input
                        className="size-4"
                        name="resetAvatar"
                        type="checkbox"
                      />
                      Use default avatar
                    </label>
                  </div>
                </div>
                <Button className="self-start" type="submit">
                  Save team bot profile
                </Button>
              </form>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-sm font-medium">{botProfile.botName}</p>
                <p className="text-xs text-muted-foreground">
                  Team meeting bot avatar
                </p>
                <div
                  aria-label="Current team meeting bot avatar"
                  className="size-16 rounded-lg border bg-muted bg-cover bg-center"
                  role="img"
                  style={
                    botAvatarJpegBase64
                      ? {
                          backgroundImage: `url(data:image/jpeg;base64,${botAvatarJpegBase64})`,
                        }
                      : undefined
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {botProfile.avatarJpegBase64
                    ? "Custom avatar saved"
                    : "Default avatar"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        {canEditTeamSettings || vocabularyTerms.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Transcription vocabulary</CardTitle>
            <CardDescription>
              Help Tape recognize team, company, and deal names correctly.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {canEditTeamSettings ? (
              <form
                action="/api/team/vocabulary"
                className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                method="post"
              >
                <Input
                  aria-label="Vocabulary term"
                  name="term"
                  placeholder="Term"
                />
                <Input
                  aria-label="Vocabulary hint"
                  name="hint"
                  placeholder="Optional hint"
                />
                <Button type="submit">Add</Button>
              </form>
            ) : null}
            {vocabularyTerms.length > 0 ? (
              <ul className="divide-y rounded-lg border">
                {vocabularyTerms.map((term) => (
                  <li className="px-3 py-2" key={term.id}>
                    <p className="text-sm font-medium">{term.term}</p>
                    {term.hint ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {term.hint}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg border px-3 py-4 text-sm text-muted-foreground">
                No team vocabulary yet.
              </p>
            )}
          </CardContent>
        </Card>
        ) : null}
        <details className="group rounded-lg border bg-card shadow-sm">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <span>Workspace members</span>
            <span className="text-sm font-normal text-muted-foreground">
              {teamMembers.length.toLocaleString()}
            </span>
          </summary>
          <div className="border-t p-4">
            {teamMembers.length > 0 ? (
              <ul className="max-h-80 divide-y overflow-y-auto rounded-lg border">
                {teamMembers.map((member) => (
                  <li
                    className="flex flex-wrap items-center justify-between gap-3 px-3 py-3"
                    key={member.id}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {member.name || member.email}
                      </p>
                      {member.name ? (
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {member.email}
                        </p>
                      ) : null}
                    </div>
                    {member.isCurrentUser ? (
                      <span className="rounded-md border px-2 py-1 text-xs font-medium">
                        You
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No workspace members yet.
              </p>
            )}
          </div>
        </details>
      </section>
    </AppShell>
  );
}
