"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  getMeetingDisplayStatus,
  type MeetingRecordStatus,
  type TranscriptJobStatus,
} from "@/lib/meeting-display-status";

export const MEETING_AUTO_REFRESH_INTERVAL_MS = 5000;

type MeetingAutoRefreshProps = {
  meetingStatus: MeetingRecordStatus;
  segmentCount: number;
  transcriptJobStatus?: TranscriptJobStatus | null;
};

export function MeetingAutoRefresh(props: MeetingAutoRefreshProps) {
  const router = useRouter();
  const shouldRefresh = shouldAutoRefreshMeeting(props);

  useEffect(() => {
    if (!shouldRefresh) {
      return;
    }

    const intervalId = window.setInterval(() => {
      router.refresh();
    }, MEETING_AUTO_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [router, shouldRefresh]);

  return null;
}

export function shouldAutoRefreshMeeting({
  meetingStatus,
  segmentCount,
  transcriptJobStatus,
}: MeetingAutoRefreshProps) {
  if (segmentCount > 0) {
    return false;
  }

  const displayStatus = getMeetingDisplayStatus({
    meetingStatus,
    transcriptJobStatus,
  });

  return !["ready", "failed"].includes(displayStatus);
}
