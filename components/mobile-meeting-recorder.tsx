"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, LoaderCircle, Mic, Square } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getMobileRecordingFileType,
  selectMobileRecorderMimeType,
} from "@/lib/mobile-recorder";

type RecorderState =
  | "idle"
  | "requesting"
  | "recording"
  | "uploading"
  | "error";

export function MobileMeetingRecorder({
  meetingId,
  meetingTitle,
}: {
  meetingId: string;
  meetingTitle: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<RecorderState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const chunksRef = useRef<Blob[]>([]);
  const discardRecordingRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (mediaRecorderRef.current?.state === "recording") {
        event.preventDefault();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      discardRecordingRef.current = true;
      clearTimer();
      const recorder = mediaRecorderRef.current;
      if (recorder?.state === "recording") {
        recorder.stop();
      }
      stopStream();
    };
  }, []);

  async function startRecording() {
    setErrorMessage(null);

    if (
      typeof MediaRecorder === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      showError("Audio recording is not supported in this browser");
      return;
    }

    const mimeType = selectMobileRecorderMimeType((candidate) =>
      MediaRecorder.isTypeSupported(candidate),
    );

    if (!mimeType) {
      showError("This browser cannot create a supported audio recording");
      return;
    }

    setState("requesting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType });

      chunksRef.current = [];
      discardRecordingRef.current = false;
      mediaRecorderRef.current = recorder;
      streamRef.current = stream;
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      });
      recorder.addEventListener("stop", () => {
        stopStream();
        if (!discardRecordingRef.current) {
          void uploadRecording(recorder.mimeType || mimeType);
        }
      });
      recorder.start(1000);
      setElapsedSeconds(0);
      timerRef.current = window.setInterval(() => {
        setElapsedSeconds((seconds) => seconds + 1);
      }, 1000);
      setState("recording");
    } catch {
      stopStream();
      showError("Microphone access is required to record this meeting");
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;

    if (!recorder || recorder.state !== "recording") {
      return;
    }

    clearTimer();
    setState("uploading");
    recorder.stop();
  }

  async function uploadRecording(mimeType: string) {
    const fileType = getMobileRecordingFileType(mimeType);

    if (!fileType || chunksRef.current.length === 0) {
      showError("The recording was empty or used an unsupported format");
      return;
    }

    const file = new File(
      chunksRef.current,
      `meeting-recording.${fileType.extension}`,
      { type: fileType.contentType },
    );
    const formData = new FormData();
    formData.set("meeting-audio", file);

    try {
      const response = await fetch(
        `/api/meetings/${encodeURIComponent(meetingId)}/uploads/audio`,
        { body: formData, method: "POST" },
      );

      if (!response.ok) {
        throw new Error("Recording upload failed");
      }

      router.replace(`/meetings/${encodeURIComponent(meetingId)}`);
      router.refresh();
    } catch {
      showError("Could not upload the recording. Please try again");
    }
  }

  function clearTimer() {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function showError(message: string) {
    clearTimer();
    setState("error");
    setErrorMessage(message);
  }

  const isBusy = state === "requesting" || state === "uploading";

  return (
    <Card className="w-full max-w-lg">
      <CardHeader className="border-b bg-muted/35">
        <CardTitle>{meetingTitle}</CardTitle>
        <CardDescription>
          Record this meeting with your phone microphone.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-6 py-8 text-center">
        <div
          aria-hidden="true"
          className={`flex size-24 items-center justify-center rounded-full ${
            state === "recording"
              ? "bg-destructive/15 text-destructive"
              : "bg-primary/10 text-primary"
          }`}
        >
          <Mic className="size-10" />
        </div>

        {state === "recording" ? (
          <div aria-live="polite">
            <p className="text-2xl font-semibold tabular-nums">
              {formatDuration(elapsedSeconds)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Recording</p>
          </div>
        ) : null}

        {state === "recording" ? (
          <Button onClick={stopRecording} size="lg" variant="destructive">
            <Square data-icon="inline-start" />
            Stop and upload
          </Button>
        ) : (
          <Button disabled={isBusy} onClick={startRecording} size="lg">
            {isBusy ? (
              <LoaderCircle className="animate-spin" data-icon="inline-start" />
            ) : (
              <Mic data-icon="inline-start" />
            )}
            {state === "requesting"
              ? "Requesting microphone"
              : state === "uploading"
                ? "Uploading recording"
                : "Start recording"}
          </Button>
        )}

        <p className="max-w-sm text-sm leading-6 text-muted-foreground">
          Keep this page open while recording. Stopping uploads the audio and
          starts transcription automatically.
        </p>

        {errorMessage ? (
          <Alert className="text-left" variant="destructive">
            <AlertCircle />
            <AlertTitle>Recorder unavailable</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
