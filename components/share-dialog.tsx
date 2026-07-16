"use client";

import { FormEvent, useState } from "react";
import { AlertCircle, Check, CheckCircle2, Copy, Send } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ShareRecipient } from "@/lib/meeting-queries";

type ShareDialogProps = {
  meetingId: string;
  organizationDomain: string;
  teamMembers: ShareRecipient[];
};

type ShareState = "idle" | "sharing" | "success" | "error";

export function ShareDialog({
  meetingId,
  organizationDomain,
  teamMembers,
}: ShareDialogProps) {
  const [email, setEmail] = useState("");
  const [selectedMemberEmail, setSelectedMemberEmail] = useState(
    teamMembers[0]?.email ?? "",
  );
  const [state, setState] = useState<ShareState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [includeRelated, setIncludeRelated] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const encodedMeetingId = encodeURIComponent(meetingId);
  const meetingPath = `/meetings/${encodedMeetingId}`;

  async function copyMeetingLink() {
    const url = new URL(meetingPath, window.location.origin).toString();

    await navigator.clipboard.writeText(url);
    setCopyState("copied");
    window.setTimeout(() => setCopyState("idle"), 2000);
  }

  async function shareWithEmail(emailToShare: string) {
    setState("sharing");
    setMessage(null);

    const response = await fetch(`/api/meetings/${encodedMeetingId}/share`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ email: emailToShare, includeRelated }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      setState("error");
      setMessage(body?.error ?? "Could not share this meeting.");
      return;
    }

    const body = (await response.json()) as {
      pending?: boolean;
      futureMeetings?: boolean;
      meetingCount?: number;
      user?: { email: string; name: string | null };
      email?: string;
    };

    setState("success");
    const accessMessage = body.pending
      ? "Invite saved. They can sign in to read this transcript."
      : `Access granted to ${body.user?.email ?? emailToShare}.`;
    const meetingCount = body.meetingCount ?? 1;
    const relatedMessage = body.futureMeetings
      ? ` Access now covers ${meetingCount} matching meeting${meetingCount === 1 ? "" : "s"}. Future matches will be shared automatically.`
      : "";

    setMessage(`${accessMessage}${relatedMessage}`);
  }

  async function shareSelectedMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedMemberEmail) {
      return;
    }

    await shareWithEmail(selectedMemberEmail);
  }

  async function shareEnteredEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await shareWithEmail(email);
    setEmail("");
  }

  return (
    <Card aria-labelledby="share-dialog-title">
      <CardHeader>
        <CardTitle id="share-dialog-title">Share transcript</CardTitle>
        <CardDescription>
          Send the meeting link or grant transcript access.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="share-link">Meeting link</Label>
          <div className="flex gap-2">
            <Input id="share-link" readOnly value={meetingPath} />
            <Button onClick={copyMeetingLink} type="button" variant="outline">
              {copyState === "copied" ? (
                <Check data-icon="inline-start" />
              ) : (
                <Copy data-icon="inline-start" />
              )}
              {copyState === "copied" ? "Copied" : "Copy link"}
            </Button>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            Anyone signed in with @{organizationDomain} can open this link.
          </p>
        </div>

        <label className="flex items-start gap-3 rounded-lg border p-3">
          <input
            checked={includeRelated}
            className="mt-1 size-4"
            name="includeRelated"
            onChange={(event) => setIncludeRelated(event.currentTarget.checked)}
            type="checkbox"
          />
          <span>
            <span className="block text-sm font-medium">
              Share related and future meetings
            </span>
            <span className="mt-1 block text-xs leading-5 text-muted-foreground">
              Apply access to meetings with the same title or external people,
              including future matches.
            </span>
          </span>
        </label>

        <form className="flex flex-col gap-3" onSubmit={shareSelectedMember}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="share-member">Select someone in organization</Label>
            <select
              className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50"
              disabled={teamMembers.length === 0}
              id="share-member"
              onChange={(event) => {
                setSelectedMemberEmail(event.currentTarget.value);
                setState("idle");
                setMessage(null);
              }}
              value={selectedMemberEmail}
            >
              {teamMembers.length === 0 ? (
                <option value="">No teammates yet</option>
              ) : (
                teamMembers.map((member) => (
                  <option key={member.email} value={member.email}>
                    {member.name
                      ? `${member.name} (${member.email})`
                      : member.email}
                  </option>
                ))
              )}
            </select>
          </div>
          <Button
            className="w-fit"
            disabled={state === "sharing" || !selectedMemberEmail}
            type="submit"
            variant="outline"
          >
            <Send data-icon="inline-start" />
            Share selected
          </Button>
        </form>

        <form className="flex flex-col gap-3" onSubmit={shareEnteredEmail}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="share-email">Add by email</Label>
            <Input
              autoComplete="email"
              id="share-email"
              name="email"
              onChange={(event) => {
                setEmail(event.currentTarget.value);
                setState("idle");
                setMessage(null);
              }}
              placeholder="teammate@example.com"
              required
              type="email"
              value={email}
            />
            <p className="text-sm leading-6 text-muted-foreground">
              External people get read only transcript access after they sign in.
            </p>
          </div>
          <Button
            className="w-fit"
            disabled={state === "sharing"}
            type="submit"
          >
            <Send data-icon="inline-start" />
            {state === "sharing" ? "Sharing" : "Add email"}
          </Button>
        </form>
        {message ? (
          <Alert variant={state === "error" ? "destructive" : "default"}>
            {state === "error" ? <AlertCircle /> : <CheckCircle2 />}
            <AlertTitle>
              {state === "error" ? "Share failed" : "Shared"}
            </AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
      <CardFooter className="border-t pt-4">
        <p className="text-xs leading-5 text-muted-foreground">
          Sharing grants transcript viewing only. Meeting creation stays inside
          the workspace.
        </p>
      </CardFooter>
    </Card>
  );
}
