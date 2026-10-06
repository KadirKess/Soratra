ALTER TABLE "friendships" DROP CONSTRAINT "friendships_active_requester_fk";
--> statement-breakpoint
ALTER TABLE "friendships" DROP CONSTRAINT "friendships_active_addressee_fk";
--> statement-breakpoint
ALTER TABLE "password_reset_tokens" DROP CONSTRAINT "password_reset_tokens_active_user_fk";
--> statement-breakpoint
ALTER TABLE "reading_sessions" DROP CONSTRAINT "reading_sessions_active_user_fk";
--> statement-breakpoint
ALTER TABLE "streak_freezes" DROP CONSTRAINT "streak_freezes_active_user_fk";
--> statement-breakpoint
ALTER TABLE "user_books" DROP CONSTRAINT "user_books_active_user_fk";
--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_active_requester_fk" FOREIGN KEY ("requester_id","requester_active_data_version") REFERENCES "public"."users"("id","active_data_version") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_active_addressee_fk" FOREIGN KEY ("addressee_id","addressee_active_data_version") REFERENCES "public"."users"("id","active_data_version") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_active_user_fk" FOREIGN KEY ("user_id","user_active_data_version") REFERENCES "public"."users"("id","active_data_version") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "reading_sessions" ADD CONSTRAINT "reading_sessions_active_user_fk" FOREIGN KEY ("user_id","user_active_data_version") REFERENCES "public"."users"("id","active_data_version") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "streak_freezes" ADD CONSTRAINT "streak_freezes_active_user_fk" FOREIGN KEY ("user_id","user_active_data_version") REFERENCES "public"."users"("id","active_data_version") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_books" ADD CONSTRAINT "user_books_active_user_fk" FOREIGN KEY ("user_id","user_active_data_version") REFERENCES "public"."users"("id","active_data_version") ON DELETE no action ON UPDATE cascade;