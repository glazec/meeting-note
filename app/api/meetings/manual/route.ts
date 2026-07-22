import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { meetings } from "@/db/schema";
import { SharedOnlyAccessError } from "@/lib/access-errors";
import { getCurrentUser } from "@/lib/auth";
import { reconcileMeetingSharingForMeeting } from "@/lib/meeting-share-rules";
import {
  assertCanCreateMeetings,
  getOrCreateWorkspaceForSessionUser,
} from "@/lib/workspace";

export const runtime = "nodejs";

const requestSchema = z.strictObject({
  title: z.string().trim().max(100).optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => ({})));

  if (!parsed.success) {
    return Response.json({ error: "Invalid meeting details" }, { status: 400 });
  }

  try {
    const workspace = await getOrCreateWorkspaceForSessionUser(user);
    await assertCanCreateMeetings(workspace);
    const now = new Date();
    const [meeting] = await db
      .insert(meetings)
      .values({
        ownerUserId: workspace.userId,
        platform: "in_person",
        startedAt: now,
        status: "scheduled",
        teamId: workspace.teamId,
        title: parsed.data.title || "Manual meeting",
        titleSource: "manual",
      })
      .returning({ id: meetings.id });

    try {
      await reconcileMeetingSharingForMeeting(meeting.id);
    } catch (error) {
      await db.delete(meetings).where(eq(meetings.id, meeting.id));
      throw error;
    }
    revalidatePath("/dashboard");

    return Response.json({ meetingId: meeting.id }, { status: 201 });
  } catch (error) {
    if (error instanceof SharedOnlyAccessError) {
      return Response.json({ error: error.message }, { status: 403 });
    }

    return Response.json({ error: "Meeting could not be created" }, { status: 500 });
  }
}
