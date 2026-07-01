export function logWebhookProcessingError(
  message: string,
  input: {
    eventType: string;
    idempotencyKey: string;
    error: unknown;
  },
) {
  console.error(message, {
    eventType: input.eventType,
    idempotencyKey: input.idempotencyKey,
    error: serializeWebhookError(input.error),
  });
}

function serializeWebhookError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  return { message: String(error) };
}
