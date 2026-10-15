export function webhookDeliveryDisposition(
  delivery:
    | {
        processedAt: string | null;
        error: string | null;
        receivedAt: string;
      }
    | undefined,
  now: number,
): "new" | "duplicate" | "in_progress" | "retry" {
  if (!delivery) return "new";
  if (delivery.processedAt) return "duplicate";
  if (delivery.error) return "retry";
  const receivedAt = Date.parse(delivery.receivedAt);
  return Number.isFinite(receivedAt) && now - receivedAt < 5 * 60 * 1_000
    ? "in_progress"
    : "retry";
}
