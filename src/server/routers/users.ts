import { z } from 'zod'
import { router, protectedProcedure } from '../trpc'
import { db, friendships, userBooks, users, readingSessions, streakFreezes } from '../db'
import { eq, and, count, desc, gte, isNull, lte, or, ne } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { addDaysToDate, isValidTimeZone, localDateInTimeZone, weekStartForDate } from '@/lib/dates'
import { getCurrentStreak } from '@/server/readingStreak'
import { normalizeUsernameLookup } from '@/lib/usernames'
import { catalogLanguageSchema } from '@/lib/catalogLanguages'

function shelfOffset(userId: string, today: string, total: number, nonce = 0) {
  let hash = 0
  for (const character of `${userId}:${today}:${nonce}`) {
    hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0
  }
  return Math.abs(hash) % total
}

export const usersRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const { id, username, timezone, preferredLanguage, createdAt } = ctx.activeUser
    return { id, username, timezone, preferredLanguage, createdAt }
  }),

  setTimezone: protectedProcedure
    .input(z.object({ timezone: z.string().refine(isValidTimeZone, 'Use a valid IANA time zone.') }))
    .mutation(async ({ ctx, input }) => {
      const [user] = await db.update(users)
        .set({ timezone: input.timezone, updatedAt: new Date() })
        .where(eq(users.id, ctx.session.user.id))
        .returning({ timezone: users.timezone })
      return user
    }),

  setPreferredLanguage: protectedProcedure
    .input(z.object({ preferredLanguage: catalogLanguageSchema }))
    .mutation(async ({ ctx, input }) => {
      const [user] = await db.update(users)
        .set({ preferredLanguage: input.preferredLanguage, updatedAt: new Date() })
        .where(eq(users.id, ctx.session.user.id))
        .returning({ preferredLanguage: users.preferredLanguage })
      return user
    }),

  stats: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id

    // One grouped count instead of three separate COUNT queries, run in
    // parallel with the two list queries.
    const [statusCounts, recentlyRead, currentlyReadingRows] = await Promise.all([
      db
        .select({ status: userBooks.status, count: count() })
        .from(userBooks)
        .where(eq(userBooks.userId, userId))
        .groupBy(userBooks.status),
      db.query.userBooks.findMany({
        where: and(eq(userBooks.userId, userId), eq(userBooks.status, 'read')),
        with: { book: true },
        orderBy: (ub, { desc }) => [desc(ub.updatedAt)],
        limit: 6,
      }),
      db.query.userBooks.findMany({
        where: and(eq(userBooks.userId, userId), eq(userBooks.status, 'reading')),
        with: { book: true },
        orderBy: (ub, { desc }) => [desc(ub.updatedAt)],
      }),
    ])

    const countFor = (status: string) =>
      Number(statusCounts.find((r) => r.status === status)?.count ?? 0)

    return {
      totalRead: countFor('read'),
      totalReading: countFor('reading'),
      totalWantToRead: countFor('want_to_read'),
      recentlyRead,
      currentlyReading: currentlyReadingRows,
    }
  }),

  dashboard: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id
    const timezone = ctx.activeUser.timezone ?? 'UTC'
    const today = localDateInTimeZone(new Date(), timezone)
    const heatmapStart = addDaysToDate(today, -27)

    const [statusCounts, recentlyRead, currentlyReadingRows, streak, heatmapSessions] = await Promise.all([
      db
        .select({ status: userBooks.status, count: count() })
        .from(userBooks)
        .where(eq(userBooks.userId, userId))
        .groupBy(userBooks.status),
      db.query.userBooks.findMany({
        where: and(eq(userBooks.userId, userId), eq(userBooks.status, 'read')),
        with: { book: true },
        orderBy: (ub, { desc: descending }) => [descending(ub.updatedAt)],
        limit: 6,
      }),
      db.query.userBooks.findMany({
        where: and(eq(userBooks.userId, userId), eq(userBooks.status, 'reading')),
        with: { book: true },
        orderBy: (ub, { desc: descending }) => [descending(ub.updatedAt)],
        limit: 3,
      }),
      getCurrentStreak(userId, today),
      db
        .select({ sessionDate: readingSessions.sessionDate, minutes: readingSessions.minutes, bookId: readingSessions.bookId })
        .from(readingSessions)
        .where(and(eq(readingSessions.userId, userId), gte(readingSessions.sessionDate, heatmapStart))),
    ])

    const countFor = (status: string) =>
      Number(statusCounts.find((row) => row.status === status)?.count ?? 0)
    const totalWantToRead = countFor('want_to_read')
    const heatmap: Record<string, number> = {}
    for (const session of heatmapSessions) {
      heatmap[session.sessionDate] = (heatmap[session.sessionDate] ?? 0) + session.minutes
    }

    const weekStart = weekStartForDate(today)
    const yesterday = addDaysToDate(today, -1)
    const canUseWeeklyFreeze = !ctx.activeUser.weeklyFreezeUsed || ctx.activeUser.freezeWeekStart !== weekStart
    const freezeCandidate = canUseWeeklyFreeze && !heatmap[yesterday]
    const [shelfPick, streakBeforeYesterday, existingFreeze] = await Promise.all([
      totalWantToRead
        ? db.query.userBooks.findFirst({
            where: and(eq(userBooks.userId, userId), eq(userBooks.status, 'want_to_read')),
            with: { book: true },
            orderBy: (ub, { desc: descending }) => [descending(ub.updatedAt)],
            offset: shelfOffset(userId, today, totalWantToRead),
          })
        : Promise.resolve(null),
      freezeCandidate ? getCurrentStreak(userId, addDaysToDate(today, -2)) : Promise.resolve(0),
      freezeCandidate
        ? db.query.streakFreezes.findFirst({
          where: and(eq(streakFreezes.userId, userId), eq(streakFreezes.frozenDate, yesterday)),
          columns: { id: true },
        })
        : Promise.resolve(null),
    ])

    return {
      totalRead: countFor('read'),
      totalReading: countFor('reading'),
      totalWantToRead,
      recentlyRead,
      currentlyReading: currentlyReadingRows,
      shelfPick,
      streak,
      freezeEligible: freezeCandidate && !existingFreeze && streakBeforeYesterday > 0,
      todayDate: today,
      timezone,
      heatmap,
      todayLogged: heatmapSessions
        .filter((session) => session.sessionDate === today)
        .map((session) => session.bookId),
    }
  }),

  shelfPick: protectedProcedure
    .input(z.object({
      nonce: z.number().int().min(0).max(10_000),
      excludedBookId: z.string().uuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const today = localDateInTimeZone(new Date(), ctx.activeUser.timezone ?? 'UTC')
      const conditions = [eq(userBooks.userId, userId), eq(userBooks.status, 'want_to_read')]
      if (input.excludedBookId) conditions.push(ne(userBooks.bookId, input.excludedBookId))
      const [total] = await db
        .select({ count: count() })
        .from(userBooks)
        .where(and(...conditions))
      const totalWantToRead = Number(total?.count ?? 0)
      if (!totalWantToRead) return null

      return db.query.userBooks.findFirst({
        where: and(...conditions),
        with: { book: true },
        orderBy: (ub, { desc: descending }) => [descending(ub.updatedAt)],
        offset: shelfOffset(userId, today, totalWantToRead, input.nonce),
      }) ?? null
    }),

  friendProfile: protectedProcedure
    .input(z.object({
      username: z.string(),
      logOffset: z.number().int().min(0).max(10_000).optional().default(0),
      finishedOffset: z.number().int().min(0).max(10_000).optional().default(0),
      wantToReadOffset: z.number().int().min(0).max(10_000).optional().default(0),
    }))
    .query(async ({ ctx, input }) => {
      const pageSize = 6
      const user = await db.query.users.findFirst({
        where: and(eq(users.usernameNormalized, normalizeUsernameLookup(input.username)), isNull(users.deletedAt)),
        columns: { id: true, username: true, timezone: true },
      })
      if (!user) return null

      if (user.id !== ctx.session.user.id) {
        const relationship = await db.query.friendships.findFirst({
          where: and(
            eq(friendships.status, 'accepted'),
            or(
              and(eq(friendships.requesterId, ctx.session.user.id), eq(friendships.addresseeId, user.id)),
              and(eq(friendships.requesterId, user.id), eq(friendships.addresseeId, ctx.session.user.id)),
            ),
          ),
          columns: { id: true },
        })
        if (!relationship) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Profiles are visible to accepted friends only.' })
        }
      }

      const today = localDateInTimeZone(new Date(), user.timezone ?? 'UTC')
      const heatmapStart = addDaysToDate(today, -(52 * 7 - 1))
      const [statusCounts, currentlyReadingRows, streak, heatmapSessions, logRows, finishedRows, wantToReadRows] = await Promise.all([
        db
          .select({ status: userBooks.status, count: count() })
          .from(userBooks)
          .where(eq(userBooks.userId, user.id))
          .groupBy(userBooks.status),
        db.query.userBooks.findMany({
          where: and(eq(userBooks.userId, user.id), eq(userBooks.status, 'reading')),
          with: { book: { columns: { id: true, openLibraryId: true, title: true, authors: true, coverUrl: true } } },
          orderBy: (ub, { desc }) => [desc(ub.updatedAt)],
          limit: 3,
        }),
        getCurrentStreak(user.id, today),
        db
          .select({ sessionDate: readingSessions.sessionDate, minutes: readingSessions.minutes })
          .from(readingSessions)
          .where(and(
            eq(readingSessions.userId, user.id),
            gte(readingSessions.sessionDate, heatmapStart),
            lte(readingSessions.sessionDate, today),
          )),
        db.query.readingSessions.findMany({
          where: eq(readingSessions.userId, user.id),
          with: { book: { columns: { id: true, openLibraryId: true, title: true, authors: true, coverUrl: true } } },
          orderBy: [desc(readingSessions.sessionDate), desc(readingSessions.createdAt)],
          offset: input.logOffset,
          limit: pageSize + 1,
        }),
        db.query.userBooks.findMany({
          where: and(eq(userBooks.userId, user.id), eq(userBooks.status, 'read')),
          with: { book: { columns: { id: true, openLibraryId: true, title: true, authors: true, coverUrl: true } } },
          orderBy: [desc(userBooks.finishedAt), desc(userBooks.updatedAt)],
          offset: input.finishedOffset,
          limit: pageSize + 1,
        }),
        db.query.userBooks.findMany({
          where: and(eq(userBooks.userId, user.id), eq(userBooks.status, 'want_to_read')),
          with: { book: { columns: { id: true, openLibraryId: true, title: true, authors: true, coverUrl: true } } },
          orderBy: [desc(userBooks.updatedAt)],
          offset: input.wantToReadOffset,
          limit: pageSize + 1,
        }),
      ])

      const countFor = (status: string) =>
        Number(statusCounts.find((row) => row.status === status)?.count ?? 0)

      const heatmap: Record<string, number> = {}
      for (const s of heatmapSessions) {
        heatmap[s.sessionDate] = (heatmap[s.sessionDate] ?? 0) + s.minutes
      }

      return {
        user: { id: user.id, username: user.username },
        totalRead: countFor('read'),
        totalReading: countFor('reading'),
        totalWantToRead: countFor('want_to_read'),
        currentlyReading: currentlyReadingRows.map(({ book }) => ({ book })),
        streak,
        heatmap,
        heatmapEndDate: today,
        logs: {
          entries: logRows.slice(0, pageSize).map((session) => ({
            id: session.id,
            sessionDate: session.sessionDate,
            minutes: session.minutes,
            rating: session.rating,
            note: session.note,
            hasSpoiler: session.hasSpoiler === 1,
            book: session.book,
          })),
          hasMore: logRows.length > pageSize,
        },
        finished: {
          entries: finishedRows.slice(0, pageSize).map((entry) => ({
            id: entry.id,
            rating: entry.rating,
            review: entry.review,
            reviewHasSpoiler: entry.reviewHasSpoiler === 1,
            finishedDate: entry.finishedAt
              ? localDateInTimeZone(entry.finishedAt, user.timezone ?? 'UTC')
              : null,
            book: entry.book,
          })),
          hasMore: finishedRows.length > pageSize,
        },
        wantToRead: {
          entries: wantToReadRows.slice(0, pageSize).map(({ id, book }) => ({ id, book })),
          hasMore: wantToReadRows.length > pageSize,
        },
      }
    }),
})
