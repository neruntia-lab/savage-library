import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
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
    iconKey: text("icon_key"),
    useIconEverywhere: boolean("use_icon_everywhere").notNull().default(false),
    installationInstructions: text("installation_instructions"),
    licenseName: text("license_name"),
    licenseUrl: text("license_url"),
    manifestUrl: text("manifest_url"),
    projectUrl: text("project_url"),
    foundryModuleId: text("foundry_module_id"),
    activeReleaseId: text("active_release_id"),
    publisherTokenHash: text("publisher_token_hash"),
    publisherTokenCreatedAt: text("publisher_token_created_at"),
    defaultLocale: text("default_locale").notNull().default("en"),
    accessMode: text("access_mode").notNull().default("public"),
    sourcePatreonPostId: text("source_patreon_post_id"),
    lastApprovedCandidateId: text("last_approved_candidate_id"),
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
    uniqueIndex("resources_foundry_module_id_unique")
      .on(table.foundryModuleId)
      .where(sql`${table.foundryModuleId} IS NOT NULL`),
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
    releaseStatus: text("release_status").notNull().default("published"),
    manifestSnapshot: text("manifest_snapshot"),
    validationErrors: text("validation_errors").notNull().default("[]"),
    uploadSource: text("upload_source").notNull().default("admin"),
    artifactChecksum: text("artifact_checksum"),
    artifactSize: integer("artifact_size"),
    changelogSummary: text("changelog_summary").notNull().default(""),
    changelogDetails: text("changelog_details").notNull().default(""),
    publishedAt: text("published_at"),
    rejectedAt: text("rejected_at"),
    supersededAt: text("superseded_at"),
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
    index("resource_versions_release_status_idx").on(
      table.resourceId,
      table.releaseStatus,
    ),
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

// Auth.js persistence. JWT sessions remain enabled so the existing credentials
// administrator can coexist with email magic links.
export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text("name"),
    email: text("email"),
    emailVerified: timestamp("email_verified", { mode: "date" }),
    image: text("image"),
    ...timestamps,
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.providerAccountId] }),
    index("accounts_user_idx").on(table.userId),
  ],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.identifier, table.token] }),
  ],
);

export const adminCliTokens = pgTable(
  "admin_cli_tokens",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    tokenPrefix: text("token_prefix").notNull(),
    tokenHash: text("token_hash").notNull(),
    scopes: text("scopes").notNull(),
    createdBy: text("created_by").notNull(),
    expiresAt: text("expires_at"),
    lastUsedAt: text("last_used_at"),
    revokedAt: text("revoked_at"),
    revocationReason: text("revocation_reason"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("admin_cli_tokens_hash_unique").on(table.tokenHash),
    index("admin_cli_tokens_active_idx").on(table.revokedAt, table.expiresAt),
  ],
);

export const manualGrants = pgTable(
  "manual_grants",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("active"),
    reason: text("reason").notNull().default(""),
    internalNote: text("internal_note").notNull().default(""),
    grantedBy: text("granted_by").notNull(),
    expiresAt: text("expires_at"),
    revokedAt: text("revoked_at"),
    revocationReason: text("revocation_reason"),
    ...timestamps,
  },
  (table) => [
    index("manual_grants_user_idx").on(table.userId, table.status),
    index("manual_grants_expiry_idx").on(table.expiresAt),
  ],
);

export const manualGrantTiers = pgTable(
  "manual_grant_tiers",
  {
    grantId: text("grant_id")
      .notNull()
      .references(() => manualGrants.id, { onDelete: "cascade" }),
    tierId: text("tier_id")
      .notNull()
      .references(() => patreonTiers.id, { onDelete: "restrict" }),
  },
  (table) => [
    primaryKey({ columns: [table.grantId, table.tierId] }),
    index("manual_grant_tier_idx").on(table.tierId),
  ],
);

