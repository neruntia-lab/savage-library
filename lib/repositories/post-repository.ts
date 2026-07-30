import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { patreonPosts, protectedPostLinks } from "../../db/schema";

export async function listPublishedPosts() {
  return getDb()
    .select({
      id: patreonPosts.id,
      slug: patreonPosts.slug,
      title: patreonPosts.title,
      sanitizedHtml: patreonPosts.sanitizedHtml,
      sourceUrl: patreonPosts.sourceUrl,
      publishedAt: patreonPosts.publishedAt,
      isPublicOnPatreon: patreonPosts.isPublicOnPatreon,
    })
    .from(patreonPosts)
    .where(eq(patreonPosts.isPublished, true))
    .orderBy(desc(patreonPosts.publishedAt));
}

export async function getPublishedPost(slug: string) {
  return (
    await getDb()
      .select()
      .from(patreonPosts)
      .where(eq(patreonPosts.slug, slug))
      .limit(1)
  )[0] ?? null;
}

export async function getProtectedPostLink(id: string) {
  return (
    await getDb()
      .select({
        link: protectedPostLinks,
        postPublished: patreonPosts.reviewStatus,
      })
      .from(protectedPostLinks)
      .innerJoin(patreonPosts, eq(patreonPosts.id, protectedPostLinks.postId))
      .where(eq(protectedPostLinks.id, id))
      .limit(1)
  )[0] ?? null;
}

export async function recordProtectedLinkAccess(id: string) {
  await getDb()
    .update(protectedPostLinks)
    .set({
      accessCount: sql`${protectedPostLinks.accessCount} + 1`,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(protectedPostLinks.id, id));
}

export async function listAdminPosts() {
  return getDb()
    .select({
      id: patreonPosts.id,
      slug: patreonPosts.slug,
      title: patreonPosts.title,
      sourceUrl: patreonPosts.sourceUrl,
      publishedAt: patreonPosts.publishedAt,
      isPublished: patreonPosts.isPublished,
      resourceId: patreonPosts.resourceId,
      lastSyncedAt: patreonPosts.lastSyncedAt,
    })
    .from(patreonPosts)
    .orderBy(desc(patreonPosts.publishedAt));
}

export async function updateAdminPost(
  id: string,
  input: { isPublished?: boolean; resourceId?: string | null },
) {
  const rows = await getDb()
    .update(patreonPosts)
    .set({ ...input, updatedAt: new Date().toISOString() })
    .where(eq(patreonPosts.id, id))
    .returning({ id: patreonPosts.id });
  return Boolean(rows[0]);
}
