CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`language` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `code_redemptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`code_id` text,
	`benefits_applied` text,
	`redeemed_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`code_id`) REFERENCES `promo_codes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `food_scans` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`image_url` text,
	`detected_items` text,
	`nutrition_summary` text,
	`score_blood_sugar` real,
	`score_gut_health` real,
	`score_inflammation` real,
	`score_nutrient_density` real,
	`score_processing` real,
	`score_protein_quality` real,
	`score_micronutrient` real,
	`score_overall` real,
	`model_used` text,
	`scan_mode` text,
	`error_class` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `ingredients` (
	`id` text PRIMARY KEY NOT NULL,
	`name_th` text NOT NULL,
	`name_en` text NOT NULL,
	`category` text,
	`nutrition_per_100g` text,
	`glycemic_index` real,
	`special_properties` text
);
--> statement-breakpoint
CREATE TABLE `promo_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`type` text NOT NULL,
	`description` text,
	`description_th` text,
	`trial_days` integer,
	`discount_percent` real,
	`grant_tier` text DEFAULT 'premium',
	`usage_limit` integer DEFAULT 100,
	`usage_count` integer DEFAULT 0,
	`is_active` integer DEFAULT true,
	`expires_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `promo_codes_code_unique` ON `promo_codes` (`code`);--> statement-breakpoint
CREATE TABLE `recipes` (
	`id` text PRIMARY KEY NOT NULL,
	`name_th` text NOT NULL,
	`name_en` text NOT NULL,
	`ingredients` text,
	`instructions_th` text,
	`instructions_en` text,
	`nutrition_per_serving` text,
	`dietary_flags` text,
	`score_overall` real,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`hashed_password` text,
	`subscription_tier` text DEFAULT 'free',
	`trial_expires_at` integer,
	`promo_source` text,
	`language` text DEFAULT 'th',
	`health_info` text,
	`usage_tracking` text,
	`scans_this_month` integer DEFAULT 0,
	`streak_days` integer DEFAULT 0,
	`total_points` integer DEFAULT 0,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);