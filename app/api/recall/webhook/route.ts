import { normalizeRecallWebhook } from "@/lib/vendors/recall";
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

  try {
    const event = normalizeRecallWebhook(body);

    return Response.json({ received: true, event });
  } catch {
    return Response.json({ error: "Invalid webhook payload" }, { status: 400 });
  }
}
