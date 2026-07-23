"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

export function MeetingRecordingResume({
  meetingId,
  meetingUrl,
}: {
  meetingId: string;
  meetingUrl: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "joining" | "joined" | "error">(
    "idle",
  );

  async function resumeRecording() {
    setState("joining");

    try {
      const response = await fetch("/api/meetings/link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ meetingUrl, recoveryMeetingId: meetingId }),
      });

      if (!response.ok) {
        throw new Error("Meeting bot could not rejoin");
      }

      setState("joined");
      router.refresh();
    } catch {
      setState("error");
    }
  }

  return (
    <div className="mb-5 flex flex-col gap-3 rounded-lg border bg-muted/25 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-semibold">Recording ended early</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          The meeting is still scheduled. Continue under this meeting record.
        </p>
        {state === "error" ? (
          <p
            className="mt-2 flex items-center gap-2 text-sm text-destructive"
            role="alert"
          >
            <CircleAlert className="size-4" />
            The bot could not rejoin. Try again.
          </p>
        ) : null}
      </div>
      <Button
        aria-busy={state === "joining"}
        className="min-h-11 shrink-0"
        disabled={state === "joining" || state === "joined"}
        onClick={resumeRecording}
        type="button"
      >
        <RotateCcw data-icon="inline-start" />
        {state === "joining"
          ? "Resuming..."
          : state === "joined"
            ? "Bot rejoining"
            : "Resume recording"}
      </Button>
      <span className="sr-only" aria-live="polite">
        {state === "joined" ? "The bot is rejoining this meeting." : ""}
      </span>
    </div>
  );
}
