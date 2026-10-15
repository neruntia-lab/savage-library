import { and, asc, eq, isNotNull } from "drizzle-orm";
import { getDb } from "../../db";
import { resources, resourceTranslations, wikiGuides } from "../../db/schema";
import { isLocalPreview } from "../config/local-preview";
import { SEED_RESOURCES } from "../data/seed-resources";

export async function sitemapEntries() {
  if (isLocalPreview())
    return {
      resources: SEED_RESOURCES.map(
        ({ slug, updatedAt, availableLocales }) => ({
          slug,
          updatedAt,
          locales: availableLocales ?? ["en"],
        }),
      ),
      guides: [],
    };
  const db = getDb();
  const [resourceEntries, guides, translations] = await Promise.all([
    db
      .select({
        id: resources.id,
        slug: resources.slug,
        updatedAt: resources.updatedAt,
      })
      .from(resources)
      .where(eq(resources.isPublished, true))
      .orderBy(asc(resources.id)),
    db
      .select({
        slug: wikiGuides.publishedSlug,
        publishedAt: wikiGuides.publishedAt,
        content: wikiGuides.publishedContent,
      })
      .from(wikiGuides)
      .where(isNotNull(wikiGuides.publishedContent))
      .orderBy(asc(wikiGuides.id)),
    db
      .select({
        resourceId: resourceTranslations.resourceId,
        locale: resourceTranslations.locale,
      })
      .from(resourceTranslations)
      .innerJoin(resources, eq(resources.id, resourceTranslations.resourceId))
      .where(
        and(
          eq(resources.isPublished, true),
          eq(resourceTranslations.isPublished, true),
        ),
      ),
  ]);
  return {
    resources: resourceEntries.map((resource) => ({
      ...resource,
      locales: translations
        .filter((item) => item.resourceId === resource.id)
        .map((item) => item.locale),
    })),
    guides,
  };
}
