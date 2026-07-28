import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { patreonTiers } from "../../db/schema";
import { getCreatorAccessToken } from "./creator-credentials";

type PatreonResource = {
  id: string;
  type: string;
  attributes?: Record<string, unknown>;
  relationships?: Record<
    string,
    { data?: { id: string; type: string } | Array<{ id: string; type: string }> }
  >;
};

type PatreonResponse = {
  data?: PatreonResource | PatreonResource[];
  included?: PatreonResource[];
};

export async function verifyPatreonEntitlement(
  accessToken: string,
  allowedTierIds: string[],
): Promise<{ entitled: boolean; tierIds: string[] }> {
  const campaignId = process.env.PATREON_CAMPAIGN_ID;
  if (!campaignId || !allowedTierIds.length) {
    return { entitled: false, tierIds: [] };
  }

  const url = new URL("https://www.patreon.com/api/oauth2/v2/identity");
  url.searchParams.set("include", "memberships.currently_entitled_tiers");
  url.searchParams.set("fields[member]", "patron_status,last_charge_status");
  url.searchParams.set("fields[tier]", "title,amount_cents");

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Patreon membership could not be checked.");

  const body = (await response.json()) as PatreonResponse;
  const included = body.included ?? [];
  const membership = included.find((item) => {
    if (item.type !== "member") return false;
    const campaign = item.relationships?.campaign?.data;
    return !Array.isArray(campaign) && campaign?.id === campaignId;
  });
  if (!membership) return { entitled: false, tierIds: [] };

  const tierRelationship = membership.relationships?.currently_entitled_tiers?.data;
  const tierIds = Array.isArray(tierRelationship)
    ? tierRelationship.map((tier) => tier.id)
    : [];
  return {
    entitled: allowedTierIds.some((id) => tierIds.includes(id)),
    tierIds,
  };
}

export async function listPatreonTiers() {
  return getDb()
    .select()
    .from(patreonTiers)
    .orderBy(patreonTiers.amountCents, patreonTiers.title);
}

export async function syncPatreonTiers(): Promise<number> {
  const campaignId = process.env.PATREON_CAMPAIGN_ID;
  const creatorToken = await getCreatorAccessToken();
  if (!campaignId || !creatorToken) {
    throw new Error("Patreon campaign credentials are not configured.");
  }

  const url = new URL(
    `https://www.patreon.com/api/oauth2/v2/campaigns/${encodeURIComponent(campaignId)}`,
  );
  url.searchParams.set("include", "tiers");
  url.searchParams.set(
    "fields[tier]",
    "title,description,amount_cents,published,url",
  );
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${creatorToken}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Patreon tiers could not be synchronized.");

  const body = (await response.json()) as PatreonResponse;
  const tiers = (body.included ?? []).filter((item) => item.type === "tier");
  const db = getDb();
  const now = new Date().toISOString();
  for (const tier of tiers) {
    const attributes = tier.attributes ?? {};
    await db
      .insert(patreonTiers)
      .values({
        id: tier.id,
        campaignId,
        title: String(attributes.title ?? "Patreon tier"),
        description: String(attributes.description ?? ""),
        amountCents: Number(attributes.amount_cents ?? 0),
        url: typeof attributes.url === "string" ? attributes.url : null,
        isPublished: attributes.published !== false,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: patreonTiers.id,
        set: {
          title: String(attributes.title ?? "Patreon tier"),
          description: String(attributes.description ?? ""),
          amountCents: Number(attributes.amount_cents ?? 0),
          url: typeof attributes.url === "string" ? attributes.url : null,
          isPublished: attributes.published !== false,
          updatedAt: now,
        },
      });
  }

  if (tiers.length) {
    const knownIds = new Set(tiers.map((tier) => tier.id));
    const existing = await db
      .select({ id: patreonTiers.id })
      .from(patreonTiers)
      .where(eq(patreonTiers.campaignId, campaignId));
    for (const tier of existing) {
      if (!knownIds.has(tier.id)) {
        await db
          .update(patreonTiers)
          .set({ isPublished: false, updatedAt: now })
          .where(eq(patreonTiers.id, tier.id));
      }
    }
  }
  return tiers.length;
}
