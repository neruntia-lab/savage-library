CREATE TABLE "accounts" (
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "integration_credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"access_token_encrypted" text NOT NULL,
	"refresh_token_encrypted" text,
	"expires_at" integer,
	"scope" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manual_grant_tiers" (
	"grant_id" text NOT NULL,
	"tier_id" text NOT NULL,
	CONSTRAINT "manual_grant_tiers_grant_id_tier_id_pk" PRIMARY KEY("grant_id","tier_id")
);
--> statement-breakpoint
CREATE TABLE "manual_grants" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"internal_note" text DEFAULT '' NOT NULL,
	"granted_by" text NOT NULL,
	"expires_at" text,
	"revoked_at" text,
	"revocation_reason" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patreon_member_tiers" (
	"member_id" text NOT NULL,
	"tier_id" text NOT NULL,
	CONSTRAINT "patreon_member_tiers_member_id_tier_id_pk" PRIMARY KEY("member_id","tier_id")
);
--> statement-breakpoint
CREATE TABLE "patreon_members" (
	"id" text PRIMARY KEY NOT NULL,
	"patreon_user_id" text NOT NULL,
	"website_user_id" text,
	"campaign_id" text NOT NULL,
	"display_name" text DEFAULT 'Patreon member' NOT NULL,
	"patron_status" text,
	"is_active" boolean DEFAULT false NOT NULL,
	"last_synced_at" text NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patreon_posts" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"sanitized_html" text DEFAULT '' NOT NULL,
	"source_url" text NOT NULL,
	"embed_url" text,
	"embed_data" text,
	"is_public_on_patreon" boolean DEFAULT false NOT NULL,
	"required_tier_ids" text DEFAULT '[]' NOT NULL,
	"published_at" text NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"resource_id" text,
	"last_synced_at" text NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "protected_post_links" (
	"id" text PRIMARY KEY NOT NULL,
	"post_id" text NOT NULL,
	"label" text NOT NULL,
	"destination" text NOT NULL,
	"required_tier_ids" text DEFAULT '[]' NOT NULL,
	"access_count" integer DEFAULT 0 NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_states" (
	"id" text PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'idle' NOT NULL,
	"last_started_at" text,
	"last_succeeded_at" text,
	"last_error" text,
	"member_count" integer DEFAULT 0 NOT NULL,
	"post_count" integer DEFAULT 0 NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"email_verified" timestamp,
	"image" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"campaign_id" text,
	"received_at" text NOT NULL,
	"processed_at" text,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_grant_tiers" ADD CONSTRAINT "manual_grant_tiers_grant_id_manual_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."manual_grants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_grant_tiers" ADD CONSTRAINT "manual_grant_tiers_tier_id_patreon_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."patreon_tiers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_grants" ADD CONSTRAINT "manual_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patreon_member_tiers" ADD CONSTRAINT "patreon_member_tiers_member_id_patreon_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."patreon_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patreon_members" ADD CONSTRAINT "patreon_members_website_user_id_users_id_fk" FOREIGN KEY ("website_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patreon_posts" ADD CONSTRAINT "patreon_posts_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "protected_post_links" ADD CONSTRAINT "protected_post_links_post_id_patreon_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."patreon_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "manual_grant_tier_idx" ON "manual_grant_tiers" USING btree ("tier_id");--> statement-breakpoint
CREATE INDEX "manual_grants_user_idx" ON "manual_grants" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "manual_grants_expiry_idx" ON "manual_grants" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "patreon_member_tier_idx" ON "patreon_member_tiers" USING btree ("tier_id");--> statement-breakpoint
CREATE UNIQUE INDEX "patreon_members_user_campaign_unique" ON "patreon_members" USING btree ("patreon_user_id","campaign_id");--> statement-breakpoint
CREATE INDEX "patreon_members_status_idx" ON "patreon_members" USING btree ("campaign_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "patreon_posts_slug_unique" ON "patreon_posts" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "patreon_posts_public_idx" ON "patreon_posts" USING btree ("is_published","published_at");--> statement-breakpoint
CREATE INDEX "protected_post_links_post_idx" ON "protected_post_links" USING btree ("post_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");