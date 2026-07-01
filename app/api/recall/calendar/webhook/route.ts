import {
  normalizeRecallCalendarWebhook,
  processRecallCalendarWebhook,
} from "@/lib/recall-calendar";
import {
  markVendorWebhookEventProcessed,
  MissingWebhookIdempotencyKeyError,
  recordVendorWebhookEvent,
} from "@/lib/vendor-webhook-events";
import {
  verifyRecallWebhook,
  webhookVerificationResponse,
} from "@/lib/webhook-signatures";
import { logWebhookProcessingError } from "@/lib/webhook-error-logging";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  let body: unknown;

  try {
    verifyRecallWebhook(rawBody, request.headers);
    body = JSON.parse(rawBody);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json(
        { error: "Invalid webhook payload" },
        { status: 400 },
      );
    }

    return webhookVerificationResponse(error);
  }

  let event: ReturnType<typeof normalizeRecallCalendarWebhook>;

  try {
    event = normalizeRecallCalendarWebhook(body);
  } catch {
    return Response.json({ error: "Invalid webhook payload" }, { status: 400 });
  }

  try {
    const idempotencyKey = getRecallCalendarWebhookIdempotencyKey(
      request.headers,
    );
    const recorded = await recordVendorWebhookEvent({
      provider: "recall",
      eventType: event.eventType,
      idempotencyKey,
      payload: body,
    });
    let result: Awaited<ReturnType<typeof processRecallCalendarWebhook>> | {
      action: "duplicate";
    };

    if (!recorded.shouldProcess && recorded.processed === false) {
      return Response.json(
        {
          received: false,
          result: { action: "retry", reason: "processing" },
        },
        { status: 503 },
      );
    }

    if (recorded.shouldProcess) {
      result = await processRecallCalendarWebhook(event);
      await markVendorWebhookEventProcessed({
        provider: "recall",
        idempotencyKey,
      });
    } else {
      result = { action: "duplicate" };
    }

    return Response.json({ received: true, result });
  } catch (error) {
    if (error instanceof MissingWebhookIdempotencyKeyError) {
      return Response.json(
        { error: "Invalid webhook payload" },
        { status: 400 },
      );
    }

    logWebhookProcessingError("Recall calendar webhook processing failed", {
      eventType: event.eventType,
      idempotencyKey: getRecallCalendarWebhookIdempotencyKey(request.headers),
      error,
    });

    return Response.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}

function getRecallCalendarWebhookIdempotencyKey(headers: Headers) {
  return headers.get("webhook-id") ?? headers.get("svix-id") ?? "";
}
