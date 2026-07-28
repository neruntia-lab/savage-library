ALTER TABLE "integration_credentials" ADD COLUMN "webhook_secret_encrypted" text;--> statement-breakpoint
ALTER TABLE "integration_credentials" ADD COLUMN "webhook_id" text;