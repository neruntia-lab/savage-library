import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import {
  manualGrants,
  accounts,
  patreonMembers,
  patreonMemberTiers,
  patreonPosts,
  protectedPostLinks,
  resources,
  syncStates,
} from "../../db/schema";
import { extractPatreonImport, postSlug } from "./patreon-posts";
import { syncPatreonTiers } from "./patreon";
import { getCreatorAccessToken } from "./creator-credentials";

type Resource = {
  id: string;
  type: string;
  attributes?: Record<string, unknown>;
  relationships?: Record<
    string,
    { data?: { id: string; type: string } | Array<{ id: string; type: string }> }
  >;
};
type ApiPage = {
  data?: Resource[];
  included?: Resource[];
  meta?: { pagination?: { cursors?: { next?: string | null } } };
};

export async function reconcilePatreon() {
  const now = new Date().toISOString();
  await setSyncState({ status: "running", lastStartedAt: now, lastError: null });
  try {
    await syncPatreonTiers();
    const [memberCount, postCount] = await Promise.all([
      syncAllMembers(),
      syncAllPosts(),
    ]);
    await setSyncState({
      status: "healthy",
      lastSucceededAt: new Date().toISOString(),
      lastError: null,
      memberCount,
      postCount,
    });
    return { memberCount, postCount };
  } catch (error) {
    await setSyncState({
      status: "error",
      lastError: error instanceof Error ? error.message : "Unknown sync error",
    });
    throw error;
  }
}

export async function syncAllMembers() {
  const campaignId = required("PATREON_CAMPAIGN_ID");
  const seen = new Set<string>();
  let count = 0;
  for await (const page of pages(
    `/campaigns/${encodeURIComponent(campaignId)}/members`,
    {
      include: "currently_entitled_tiers,user",
      "fields[member]": "full_name,patron_status",
      "fields[user]": "full_name",
      "fields[tier]": "title,amount_cents",
    },
  )) {
    const included = page.included ?? [];
    for (const member of page.data ?? []) {
      const userRel = member.relationships?.user?.data;
      const userId = !Array.isArray(userRel) ? userRel?.id : undefined;
      if (!userId) continue;
      const tierRel = member.relationships?.currently_entitled_tiers?.data;
      const tierIds = Array.isArray(tierRel) ? tierRel.map((tier) => tier.id) : [];
      const user = included.find((item) => item.type === "user" && item.id === userId);
      await upsertMember({
        id: member.id,
        userId,
        campaignId,
        displayName: String(
          member.attributes?.full_name ??
            user?.attributes?.full_name ??
            "Patreon member",
        ),
        patronStatus:
          typeof member.attributes?.patron_status === "string"
            ? member.attributes.patron_status
            : null,
        tierIds,
      });
      seen.add(member.id);
      count += 1;
    }
  }
  const existing = await getDb()
    .select({ id: patreonMembers.id })
    .from(patreonMembers)
    .where(eq(patreonMembers.campaignId, campaignId));
  const stale = existing.filter((row) => !seen.has(row.id)).map((row) => row.id);
  if (stale.length) {
    await getDb()
      .update(patreonMembers)
      .set({ isActive: false, lastSyncedAt: new Date().toISOString() })
      .where(inArray(patreonMembers.id, stale));
  }
  return count;
}

export async function syncAllPosts() {
  const campaignId = required("PATREON_CAMPAIGN_ID");
  const seen = new Set<string>();
  let count = 0;
  for await (const page of pages(
    `/campaigns/${encodeURIComponent(campaignId)}/posts`,
    {
      "fields[post]":
        "title,content,embed_data,embed_url,is_public,published_at,tiers,url",
    },
  )) {
    for (const post of page.data ?? []) {
      await upsertPost(post, campaignId);
      seen.add(post.id);
      count += 1;
    }
  }
  const existing = await getDb()
    .select({ id: patreonPosts.id })
    .from(patreonPosts)
    .where(eq(patreonPosts.campaignId, campaignId));
  const stale = existing.filter((row) => !seen.has(row.id)).map((row) => row.id);
  if (stale.length) {
    const now = new Date().toISOString();
    await getDb()
      .update(patreonPosts)
      .set({
        isPublished: false,
        reviewStatus: "source_deleted",
        sourceDeletedAt: now,
        updatedAt: now,
      })
      .where(inArray(patreonPosts.id, stale));
  }
  return count;
}

