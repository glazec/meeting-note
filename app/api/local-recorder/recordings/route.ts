import { getLocalRecorderDeviceRequestContext } from "@/lib/local-recorder-auth";
import {
  createLocalRecorderRecording,
  LocalRecorderUploadError,
} from "@/lib/local-recorder-records";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const deviceContext = await getLocalRecorderDeviceRequestContext(request);

  if (!deviceContext.ok) {
    return Response.json(
      { error: deviceContext.error },
      { status: deviceContext.status },
    );
  }

  const formData = await request.formData().catch(() => null);
  const fallbackIntentId = getFormString(formData, "fallbackIntentId");
  const clientRecordingId = getFormString(formData, "clientRecordingId");
  const recordingStartedAt = getFormDate(formData, "recordingStartedAt");
  const recordingStoppedAt = getFormDate(formData, "recordingStoppedAt");
  const manifest = parseManifest(getFormString(formData, "manifest"));
  const computerAudio = formData?.get("computerAudio");
  const microphoneAudio = formData?.get("microphoneAudio");

  if (
    !fallbackIntentId ||
    !clientRecordingId ||
    !recordingStartedAt ||
    !recordingStoppedAt ||
    recordingStoppedAt <= recordingStartedAt ||
    !manifest.ok ||
    !(computerAudio instanceof File) ||
    !(microphoneAudio instanceof File)
  ) {
    return Response.json(
      { error: "Invalid local recording upload" },
      { status: 400 },
    );
  }

  try {
    const result = await createLocalRecorderRecording({
      clientRecordingId,
      computerAudio,
      deviceId: deviceContext.deviceId,
      fallbackIntentId,
      manifest: manifest.value,
      microphoneAudio,
      recordingStartedAt,
      recordingStoppedAt,
      workspace: deviceContext.workspace,
    });

    return Response.json(result, { status: 202 });
  } catch (error) {
    if (error instanceof LocalRecorderUploadError) {
      return Response.json({ error: error.message }, { status: 409 });
    }

    return Response.json(
      { error: "Local recording upload unavailable" },
      { status: 500 },
    );
  }
}

function getFormString(formData: FormData | null, key: string) {
  const value = formData?.get(key);

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getFormDate(formData: FormData | null, key: string) {
  const value = getFormString(formData, key);

  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function parseManifest(value: string | null) {
  if (!value) {
    return { ok: true as const, value: {} };
  }

  try {
    return { ok: true as const, value: JSON.parse(value) };
  } catch {
    return { ok: false as const };
  }
}
