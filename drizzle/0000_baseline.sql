CREATE TABLE "book_title_resolutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"language" text NOT NULL,
	"title" text,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"open_library_id" text NOT NULL,
	"title" text NOT NULL,
	"authors" text[] DEFAULT '{}' NOT NULL,
	"alternative_titles" text[] DEFAULT '{}' NOT NULL,
	"alternative_titles_fetched_at" timestamp with time zone,
	"cover_url" text,
	"description" text,
	"published_date" text,
	"page_count" integer,
	"genres" text[] DEFAULT '{}' NOT NULL,
	"cached_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "books_open_library_id_unique" UNIQUE("open_library_id")
);
--> statement-breakpoint
CREATE TABLE "friendships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_id" uuid NOT NULL,
	"requester_active_data_version" integer DEFAULT 1 NOT NULL,
	"addressee_id" uuid NOT NULL,
	"addressee_active_data_version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "friendships_status_check" CHECK ("friendships"."status" in ('pending', 'accepted')),
	CONSTRAINT "friendships_distinct_users_check" CHECK ("friendships"."requester_id" <> "friendships"."addressee_id")
);
--> statement-breakpoint
CREATE TABLE "instance_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"auth_secret" text NOT NULL,
	"operator_name" text,
	"contact" text,
	"registration" text DEFAULT 'invite' NOT NULL,
	"setup_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "instance_settings_single_row_check" CHECK ("instance_settings"."id" = 1),
	CONSTRAINT "instance_settings_registration_check" CHECK ("instance_settings"."registration" in ('invite', 'open'))
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"created_by" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"used_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invites_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"user_active_data_version" integer DEFAULT 1 NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "rate_limit_buckets" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"reset_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reading_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"user_active_data_version" integer DEFAULT 1 NOT NULL,
	"book_id" uuid NOT NULL,
	"session_date" text NOT NULL,
	"rating" numeric(2, 1) NOT NULL,
	"minutes" integer NOT NULL,
	"note" text,
	"has_spoiler" integer DEFAULT 0 NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reading_sessions_minutes_check" CHECK ("reading_sessions"."minutes" > 0)
);
--> statement-breakpoint
CREATE TABLE "streak_freezes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"user_active_data_version" integer DEFAULT 1 NOT NULL,
	"frozen_date" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"user_active_data_version" integer DEFAULT 1 NOT NULL,
	"book_id" uuid NOT NULL,
	"status" text NOT NULL,
	"rating" numeric(2, 1),
	"review" text,
	"review_has_spoiler" integer DEFAULT 0 NOT NULL,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_books_status_check" CHECK ("user_books"."status" in ('want_to_read', 'reading', 'read'))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"username_normalized" text GENERATED ALWAYS AS (lower(btrim("username"))) STORED NOT NULL,
	"password_hash" text,
	"gdpr_consent_at" timestamp with time zone NOT NULL,
	"gdpr_consent_version" text NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"timezone" text,
	"preferred_language" text DEFAULT 'en' NOT NULL,
	"auth_version" integer DEFAULT 0 NOT NULL,
	"active_data_version" integer DEFAULT 1 NOT NULL,
	"weekly_freeze_used" integer DEFAULT 0 NOT NULL,
	"freeze_week_start" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_id_active_data_version_unique" UNIQUE("id","active_data_version")
);
--> statement-breakpoint
ALTER TABLE "book_title_resolutions" ADD CONSTRAINT "book_title_resolutions_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_addressee_id_users_id_fk" FOREIGN KEY ("addressee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_active_requester_fk" FOREIGN KEY ("requester_id","requester_active_data_version") REFERENCES "public"."users"("id","active_data_version") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_active_addressee_fk" FOREIGN KEY ("addressee_id","addressee_active_data_version") REFERENCES "public"."users"("id","active_data_version") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_used_by_users_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_active_user_fk" FOREIGN KEY ("user_id","user_active_data_version") REFERENCES "public"."users"("id","active_data_version") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "reading_sessions" ADD CONSTRAINT "reading_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_sessions" ADD CONSTRAINT "reading_sessions_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_sessions" ADD CONSTRAINT "reading_sessions_active_user_fk" FOREIGN KEY ("user_id","user_active_data_version") REFERENCES "public"."users"("id","active_data_version") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "streak_freezes" ADD CONSTRAINT "streak_freezes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streak_freezes" ADD CONSTRAINT "streak_freezes_active_user_fk" FOREIGN KEY ("user_id","user_active_data_version") REFERENCES "public"."users"("id","active_data_version") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_books" ADD CONSTRAINT "user_books_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_books" ADD CONSTRAINT "user_books_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_books" ADD CONSTRAINT "user_books_active_user_fk" FOREIGN KEY ("user_id","user_active_data_version") REFERENCES "public"."users"("id","active_data_version") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "book_title_resolution_unique" ON "book_title_resolutions" USING btree ("book_id","language");--> statement-breakpoint
CREATE INDEX "book_title_resolutions_book_id_idx" ON "book_title_resolutions" USING btree ("book_id");--> statement-breakpoint
CREATE UNIQUE INDEX "friendship_unique" ON "friendships" USING btree ("requester_id","addressee_id");--> statement-breakpoint
CREATE INDEX "friendships_addressee_id_idx" ON "friendships" USING btree ("addressee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "friendships_unordered_pair_unique" ON "friendships" USING btree (least("requester_id", "addressee_id"),greatest("requester_id", "addressee_id"));--> statement-breakpoint
CREATE INDEX "friendships_status_requester_id_idx" ON "friendships" USING btree ("status","requester_id");--> statement-breakpoint
CREATE INDEX "friendships_status_addressee_id_idx" ON "friendships" USING btree ("status","addressee_id");--> statement-breakpoint
CREATE INDEX "invites_expires_at_idx" ON "invites" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "rate_limit_buckets_reset_at_idx" ON "rate_limit_buckets" USING btree ("reset_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_book_date_unique" ON "reading_sessions" USING btree ("user_id","book_id","session_date");--> statement-breakpoint
CREATE INDEX "reading_sessions_book_id_idx" ON "reading_sessions" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "reading_sessions_user_session_date_idx" ON "reading_sessions" USING btree ("user_id","session_date");--> statement-breakpoint
CREATE INDEX "reading_sessions_user_recent_idx" ON "reading_sessions" USING btree ("user_id","session_date" desc,"created_at" desc);--> statement-breakpoint
CREATE UNIQUE INDEX "streak_freezes_user_date_unique" ON "streak_freezes" USING btree ("user_id","frozen_date");--> statement-breakpoint
CREATE INDEX "streak_freezes_user_id_idx" ON "streak_freezes" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_book_unique" ON "user_books" USING btree ("user_id","book_id");--> statement-breakpoint
CREATE INDEX "user_books_book_id_idx" ON "user_books" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "user_books_user_status_updated_at_idx" ON "user_books" USING btree ("user_id","status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_normalized_unique" ON "users" USING btree ("username_normalized");--> statement-breakpoint
CREATE UNIQUE INDEX "users_single_admin_unique" ON "users" USING btree ("is_admin") WHERE "users"."is_admin";