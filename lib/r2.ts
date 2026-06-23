import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";

type MeetingObjectKeyInput = {
  teamId: string;
  meetingId: string;
  assetId: string;
  extension: string;
};

type CreateUploadUrlInput = {
  key: string;
  contentType: string;
};

const r2EnvSchema = z.object({
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET: z.string().min(1),
});

export function buildMeetingObjectKey(input: MeetingObjectKeyInput) {
  return `teams/${input.teamId}/meetings/${input.meetingId}/assets/${input.assetId}.${input.extension}`;
}

export async function createUploadUrl(input: CreateUploadUrlInput) {
  const env = r2EnvSchema.parse(process.env);
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });

  const command = new PutObjectCommand({
    Bucket: env.R2_BUCKET,
    Key: input.key,
    ContentType: input.contentType,
  });

  return getSignedUrl(client, command, { expiresIn: 900 });
}
