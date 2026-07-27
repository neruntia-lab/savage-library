CREATE TABLE "authors" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"website_url" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "changelog_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"resource_version_id" text NOT NULL,
	"summary" text NOT NULL,
	"details" text DEFAULT '' NOT NULL,
	"published_at" text NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dependencies" (
	"id" text PRIMARY KEY NOT NULL,
	"resource_id" text NOT NULL,
	"name" text NOT NULL,
	"version_range" text,
	"url" text,
	"is_required" boolean DEFAULT true NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "downloads" (
	"id" text PRIMARY KEY NOT NULL,
	"resource_id" text NOT NULL,
	"file_id" text NOT NULL,
	"visitor_hash" text,
	"downloaded_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" text PRIMARY KEY NOT NULL,
	"resource_version_id" text NOT NULL,
	"kind" text NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"storage_key" text NOT NULL,
	"storage_url" text,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"extension" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"checksum" text,
	"uploaded_by" text,
	"is_restricted" boolean DEFAULT false NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "foundry_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"version" text NOT NULL,
	"is_supported" boolean DEFAULT true NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_systems" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patreon_tiers" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"amount_cents" integer DEFAULT 0 NOT NULL,
	"url" text,
	"is_published" boolean DEFAULT true NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_started_at" integer NOT NULL,
	"expires_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "release_translations" (
	"id" text PRIMARY KEY NOT NULL,
	"resource_version_id" text NOT NULL,
	"locale" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"details" text DEFAULT '' NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_foundry_versions" (
	"resource_id" text NOT NULL,
	"foundry_version_id" text NOT NULL,
	CONSTRAINT "resource_foundry_versions_resource_id_foundry_version_id_pk" PRIMARY KEY("resource_id","foundry_version_id")
);
--> statement-breakpoint
CREATE TABLE "resource_patreon_tiers" (
	"resource_id" text NOT NULL,
	"tier_id" text NOT NULL,
	CONSTRAINT "resource_patreon_tiers_resource_id_tier_id_pk" PRIMARY KEY("resource_id","tier_id")
);
--> statement-breakpoint
CREATE TABLE "resource_tags" (
	"resource_id" text NOT NULL,
	"tag_id" text NOT NULL,
	CONSTRAINT "resource_tags_resource_id_tag_id_pk" PRIMARY KEY("resource_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "resource_translations" (
	"id" text PRIMARY KEY NOT NULL,
	"resource_id" text NOT NULL,
	"locale" text NOT NULL,
	"title" text NOT NULL,
	"short_description" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"compatibility_notes" text,
	"installation_instructions" text,
	"price_label" text,
	"is_published" boolean DEFAULT false NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"resource_id" text NOT NULL,
	"version" text NOT NULL,
	"foundry_minimum" text,
	"foundry_verified" text,
	"foundry_maximum" text,
	"is_current" boolean DEFAULT false NOT NULL,
	"released_at" text NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"short_description" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"resource_type" text NOT NULL,
	"category_id" text NOT NULL,
	"author_id" text NOT NULL,
	"game_system_id" text NOT NULL,
	"class_name" text,
	"subclass_name" text,
	"current_version" text NOT NULL,
	"foundry_minimum" text,
	"foundry_verified" text,
	"foundry_maximum" text,
	"compatibility_status" text NOT NULL,
	"compatibility_notes" text,
	"pricing" text DEFAULT 'free' NOT NULL,
	"price_label" text,
	"thumbnail_key" text,
	"cover_key" text,
	"installation_instructions" text,
	"license_name" text,
	"license_url" text,
	"manifest_url" text,
	"project_url" text,
	"default_locale" text DEFAULT 'en' NOT NULL,
	"access_mode" text DEFAULT 'public' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"download_count" integer DEFAULT 0 NOT NULL,
	"popularity_score" integer DEFAULT 0 NOT NULL,
	"published_at" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "changelog_entries" ADD CONSTRAINT "changelog_entries_resource_version_id_resource_versions_id_fk" FOREIGN KEY ("resource_version_id") REFERENCES "public"."resource_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dependencies" ADD CONSTRAINT "dependencies_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_resource_version_id_resource_versions_id_fk" FOREIGN KEY ("resource_version_id") REFERENCES "public"."resource_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_translations" ADD CONSTRAINT "release_translations_resource_version_id_resource_versions_id_fk" FOREIGN KEY ("resource_version_id") REFERENCES "public"."resource_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_foundry_versions" ADD CONSTRAINT "resource_foundry_versions_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_foundry_versions" ADD CONSTRAINT "resource_foundry_versions_foundry_version_id_foundry_versions_id_fk" FOREIGN KEY ("foundry_version_id") REFERENCES "public"."foundry_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_patreon_tiers" ADD CONSTRAINT "resource_patreon_tiers_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_patreon_tiers" ADD CONSTRAINT "resource_patreon_tiers_tier_id_patreon_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."patreon_tiers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_tags" ADD CONSTRAINT "resource_tags_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_tags" ADD CONSTRAINT "resource_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_translations" ADD CONSTRAINT "resource_translations_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_versions" ADD CONSTRAINT "resource_versions_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_game_system_id_game_systems_id_fk" FOREIGN KEY ("game_system_id") REFERENCES "public"."game_systems"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "authors_slug_unique" ON "authors" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_unique" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "changelog_resource_version_idx" ON "changelog_entries" USING btree ("resource_version_id");--> statement-breakpoint
CREATE INDEX "dependencies_resource_idx" ON "dependencies" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "downloads_resource_idx" ON "downloads" USING btree ("resource_id");--> statement-breakpoint
CREATE UNIQUE INDEX "files_storage_key_unique" ON "files" USING btree ("storage_key");--> statement-breakpoint
CREATE UNIQUE INDEX "files_release_kind_locale_unique" ON "files" USING btree ("resource_version_id","kind","locale");--> statement-breakpoint
CREATE INDEX "files_resource_version_idx" ON "files" USING btree ("resource_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "foundry_versions_version_unique" ON "foundry_versions" USING btree ("version");--> statement-breakpoint
CREATE UNIQUE INDEX "game_systems_slug_unique" ON "game_systems" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "patreon_tiers_campaign_idx" ON "patreon_tiers" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "rate_limits_expiry_idx" ON "rate_limits" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "release_translation_locale_unique" ON "release_translations" USING btree ("resource_version_id","locale");--> statement-breakpoint
CREATE INDEX "resource_patreon_tier_idx" ON "resource_patreon_tiers" USING btree ("tier_id");--> statement-breakpoint
CREATE INDEX "resource_tags_tag_idx" ON "resource_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "resource_translation_locale_unique" ON "resource_translations" USING btree ("resource_id","locale");--> statement-breakpoint
CREATE INDEX "resource_translation_public_idx" ON "resource_translations" USING btree ("locale","is_published");--> statement-breakpoint
CREATE UNIQUE INDEX "resource_version_unique" ON "resource_versions" USING btree ("resource_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "resource_version_current_unique" ON "resource_versions" USING btree ("resource_id") WHERE "resource_versions"."is_current" = true;--> statement-breakpoint
CREATE INDEX "resource_versions_resource_idx" ON "resource_versions" USING btree ("resource_id");--> statement-breakpoint
CREATE UNIQUE INDEX "resources_slug_unique" ON "resources" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "resources_catalog_idx" ON "resources" USING btree ("is_published","resource_type","game_system_id");--> statement-breakpoint
CREATE INDEX "resources_recency_idx" ON "resources" USING btree ("published_at","updated_at");--> statement-breakpoint
CREATE INDEX "resources_access_idx" ON "resources" USING btree ("access_mode","is_published");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_slug_unique" ON "tags" USING btree ("slug");