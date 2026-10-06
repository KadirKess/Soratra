ALTER TABLE "users" ADD COLUMN "username_normalized" text GENERATED ALWAYS AS (lower(btrim("username"))) STORED NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "friendships_unordered_pair_unique" ON "friendships" USING btree (least("requester_id", "addressee_id"),greatest("requester_id", "addressee_id"));--> statement-breakpoint
CREATE INDEX "friendships_status_requester_id_idx" ON "friendships" USING btree ("status","requester_id");--> statement-breakpoint
CREATE INDEX "friendships_status_addressee_id_idx" ON "friendships" USING btree ("status","addressee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_normalized_unique" ON "users" USING btree ("username_normalized");--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_distinct_users_check" CHECK ("friendships"."requester_id" <> "friendships"."addressee_id");