CREATE TABLE `authors` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`website_url` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `authors_slug_unique` ON `authors` (`slug`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_slug_unique` ON `categories` (`slug`);--> statement-breakpoint
CREATE TABLE `changelog_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`resource_version_id` text NOT NULL,
	`summary` text NOT NULL,
	`details` text DEFAULT '' NOT NULL,
	`published_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`resource_version_id`) REFERENCES `resource_versions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `changelog_resource_version_idx` ON `changelog_entries` (`resource_version_id`);--> statement-breakpoint
CREATE TABLE `dependencies` (
	`id` text PRIMARY KEY NOT NULL,
	`resource_id` text NOT NULL,
	`name` text NOT NULL,
	`version_range` text,
	`url` text,
	`is_required` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`resource_id`) REFERENCES `resources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `dependencies_resource_idx` ON `dependencies` (`resource_id`);--> statement-breakpoint
CREATE TABLE `downloads` (
	`id` text PRIMARY KEY NOT NULL,
	`resource_id` text NOT NULL,
	`file_id` text NOT NULL,
	`user_id` text,
	`visitor_hash` text,
	`downloaded_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`resource_id`) REFERENCES `resources`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `downloads_resource_idx` ON `downloads` (`resource_id`);--> statement-breakpoint
CREATE INDEX `downloads_user_idx` ON `downloads` (`user_id`,`downloaded_at`);--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`resource_version_id` text NOT NULL,
	`kind` text NOT NULL,
	`storage_key` text NOT NULL,
	`original_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`extension` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`checksum` text,
	`is_restricted` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`resource_version_id`) REFERENCES `resource_versions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `files_storage_key_unique` ON `files` (`storage_key`);--> statement-breakpoint
CREATE INDEX `files_resource_version_idx` ON `files` (`resource_version_id`);--> statement-breakpoint
CREATE TABLE `foundry_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`version` text NOT NULL,
	`is_supported` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `foundry_versions_version_unique` ON `foundry_versions` (`version`);--> statement-breakpoint
CREATE TABLE `game_systems` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_systems_slug_unique` ON `game_systems` (`slug`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`window_started_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rate_limits_expiry_idx` ON `rate_limits` (`expires_at`);--> statement-breakpoint
CREATE TABLE `resource_foundry_versions` (
	`resource_id` text NOT NULL,
	`foundry_version_id` text NOT NULL,
	PRIMARY KEY(`resource_id`, `foundry_version_id`),
	FOREIGN KEY (`resource_id`) REFERENCES `resources`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`foundry_version_id`) REFERENCES `foundry_versions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `resource_tags` (
	`resource_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`resource_id`, `tag_id`),
	FOREIGN KEY (`resource_id`) REFERENCES `resources`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `resource_tags_tag_idx` ON `resource_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `resource_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`resource_id` text NOT NULL,
	`version` text NOT NULL,
	`foundry_minimum` text,
	`foundry_verified` text,
	`foundry_maximum` text,
	`is_current` integer DEFAULT false NOT NULL,
	`released_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`resource_id`) REFERENCES `resources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `resource_version_unique` ON `resource_versions` (`resource_id`,`version`);--> statement-breakpoint
CREATE INDEX `resource_versions_resource_idx` ON `resource_versions` (`resource_id`);--> statement-breakpoint
CREATE TABLE `resources` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`short_description` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`resource_type` text NOT NULL,
	`category_id` text NOT NULL,
	`author_id` text NOT NULL,
	`game_system_id` text NOT NULL,
	`class_name` text,
	`subclass_name` text,
	`current_version` text NOT NULL,
	`foundry_minimum` text,
	`foundry_verified` text,
	`foundry_maximum` text,
	`compatibility_status` text NOT NULL,
	`compatibility_notes` text,
	`pricing` text DEFAULT 'free' NOT NULL,
	`price_label` text,
	`thumbnail_key` text,
	`cover_key` text,
	`installation_instructions` text,
	`license_name` text,
	`license_url` text,
	`manifest_url` text,
	`project_url` text,
	`is_featured` integer DEFAULT false NOT NULL,
	`is_published` integer DEFAULT false NOT NULL,
	`download_count` integer DEFAULT 0 NOT NULL,
	`popularity_score` integer DEFAULT 0 NOT NULL,
	`published_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`author_id`) REFERENCES `authors`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`game_system_id`) REFERENCES `game_systems`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `resources_slug_unique` ON `resources` (`slug`);--> statement-breakpoint
CREATE INDEX `resources_catalog_idx` ON `resources` (`is_published`,`resource_type`,`game_system_id`);--> statement-breakpoint
CREATE INDEX `resources_recency_idx` ON `resources` (`published_at`,`updated_at`);--> statement-breakpoint
CREATE TABLE `saved_resources` (
	`user_id` text NOT NULL,
	`resource_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`user_id`, `resource_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resource_id`) REFERENCES `resources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `saved_resources_user_idx` ON `saved_resources` (`user_id`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_slug_unique` ON `tags` (`slug`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`role` text DEFAULT 'user' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);