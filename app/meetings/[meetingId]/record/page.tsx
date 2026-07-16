import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { MobileMeetingRecorder } from "@/components/mobile-meeting-recorder";
import { requireCurrentUser } from "@/lib/auth-guards";
import { getMeetingTranscriptForWorkspace } from "@/lib/meeting-queries";
import { getOrCreateWorkspaceForSessionUser } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function MobileMeetingRecorderPage({
  params,
}: {
  params: Promise<{ meetingId: string }>;
}) {
  const [user, { meetingId }] = await Promise.all([
    requireCurrentUser(),
    params,
  ]);
  const workspace = await getOrCreateWorkspaceForSessionUser(user);
  const meeting = await getMeetingTranscriptForWorkspace(workspace, meetingId);

  if (!meeting?.canManage) {
    notFound();
  }

  return (
    <AppShell
      activeHref="/dashboard"
      canCreateMeetings
      oneSignalExternalId={workspace.userId}
    >
      <section className="mx-auto flex max-w-xl flex-col items-center gap-6 py-6 sm:py-12">
        <div className="text-center">
          <p className="text-sm font-medium uppercase tracking-normal text-primary">
            Mobile recorder
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Record this meeting</h1>
        </div>
        <MobileMeetingRecorder
          meetingId={meeting.id}
          meetingTitle={meeting.title}
        />
      </section>
    </AppShell>
  );
}
