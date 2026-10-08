import {
  resources,
  authors,
  categories,
  gameSystems,
  tags,
} from "../../db/schema";
import type { ResourceSummary } from "../domain/resource";
import { resolveResourceArtwork } from "../services/resource-artwork";

export const publicCatalogSelection = {
  resource: {
    id: resources.id,
    slug: resources.slug,
    title: resources.title,
    shortDescription: resources.shortDescription,
    resourceType: resources.resourceType,
    thumbnailKey: resources.thumbnailKey,
    iconKey: resources.iconKey,
    useIconEverywhere: resources.useIconEverywhere,
    className: resources.className,
    subclassName: resources.subclassName,
    currentVersion: resources.currentVersion,
    foundryMinimum: resources.foundryMinimum,
    foundryVerified: resources.foundryVerified,
    foundryMaximum: resources.foundryMaximum,
    compatibilityStatus: resources.compatibilityStatus,
    pricing: resources.pricing,
    priceLabel: resources.priceLabel,
    isFeatured: resources.isFeatured,
    downloadCount: resources.downloadCount,
    popularityScore: resources.popularityScore,
    publishedAt: resources.publishedAt,
    createdAt: resources.createdAt,
    updatedAt: resources.updatedAt,
    accessMode: resources.accessMode,
    defaultLocale: resources.defaultLocale,
  },
  author: {
    id: authors.id,
    name: authors.name,
    slug: authors.slug,
    websiteUrl: authors.websiteUrl,
  },
  category: { id: categories.id, name: categories.name, slug: categories.slug },
  system: {
    id: gameSystems.id,
    name: gameSystems.name,
    slug: gameSystems.slug,
  },
};

export function mapSummary(
  row: {
    resource: Pick<
      typeof resources.$inferSelect,
      keyof typeof publicCatalogSelection.resource
    >;
    author: Pick<
      typeof authors.$inferSelect,
      keyof typeof publicCatalogSelection.author
    >;
    category: Pick<
      typeof categories.$inferSelect,
      keyof typeof publicCatalogSelection.category
    >;
    system: Pick<
      typeof gameSystems.$inferSelect,
      keyof typeof publicCatalogSelection.system
    >;
  },
  tagRows: Array<typeof tags.$inferSelect>,
): ResourceSummary {
  const artwork = {
    thumbnailUrl: storageImageUrl(row.resource.thumbnailKey),
    iconUrl: storageImageUrl(row.resource.iconKey),
    useIconEverywhere: row.resource.useIconEverywhere,
  };
  return {
    id: row.resource.id,
    slug: row.resource.slug,
    title: row.resource.title,
    shortDescription: row.resource.shortDescription,
    resourceType: row.resource.resourceType as ResourceSummary["resourceType"],
    category: {
      id: row.category.id,
      name: row.category.name,
      slug: row.category.slug,
    },
    author: {
      id: row.author.id,
      name: row.author.name,
      slug: row.author.slug,
      websiteUrl: row.author.websiteUrl,
    },
    gameSystem: {
      id: row.system.id,
      name: row.system.name,
      slug: row.system.slug,
    },
    className: row.resource.className,
    subclassName: row.resource.subclassName,
    currentVersion: row.resource.currentVersion,
    foundryMinimum: row.resource.foundryMinimum,
    foundryVerified: row.resource.foundryVerified,
    foundryMaximum: row.resource.foundryMaximum,
    compatibilityStatus: row.resource
      .compatibilityStatus as ResourceSummary["compatibilityStatus"],
    pricing: row.resource.pricing as ResourceSummary["pricing"],
    priceLabel: row.resource.priceLabel,
    tags: tagRows.map((tag) => ({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
    })),
    ...artwork,
    ...resolveResourceArtwork(artwork),
    isFeatured: row.resource.isFeatured,
    downloadCount: row.resource.downloadCount,
    popularityScore: row.resource.popularityScore,
    publishedAt: row.resource.publishedAt ?? row.resource.createdAt,
    updatedAt: row.resource.updatedAt,
    accessMode: row.resource.accessMode === "patreon" ? "patreon" : "public",
    defaultLocale: row.resource.defaultLocale === "es" ? "es" : "en",
  };
}

export function storageImageUrl(key?: string | null): string | null {
  if (key?.startsWith("http://") || key?.startsWith("https://")) return key;
  return key
    ? `/api/assets/${key
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/")}`
    : null;
}
