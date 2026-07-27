CREATE TABLE "site_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"hero_image_url" text,
	"hero_image_pathname" text,
	"hero_image_original_name" text,
	"hero_image_mime_type" text,
	"hero_image_size_bytes" integer,
	"updated_by" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
