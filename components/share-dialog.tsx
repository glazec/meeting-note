"use client";

import { FormEvent, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Send,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ShareDialogProps = {
  instanceId: string;
  meetingId: string;
  organizationDomain: string;
};

type ShareState = "idle" | "sharing" | "success" | "error";

export function ShareDialog({
  instanceId,
  meetingId,
  organizationDomain,
}: ShareDialogProps) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<ShareState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [includeRelated, setIncludeRelated] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const encodedMeetingId = encodeURIComponent(meetingId);
  const meetingPath = `/meetings/${encodedMeetingId}`;
  const titleId = `${instanceId}-share-title`;
  const emailId = `${instanceId}-share-email`;
  const relatedId = `${instanceId}-include-related`;

  async function copyMeetingLink() {
    const url = new URL(meetingPath, window.location.origin).toString();

    try {
      await navigator.clipboard.writeText(url);
      setCopyState("copied");
      setState("idle");
      setMessage(null);
      window.setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setState("error");
      setMessage("Could not copy the link. Try again.");
    }
  }

  async function shareWithEmail(emailToShare: string): Promise<boolean> {
    setState("sharing");
    setMessage(null);

    const response = await fetch(`/api/meetings/${encodedMeetingId}/share`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: emailToShare, includeRelated }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      setState("error");
      setMessage(body?.error ?? "Could not share this meeting.");
      return false;
    }

    const body = (await response.json()) as {
      pending?: boolean;
      futureMeetings?: boolean;
      meetingCount?: number;
      user?: { email: string; name: string | null };
      email?: string;
    };
    const recipient = body.user?.email ?? body.email ?? emailToShare;
    const meetingCount = body.meetingCount ?? 1;
    const meetingLabel = `matching meeting${meetingCount === 1 ? "" : "s"}`;

    setState("success");
    if (body.futureMeetings) {
      setMessage(
        body.pending
          ? `Access saved for ${recipient} across ${meetingCount} ${meetingLabel}. Future matches will be shared automatically.`
          : `Shared ${meetingCount} ${meetingLabel} with ${recipient}. Future matches will be shared automatically.`,
      );
    } else {
      setMessage(
        body.pending
          ? `Access saved for ${recipient}. They can open it after signing in.`
          : `Shared with ${recipient}.`,
      );
    }

    return true;
  }

  async function shareEnteredEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (await shareWithEmail(email)) {
      setEmail("");
    }
  }

  return (
    <Card aria-labelledby={titleId} size="sm">
      <CardHeader>
        <CardTitle id={titleId}>Share</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm leading-5 text-muted-foreground">
          Anyone at @{organizationDomain} can open this meeting.
        </p>
        <Button
          className="min-h-11 w-full"
          onClick={copyMeetingLink}
          type="button"
        >
          {copyState === "copied" ? (
            <Check data-icon="inline-start" />
          ) : (
            <Copy data-icon="inline-start" />
          )}
          {copyState === "copied" ? "Link copied" : "Copy link"}
        </Button>
        <span aria-live="polite" className="sr-only">
          {copyState === "copied" ? "Meeting link copied" : ""}
        </span>

        <details className="group border-t pt-1">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
            Share outside the organization
            <ChevronDown className="size-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
          </summary>
          <form className="mt-2 flex flex-col gap-3" onSubmit={shareEnteredEmail}>
            <Label htmlFor={emailId}>Email address</Label>
            <Input
              autoComplete="email"
              className="h-11"
              id={emailId}
              name="email"
              onChange={(event) => {
                setEmail(event.currentTarget.value);
                setState("idle");
                setMessage(null);
              }}
              placeholder="partner@example.com"
              required
              type="email"
              value={email}
            />
            <p className="text-xs leading-5 text-muted-foreground">
              They can view this transcript after signing in.
            </p>

            <details>
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-lg text-xs font-medium text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                More options
                <ChevronDown className="size-3.5" />
              </summary>
              <label className="flex items-start gap-3 pb-1">
                <input
                  checked={includeRelated}
                  className="mt-0.5 size-4"
                  id={relatedId}
                  name="includeRelated"
                  onChange={(event) =>
                    setIncludeRelated(event.currentTarget.checked)
                  }
                  type="checkbox"
                />
                <span>
                  <span className="block text-sm font-medium">
                    Include related meetings
                  </span>
                  {includeRelated ? (
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                      Matches by title or external attendees, including future
                      meetings.
                    </span>
                  ) : null}
                </span>
              </label>
            </details>

            <Button
              className="min-h-11 w-full"
              disabled={state === "sharing"}
              type="submit"
            >
              <Send data-icon="inline-start" />
              {state === "sharing"
                ? "Sharing…"
                : includeRelated
                  ? "Share matching meetings"
                  : "Share"}
            </Button>
          </form>
        </details>

        {message ? (
          <div
            aria-live="polite"
            className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs leading-5 ${
              state === "error"
                ? "bg-destructive/10 text-destructive"
                : "bg-muted text-foreground"
            }`}
            role={state === "error" ? "alert" : "status"}
          >
            {state === "error" ? (
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
            ) : (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            )}
            <span>{message}</span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
