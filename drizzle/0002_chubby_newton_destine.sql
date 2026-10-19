ALTER TABLE "reading_sessions" ADD COLUMN "start_page" integer;--> statement-breakpoint
ALTER TABLE "reading_sessions" ADD COLUMN "end_page" integer;--> statement-breakpoint
ALTER TABLE "user_books" ADD COLUMN "page_count" integer;--> statement-breakpoint
ALTER TABLE "reading_sessions" ADD CONSTRAINT "reading_sessions_end_page_check" CHECK ("reading_sessions"."end_page" is null or "reading_sessions"."end_page" between 0 and 100000);--> statement-breakpoint
ALTER TABLE "reading_sessions" ADD CONSTRAINT "reading_sessions_start_page_check" CHECK ("reading_sessions"."start_page" is null or ("reading_sessions"."end_page" is not null and "reading_sessions"."start_page" between 0 and "reading_sessions"."end_page"));--> statement-breakpoint
ALTER TABLE "user_books" ADD CONSTRAINT "user_books_page_count_check" CHECK ("user_books"."page_count" is null or "user_books"."page_count" between 1 and 100000);