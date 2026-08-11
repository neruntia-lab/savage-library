import { and, isNotNull, lt } from "drizzle-orm";
import { getDb } from "../../db";
import {
  rateLimits,
  verificationTokens,
  webhookDeliveries,
} from "../../db/schema";

const COMPLETED_WEBHOOK_RETENTION_DAYS = 90;

export async function cleanExpiredOperationalRecords(now = new Date()) {
  const db = getDb();
  const webhookCutoff = completedWebhookCutoff(now);
  const [rateLimitRows, verificationRows, webhookRows] = await db.batch([
    db
      .delete(rateLimits)
      .where(lt(rateLimits.expiresAt, now.getTime()))
      .returning({ id: rateLimits.key }),
    db
      .delete(verificationTokens)
      .where(lt(verificationTokens.expires, now))
      .returning({ id: verificationTokens.token }),
    db
      .delete(webhookDeliveries)
      .where(
        and(
          isNotNull(webhookDeliveries.processedAt),
          lt(webhookDeliveries.receivedAt, webhookCutoff),
        ),
      )
      .returning({ id: webhookDeliveries.id }),
  ]);

  return {
    expiredRateLimits: rateLimitRows.length,
    expiredVerificationTokens: verificationRows.length,
    completedWebhookDeliveries: webhookRows.length,
  };
}

export function completedWebhookCutoff(now: Date): string {
  return new Date(
    now.getTime() - COMPLETED_WEBHOOK_RETENTION_DAYS * 24 * 60 * 60 * 1_000,
  ).toISOString();
}
