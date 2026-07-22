"use client";

import { FormEvent, useState } from "react";
import { AlertCircle, CalendarPlus, CheckCircle2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormState = "idle" | "saving" | "scheduled" | "joining" | "error";

export function MeetingLinkForm() {
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [signInRequired, setSignInRequired] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving");
    setMessage(null);
    setSignInRequired(false);

    const formData = new FormData(event.currentTarget);
    const meetingUrl = String(formData.get("meeting-link") ?? "").trim();

    if (!meetingUrl) {
      setState("error");
      setMessage("Enter a Google Meet or Zoom link");
      return;
    }

    try {
      const response = await fetch("/api/meetings/link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ meetingUrl }),
      });

      if (response.status === 401) {
        setState("error");
        setMessage("Sign in to schedule a meeting bot");
        setSignInRequired(true);
        return;
      }

      const responseBody = (await response.json().catch(() => null)) as {
        error?: unknown;
        status?: unknown;
      } | null;

      if (!response.ok) {
        if (
          typeof responseBody?.error === "string" &&
          responseBody.error.toLowerCase().includes("join")
        ) {
          setState("error");
          setMessage("Bot could not join. Try again.");
          return;
        }

        throw new Error("Meeting bot request failed");
      }

      if (responseBody?.status === "joining") {
        setState("joining");
        setMessage("The bot should appear within about 30 seconds.");
      } else {
        setState("scheduled");
        setMessage("Meeting bot scheduled");
      }
    } catch {
      setState("error");
      setMessage("Meeting bot could not be scheduled");
    }
  }

  return (
    <Card>
      <CardHeader className="border-b bg-muted/35">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Meeting link</CardTitle>
            <CardDescription>
              Tape joins an active meeting now or schedules a future meeting.
            </CardDescription>
          </div>
          <span
            aria-hidden="true"
            className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"
          >
            <CalendarPlus className="size-4" />
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="meeting-link">Meeting link</Label>
            <Input
              id="meeting-link"
              name="meeting-link"
              type="url"
              placeholder="https://meet.google.com/example"
              className="min-h-11 bg-background"
              aria-invalid={state === "error"}
            />
          </div>
          <Button
            type="submit"
            disabled={state === "saving"}
            className="min-h-11 w-fit"
          >
            <CalendarPlus data-icon="inline-start" />
            {state === "saving" ? "Checking meeting" : "Add meeting bot"}
          </Button>
          {message ? (
            <Alert
              role={state === "error" ? "alert" : "status"}
              variant={state === "error" ? "destructive" : "default"}
            >
              {state === "error" ? <AlertCircle /> : <CheckCircle2 />}
              <AlertTitle>
                {state === "error"
                  ? message?.startsWith("Bot could not join")
                    ? "Bot could not join"
                    : "Meeting not scheduled"
                  : state === "joining"
                    ? "Bot joining"
                    : "Bot scheduled"}
              </AlertTitle>
              <AlertDescription>
                {message}
                {signInRequired ? (
                  <>
                    {" "}
                    <a href="/auth/sign-in">Sign in</a>
                  </>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
