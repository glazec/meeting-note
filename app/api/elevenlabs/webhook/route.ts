import { normalizeElevenLabsWebhook } from "@/lib/vendors/elevenlabs";
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

  try {
    const event = normalizeElevenLabsWebhook(body);

    return Response.json({ received: true, event });
  } catch {
    return Response.json({ error: "Invalid webhook payload" }, { status: 400 });
  }
}
