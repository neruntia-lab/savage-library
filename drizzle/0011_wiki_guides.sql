CREATE TABLE "wiki_guides" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"published_slug" text,
	"draft" jsonb NOT NULL,
	"published_content" jsonb,
	"module_id" text,
	"published_module_id" text,
	"revision" integer DEFAULT 1 NOT NULL,
	"updated_by" text NOT NULL,
	"published_at" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wiki_guides" ADD CONSTRAINT "wiki_guides_module_id_resources_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."resources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_guides" ADD CONSTRAINT "wiki_guides_published_module_id_resources_id_fk" FOREIGN KEY ("published_module_id") REFERENCES "public"."resources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "wiki_slug_unique" ON "wiki_guides" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "wiki_published_slug_unique" ON "wiki_guides" USING btree ("published_slug");