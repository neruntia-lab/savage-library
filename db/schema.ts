import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
};

export const authors = sqliteTable(
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

export const categories = sqliteTable(
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

export const gameSystems = sqliteTable(
  "game_systems",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("game_systems_slug_unique").on(table.slug)],
);

export const tags = sqliteTable(
  "tags",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("tags_slug_unique").on(table.slug)],
);

export const foundryVersions = sqliteTable(
  "foundry_versions",
  {
    id: text("id").primaryKey(),
    version: text("version").notNull(),
    isSupported: integer("is_supported", { mode: "boolean" })
      .notNull()
      .default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("foundry_versions_version_unique").on(table.version),
  ],
);

export const resources = sqliteTable(
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
    isFeatured: integer("is_featured", { mode: "boolean" })
      .notNull()
      .default(false),
    isPublished: integer("is_published", { mode: "boolean" })
      .notNull()
      .default(false),
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
  ],
);

export const resourceVersions = sqliteTable(
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
    isCurrent: integer("is_current", { mode: "boolean" })
      .notNull()
      .default(false),
    releasedAt: text("released_at").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("resource_version_unique").on(
      table.resourceId,
      table.version,
    ),
    index("resource_versions_resource_idx").on(table.resourceId),
  ],
);

export const files = sqliteTable(
  "files",
  {
    id: text("id").primaryKey(),
    resourceVersionId: text("resource_version_id")
      .notNull()
      .references(() => resourceVersions.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    storageKey: text("storage_key").notNull(),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    extension: text("extension").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    checksum: text("checksum"),
    isRestricted: integer("is_restricted", { mode: "boolean" })
      .notNull()
      .default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("files_storage_key_unique").on(table.storageKey),
    index("files_resource_version_idx").on(table.resourceVersionId),
  ],
);

export const resourceTags = sqliteTable(
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

export const resourceFoundryVersions = sqliteTable(
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

export const dependencies = sqliteTable(
  "dependencies",
  {
    id: text("id").primaryKey(),
    resourceId: text("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    versionRange: text("version_range"),
    url: text("url"),
    isRequired: integer("is_required", { mode: "boolean" })
      .notNull()
      .default(true),
    ...timestamps,
  },
  (table) => [index("dependencies_resource_idx").on(table.resourceId)],
);

export const changelogEntries = sqliteTable(
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

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name"),
    role: text("role").notNull().default("user"),
    ...timestamps,
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const savedResources = sqliteTable(
  "saved_resources",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    resourceId: text("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.resourceId] }),
    index("saved_resources_user_idx").on(table.userId),
  ],
);

export const downloads = sqliteTable(
  "downloads",
  {
    id: text("id").primaryKey(),
    resourceId: text("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    fileId: text("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "restrict" }),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    visitorHash: text("visitor_hash"),
    downloadedAt: text("downloaded_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("downloads_resource_idx").on(table.resourceId),
    index("downloads_user_idx").on(table.userId, table.downloadedAt),
  ],
);

export const rateLimits = sqliteTable(
  "rate_limits",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull().default(0),
    windowStartedAt: integer("window_started_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (table) => [index("rate_limits_expiry_idx").on(table.expiresAt)],
);
