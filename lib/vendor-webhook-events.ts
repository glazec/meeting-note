import { and, eq, isNull, lt, or } from "drizzle-orm";

import { db } from "@/db/client";
import { vendorWebhookEvents } from "@/db/schema";

type Provider = "elevenlabs" | "recall";

type RecordVendorWebhookEventInput = {
  provider: Provider;
  eventType: string;
  idempotencyKey: string;
  payload: unknown;
};

const PROCESSING_CLAIM_TIMEOUT_MS = 10 * 60 * 1000;

export class MissingWebhookIdempotencyKeyError extends Error {
  constructor(provider: Provider) {
    super(`Missing ${provider} webhook idempotency key`);
    this.name = "MissingWebhookIdempotencyKeyError";
  }
}

export async function recordVendorWebhookEvent(
  input: RecordVendorWebhookEventInput,
) {
  if (!input.idempotencyKey) {
    throw new MissingWebhookIdempotencyKeyError(input.provider);
  }

  const now = new Date();
  const staleProcessingClaim = new Date(
    now.getTime() - PROCESSING_CLAIM_TIMEOUT_MS,
  );
  const rows = await db
    .insert(vendorWebhookEvents)
    .values({
      provider: input.provider,
      eventType: input.eventType,
      idempotencyKey: input.idempotencyKey,
      payload: input.payload,
      processedAt: null,
      processingStartedAt: now,
    })
    .onConflictDoNothing({
      target: [
        vendorWebhookEvents.provider,
        vendorWebhookEvents.idempotencyKey,
      ],
    })
    .returning({
      id: vendorWebhookEvents.id,
      processedAt: vendorWebhookEvents.processedAt,
      processingStartedAt: vendorWebhookEvents.processingStartedAt,
    });

  if (rows[0]) {
    return {
      id: rows[0].id,
      inserted: true,
      processed: false,
      shouldProcess: true,
    };
  }

  const claimedRows = await db
    .update(vendorWebhookEvents)
    .set({
      processingStartedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(vendorWebhookEvents.provider, input.provider),
        eq(vendorWebhookEvents.idempotencyKey, input.idempotencyKey),
        isNull(vendorWebhookEvents.processedAt),
        or(
          isNull(vendorWebhookEvents.processingStartedAt),
          lt(vendorWebhookEvents.processingStartedAt, staleProcessingClaim),
        ),
      ),
    )
    .returning({
      id: vendorWebhookEvents.id,
      processedAt: vendorWebhookEvents.processedAt,
      processingStartedAt: vendorWebhookEvents.processingStartedAt,
    });

  if (claimedRows[0]) {
    return {
      id: claimedRows[0].id,
      inserted: false,
      processed: false,
      shouldProcess: true,
    };
  }

  const [existing] = await db
    .select({
      id: vendorWebhookEvents.id,
      processedAt: vendorWebhookEvents.processedAt,
      processingStartedAt: vendorWebhookEvents.processingStartedAt,
    })
    .from(vendorWebhookEvents)
    .where(
      and(
        eq(vendorWebhookEvents.provider, input.provider),
        eq(vendorWebhookEvents.idempotencyKey, input.idempotencyKey),
      ),
    )
    .limit(1);

  const processed = Boolean(existing?.processedAt);

  return {
    id: existing?.id ?? null,
    inserted: false,
    processed,
    shouldProcess: false,
  };
}

export async function markVendorWebhookEventProcessed(input: {
  provider: Provider;
  idempotencyKey: string;
}) {
  if (!input.idempotencyKey) {
    throw new MissingWebhookIdempotencyKeyError(input.provider);
  }

  await db
    .update(vendorWebhookEvents)
    .set({
      processedAt: new Date(),
      processingStartedAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(vendorWebhookEvents.provider, input.provider),
        eq(vendorWebhookEvents.idempotencyKey, input.idempotencyKey),
      ),
    );
}
