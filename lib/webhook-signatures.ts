import { createHmac, timingSafeEqual } from "node:crypto";

import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

export class WebhookVerificationError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 500,
  ) {
    super(message);
  }
}

const elevenLabsClient = new ElevenLabsClient();
const RECALL_WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

export async function verifyElevenLabsWebhook(
  rawBody: string,
  headers: Headers,
) {
  const secret = process.env.ELEVENLABS_WEBHOOK_SECRET?.trim();
  const signature = headers.get("elevenlabs-signature");

  if (!secret) {
    throw new WebhookVerificationError("Webhook secret is not configured", 500);
  }

  if (!signature) {
    throw new WebhookVerificationError("Invalid webhook signature", 401);
  }

  try {
    return await elevenLabsClient.webhooks.constructEvent(
      rawBody,
      signature,
      secret,
    );
  } catch {
    throw new WebhookVerificationError("Invalid webhook signature", 401);
  }
}

export function verifyRecallWebhook(rawBody: string, headers: Headers) {
  const secret = process.env.RECALL_WEBHOOK_SECRET?.trim();

  if (!secret || !secret.startsWith("whsec_")) {
    throw new WebhookVerificationError("Webhook secret is not configured", 500);
  }

  const messageId = headers.get("webhook-id") ?? headers.get("svix-id");
  const timestamp =
    headers.get("webhook-timestamp") ?? headers.get("svix-timestamp");
  const signature =
    headers.get("webhook-signature") ?? headers.get("svix-signature");

  if (!messageId || !timestamp || !signature) {
    throw new WebhookVerificationError("Invalid webhook signature", 401);
  }

  const timestampSeconds = Number(timestamp);

  if (
    !Number.isSafeInteger(timestampSeconds) ||
    Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds) >
      RECALL_WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS
  ) {
    throw new WebhookVerificationError("Invalid webhook signature", 401);
  }

  const key = Buffer.from(secret.slice("whsec_".length), "base64");
  if (key.length === 0) {
    throw new WebhookVerificationError("Webhook secret is not configured", 500);
  }

  const expectedSignature = createHmac("sha256", key)
    .update(`${messageId}.${timestamp}.${rawBody}`)
    .digest("base64");
  const expectedBytes = Buffer.from(expectedSignature, "base64");

  for (const versionedSignature of signature.split(" ")) {
    const [version, value] = versionedSignature.split(",");
    if (version !== "v1" || !value) {
      continue;
    }

    const valueBytes = Buffer.from(value, "base64");
    if (
      valueBytes.length === expectedBytes.length &&
      timingSafeEqual(valueBytes, expectedBytes)
    ) {
      return;
    }
  }

  throw new WebhookVerificationError("Invalid webhook signature", 401);
}

export function webhookVerificationResponse(error: unknown) {
  if (error instanceof WebhookVerificationError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  return Response.json(
    { error: "Webhook verification failed" },
    { status: 500 },
  );
}
