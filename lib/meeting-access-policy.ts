import { eq, or, sql, type SQL } from "drizzle-orm";

import { meetingAccess, meetings } from "@/db/schema";
import type { WorkspaceContext } from "@/lib/workspace";

export function canReadWorkspaceMeetings(workspace: WorkspaceContext) {
  return workspace.canCreateMeetings !== false;
}

export function getReadableMeetingsCondition(
  workspace: WorkspaceContext,
): SQL {
  const sharedAccessCondition = sql`exists (
    select 1
    from ${meetingAccess}
    where ${meetingAccess.meetingId} = ${meetings.id}
      and ${meetingAccess.userId} = ${workspace.userId}
  )`;

  if (!canReadWorkspaceMeetings(workspace)) {
    return sharedAccessCondition;
  }

  return or(eq(meetings.teamId, workspace.teamId), sharedAccessCondition)!;
}

export function getMeetingAccessScope(
  meetingTeamId: string,
  workspace: WorkspaceContext,
) {
  return canReadWorkspaceMeetings(workspace) &&
    meetingTeamId === workspace.teamId
    ? "workspace"
    : "shared";
}
