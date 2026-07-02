import { z } from "zod";

import { SharedOnlyAccessError } from "@/lib/access-errors";
import { getCurrentUser } from "@/lib/auth";
import {
  buildPendingUploadObjectKey,
  createUploadUrl,
  UnsafeObjectKeySegmentError,
} from "@/lib/r2";
import { getSupportedUploadMedia } from "@/lib/upload-media";
import {
  assertCanCreateMeetings,
  getOrCreateWorkspaceForSessionUser,
} from "@/lib/workspace";

export const runtime = "nodejs";

const uploadRequestSchema = z.strictObject({
  extension: z.string().trim().toLowerCase().min(1),
  contentType: z.string().trim().toLowerCase().min(1),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const result = uploadRequestSchema.safeParse(body);
  const uploadMedia = result.success
    ? getSupportedUploadMedia(result.data)
    : null;

  if (!result.success || !uploadMedia) {
    return Response.json({ error: "Invalid upload request" }, { status: 400 });
  }

  try {
    const workspace = await getOrCreateWorkspaceForSessionUser(user);
    await assertCanCreateMeetings(workspace);

    const uploadId = crypto.randomUUID();
    const key = buildPendingUploadObjectKey({
      userId: user.id,
      uploadId,
      extension: uploadMedia.extension,
    });
    const uploadUrl = await createUploadUrl({
      key,
      contentType: uploadMedia.contentType,
    });

    return Response.json({ key, uploadUrl, uploadId });
  } catch (error) {
    if (error instanceof UnsafeObjectKeySegmentError) {
      return Response.json(
        { error: "Invalid upload request" },
        { status: 400 },
      );
    }

    if (error instanceof SharedOnlyAccessError) {
      return Response.json(
        { error: "Shared users cannot add meetings" },
        { status: 403 },
      );
    }

    return Response.json({ error: "Upload URL unavailable" }, { status: 500 });
  }
}
