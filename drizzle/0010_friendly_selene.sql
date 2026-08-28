ALTER TABLE "resources" ADD COLUMN "setup_status" text DEFAULT 'complete' NOT NULL;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "setup_step" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "setup_completed_at" text;