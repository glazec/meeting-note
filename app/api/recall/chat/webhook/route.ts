import {
  answerRecallChatMessage,
  normalizeRecallChatWebhook,
} from "@/lib/recall-chat";
import {
  markVendorWebhookEventProcessed,
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

  let event: ReturnType<typeof normalizeRecallChatWebhook>;

  try {
    event = normalizeRecallChatWebhook(body);
  } catch {
    return Response.json({ error: "Invalid webhook payload" }, { status: 400 });
  }

  try {
    const idempotencyKey =
      request.headers.get("webhook-id") ?? request.headers.get("svix-id") ?? "";
    const recorded = await recordVendorWebhookEvent({
      provider: "recall",
      eventType: event.eventType,
      idempotencyKey,
      payload: body,
    });

    if (!recorded.shouldProcess) {
      return Response.json({
        received: true,
        result: { action: "skipped", reason: "duplicate" },
      });
    }

    const result = await answerRecallChatMessage(event);

    await markVendorWebhookEventProcessed({
      provider: "recall",
      idempotencyKey,
    });

    return Response.json({ received: true, result });
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
