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
import { patreonRead } from "./patreon-http";
import { createImportMatcher } from "./import-matching";
import { withWriteTransaction, type WriteDatabase } from "../../db/transaction";
import { withSynchronizationLock } from "../../db/synchronization-lock";

type Resource = {
  id: string;
  type: string;
  attributes?: Record<string, unknown>;
  relationships?: Record<
    string,
    {
      data?: { id: string; type: string } | Array<{ id: string; type: string }>;
    }
  >;
};
type ApiPage = {
  data?: Resource[];
  included?: Resource[];
  meta?: { pagination?: { cursors?: { next?: string | null } } };
};

export async function reconcilePatreon() {
  return withSynchronizationLock(reconcile);
}

async function reconcile(assertOwned: () => void) {
  const now = new Date().toISOString();
  await setSyncState({
    status: "running",
    lastStartedAt: now,
    lastError: null,
  });
  try {
    await syncPatreonTiers();
    const results = await Promise.allSettled([
      syncMembers(assertOwned),
      syncPosts(assertOwned),
    ]);
    // Do not release ownership while the sibling scan is still making writes.
    const failed = results.find((result) => result.status === "rejected");
    if (failed?.status === "rejected") throw failed.reason;
    const [memberCount, postCount] = results.map((result) =>
      result.status === "fulfilled" ? result.value : 0,
    );
    assertOwned();
    await setSyncState({
      status: "healthy",
      lastSucceededAt: new Date().toISOString(),
      lastError: null,
      memberCount,
      postCount,
    });
    return { memberCount, postCount };
  } catch (error) {
    assertOwned();
    await setSyncState({
      status: "error",
      lastError: error instanceof Error ? error.message : "Unknown sync error",
    });
    throw error;
  }
}

export async function syncAllMembers() {
  return withSynchronizationLock(syncMembers);
}

async function syncMembers(assertOwned: () => void) {
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
      assertOwned();
      const userRel = member.relationships?.user?.data;
      const userId = !Array.isArray(userRel) ? userRel?.id : undefined;
      if (!userId) continue;
      const tierRel = member.relationships?.currently_entitled_tiers?.data;
      const tierIds = Array.isArray(tierRel)
        ? tierRel.map((tier) => tier.id)
        : [];
      const user = included.find(
        (item) => item.type === "user" && item.id === userId,
      );
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
  assertOwned();
  const existing = await getDb()
    .select({ id: patreonMembers.id })
    .from(patreonMembers)
    .where(eq(patreonMembers.campaignId, campaignId));
  const stale = existing
    .filter((row) => !seen.has(row.id))
    .map((row) => row.id);
  if (stale.length) {
    assertOwned();
    await getDb()
      .update(patreonMembers)
      .set({ isActive: false, lastSyncedAt: new Date().toISOString() })
      .where(inArray(patreonMembers.id, stale));
  }
  return count;
}

export async function syncAllPosts() {
  return withSynchronizationLock(syncPosts);
}

async function syncPosts(assertOwned: () => void) {
  const campaignId = required("PATREON_CAMPAIGN_ID");
  const match = await importMatcher();
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
      assertOwned();
      await upsertPost(post, campaignId, undefined, match);
      seen.add(post.id);
      count += 1;
    }
  }
  assertOwned();
  const existing = await getDb()
    .select({ id: patreonPosts.id })
    .from(patreonPosts)
    .where(eq(patreonPosts.campaignId, campaignId));
  const stale = existing
    .filter((row) => !seen.has(row.id))
    .map((row) => row.id);
  if (stale.length) {
    assertOwned();
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

async function upsertMember(
  input: {
    id: string;
    userId: string;
    campaignId: string;
    displayName: string;
    patronStatus: string | null;
    tierIds: string[];
  },
  transaction?: WriteDatabase,
): Promise<void> {
  if (!transaction)
    return withWriteTransaction((db) => upsertMember(input, db));
  const db = transaction;
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
    await db
      .insert(patreonMemberTiers)
      .values(input.tierIds.map((tierId) => ({ memberId: input.id, tierId })));
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

async function upsertPost(
  post: Resource,
  campaignId: string,
  transaction?: WriteDatabase,
  matcher?: ReturnType<typeof createImportMatcher>,
): Promise<void> {
  if (!transaction) {
    const index = matcher ?? (await importMatcher());
    return withWriteTransaction((db) =>
      upsertPost(post, campaignId, db, index),
    );
  }
  const db = transaction;
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
    await db
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
    : matcher!(parsed.payload);
  const serializedPayload = JSON.stringify(parsed.payload);
  const reviewStatus =
    existing?.reviewStatus === "approved" &&
    existing.extractedPayload === serializedPayload
      ? "approved"
      : parsed.warnings.length
        ? "needs_review"
        : "pending";
  await db
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
  await db
    .delete(protectedPostLinks)
    .where(eq(protectedPostLinks.postId, post.id));
  if (parsed.links.length) {
    await db.insert(protectedPostLinks).values(
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

async function importMatcher() {
  return createImportMatcher(
    await getDb()
      .select({
        id: resources.id,
        slug: resources.slug,
        title: resources.title,
        manifestUrl: resources.manifestUrl,
        projectUrl: resources.projectUrl,
      })
      .from(resources),
  );
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
  if (!token)
    throw new Error("Patreon creator authorization is not configured.");
  return patreonRead(`https://www.patreon.com/api/oauth2/v2${path}`, token);
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
