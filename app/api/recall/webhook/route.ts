import {
  getRecallWebhookIdempotencyKey,
  normalizeRecallWebhook,
} from "@/lib/vendors/recall";
import {
  MissingWebhookIdempotencyKeyError,
  recordVendorWebhookEvent,
} from "@/lib/vendor-webhook-events";
import {
  verifyRecallWebhook,
  webhookVerificationResponse,
} from "@/lib/webhook-signatures";

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

  let event: ReturnType<typeof normalizeRecallWebhook>;

  try {
    event = normalizeRecallWebhook(body);
  } catch {
    return Response.json({ error: "Invalid webhook payload" }, { status: 400 });
  }

  try {
    await recordVendorWebhookEvent({
      provider: "recall",
      eventType: event.eventType,
      idempotencyKey:
        getRecallWebhookIdempotencyKey(event, request.headers) ?? "",
      payload: body,
    });

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
