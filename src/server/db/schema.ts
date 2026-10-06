import {
  pgTable, uuid, text, timestamp, numeric, integer,
  uniqueIndex, index, check, foreignKey,
} from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique(),
    username: text('username').notNull().unique(),
    usernameNormalized: text('username_normalized').generatedAlwaysAs(sql`lower(btrim("username"))`).notNull(),
    // Nullable: soft delete nulls this out (no password rather than a sentinel '').
    passwordHash: text('password_hash'),
    gdprConsentAt: timestamp('gdpr_consent_at', { withTimezone: true }).notNull(),
    gdprConsentVersion: text('gdpr_consent_version').notNull(),
    dataExportRequestedAt: timestamp('data_export_requested_at', { withTimezone: true }),
    timezone: text('timezone'),
    preferredLanguage: text('preferred_language').notNull().default('en'),
    authVersion: integer('auth_version').notNull().default(0),
    activeDataVersion: integer('active_data_version').notNull().default(1),
    isPro: integer('is_pro').notNull().default(0),
    purchasedFreezes: integer('purchased_freezes').notNull().default(0),
    periodicFreezeUsed: integer('periodic_freeze_used').notNull().default(0),
    freezePeriodStart: text('freeze_period_start'),
    weeklyFreezeUsed: integer('weekly_freeze_used').notNull().default(0),
    freezeWeekStart: text('freeze_week_start'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('users_username_normalized_unique').on(t.usernameNormalized),
    uniqueIndex('users_id_active_data_version_unique').on(t.id, t.activeDataVersion),
  ],
)

export const books = pgTable('books', {
  id: uuid('id').primaryKey().defaultRandom(),
  openLibraryId: text('open_library_id').notNull().unique(),
  title: text('title').notNull(),
  authors: text('authors').array().notNull().default([]),
  alternativeTitles: text('alternative_titles').array().notNull().default([]),
  alternativeTitlesFetchedAt: timestamp('alternative_titles_fetched_at', { withTimezone: true }),
  coverUrl: text('cover_url'),
  description: text('description'),
  publishedDate: text('published_date'),
  pageCount: integer('page_count'),
  genres: text('genres').array().notNull().default([]),
  cachedAt: timestamp('cached_at', { withTimezone: true }).notNull().defaultNow(),
})

export const bookTitleResolutions = pgTable(
  'book_title_resolutions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookId: uuid('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
    language: text('language').notNull(),
    title: text('title'),
    checkedAt: timestamp('checked_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('book_title_resolution_unique').on(t.bookId, t.language),
    index('book_title_resolutions_book_id_idx').on(t.bookId),
  ],
)

export const userBooks = pgTable(
  'user_books',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    userActiveDataVersion: integer('user_active_data_version').notNull().default(1),
    bookId: uuid('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
    status: text('status').notNull(), // 'want_to_read' | 'reading' | 'read'
    rating: numeric('rating', { precision: 2, scale: 1 }), // 0.5–5.0, nullable
    review: text('review'),
    reviewHasSpoiler: integer('review_has_spoiler').notNull().default(0),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('user_book_unique').on(t.userId, t.bookId),
    index('user_books_book_id_idx').on(t.bookId),
    index('user_books_user_status_updated_at_idx').on(t.userId, t.status, t.updatedAt),
    foreignKey({
      name: 'user_books_active_user_fk',
      columns: [t.userId, t.userActiveDataVersion],
      foreignColumns: [users.id, users.activeDataVersion],
    }).onUpdate('cascade'),
    check('user_books_status_check', sql`${t.status} in ('want_to_read', 'reading', 'read')`),
  ],
)

export const readingSessions = pgTable(
  'reading_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    userActiveDataVersion: integer('user_active_data_version').notNull().default(1),
    bookId: uuid('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
    sessionDate: text('session_date').notNull(), // YYYY-MM-DD local date
    rating: numeric('rating', { precision: 2, scale: 1 }).notNull(),
    minutes: integer('minutes').notNull(),
    note: text('note'),
    hasSpoiler: integer('has_spoiler').notNull().default(0),
    revision: integer('revision').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('user_book_date_unique').on(t.userId, t.bookId, t.sessionDate),
    index('reading_sessions_book_id_idx').on(t.bookId),
    index('reading_sessions_user_session_date_idx').on(t.userId, t.sessionDate),
    index('reading_sessions_user_recent_idx').on(t.userId, sql`${t.sessionDate} desc`, sql`${t.createdAt} desc`),
    foreignKey({
      name: 'reading_sessions_active_user_fk',
      columns: [t.userId, t.userActiveDataVersion],
      foreignColumns: [users.id, users.activeDataVersion],
    }).onUpdate('cascade'),
    check('reading_sessions_minutes_check', sql`${t.minutes} > 0`),
  ],
)

