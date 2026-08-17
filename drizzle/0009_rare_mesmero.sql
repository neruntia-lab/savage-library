CREATE TABLE "admin_cli_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"token_prefix" text NOT NULL,
	"token_hash" text NOT NULL,
	"scopes" text NOT NULL,
	"created_by" text NOT NULL,
	"expires_at" text,
	"last_used_at" text,
	"revoked_at" text,
	"revocation_reason" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "admin_cli_tokens_hash_unique" ON "admin_cli_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "admin_cli_tokens_active_idx" ON "admin_cli_tokens" USING btree ("revoked_at","expires_at");