export async function syncPostById(id: string) {
  const campaignId = required("PATREON_CAMPAIGN_ID");
  const response = await patreonFetch(
    `/posts/${encodeURIComponent(id)}?${new URLSearchParams({
      "fields[post]":
        "title,content,embed_data,embed_url,is_public,published_at,tiers,url",
    })}`,
  );
  const body = (await response.json()) as { data?: Resource };
  if (body.data) await upsertPost(body.data, campaignId);
}

export async function unpublishPost(id: string) {
  await getDb()
    .update(patreonPosts)
    .set({
      isPublished: false,
      reviewStatus: "source_deleted",
      sourceDeletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(patreonPosts.id, id));
}

async function upsertMember(input: {
  id: string;
  userId: string;
  campaignId: string;
  displayName: string;
  patronStatus: string | null;
  tierIds: string[];
}) {
  const db = getDb();
  const now = new Date().toISOString();
  const linked =
    (
      await db
        .select({ websiteUserId: patreonMembers.websiteUserId })
        .from(patreonMembers)
        .where(eq(patreonMembers.patreonUserId, input.userId))
        .limit(1)
    )[0]?.websiteUserId ??
    (
      await db
        .select({ websiteUserId: accounts.userId })
        .from(accounts)
        .where(
          and(
            eq(accounts.provider, "patreon"),
            eq(accounts.providerAccountId, input.userId),
          ),
        )
        .limit(1)
    )[0]?.websiteUserId;
  await db
    .insert(patreonMembers)
    .values({
      id: input.id,
      patreonUserId: input.userId,
      websiteUserId: linked,
      campaignId: input.campaignId,
      displayName: input.displayName,
      patronStatus: input.patronStatus,
      isActive: input.tierIds.length > 0,
      lastSyncedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: patreonMembers.id,
      set: {
        displayName: input.displayName,
        patronStatus: input.patronStatus,
        websiteUserId: linked,
        isActive: input.tierIds.length > 0,
        lastSyncedAt: now,
        updatedAt: now,
      },
    });
  await db
    .delete(patreonMemberTiers)
    .where(eq(patreonMemberTiers.memberId, input.id));
  if (input.tierIds.length) {
    await db.insert(patreonMemberTiers).values(
      input.tierIds.map((tierId) => ({ memberId: input.id, tierId })),
    );
    if (linked) {
      await db
        .update(manualGrants)
        .set({
          status: "replaced",
          revokedAt: now,
          revocationReason: "replaced_by_patreon",
          updatedAt: now,
        })
        .where(
          and(
            eq(manualGrants.userId, linked),
            eq(manualGrants.status, "active"),
          ),
        );
    }
  }
}

async function upsertPost(post: Resource, campaignId: string) {
  const attributes = post.attributes ?? {};
  const title = String(attributes.title ?? "Patreon update");
  const tierIds = Array.isArray(attributes.tiers)
    ? attributes.tiers.map(String)
    : [];
  const parsed = extractPatreonImport(
    post.id,
    title,
    String(attributes.content ?? ""),
  );
  const now = new Date().toISOString();
  const existing = (
    await getDb()
      .select({
        resourceId: patreonPosts.resourceId,
        slug: patreonPosts.slug,
        reviewStatus: patreonPosts.reviewStatus,
        extractedPayload: patreonPosts.extractedPayload,
      })
      .from(patreonPosts)
      .where(eq(patreonPosts.id, post.id))
      .limit(1)
  )[0];
  const match = existing?.resourceId
    ? { resourceId: existing.resourceId, matchedBy: "preserved" }
    : await matchResource(parsed.payload);
  const serializedPayload = JSON.stringify(parsed.payload);
  const reviewStatus =
    existing?.reviewStatus === "approved" &&
    existing.extractedPayload === serializedPayload
      ? "approved"
      : parsed.warnings.length
        ? "needs_review"
        : "pending";
  await getDb()
    .insert(patreonPosts)
    .values({
      id: post.id,
      campaignId,
      slug: existing?.slug ?? postSlug(title, post.id),
      title,
      sanitizedHtml: parsed.sanitizedHtml,
      sourceUrl: String(attributes.url ?? "https://www.patreon.com/"),
      embedUrl:
        typeof attributes.embed_url === "string" &&
        attributes.embed_url.startsWith("https://")
          ? attributes.embed_url
          : null,
      embedData: attributes.embed_data
        ? JSON.stringify(attributes.embed_data)
        : null,
      isPublicOnPatreon: attributes.is_public === true,
      requiredTierIds: JSON.stringify(tierIds),
      publishedAt: String(attributes.published_at ?? now),
      isPublished: false,
      resourceId: match.resourceId,
      reviewStatus,
      detectedType: parsed.payload.resourceType ?? null,
      confidence: parsed.confidence,
      extractedPayload: serializedPayload,
      warnings: JSON.stringify(parsed.warnings),
      matchedBy: match.matchedBy,
      sourceDeletedAt: null,
      lastSyncedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: patreonPosts.id,
      set: {
        title,
        sanitizedHtml: parsed.sanitizedHtml,
        sourceUrl: String(attributes.url ?? "https://www.patreon.com/"),
        embedUrl:
          typeof attributes.embed_url === "string" &&
          attributes.embed_url.startsWith("https://")
            ? attributes.embed_url
            : null,
        embedData: attributes.embed_data
          ? JSON.stringify(attributes.embed_data)
          : null,
        requiredTierIds: JSON.stringify(tierIds),
        isPublicOnPatreon: attributes.is_public === true,
        publishedAt: String(attributes.published_at ?? now),
        isPublished: false,
        resourceId: match.resourceId,
        reviewStatus,
        detectedType: parsed.payload.resourceType ?? null,
        confidence: parsed.confidence,
        extractedPayload: serializedPayload,
        warnings: JSON.stringify(parsed.warnings),
        matchedBy: match.matchedBy,
        sourceDeletedAt: null,
        lastSyncedAt: now,
        updatedAt: now,
      },
    });
  await getDb()
    .delete(protectedPostLinks)
    .where(eq(protectedPostLinks.postId, post.id));
  if (parsed.links.length) {
    await getDb().insert(protectedPostLinks).values(
      parsed.links.map((link) => ({
        ...link,
        postId: post.id,
        role: link.role,
        requiredTierIds: JSON.stringify(tierIds),
        createdAt: now,
        updatedAt: now,
      })),
    );
  }
}

async function matchResource(payload: {
  resourceKey?: string;
  title: string;
  manifestUrl?: string;
  projectUrl?: string;
}) {
  const rows = await getDb()
    .select({
      id: resources.id,
      slug: resources.slug,
      title: resources.title,
      manifestUrl: resources.manifestUrl,
      projectUrl: resources.projectUrl,
    })
    .from(resources);
  if (payload.resourceKey) {
    const found = rows.find((row) => row.slug === payload.resourceKey);
    if (found) return { resourceId: found.id, matchedBy: "resource_key" };
  }
  for (const [field, value] of [
    ["manifest_url", payload.manifestUrl],
    ["project_url", payload.projectUrl],
  ] as const) {
    if (!value) continue;
    const normalized = normalizeUrl(value);
    const found = rows.find((row) =>
      normalizeUrl(field === "manifest_url" ? row.manifestUrl : row.projectUrl) ===
      normalized,
    );
    if (found) return { resourceId: found.id, matchedBy: field };
  }
  const normalizedTitle = normalizeTitle(payload.title);
  const titleMatches = rows.filter(
    (row) => normalizeTitle(row.title) === normalizedTitle,
  );
  return titleMatches.length === 1
    ? { resourceId: titleMatches[0].id, matchedBy: "title" }
    : { resourceId: null, matchedBy: titleMatches.length ? "ambiguous_title" : null };
}

function normalizeUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return value.trim().toLowerCase();
  }
}

function normalizeTitle(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "")
    .toLowerCase();
}

async function* pages(path: string, params: Record<string, string>) {
  let cursor: string | null = null;
  do {
    const query = new URLSearchParams({ ...params, "page[count]": "100" });
    if (cursor) query.set("page[cursor]", cursor);
    const response = await patreonFetch(`${path}?${query}`);
    const body = (await response.json()) as ApiPage;
    yield body;
    cursor = body.meta?.pagination?.cursors?.next ?? null;
  } while (cursor);
}

async function patreonFetch(path: string) {
  const token = await getCreatorAccessToken();
  if (!token) throw new Error("Patreon creator authorization is not configured.");
  const response = await fetch(`https://www.patreon.com/api/oauth2/v2${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Patreon returned ${response.status}.`);
  }
  return response;
}

async function setSyncState(
  values: Partial<typeof syncStates.$inferInsert> & { status: string },
) {
  const now = new Date().toISOString();
  await getDb()
    .insert(syncStates)
    .values({ id: "patreon", ...values, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: syncStates.id,
      set: { ...values, updatedAt: now },
    });
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}