export const friendships = pgTable(
  'friendships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requesterId: uuid('requester_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    requesterActiveDataVersion: integer('requester_active_data_version').notNull().default(1),
    addresseeId: uuid('addressee_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    addresseeActiveDataVersion: integer('addressee_active_data_version').notNull().default(1),
    status: text('status').notNull().default('pending'), // 'pending' | 'accepted'
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('friendship_unique').on(t.requesterId, t.addresseeId),
    index('friendships_addressee_id_idx').on(t.addresseeId),
    uniqueIndex('friendships_unordered_pair_unique').on(
      sql`least(${t.requesterId}, ${t.addresseeId})`,
      sql`greatest(${t.requesterId}, ${t.addresseeId})`,
    ),
    index('friendships_status_requester_id_idx').on(t.status, t.requesterId),
    index('friendships_status_addressee_id_idx').on(t.status, t.addresseeId),
    foreignKey({
      name: 'friendships_active_requester_fk',
      columns: [t.requesterId, t.requesterActiveDataVersion],
      foreignColumns: [users.id, users.activeDataVersion],
    }).onUpdate('cascade'),
    foreignKey({
      name: 'friendships_active_addressee_fk',
      columns: [t.addresseeId, t.addresseeActiveDataVersion],
      foreignColumns: [users.id, users.activeDataVersion],
    }).onUpdate('cascade'),
    check('friendships_status_check', sql`${t.status} in ('pending', 'accepted')`),
    check('friendships_distinct_users_check', sql`${t.requesterId} <> ${t.addresseeId}`),
  ],
)

export const streakFreezes = pgTable(
  'streak_freezes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    userActiveDataVersion: integer('user_active_data_version').notNull().default(1),
    frozenDate: text('frozen_date').notNull(), // YYYY-MM-DD
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('streak_freezes_user_date_unique').on(t.userId, t.frozenDate),
    index('streak_freezes_user_id_idx').on(t.userId),
    foreignKey({
      name: 'streak_freezes_active_user_fk',
      columns: [t.userId, t.userActiveDataVersion],
      foreignColumns: [users.id, users.activeDataVersion],
    }).onUpdate('cascade'),
  ],
)

export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    userActiveDataVersion: integer('user_active_data_version').notNull().default(1),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('password_reset_tokens_user_id_idx').on(t.userId),
    foreignKey({
      name: 'password_reset_tokens_active_user_fk',
      columns: [t.userId, t.userActiveDataVersion],
      foreignColumns: [users.id, users.activeDataVersion],
    }).onUpdate('cascade'),
  ],
)

export const rateLimitBuckets = pgTable(
  'rate_limit_buckets',
  {
    key: text('key').primaryKey(),
    count: integer('count').notNull(),
    resetAt: timestamp('reset_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('rate_limit_buckets_reset_at_idx').on(t.resetAt)],
)

export const usersRelations = relations(users, ({ many }) => ({
  userBooks: many(userBooks),
  readingSessions: many(readingSessions),
  sentRequests: many(friendships, { relationName: 'requester' }),
  receivedRequests: many(friendships, { relationName: 'addressee' }),
  streakFreezes: many(streakFreezes),
  passwordResetTokens: many(passwordResetTokens),
}))

export const booksRelations = relations(books, ({ many }) => ({
  userBooks: many(userBooks),
  readingSessions: many(readingSessions),
  titleResolutions: many(bookTitleResolutions),
}))

export const bookTitleResolutionsRelations = relations(bookTitleResolutions, ({ one }) => ({
  book: one(books, { fields: [bookTitleResolutions.bookId], references: [books.id] }),
}))

export const userBooksRelations = relations(userBooks, ({ one }) => ({
  user: one(users, { fields: [userBooks.userId], references: [users.id] }),
  book: one(books, { fields: [userBooks.bookId], references: [books.id] }),
}))

export const readingSessionsRelations = relations(readingSessions, ({ one }) => ({
  user: one(users, { fields: [readingSessions.userId], references: [users.id] }),
  book: one(books, { fields: [readingSessions.bookId], references: [books.id] }),
}))

export const friendshipsRelations = relations(friendships, ({ one }) => ({
  requester: one(users, { fields: [friendships.requesterId], references: [users.id], relationName: 'requester' }),
  addressee: one(users, { fields: [friendships.addresseeId], references: [users.id], relationName: 'addressee' }),
}))

export const streakFreezesRelations = relations(streakFreezes, ({ one }) => ({
  user: one(users, { fields: [streakFreezes.userId], references: [users.id] }),
}))

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, { fields: [passwordResetTokens.userId], references: [users.id] }),
}))

export type User = typeof users.$inferSelect
export type Book = typeof books.$inferSelect
export type BookTitleResolution = typeof bookTitleResolutions.$inferSelect
export type UserBook = typeof userBooks.$inferSelect
export type ReadingSession = typeof readingSessions.$inferSelect
export type Friendship = typeof friendships.$inferSelect
export type StreakFreeze = typeof streakFreezes.$inferSelect
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect
export type RateLimitBucket = typeof rateLimitBuckets.$inferSelect
