import { and, eq, isNull, lte, or } from "drizzle-orm";

import { db } from "@/db/client";
import {
  calendarEvents,
  meetingReminders,
  meetings,
  users,
} from "@/db/schema";
import { sendOneSignalLocationReminder } from "@/lib/vendors/onesignal";

const STALE_REMINDER_CLAIM_MS = 5 * 60 * 1000;

export async function sendDueLocationReminders(input: { now?: Date } = {}) {
  const now = input.now ?? new Date();
  const staleClaimBefore = new Date(now.getTime() - STALE_REMINDER_CLAIM_MS);
  const reminders = await db
    .select({
      id: meetingReminders.id,
      meetingId: meetingReminders.meetingId,
      userId: meetingReminders.userId,
      title: meetings.title,
      startsAt: meetings.startedAt,
      location: calendarEvents.location,
    })
    .from(meetingReminders)
    .innerJoin(meetings, eq(meetingReminders.meetingId, meetings.id))
    .innerJoin(calendarEvents, eq(meetings.calendarEventId, calendarEvents.id))
    .innerJoin(users, eq(meetingReminders.userId, users.id))
    .where(
      and(
        isNull(meetingReminders.sentAt),
        lte(meetingReminders.scheduledFor, now),
        or(
          eq(meetingReminders.status, "pending"),
          and(
            eq(meetingReminders.status, "sending"),
            lte(meetingReminders.updatedAt, staleClaimBefore),
          ),
        ),
      ),
    )
    .limit(100);
  let sentCount = 0;

  for (const reminder of reminders) {
    const claimed = await claimLocationReminder({
      id: reminder.id,
      now,
      staleClaimBefore,
    });

    if (!claimed) {
      continue;
    }

    if (reminder.startsAt && now > reminder.startsAt) {
      await markReminderFailed({
        id: reminder.id,
        errorMessage: "Reminder expired after meeting start",
        now,
      });
      continue;
    }

    if (!reminder.location) {
      await markReminderFailed({
        id: reminder.id,
        errorMessage: "Reminder has no location",
        now,
      });
      continue;
    }

    try {
      const response = await sendOneSignalLocationReminder({
        externalUserId: reminder.userId,
        meetingId: reminder.meetingId,
        meetingTitle: reminder.title,
        location: reminder.location,
      });

      await db
        .update(meetingReminders)
        .set({
          providerNotificationId: getNotificationId(response),
          sentAt: now,
          status: "sent",
          updatedAt: now,
        })
        .where(eq(meetingReminders.id, reminder.id));
      sentCount += 1;
    } catch (error) {
      await markReminderFailed({
        id: reminder.id,
        errorMessage:
          error instanceof Error ? error.message : "Reminder send failed",
        now,
      });
    }
  }

  return { sentCount };
}

async function claimLocationReminder(input: {
  id: string;
  now: Date;
  staleClaimBefore: Date;
}) {
  const claimed = await db
    .update(meetingReminders)
    .set({
      errorMessage: null,
      status: "sending",
      updatedAt: input.now,
    })
    .where(
      and(
        eq(meetingReminders.id, input.id),
        isNull(meetingReminders.sentAt),
        or(
          eq(meetingReminders.status, "pending"),
          and(
            eq(meetingReminders.status, "sending"),
            lte(meetingReminders.updatedAt, input.staleClaimBefore),
          ),
        ),
      ),
    )
    .returning({ id: meetingReminders.id });

  return claimed.length > 0;
}

async function markReminderFailed(input: {
  id: string;
  errorMessage: string;
  now: Date;
}) {
  await db
    .update(meetingReminders)
    .set({
      errorMessage: input.errorMessage,
      status: "failed",
      updatedAt: input.now,
    })
    .where(eq(meetingReminders.id, input.id));
}

function getNotificationId(response: unknown) {
  return response && typeof response === "object"
    ? ((response as { id?: unknown }).id as string | undefined)
    : undefined;
}
