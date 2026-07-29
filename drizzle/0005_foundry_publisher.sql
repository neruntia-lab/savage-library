ALTER TABLE "resources" ADD COLUMN "foundry_module_id" text;
ALTER TABLE "resources" ADD COLUMN "active_release_id" text;
ALTER TABLE "resources" ADD COLUMN "publisher_token_hash" text;
ALTER TABLE "resources" ADD COLUMN "publisher_token_created_at" text;
CREATE UNIQUE INDEX "resources_foundry_module_id_unique" ON "resources" ("foundry_module_id") WHERE "foundry_module_id" IS NOT NULL;

ALTER TABLE "resource_versions" ADD COLUMN "release_status" text DEFAULT 'published' NOT NULL;
ALTER TABLE "resource_versions" ADD COLUMN "manifest_snapshot" text;
ALTER TABLE "resource_versions" ADD COLUMN "validation_errors" text DEFAULT '[]' NOT NULL;
ALTER TABLE "resource_versions" ADD COLUMN "upload_source" text DEFAULT 'admin' NOT NULL;
ALTER TABLE "resource_versions" ADD COLUMN "artifact_checksum" text;
ALTER TABLE "resource_versions" ADD COLUMN "artifact_size" integer;
ALTER TABLE "resource_versions" ADD COLUMN "changelog_summary" text DEFAULT '' NOT NULL;
ALTER TABLE "resource_versions" ADD COLUMN "changelog_details" text DEFAULT '' NOT NULL;
ALTER TABLE "resource_versions" ADD COLUMN "published_at" text;
ALTER TABLE "resource_versions" ADD COLUMN "rejected_at" text;
ALTER TABLE "resource_versions" ADD COLUMN "superseded_at" text;
CREATE INDEX "resource_versions_release_status_idx" ON "resource_versions" ("resource_id", "release_status");

UPDATE "resources" r
SET "active_release_id" = rv."id"
FROM "resource_versions" rv
WHERE rv."resource_id" = r."id" AND rv."is_current" = true;

UPDATE "resource_versions"
SET "published_at" = "released_at"
WHERE "is_current" = true;

UPDATE "resource_versions"
SET "release_status" = 'superseded', "superseded_at" = "released_at"
WHERE "is_current" = false;
