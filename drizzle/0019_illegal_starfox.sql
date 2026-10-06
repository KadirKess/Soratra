ALTER TABLE "books" ADD COLUMN "alternative_titles_fetched_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "preferred_language" text DEFAULT 'fr' NOT NULL;