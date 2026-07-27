import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
};

export const authors = pgTable(
  "authors",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    websiteUrl: text("website_url"),
    ...timestamps,
  },
  (table) => [uniqueIndex("authors_slug_unique").on(table.slug)],
);

export const categories = pgTable(
  "categories",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description").notNull().default(""),
    ...timestamps,
  },
  (table) => [uniqueIndex("categories_slug_unique").on(table.slug)],
);

export const gameSystems = pgTable(
  "game_systems",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("game_systems_slug_unique").on(table.slug)],
);

export const tags = pgTable(
  "tags",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("tags_slug_unique").on(table.slug)],
);

export const foundryVersions = pgTable(
  "foundry_versions",
  {
    id: text("id").primaryKey(),
    version: text("version").notNull(),
    isSupported: boolean("is_supported").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("foundry_versions_version_unique").on(table.version),
  ],
);

export const resources = pgTable(
  "resources",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    shortDescription: text("short_description").notNull(),
    description: text("description").notNull().default(""),
    resourceType: text("resource_type").notNull(),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    authorId: text("author_id")
      .notNull()
      .references(() => authors.id, { onDelete: "restrict" }),
    gameSystemId: text("game_system_id")
      .notNull()
      .references(() => gameSystems.id, { onDelete: "restrict" }),
    className: text("class_name"),
    subclassName: text("subclass_name"),
    currentVersion: text("current_version").notNull(),
    foundryMinimum: text("foundry_minimum"),
    foundryVerified: text("foundry_verified"),
    foundryMaximum: text("foundry_maximum"),
    compatibilityStatus: text("compatibility_status").notNull(),
    compatibilityNotes: text("compatibility_notes"),
    pricing: text("pricing").notNull().default("free"),
    priceLabel: text("price_label"),
    thumbnailKey: text("thumbnail_key"),
    coverKey: text("cover_key"),
    installationInstructions: text("installation_instructions"),
    licenseName: text("license_name"),
    licenseUrl: text("license_url"),
    manifestUrl: text("manifest_url"),
    projectUrl: text("project_url"),
    defaultLocale: text("default_locale").notNull().default("en"),
    accessMode: text("access_mode").notNull().default("public"),
    revision: integer("revision").notNull().default(1),
    isFeatured: boolean("is_featured").notNull().default(false),
    isPublished: boolean("is_published").notNull().default(false),
    downloadCount: integer("download_count").notNull().default(0),
    popularityScore: integer("popularity_score").notNull().default(0),
    publishedAt: text("published_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("resources_slug_unique").on(table.slug),
    index("resources_catalog_idx").on(
      table.isPublished,
      table.resourceType,
      table.gameSystemId,
    ),
    index("resources_recency_idx").on(table.publishedAt, table.updatedAt),
    index("resources_access_idx").on(table.accessMode, table.isPublished),
  ],
);

