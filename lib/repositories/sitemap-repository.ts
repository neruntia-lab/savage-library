import { asc, eq, isNotNull } from "drizzle-orm";
import { getDb } from "../../db";
import { resources, wikiGuides } from "../../db/schema";
import { isLocalPreview } from "../config/local-preview";
import { SEED_RESOURCES } from "../data/seed-resources";

export async function sitemapEntries() {
  if (isLocalPreview())
    return {
      resources: SEED_RESOURCES.map(({ slug, updatedAt }) => ({
        slug,
        updatedAt,
      })),
      guides: [],
    };
  const db = getDb();
  const [resourceEntries, guides] = await Promise.all([
    db
      .select({ slug: resources.slug, updatedAt: resources.updatedAt })
      .from(resources)
      .where(eq(resources.isPublished, true))
      .orderBy(asc(resources.id)),
    db
      .select({
        slug: wikiGuides.publishedSlug,
        publishedAt: wikiGuides.publishedAt,
      })
      .from(wikiGuides)
      .where(isNotNull(wikiGuides.publishedContent))
      .orderBy(asc(wikiGuides.id)),
  ]);
  return { resources: resourceEntries, guides };
}
