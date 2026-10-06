CREATE TABLE "book_title_resolutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"language" text NOT NULL,
	"title" text,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "book_title_resolutions" ADD CONSTRAINT "book_title_resolutions_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "book_title_resolution_unique" ON "book_title_resolutions" USING btree ("book_id","language");--> statement-breakpoint
CREATE INDEX "book_title_resolutions_book_id_idx" ON "book_title_resolutions" USING btree ("book_id");