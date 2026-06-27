import { createHmac } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  answerRecallChatMessage,
  markVendorWebhookEventProcessed,
  recordVendorWebhookEvent,
  MissingWebhookIdempotencyKeyError,
} = vi.hoisted(() => ({
  answerRecallChatMessage: vi.fn(),
  markVendorWebhookEventProcessed: vi.fn(),
  recordVendorWebhookEvent: vi.fn(),
  MissingWebhookIdempotencyKeyError: class MissingWebhookIdempotencyKeyError extends Error {
    constructor() {
      super("Missing webhook idempotency key");
    }
  },
}));

vi.mock("@/lib/recall-chat", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/recall-chat")>();

  return {
    ...actual,
    answerRecallChatMessage,
  };
});

vi.mock("@/lib/vendor-webhook-events", () => ({
  MissingWebhookIdempotencyKeyError,
  markVendorWebhookEventProcessed,
  recordVendorWebhookEvent,
}));

const recallWebhookSecret = "whsec_cmVjYWxsLXdlYmhvb2stc2VjcmV0";

function signRecallWebhook(rawBody: string) {
  const messageId = "msg_chat";
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const key = Buffer.from(recallWebhookSecret.slice("whsec_".length), "base64");
  const signature = createHmac("sha256", key)
    .update(`${messageId}.${timestamp}.${rawBody}`)
    .digest("base64");

  return {
    "webhook-id": messageId,
    "webhook-timestamp": timestamp,
    "webhook-signature": `v1,${signature}`,
  };
}

async function postRecallChatWebhook(body: unknown, signed = true) {
  vi.stubEnv("RECALL_WEBHOOK_SECRET", recallWebhookSecret);
  const { POST } = await import("@/app/api/recall/chat/webhook/route");
  const rawBody = JSON.stringify(body);
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  if (signed) {
    Object.assign(headers, signRecallWebhook(rawBody));
  }

  return POST(
    new Request("https://app.example.com/api/recall/chat/webhook", {
      method: "POST",
      body: rawBody,
      headers,
    }),
  );
}

const chatPayload = {
  event: "participant_events.chat_message",
  data: {
    data: {
      participant: {
        id: 7,
        name: "Alice",
        is_host: false,
        platform: "desktop",
        extra_data: {},
        email: "alice@example.com",
      },
      timestamp: {
        absolute: "2026-06-27T16:00:00.000Z",
        relative: 12.5,
      },
      data: {
        text: "@IOSG Old Friend what did we decide?",
        to: "everyone",
      },
    },
    bot: {
      id: "bot_123",
      metadata: {
        meetingId: "11111111-1111-4111-8111-111111111111",
      },
    },
  },
};

describe("POST /api/recall/chat/webhook", () => {
  beforeEach(() => {
    recordVendorWebhookEvent.mockResolvedValue({
      inserted: true,
      shouldProcess: true,
    });
    markVendorWebhookEventProcessed.mockResolvedValue(undefined);
    answerRecallChatMessage.mockResolvedValue({
      action: "replied",
      reply: "We decided to follow up next week.",
    });
  });

  afterEach(() => {
    recordVendorWebhookEvent.mockReset();
    markVendorWebhookEventProcessed.mockReset();
    answerRecallChatMessage.mockReset();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("processes signed chat messages and marks the delivery processed", async () => {
    const response = await postRecallChatWebhook(chatPayload);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      received: true,
      result: {
        action: "replied",
      },
    });
    expect(recordVendorWebhookEvent).toHaveBeenCalledWith({
      provider: "recall",
      eventType: "participant_events.chat_message",
      idempotencyKey: "msg_chat",
      payload: chatPayload,
    });
    expect(answerRecallChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        botId: "bot_123",
        text: "@IOSG Old Friend what did we decide?",
      }),
    );
    expect(markVendorWebhookEventProcessed).toHaveBeenCalledWith({
      provider: "recall",
      idempotencyKey: "msg_chat",
    });
  });

  it("does not answer duplicate chat webhook deliveries", async () => {
    recordVendorWebhookEvent.mockResolvedValue({
      inserted: false,
      shouldProcess: false,
    });

    const response = await postRecallChatWebhook(chatPayload);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      received: true,
      result: {
        action: "skipped",
        reason: "duplicate",
      },
    });
    expect(answerRecallChatMessage).not.toHaveBeenCalled();
    expect(markVendorWebhookEventProcessed).not.toHaveBeenCalled();
  });
});
