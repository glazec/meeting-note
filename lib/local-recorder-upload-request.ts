import { z } from "zod";

const requiredString = z.string().trim().min(1);

const uploadMetadataSchema = z.strictObject({
  clientRecordingId: requiredString,
  fallbackIntentId: requiredString,
  manifest: z.unknown().optional(),
  recordingStartedAt: requiredString,
  recordingStoppedAt: requiredString,
});

const uploadCompletionSchema = uploadMetadataSchema.extend({
  assets: z.strictObject({
    computerAudioAssetId: requiredString,
    microphoneAudioAssetId: requiredString,
    synthesizedAudioAssetId: requiredString,
  }),
});

export function parseLocalRecorderUploadPrepareRequest(body: unknown) {
  const parsed = uploadMetadataSchema.safeParse(body);

  if (!parsed.success) {
    return { ok: false as const };
  }

  return parseLocalRecorderUploadDates(parsed.data);
}

export function parseLocalRecorderUploadCompletionRequest(body: unknown) {
  const parsed = uploadCompletionSchema.safeParse(body);

  if (!parsed.success) {
    return { ok: false as const };
  }

  const metadata = parseLocalRecorderUploadDates(parsed.data);

  if (!metadata.ok) {
    return metadata;
  }

  return {
    ok: true as const,
    value: {
      ...metadata.value,
      assets: parsed.data.assets,
    },
  };
}

function parseLocalRecorderUploadDates(input: z.infer<typeof uploadMetadataSchema>) {
  const recordingStartedAt = new Date(input.recordingStartedAt);
  const recordingStoppedAt = new Date(input.recordingStoppedAt);

  if (
    Number.isNaN(recordingStartedAt.getTime()) ||
    Number.isNaN(recordingStoppedAt.getTime()) ||
    recordingStoppedAt <= recordingStartedAt
  ) {
    return { ok: false as const };
  }

  return {
    ok: true as const,
    value: {
      clientRecordingId: input.clientRecordingId,
      fallbackIntentId: input.fallbackIntentId,
      manifest: input.manifest ?? {},
      recordingStartedAt,
      recordingStoppedAt,
    },
  };
}
