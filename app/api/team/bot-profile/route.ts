import { getCurrentUser } from "@/lib/auth";
import {
  MeetingBotProfileInputError,
  upsertMeetingBotProfile,
} from "@/lib/meeting-bot-profile";
import {
  getOrCreateWorkspaceForSessionUser,
  getWorkspaceAccessSummary,
} from "@/lib/workspace";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspace = await getOrCreateWorkspaceForSessionUser(user);
  const accessSummary = await getWorkspaceAccessSummary(workspace);

  if (!accessSummary.canCreateMeetings) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);
  const botName = formData?.get("botName");
  const avatar = formData?.get("avatar");

  try {
    await upsertMeetingBotProfile({
      teamId: workspace.teamId,
      botName: typeof botName === "string" ? botName : null,
      avatarFile: avatar instanceof File ? avatar : null,
      resetAvatar: formData?.get("resetAvatar") === "on",
    });
  } catch (error) {
    if (error instanceof MeetingBotProfileInputError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json(
      { error: "Bot profile could not be saved" },
      { status: 500 },
    );
  }

  return Response.redirect(new URL("/settings/team", request.url), 303);
}