export const resourceTranslations = pgTable(
  "resource_translations",
  {
    id: text("id").primaryKey(),
    resourceId: text("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    locale: text("locale").notNull(),
    title: text("title").notNull(),
    shortDescription: text("short_description").notNull(),
    description: text("description").notNull().default(""),
    compatibilityNotes: text("compatibility_notes"),
    installationInstructions: text("installation_instructions"),
    priceLabel: text("price_label"),
    isPublished: boolean("is_published").notNull().default(false),
    revision: integer("revision").notNull().default(1),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("resource_translation_locale_unique").on(
      table.resourceId,
      table.locale,
    ),
    index("resource_translation_public_idx").on(
      table.locale,
      table.isPublished,
    ),
  ],
);

export const resourceVersions = pgTable(
  "resource_versions",
  {
    id: text("id").primaryKey(),
    resourceId: text("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    version: text("version").notNull(),
    foundryMinimum: text("foundry_minimum"),
    foundryVerified: text("foundry_verified"),
    foundryMaximum: text("foundry_maximum"),
    isCurrent: boolean("is_current").notNull().default(false),
    releasedAt: text("released_at").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("resource_version_unique").on(
      table.resourceId,
      table.version,
    ),
    uniqueIndex("resource_version_current_unique")
      .on(table.resourceId)
      .where(sql`${table.isCurrent} = true`),
    index("resource_versions_resource_idx").on(table.resourceId),
  ],
);

export const releaseTranslations = pgTable(
  "release_translations",
  {
    id: text("id").primaryKey(),
    resourceVersionId: text("resource_version_id")
      .notNull()
      .references(() => resourceVersions.id, { onDelete: "cascade" }),
    locale: text("locale").notNull(),
    summary: text("summary").notNull().default(""),
    details: text("details").notNull().default(""),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("release_translation_locale_unique").on(
      table.resourceVersionId,
      table.locale,
    ),
  ],
);

export const files = pgTable(
  "files",
  {
    id: text("id").primaryKey(),
    resourceVersionId: text("resource_version_id")
      .notNull()
      .references(() => resourceVersions.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    locale: text("locale").notNull().default("en"),
    storageKey: text("storage_key").notNull(),
    storageUrl: text("storage_url"),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    extension: text("extension").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    checksum: text("checksum"),
    uploadedBy: text("uploaded_by"),
    isRestricted: boolean("is_restricted").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("files_storage_key_unique").on(table.storageKey),
    uniqueIndex("files_release_kind_locale_unique").on(
      table.resourceVersionId,
      table.kind,
      table.locale,
    ),
    index("files_resource_version_idx").on(table.resourceVersionId),
  ],
);

export const resourceTags = pgTable(
  "resource_tags",
  {
    resourceId: text("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.resourceId, table.tagId] }),
    index("resource_tags_tag_idx").on(table.tagId),
  ],
);

export const resourceFoundryVersions = pgTable(
  "resource_foundry_versions",
  {
    resourceId: text("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    foundryVersionId: text("foundry_version_id")
      .notNull()
      .references(() => foundryVersions.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.resourceId, table.foundryVersionId] }),
  ],
);

export const dependencies = pgTable(
  "dependencies",
  {
    id: text("id").primaryKey(),
    resourceId: text("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    versionRange: text("version_range"),
    url: text("url"),
    isRequired: boolean("is_required").notNull().default(true),
    ...timestamps,
  },
  (table) => [index("dependencies_resource_idx").on(table.resourceId)],
);

export const changelogEntries = pgTable(
  "changelog_entries",
  {
    id: text("id").primaryKey(),
    resourceVersionId: text("resource_version_id")
      .notNull()
      .references(() => resourceVersions.id, { onDelete: "cascade" }),
    summary: text("summary").notNull(),
    details: text("details").notNull().default(""),
    publishedAt: text("published_at").notNull(),
    ...timestamps,
  },
  (table) => [
    index("changelog_resource_version_idx").on(table.resourceVersionId),
  ],
);

export const patreonTiers = pgTable(
  "patreon_tiers",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    amountCents: integer("amount_cents").notNull().default(0),
    url: text("url"),
    isPublished: boolean("is_published").notNull().default(true),
    ...timestamps,
  },
  (table) => [index("patreon_tiers_campaign_idx").on(table.campaignId)],
);

export const resourcePatreonTiers = pgTable(
  "resource_patreon_tiers",
  {
    resourceId: text("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    tierId: text("tier_id")
      .notNull()
      .references(() => patreonTiers.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.resourceId, table.tierId] }),
    index("resource_patreon_tier_idx").on(table.tierId),
  ],
);

export const downloads = pgTable(
  "downloads",
  {
    id: text("id").primaryKey(),
    resourceId: text("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    fileId: text("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "restrict" }),
    visitorHash: text("visitor_hash"),
    downloadedAt: text("downloaded_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("downloads_resource_idx").on(table.resourceId),
  ],
);

export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull().default(0),
    windowStartedAt: integer("window_started_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (table) => [index("rate_limits_expiry_idx").on(table.expiresAt)],
);

export const siteSettings = pgTable("site_settings", {
  id: text("id").primaryKey(),
  heroImageUrl: text("hero_image_url"),
  heroImagePathname: text("hero_image_pathname"),
  heroImageOriginalName: text("hero_image_original_name"),
  heroImageMimeType: text("hero_image_mime_type"),
  heroImageSizeBytes: integer("hero_image_size_bytes"),
  updatedBy: text("updated_by"),
  ...timestamps,
});
