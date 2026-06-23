import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import {
  buildMeetingObjectKey,
  createUploadUrl,
  UnsafeObjectKeySegmentError,
} from "@/lib/r2";

export const runtime = "nodejs";

const uploadRequestSchema = z.object({
  teamId: z.string().min(1),
  meetingId: z.string().min(1),
  assetId: z.string().min(1),
  extension: z.literal("mp3"),
  contentType: z.literal("audio/mpeg"),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const result = uploadRequestSchema.safeParse(body);

  if (!result.success) {
    return Response.json({ error: "Invalid upload request" }, { status: 400 });
  }

  try {
    const key = buildMeetingObjectKey(result.data);
    const uploadUrl = await createUploadUrl({
      key,
      contentType: result.data.contentType,
    });

    return Response.json({ key, uploadUrl });
  } catch (error) {
    if (error instanceof UnsafeObjectKeySegmentError) {
      return Response.json(
        { error: "Invalid upload request" },
        { status: 400 },
      );
    }

    return Response.json(
      { error: "Upload URL unavailable" },
      { status: 500 },
    );
  }
}
