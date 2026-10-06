ALTER TABLE "books" RENAME COLUMN "google_books_id" TO "open_library_id";--> statement-breakpoint
ALTER TABLE "books" DROP CONSTRAINT "books_google_books_id_unique";--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "alternative_titles" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_open_library_id_unique" UNIQUE("open_library_id");