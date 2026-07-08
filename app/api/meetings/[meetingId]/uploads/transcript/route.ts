import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/auth";
import {
  completeManualTranscriptUpload,
  MeetingRecoveryUploadError,
} from "@/lib/meeting-recovery-uploads";
import { getOrCreateWorkspaceForSessionUser } from "@/lib/workspace";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ meetingId: string }> },
) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [{ meetingId }, formData] = await Promise.all([
    context.params,
    request.formData().catch(() => null),
  ]);
  const transcriptText = await getTranscriptText(formData);

  if (!transcriptText) {
    return Response.json(
      { error: "Transcript text is required" },
      { status: 400 },
    );
  }

  try {
    const workspace = await getOrCreateWorkspaceForSessionUser(user);
    const result = await completeManualTranscriptUpload({
      meetingId,
      transcriptText,
      workspace,
    });

    revalidatePath("/dashboard");
    revalidatePath(`/meetings/${meetingId}`);

    return Response.json(
      {
        meetingId,
        ready: true,
        segmentCount: result.segmentCount,
      },
      { status: 202 },
    );
  } catch (error) {
    if (error instanceof MeetingRecoveryUploadError) {
      return Response.json({ error: error.message }, { status: 403 });
    }

    return Response.json(
      { error: "Transcript upload unavailable" },
      { status: 500 },
    );
  }
}

async function getTranscriptText(formData: FormData | null) {
  const transcriptText = formData?.get("transcriptText");

  if (typeof transcriptText === "string" && transcriptText.trim()) {
    return transcriptText.trim();
  }

  const transcriptFile = formData?.get("transcript-file");

  if (!(transcriptFile instanceof File) || transcriptFile.size === 0) {
    return null;
  }

  return (await transcriptFile.text()).trim() || null;
}
