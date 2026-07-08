"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, FileText, UploadCloud } from "lucide-react";

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
import {
  audioUploadMediaAccept,
  getUploadMediaFromFile,
} from "@/lib/upload-media";

const transcriptAccept = ".txt,.srt,.vtt,text/plain,text/vtt";

type RecoveryState =
  | "idle"
  | "uploading-audio"
  | "uploading-transcript"
  | "complete"
  | "error";

type RecoveryQueuedResponse = {
  redirectTo?: string;
};

export function MeetingRecoveryUploadPanel({
  meetingId,
}: {
  meetingId: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<RecoveryState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [signInRequired, setSignInRequired] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [transcriptText, setTranscriptText] = useState("");

  function resetMessage() {
    setState("idle");
    setMessage(null);
    setSignInRequired(false);
  }

  function handleAudioChange(event: ChangeEvent<HTMLInputElement>) {
    setAudioFile(event.currentTarget.files?.[0] ?? null);
    resetMessage();
  }

  function handleTranscriptFileChange(event: ChangeEvent<HTMLInputElement>) {
    setTranscriptFile(event.currentTarget.files?.[0] ?? null);
    resetMessage();
  }

  async function handleAudioSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("uploading-audio");
    setMessage(null);
    setSignInRequired(false);

    if (!audioFile || audioFile.size === 0) {
      showError("Select a recording file first");
      return;
    }

    const uploadMedia = getUploadMediaFromFile(audioFile);

    if (!uploadMedia || uploadMedia.kind !== "audio") {
      showError("Only MP3 and M4A files are supported");
      return;
    }

    try {
      const queuedResult = await uploadRecoveryAudio({
        file: audioFile,
        meetingId,
        uploadMedia,
      });

      setState("complete");
      setMessage("Recording uploaded. Transcription queued");
      router.replace(queuedResult.redirectTo ?? `/meetings/${meetingId}`);
      router.refresh();
    } catch (error) {
      if (error instanceof SignInRequiredError) {
        setSignInRequired(true);
      }

      showError("Recording upload failed");
    }
  }

  async function handleTranscriptSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("uploading-transcript");
    setMessage(null);
    setSignInRequired(false);

    if (!transcriptText.trim() && (!transcriptFile || transcriptFile.size === 0)) {
      showError("Add transcript text or choose a transcript file");
      return;
    }

    try {
      const formData = new FormData();

      if (transcriptText.trim()) {
        formData.set("transcriptText", transcriptText.trim());
      }

      if (transcriptFile) {
        formData.set("transcript-file", transcriptFile);
      }

      const response = await fetch(
        `/api/meetings/${meetingId}/uploads/transcript`,
        {
          method: "POST",
          body: formData,
        },
      );

      if (response.status === 401) {
        throw new SignInRequiredError();
      }

      if (!response.ok) {
        throw new Error("Transcript upload failed");
      }

      setState("complete");
      setMessage("Transcript added");
      router.refresh();
    } catch (error) {
      if (error instanceof SignInRequiredError) {
        setSignInRequired(true);
      }

      showError("Transcript upload failed");
    }
  }

  function showError(nextMessage: string) {
    setState("error");
    setMessage(nextMessage);
  }

  const audioUploading = state === "uploading-audio";
  const transcriptUploading = state === "uploading-transcript";

  return (
    <Card size="sm">
      <CardHeader className="border-b bg-muted/35">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Recover meeting</CardTitle>
            <CardDescription>Attach an audio recording or transcript.</CardDescription>
          </div>
          <span
            aria-hidden="true"
            className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary"
          >
            <UploadCloud className="size-4" />
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <form onSubmit={handleAudioSubmit} className="space-y-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="meeting-recovery-audio">Audio recording</Label>
            <Input
              id="meeting-recovery-audio"
              name="meeting-recovery-audio"
              type="file"
              accept={audioUploadMediaAccept}
              onChange={handleAudioChange}
              className="bg-background"
            />
          </div>
          {audioFile ? (
            <p className="break-all text-xs text-muted-foreground">
              {audioFile.name}
            </p>
          ) : null}
          <Button type="submit" disabled={audioUploading} size="sm">
            <UploadCloud data-icon="inline-start" />
            {audioUploading ? "Uploading..." : "Upload audio"}
          </Button>
        </form>

        <form
          onSubmit={handleTranscriptSubmit}
          className="space-y-3 border-t pt-5"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="meeting-recovery-transcript">
              Transcript text
            </Label>
            <textarea
              id="meeting-recovery-transcript"
              name="transcriptText"
              rows={5}
              value={transcriptText}
              onChange={(event) => {
                setTranscriptText(event.currentTarget.value);
                resetMessage();
              }}
              placeholder="Paste transcript text"
              className="min-h-28 w-full resize-y rounded-lg border border-input bg-background px-2.5 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="meeting-recovery-transcript-file">
              Transcript file
            </Label>
            <Input
              id="meeting-recovery-transcript-file"
              name="transcript-file"
              type="file"
              accept={transcriptAccept}
              onChange={handleTranscriptFileChange}
              className="bg-background"
            />
          </div>
          {transcriptFile ? (
            <p className="break-all text-xs text-muted-foreground">
              {transcriptFile.name}
            </p>
          ) : null}
          <Button type="submit" disabled={transcriptUploading} size="sm">
            <FileText data-icon="inline-start" />
            {transcriptUploading ? "Uploading..." : "Add transcript"}
          </Button>
        </form>

        {message ? (
          <Alert variant={state === "error" ? "destructive" : "default"}>
            {state === "error" ? <AlertCircle /> : <CheckCircle2 />}
            <AlertTitle>
              {state === "error" ? "Recovery failed" : "Recovery started"}
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
      </CardContent>
    </Card>
  );
}

async function uploadRecoveryAudio({
  file,
  meetingId,
  uploadMedia,
}: {
  file: File;
  meetingId: string;
  uploadMedia: { contentType: string; extension: string };
}) {
  const signResponse = await fetch("/api/upload", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      extension: uploadMedia.extension,
      contentType: uploadMedia.contentType,
    }),
  });

  if (signResponse.status === 401) {
    throw new SignInRequiredError();
  }

  if (!signResponse.ok) {
    return uploadRecoveryAudioViaServer({ file, meetingId });
  }

  const { uploadId, uploadUrl } = (await signResponse.json()) as {
    uploadId?: string;
    uploadUrl?: string;
  };

  if (!uploadId || !uploadUrl) {
    return uploadRecoveryAudioViaServer({ file, meetingId });
  }

  const uploadedDirectly = await uploadDirectly(
    uploadUrl,
    file,
    uploadMedia.contentType,
  );

  if (!uploadedDirectly) {
    return uploadRecoveryAudioViaServer({ file, meetingId });
  }

  const completeResponse = await fetch(
    `/api/meetings/${meetingId}/uploads/audio/complete`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        uploadId,
        extension: uploadMedia.extension,
        contentType: uploadMedia.contentType,
      }),
    },
  );

  if (completeResponse.status === 401) {
    throw new SignInRequiredError();
  }

  if (!completeResponse.ok) {
    throw new Error("Audio upload completion failed");
  }

  return readRecoveryQueuedResponse(completeResponse);
}

async function uploadRecoveryAudioViaServer({
  file,
  meetingId,
}: {
  file: File;
  meetingId: string;
}) {
  const formData = new FormData();
  formData.set("meeting-audio", file);

  const response = await fetch(`/api/meetings/${meetingId}/uploads/audio`, {
    method: "POST",
    body: formData,
  });

  if (response.status === 401) {
    throw new SignInRequiredError();
  }

  if (!response.ok) {
    throw new Error("Audio upload failed");
  }

  return readRecoveryQueuedResponse(response);
}

async function uploadDirectly(
  uploadUrl: string,
  file: File,
  contentType: string,
) {
  try {
    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "content-type": contentType },
      body: file,
    });

    return uploadResponse.ok;
  } catch {
    return false;
  }
}

async function readRecoveryQueuedResponse(response: Response) {
  return (await response.json().catch(() => ({}))) as RecoveryQueuedResponse;
}

class SignInRequiredError extends Error {}
