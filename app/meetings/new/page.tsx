import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { NewMeetingSources } from "@/components/new-meeting-sources";
import { requireCurrentUser } from "@/lib/auth-guards";
import {
  getOrCreateWorkspaceForSessionUser,
  getWorkspaceAccessSummary,
} from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function NewMeetingPage() {
  const user = await requireCurrentUser();
  const workspace = await getOrCreateWorkspaceForSessionUser(user);
  const accessSummary = await getWorkspaceAccessSummary(workspace);

  if (!accessSummary.canCreateMeetings) {
    redirect("/dashboard");
  }

  return (
    <AppShell activeHref="/meetings/new" oneSignalExternalId={workspace.userId}>
      <section className="flex max-w-3xl flex-col gap-6">
        <div>
          <p className="text-sm font-medium uppercase tracking-normal text-primary">
            New meeting
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Add a meeting</h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            Choose how you want to add it.
          </p>
        </div>

        <NewMeetingSources />
      </section>
    </AppShell>
  );
}
