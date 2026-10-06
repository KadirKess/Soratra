ALTER TABLE "reading_sessions" DROP CONSTRAINT "reading_sessions_time_range_check";--> statement-breakpoint
ALTER TABLE "reading_sessions" ALTER COLUMN "minutes" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "reading_sessions" DROP COLUMN "time_range";--> statement-breakpoint
ALTER TABLE "reading_sessions" ADD CONSTRAINT "reading_sessions_minutes_check" CHECK ("reading_sessions"."minutes" > 0);