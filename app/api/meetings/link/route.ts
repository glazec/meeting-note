import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import {
  createScheduledMeetingBot,
  markMeetingBotFailed,
  markMeetingBotScheduled,
} from "@/lib/meeting-bot-records";
import {
  buildAppUrl,
  detectMeetingPlatform,
  resolveMeetingJoinUrl,
} from "@/lib/meeting-links";
import {
  getMeetingBotMetadata,
  getMeetingBotProfile,
  getMeetingBotRecallCreateInput,
} from "@/lib/meeting-bot-profile";
import { scheduleRecallBot } from "@/lib/vendors/recall";
import { SharedOnlyAccessError } from "@/lib/access-errors";

export const runtime = "nodejs";

const requestSchema = z.strictObject({
  meetingUrl: z.url(),
});

type RecallBotResponse = {
  id?: unknown;
};

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const result = requestSchema.safeParse(body);

  if (!result.success) {
    return Response.json({ error: "Invalid meeting link" }, { status: 400 });
  }

  const platform = detectMeetingPlatform(result.data.meetingUrl);

  if (!platform) {
    return Response.json(
      { error: "Unsupported meeting link" },
      { status: 400 },
    );
  }

  const meetingUrl = await resolveMeetingJoinUrl(result.data.meetingUrl);
  let scheduledMeeting: {
    meetingId: string;
    teamId: string;
    startAt?: string;
    recallBotId?: string;
  };

  try {
    scheduledMeeting = await createScheduledMeetingBot({
      sessionUser: user,
      meetingUrl,
      platform,
    });
  } catch (error) {
    console.error("meeting_link_scheduling_failure", {
      errorMessage: getErrorMessage(error),
      phase: "create_meeting",
      platform,
      userId: user.id,
    });
    const response = handleMeetingLinkError(error);

    if (response) {
      return response;
    }

    return Response.json({ error: "Meeting unavailable" }, { status: 500 });
  }

  if (scheduledMeeting.recallBotId) {
    return Response.json({
      botId: scheduledMeeting.recallBotId,
      meetingId: scheduledMeeting.meetingId,
      meetingUrl,
      platform,
      status: "scheduled",
    });
  }

  try {
    const botProfile = await getMeetingBotProfile(scheduledMeeting.teamId);
    const bot = (await scheduleRecallBot({
      meetingUrl,
      ...getMeetingBotRecallCreateInput(botProfile),
      ...(scheduledMeeting.startAt ? { startAt: scheduledMeeting.startAt } : {}),
      webhookUrl: buildAppUrl("/api/recall/webhook"),
      metadata: {
        ...getMeetingBotMetadata(botProfile),
        meetingId: scheduledMeeting.meetingId,
      },
    })) as RecallBotResponse;

    if (typeof bot.id !== "string") {
      throw new Error("Recall bot response missing id");
    }

    await markMeetingBotScheduled({
      meetingId: scheduledMeeting.meetingId,
      recallBotId: bot.id,
    });

    return Response.json({
      botId: bot.id,
      meetingId: scheduledMeeting.meetingId,
      meetingUrl,
      platform,
      status: "scheduled",
    });
  } catch {
    await markMeetingBotFailed({ meetingId: scheduledMeeting.meetingId });

    return Response.json({ error: "Meeting bot unavailable" }, { status: 502 });
  }
}

function handleMeetingLinkError(error: unknown) {
  if (error instanceof SharedOnlyAccessError) {
    return Response.json(
      { error: "Shared users cannot add meetings" },
      { status: 403 },
    );
  }

  return null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown meeting link error";
}
