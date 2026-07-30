ALTER TABLE "patreon_posts" ADD COLUMN "review_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "patreon_posts" ADD COLUMN "detected_type" text;--> statement-breakpoint
ALTER TABLE "patreon_posts" ADD COLUMN "confidence" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "patreon_posts" ADD COLUMN "extracted_payload" text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "patreon_posts" ADD COLUMN "warnings" text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "patreon_posts" ADD COLUMN "matched_by" text;--> statement-breakpoint
ALTER TABLE "patreon_posts" ADD COLUMN "approved_at" text;--> statement-breakpoint
ALTER TABLE "patreon_posts" ADD COLUMN "rejected_at" text;--> statement-breakpoint
ALTER TABLE "patreon_posts" ADD COLUMN "source_deleted_at" text;--> statement-breakpoint
ALTER TABLE "protected_post_links" ADD COLUMN "role" text DEFAULT 'download' NOT NULL;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "source_patreon_post_id" text;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "last_approved_candidate_id" text;