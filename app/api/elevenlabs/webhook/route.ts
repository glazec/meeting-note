import {
  getElevenLabsWebhookIdempotencyKey,
  normalizeElevenLabsWebhook,
} from "@/lib/vendors/elevenlabs";
import {
  MissingWebhookIdempotencyKeyError,
  recordVendorWebhookEvent,
} from "@/lib/vendor-webhook-events";
import { applyElevenLabsTranscriptEvent } from "@/lib/elevenlabs-transcripts";
import {
  verifyElevenLabsWebhook,
  webhookVerificationResponse,
} from "@/lib/webhook-signatures";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  let body: unknown;

  try {
    body = await verifyElevenLabsWebhook(rawBody, request.headers);
  } catch (error) {
    return webhookVerificationResponse(error);
  }

  let event: ReturnType<typeof normalizeElevenLabsWebhook>;

  try {
    event = normalizeElevenLabsWebhook(body);
  } catch {
    return Response.json({ error: "Invalid webhook payload" }, { status: 400 });
  }

  try {
    const recorded = await recordVendorWebhookEvent({
      provider: "elevenlabs",
      eventType: event.eventType,
      idempotencyKey: getElevenLabsWebhookIdempotencyKey(event) ?? "",
      payload: body,
    });

    if (recorded.inserted) {
      await applyElevenLabsTranscriptEvent(event);
    }

    return Response.json({ received: true, event });
  } catch (error) {
    if (error instanceof MissingWebhookIdempotencyKeyError) {
      return Response.json(
        { error: "Invalid webhook payload" },
        { status: 400 },
      );
    }

    return Response.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}
