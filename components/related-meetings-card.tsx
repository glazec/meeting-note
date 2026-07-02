"use client";

import Link from "next/link";
import { Clock, FileText } from "lucide-react";
import { useState } from "react";

import { LocalDateTime } from "@/components/local-date-time";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { MeetingDetailRelatedMeeting } from "@/lib/meeting-queries";
import { cn } from "@/lib/utils";

type RelatedMeetingsCardProps = {
  meetings: MeetingDetailRelatedMeeting[];
};

export function RelatedMeetingsCard({ meetings }: RelatedMeetingsCardProps) {
  if (meetings.length === 0) {
    return null;
  }

  return (
    <Card aria-labelledby="related-meetings-title" size="sm">
      <CardHeader>
        <CardTitle id="related-meetings-title">Related meetings</CardTitle>
        <CardDescription>
          Meetings connected by people or repeated titles.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-3">
          {meetings.map((meeting) => (
            <RelatedMeetingItem key={meeting.id} meeting={meeting} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function RelatedMeetingItem({
  meeting,
}: {
  meeting: MeetingDetailRelatedMeeting;
}) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  return (
    <li
      className="relative"
      onBlur={() => setIsPreviewOpen(false)}
      onFocus={() => setIsPreviewOpen(true)}
      onMouseEnter={() => setIsPreviewOpen(true)}
      onMouseLeave={() => setIsPreviewOpen(false)}
    >
      <div className="rounded-lg border bg-background p-3 transition-colors hover:bg-muted/35">
        <Link
          className="block break-words text-sm font-semibold text-foreground hover:underline"
          href={`/meetings/${meeting.id}`}
        >
          {meeting.title}
        </Link>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock aria-hidden="true" className="size-3.5" />
          Started <LocalDateTime value={meeting.startedAt} />
        </p>
      </div>

      <div
        className={cn(
          "absolute right-0 top-full z-50 mt-2 w-[min(30rem,calc(100vw-2rem))] rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg",
          isPreviewOpen ? "block" : "hidden",
        )}
        role="tooltip"
      >
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <FileText aria-hidden="true" className="size-4" />
          Transcript
        </div>
        {meeting.transcriptPreview.length > 0 ? (
          <>
            <ol className="max-h-80 space-y-3 overflow-y-auto pr-2">
              {meeting.transcriptPreview.map((segment) => (
                <li className="text-sm leading-6" key={segment.id}>
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {segment.speaker?.trim() || "Unknown speaker"}
                    </span>
                    <span>{formatTimestamp(segment.startMs)}</span>
                  </div>
                  <p>{segment.text}</p>
                </li>
              ))}
            </ol>
            {meeting.hasMoreTranscriptSegments ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Open the meeting for the full transcript.
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">
            Transcript is not ready yet.
          </p>
        )}
      </div>
    </li>
  );
}

function formatTimestamp(startMs: number) {
  const totalSeconds = Math.floor(startMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
