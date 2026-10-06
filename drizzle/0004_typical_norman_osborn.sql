CREATE INDEX "friendships_addressee_id_idx" ON "friendships" USING btree ("addressee_id");--> statement-breakpoint
CREATE INDEX "reading_sessions_book_id_idx" ON "reading_sessions" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "streak_freezes_user_id_idx" ON "streak_freezes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_books_book_id_idx" ON "user_books" USING btree ("book_id");