export const patreonMembers = pgTable(
  "patreon_members",
  {
    id: text("id").primaryKey(),
    patreonUserId: text("patreon_user_id").notNull(),
    websiteUserId: text("website_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    campaignId: text("campaign_id").notNull(),
    displayName: text("display_name").notNull().default("Patreon member"),
    patronStatus: text("patron_status"),
    isActive: boolean("is_active").notNull().default(false),
    lastSyncedAt: text("last_synced_at").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("patreon_members_user_campaign_unique").on(
      table.patreonUserId,
      table.campaignId,
    ),
    index("patreon_members_status_idx").on(table.campaignId, table.isActive),
  ],
);

export const patreonMemberTiers = pgTable(
  "patreon_member_tiers",
  {
    memberId: text("member_id")
      .notNull()
      .references(() => patreonMembers.id, { onDelete: "cascade" }),
    tierId: text("tier_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.memberId, table.tierId] }),
    index("patreon_member_tier_idx").on(table.tierId),
  ],
);

export const patreonPosts = pgTable(
  "patreon_posts",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id").notNull(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    sanitizedHtml: text("sanitized_html").notNull().default(""),
    sourceUrl: text("source_url").notNull(),
    embedUrl: text("embed_url"),
    embedData: text("embed_data"),
    isPublicOnPatreon: boolean("is_public_on_patreon").notNull().default(false),
    requiredTierIds: text("required_tier_ids").notNull().default("[]"),
    publishedAt: text("published_at").notNull(),
    isPublished: boolean("is_published").notNull().default(true),
    resourceId: text("resource_id").references(() => resources.id, {
      onDelete: "set null",
    }),
    reviewStatus: text("review_status").notNull().default("pending"),
    detectedType: text("detected_type"),
    confidence: integer("confidence").notNull().default(0),
    extractedPayload: text("extracted_payload").notNull().default("{}"),
    warnings: text("warnings").notNull().default("[]"),
    matchedBy: text("matched_by"),
    approvedAt: text("approved_at"),
    rejectedAt: text("rejected_at"),
    sourceDeletedAt: text("source_deleted_at"),
    lastSyncedAt: text("last_synced_at").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("patreon_posts_slug_unique").on(table.slug),
    index("patreon_posts_public_idx").on(table.isPublished, table.publishedAt),
  ],
);

export const protectedPostLinks = pgTable(
  "protected_post_links",
  {
    id: text("id").primaryKey(),
    postId: text("post_id")
      .notNull()
      .references(() => patreonPosts.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    destination: text("destination").notNull(),
    role: text("role").notNull().default("download"),
    requiredTierIds: text("required_tier_ids").notNull().default("[]"),
    accessCount: integer("access_count").notNull().default(0),
    ...timestamps,
  },
  (table) => [index("protected_post_links_post_idx").on(table.postId)],
);

export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: text("id").primaryKey(),
  eventType: text("event_type").notNull(),
  campaignId: text("campaign_id"),
  receivedAt: text("received_at").notNull(),
  processedAt: text("processed_at"),
  error: text("error"),
});

export const integrationCredentials = pgTable("integration_credentials", {
  id: text("id").primaryKey(),
  accessTokenEncrypted: text("access_token_encrypted").notNull(),
  refreshTokenEncrypted: text("refresh_token_encrypted"),
  webhookSecretEncrypted: text("webhook_secret_encrypted"),
  webhookId: text("webhook_id"),
  expiresAt: integer("expires_at"),
  scope: text("scope"),
  ...timestamps,
});

export const syncStates = pgTable("sync_states", {
  id: text("id").primaryKey(),
  status: text("status").notNull().default("idle"),
  lastStartedAt: text("last_started_at"),
  lastSucceededAt: text("last_succeeded_at"),
  lastError: text("last_error"),
  memberCount: integer("member_count").notNull().default(0),
  postCount: integer("post_count").notNull().default(0),
  ...timestamps,
});
