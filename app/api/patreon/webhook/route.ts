import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { webhookDeliveries } from "../../../../db/schema";
import {
  syncAllMembers,
  syncPostById,
  unpublishPost,
} from "../../../../lib/services/patreon-sync";
import { getWebhookSecret } from "../../../../lib/services/creator-credentials";

export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-patreon-signature") ?? "";
  const secret = (await getWebhookSecret()) ?? "";
  if (!secret || !validSignature(raw, signature, secret)) {
    return Response.json({ error: "Invalid signature." }, { status: 401 });
  }
  let payload: {
    data?: {
      id?: string;
      relationships?: { campaign?: { data?: { id?: string } } };
    };
  };
  try {
    payload = JSON.parse(raw) as typeof payload;
  } catch {
    return Response.json({ error: "Invalid payload." }, { status: 400 });
  }
  const campaignId = payload.data?.relationships?.campaign?.data?.id;
  if (campaignId && campaignId !== process.env.PATREON_CAMPAIGN_ID) {
    return Response.json({ error: "Incorrect campaign." }, { status: 403 });
  }
  const eventType = request.headers.get("x-patreon-event") ?? "unknown";
  const deliveryId = createHash("sha256")
    .update(`${eventType}|${raw}`)
    .digest("hex");
  const existing = await getDb()
    .select({
      id: webhookDeliveries.id,
      receivedAt: webhookDeliveries.receivedAt,
      processedAt: webhookDeliveries.processedAt,
      error: webhookDeliveries.error,
    })
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.id, deliveryId))
    .limit(1);
  const now = new Date().toISOString();
  const disposition = webhookDeliveryDisposition(existing[0], Date.now());
  if (disposition === "duplicate") return Response.json({ duplicate: true });
  if (disposition === "in_progress") {
    return Response.json({ inProgress: true }, { status: 202 });
  }
  if (existing[0]) {
    await getDb()
      .update(webhookDeliveries)
      .set({ receivedAt: now, processedAt: null, error: null })
      .where(eq(webhookDeliveries.id, deliveryId));
  } else {
    await getDb().insert(webhookDeliveries).values({
      id: deliveryId,
      eventType,
      campaignId,
      receivedAt: now,
    });
  }
  try {
    if (eventType.startsWith("posts:")) {
      const postId = payload.data?.id;
      if (postId) {
        if (eventType === "posts:delete") await unpublishPost(postId);
        else await syncPostById(postId);
      }
    } else if (eventType.startsWith("members:")) {
      await syncAllMembers();
    }
    await getDb()
      .update(webhookDeliveries)
      .set({ processedAt: new Date().toISOString(), error: null })
      .where(eq(webhookDeliveries.id, deliveryId));
    return Response.json({ ok: true });
  } catch (error) {
    await getDb()
      .update(webhookDeliveries)
      .set({ error: error instanceof Error ? error.message : "Processing failed" })
      .where(eq(webhookDeliveries.id, deliveryId));
    return Response.json({ error: "Processing failed." }, { status: 500 });
  }
}

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

function validSignature(body: string, signature: string, secret: string) {
  const expected = createHmac("md5", secret).update(body).digest("hex");
  const left = Buffer.from(expected);
  const right = Buffer.from(signature.toLowerCase());
  return left.length === right.length && timingSafeEqual(left, right);
}
