import { z } from 'zod'
import { router, protectedProcedure } from '../trpc'
import { db, books, readingSessions, friendships, streakFreezes, userBooks, users } from '../db'
import { eq, and, desc, inArray, or, gte, isNull, lte, ne, sql, count } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { getCurrentStreak } from '@/server/readingStreak'
import { addDaysToDate, isValidDateOnly, localDateInTimeZone, weekStartForDate } from '@/lib/dates'

// Upper bound for a single session's minutes. The slider tops out at 3h;
// the number input allows up to a full day.
const MAX_SESSION_MINUTES = 1440

export const readingSessionsRouter = router({
  log: protectedProcedure
    .input(z.object({
      bookId: z.string().uuid(),
      sessionDate: z.string().refine(isValidDateOnly, 'Use a valid calendar date.'),
      rating: z.number().min(0.5).max(5).multipleOf(0.5),
      minutes: z.number().int().min(1).max(MAX_SESSION_MINUTES),
      note: z.string().max(1000).optional(),
      hasSpoiler: z.boolean().default(false),
      expectedRevision: z.number().int().min(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const today = localDateInTimeZone(new Date(), ctx.activeUser.timezone ?? 'UTC')
      if (input.sessionDate > today) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'A reading session cannot be in the future.' })
      }
      const libraryEntry = await db.query.userBooks.findFirst({
        where: and(eq(userBooks.userId, userId), eq(userBooks.bookId, input.bookId)),
        columns: { id: true },
      })
      if (!libraryEntry) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Add this book to your library before logging a session.' })
      }
      const [session] = await db
        .insert(readingSessions)
        .values({
          userId,
          bookId: input.bookId,
          sessionDate: input.sessionDate,
          rating: String(input.rating),
          minutes: input.minutes,
          note: input.note ?? null,
          hasSpoiler: input.hasSpoiler ? 1 : 0,
        })
        .onConflictDoUpdate({
          target: [readingSessions.userId, readingSessions.bookId, readingSessions.sessionDate],
          set: {
            rating: String(input.rating),
            minutes: input.minutes,
            note: input.note ?? null,
            hasSpoiler: input.hasSpoiler ? 1 : 0,
            revision: sql`${readingSessions.revision} + 1`,
          },
          where: eq(readingSessions.revision, input.expectedRevision),
        })
        .returning()
      if (!session) {
        throw new TRPCError({ code: 'CONFLICT', message: 'This entry was changed in another tab.' })
      }
      const [streak, todaySessions, loggedDateSessions] = await Promise.all([
        getCurrentStreak(userId, today),
        db.select({ bookId: readingSessions.bookId, minutes: readingSessions.minutes })
          .from(readingSessions)
          .where(and(eq(readingSessions.userId, userId), eq(readingSessions.sessionDate, today))),
        db.select({ minutes: readingSessions.minutes })
          .from(readingSessions)
          .where(and(eq(readingSessions.userId, userId), eq(readingSessions.sessionDate, input.sessionDate))),
      ])
      return {
        ...session,
        session,
        streak,
        todayDate: today,
        heatmapStart: addDaysToDate(today, -27),
        todayLogged: todaySessions.map((item) => item.bookId),
        todayMinutes: todaySessions.reduce((total, item) => total + item.minutes, 0),
        sessionDateMinutes: loggedDateSessions.reduce((total, item) => total + item.minutes, 0),
      }
    }),

  forBook: protectedProcedure
    .input(z.object({ bookId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return db.query.readingSessions.findMany({
        where: and(
          eq(readingSessions.userId, ctx.session.user.id),
          eq(readingSessions.bookId, input.bookId),
        ),
        orderBy: [desc(readingSessions.sessionDate)],
      })
    }),

  forBookDate: protectedProcedure
    .input(z.object({
      bookId: z.string().uuid(),
      sessionDate: z.string().refine(isValidDateOnly, 'Use a valid calendar date.'),
    }))
    .query(async ({ ctx, input }) => {
      const session = await db.query.readingSessions.findFirst({
        where: and(
          eq(readingSessions.userId, ctx.session.user.id),
          eq(readingSessions.bookId, input.bookId),
          eq(readingSessions.sessionDate, input.sessionDate),
        ),
      })
      return session ?? null
    }),

  myStreak: protectedProcedure
    .query(async ({ ctx }) => {
      const today = localDateInTimeZone(new Date(), ctx.activeUser.timezone ?? 'UTC')

      const streak = await getCurrentStreak(ctx.session.user.id, today)

      const weekStart = weekStartForDate(today)
      const freezeAvailable = !ctx.activeUser.weeklyFreezeUsed || ctx.activeUser.freezeWeekStart !== weekStart

      return { streak, freezeAvailable, timezone: ctx.activeUser.timezone ?? 'UTC' }
    }),

  myHeatmap: protectedProcedure
    .query(async ({ ctx }) => {
      const today = localDateInTimeZone(new Date(), ctx.activeUser.timezone ?? 'UTC')
      const startDate = addDaysToDate(today, -(52 * 7 - 1))
      const sessions = await db
        .select({ sessionDate: readingSessions.sessionDate, minutes: readingSessions.minutes })
        .from(readingSessions)
        .where(and(
          eq(readingSessions.userId, ctx.session.user.id),
          gte(readingSessions.sessionDate, startDate),
          lte(readingSessions.sessionDate, today),
        ))

      const heatmap: Record<string, number> = {}
      for (const s of sessions) {
        heatmap[s.sessionDate] = (heatmap[s.sessionDate] ?? 0) + s.minutes
      }
      return heatmap
    }),

  todayLogged: protectedProcedure
    .query(async ({ ctx }) => {
      const today = localDateInTimeZone(new Date(), ctx.activeUser.timezone ?? 'UTC')
      const sessions = await db.query.readingSessions.findMany({
        where: and(
          eq(readingSessions.userId, ctx.session.user.id),
          eq(readingSessions.sessionDate, today),
        ),
      })
      return sessions.map((s) => s.bookId)
    }),

  myRecent: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(50) }))
    .query(async ({ ctx, input }) => {
      return db.query.readingSessions.findMany({
        where: eq(readingSessions.userId, ctx.session.user.id),
        with: { book: true },
        orderBy: [desc(readingSessions.sessionDate), desc(readingSessions.createdAt)],
        limit: input.limit,
      })
    }),

  journal: protectedProcedure
    .input(z.object({ offset: z.number().int().min(0).max(10_000).optional().default(0) }).optional())
    .query(async ({ ctx, input }) => {
      const timezone = ctx.activeUser.timezone ?? 'UTC'
      const today = localDateInTimeZone(new Date(), timezone)
      const year = Number(today.slice(0, 4))
      const month = Number(today.slice(5, 7))
      const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
      const monthEnd = `${year}-${String(month).padStart(2, '0')}-31`
      const yearStart = `${year}-01-01`
      const yearEnd = `${year}-12-31`
      const heatmapStart = addDaysToDate(today, -(52 * 7 - 1))
      const [streak, recent, monthlySessions, yearSessions, heatmapSessions] = await Promise.all([
        getCurrentStreak(ctx.session.user.id, today),
        db.query.readingSessions.findMany({
          where: eq(readingSessions.userId, ctx.session.user.id),
          with: { book: true },
          orderBy: [desc(readingSessions.sessionDate), desc(readingSessions.createdAt)],
          limit: 51,
          offset: input?.offset ?? 0,
        }),
        db.query.readingSessions.findMany({
          where: and(
            eq(readingSessions.userId, ctx.session.user.id),
            gte(readingSessions.sessionDate, monthStart),
            lte(readingSessions.sessionDate, monthEnd),
          ),
          with: { book: true },
        }),
        db.query.readingSessions.findMany({
          where: and(
            eq(readingSessions.userId, ctx.session.user.id),
            gte(readingSessions.sessionDate, yearStart),
            lte(readingSessions.sessionDate, yearEnd),
          ),
          with: { book: true },
        }),
        db
          .select({ sessionDate: readingSessions.sessionDate, minutes: readingSessions.minutes })
          .from(readingSessions)
          .where(and(
            eq(readingSessions.userId, ctx.session.user.id),
            gte(readingSessions.sessionDate, heatmapStart),
            lte(readingSessions.sessionDate, today),
          )),
      ])

      const summarize = (rows: typeof monthlySessions) => {
        const byBook = new Map<string, { book: typeof monthlySessions[number]['book'], totalMinutes: number, ratings: number[] }>()
        const byAuthor = new Map<string, number>()
        let totalMinutes = 0
        for (const session of rows) {
          totalMinutes += session.minutes
          const existing = byBook.get(session.bookId)
          if (existing) {
            existing.totalMinutes += session.minutes
            existing.ratings.push(Number(session.rating))
          } else {
            byBook.set(session.bookId, {
              book: session.book,
              totalMinutes: session.minutes,
              ratings: [Number(session.rating)],
            })
          }
          for (const author of session.book.authors ?? []) {
            byAuthor.set(author, (byAuthor.get(author) ?? 0) + session.minutes)
          }
        }
        const bookStats = [...byBook.values()].map((book) => ({
          book: book.book,
          totalMinutes: book.totalMinutes,
          avgRating: book.ratings.reduce((sum, rating) => sum + rating, 0) / book.ratings.length,
        }))
        return {
          totalMinutes,
          totalSessions: rows.length,
          avgRating: rows.length
            ? rows.reduce((sum, session) => sum + Number(session.rating), 0) / rows.length
            : 0,
          daysRead: new Set(rows.map((session) => session.sessionDate)).size,
          distinctBooks: byBook.size,
          topByTime: [...bookStats].sort((a, b) => b.totalMinutes - a.totalMinutes).slice(0, 5),
          topByRating: [...bookStats].sort((a, b) => b.avgRating - a.avgRating).slice(0, 5),
          topAuthors: [...byAuthor.entries()]
            .map(([name, minutes]) => ({ name, totalMinutes: minutes }))
            .sort((a, b) => b.totalMinutes - a.totalMinutes)
            .slice(0, 3),
        }
      }

      const heatmap: Record<string, number> = {}
      for (const session of heatmapSessions) {
        heatmap[session.sessionDate] = (heatmap[session.sessionDate] ?? 0) + session.minutes
      }

      return {
        streak,
        timezone,
        heatmap,
        recent: recent.slice(0, 50),
        hasMoreRecent: recent.length > 50,
        monthlyStats: summarize(monthlySessions),
        yearStats: summarize(yearSessions),
      }
    }),

  friendFeed: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(6).default(4) }))
    .query(async ({ ctx, input }) => {
      const me = ctx.session.user.id
      const digestStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

      const friends = await db.query.friendships.findMany({
        where: and(
          eq(friendships.status, 'accepted'),
          or(
            eq(friendships.requesterId, me),
            eq(friendships.addresseeId, me),
          ),
        ),
        columns: { requesterId: true, addresseeId: true },
      })

      const friendIds = friends
        .map((f) => (f.requesterId === me ? f.addresseeId : f.requesterId))
        .filter(Boolean)

      if (friendIds.length === 0) return []

      const [sessionActivity, completedBooks] = await Promise.all([
        db.select({
          id: readingSessions.id,
          sessionDate: readingSessions.sessionDate,
          createdAt: readingSessions.createdAt,
          minutes: readingSessions.minutes,
          rating: readingSessions.rating,
          note: readingSessions.note,
          hasSpoiler: readingSessions.hasSpoiler,
          user: { username: users.username },
          book: {
            openLibraryId: books.openLibraryId,
            title: books.title,
          },
        })
          .from(readingSessions)
          .innerJoin(users, eq(readingSessions.userId, users.id))
          .innerJoin(books, eq(readingSessions.bookId, books.id))
          .where(and(
            inArray(readingSessions.userId, friendIds),
            isNull(users.deletedAt),
          ))
          .orderBy(desc(readingSessions.createdAt), desc(readingSessions.id))
          .limit(input.limit),
        db.select({
          id: userBooks.id,
          finishedAt: userBooks.finishedAt,
          updatedAt: userBooks.updatedAt,
          rating: userBooks.rating,
          review: userBooks.review,
          reviewHasSpoiler: userBooks.reviewHasSpoiler,
          user: { username: users.username, timezone: users.timezone },
          book: {
            openLibraryId: books.openLibraryId,
            title: books.title,
          },
        })
          .from(userBooks)
          .innerJoin(users, eq(userBooks.userId, users.id))
          .innerJoin(books, eq(userBooks.bookId, books.id))
          .where(and(
            inArray(userBooks.userId, friendIds),
            eq(userBooks.status, 'read'),
            isNull(users.deletedAt),
          ))
          .orderBy(desc(userBooks.updatedAt), desc(userBooks.id))
          .limit(input.limit),
      ])

      return [
        ...sessionActivity.map((session) => ({
          kind: 'session' as const,
          activityId: session.id,
          activityTimestamp: session.createdAt,
          activityDate: session.sessionDate,
          minutes: session.minutes,
          rating: session.rating,
          note: session.note,
          hasSpoiler: session.hasSpoiler === 1,
          user: session.user,
          book: session.book,
        })),
        ...completedBooks.map((entry) => ({
          kind: 'finished' as const,
          activityId: entry.id,
          activityTimestamp: entry.finishedAt ?? entry.updatedAt,
          activityDate: localDateInTimeZone(entry.finishedAt ?? entry.updatedAt, entry.user.timezone ?? 'UTC'),
          rating: entry.rating,
          review: entry.review,
          reviewHasSpoiler: entry.reviewHasSpoiler === 1,
          user: { username: entry.user.username },
          book: entry.book,
        })),
      ]
        .filter((entry) => entry.activityTimestamp >= digestStart)
        .sort((a, b) => {
          const byTimestamp = b.activityTimestamp.getTime() - a.activityTimestamp.getTime()
          if (byTimestamp !== 0) return byTimestamp
          const byKind = a.kind.localeCompare(b.kind)
          if (byKind !== 0) return byKind
          return a.activityId.localeCompare(b.activityId)
        })
        .slice(0, input.limit)
        .map(({ activityTimestamp: _activityTimestamp, ...activity }) => activity)
    }),

  monthlyStats: protectedProcedure
    .input(z.object({
      year: z.number(),
      month: z.number().min(1).max(12),
    }))
    .query(async ({ ctx, input }) => {
      const { year, month } = input
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const endDate = `${year}-${String(month).padStart(2, '0')}-31`

      const sessions = await db.query.readingSessions.findMany({
        where: and(
          eq(readingSessions.userId, ctx.session.user.id),
          gte(readingSessions.sessionDate, startDate),
          lte(readingSessions.sessionDate, endDate),
        ),
        with: { book: true },
      })

      const totalMinutes = sessions.reduce((sum, s) => sum + s.minutes, 0)
      const avgRating = sessions.length
        ? sessions.reduce((sum, s) => sum + Number(s.rating), 0) / sessions.length
        : 0

      const byBook = new Map<string, { book: typeof sessions[0]['book'], totalMinutes: number, ratings: number[] }>()
      for (const s of sessions) {
        const existing = byBook.get(s.bookId)
        if (existing) {
          existing.totalMinutes += s.minutes
          existing.ratings.push(Number(s.rating))
        } else {
          byBook.set(s.bookId, { book: s.book, totalMinutes: s.minutes, ratings: [Number(s.rating)] })
        }
      }

      const bookStats = [...byBook.values()].map(b => ({
        book: b.book,
        totalMinutes: b.totalMinutes,
        avgRating: b.ratings.reduce((a, v) => a + v, 0) / b.ratings.length,
      }))

      const topByTime = [...bookStats].sort((a, b) => b.totalMinutes - a.totalMinutes).slice(0, 5)
      const topByRating = [...bookStats].sort((a, b) => b.avgRating - a.avgRating).slice(0, 5)

      return { totalMinutes, avgRating, topByTime, topByRating }
    }),

  periodStats: protectedProcedure
    .input(z.object({ period: z.enum(['month', 'year', 'all']) }))
    .query(async ({ ctx, input }) => {
      const today = localDateInTimeZone(new Date(), ctx.activeUser.timezone ?? 'UTC')
      const year = Number(today.slice(0, 4))
      const month = Number(today.slice(5, 7))

      const conditions = [eq(readingSessions.userId, ctx.session.user.id)]
      if (input.period === 'month') {
        conditions.push(gte(readingSessions.sessionDate, `${year}-${String(month).padStart(2, '0')}-01`))
        conditions.push(lte(readingSessions.sessionDate, `${year}-${String(month).padStart(2, '0')}-31`))
      } else if (input.period === 'year') {
        conditions.push(gte(readingSessions.sessionDate, `${year}-01-01`))
        conditions.push(lte(readingSessions.sessionDate, `${year}-12-31`))
      }

      const authorDateFilter = input.period === 'month'
        ? sql`and rs.session_date >= ${`${year}-${String(month).padStart(2, '0')}-01`} and rs.session_date <= ${`${year}-${String(month).padStart(2, '0')}-31`}`
        : input.period === 'year'
          ? sql`and rs.session_date >= ${`${year}-01-01`} and rs.session_date <= ${`${year}-12-31`}`
          : sql``
      const [[summary], topByTime, topByRating, topAuthors] = await Promise.all([
        db.select({
          totalMinutes: sql<number>`coalesce(sum(${readingSessions.minutes}), 0)::int`,
          totalSessions: count(),
          avgRating: sql<number>`coalesce(avg(${readingSessions.rating}), 0)`,
          daysRead: sql<number>`count(distinct ${readingSessions.sessionDate})`,
          distinctBooks: sql<number>`count(distinct ${readingSessions.bookId})`,
        }).from(readingSessions).where(and(...conditions)),
        db.select({
          book: books,
          totalMinutes: sql<number>`sum(${readingSessions.minutes})::int`,
          avgRating: sql<number>`avg(${readingSessions.rating})`,
        }).from(readingSessions).innerJoin(books, eq(readingSessions.bookId, books.id))
          .where(and(...conditions)).groupBy(books.id).orderBy(desc(sql`sum(${readingSessions.minutes})`)).limit(5),
        db.select({
          book: books,
          totalMinutes: sql<number>`sum(${readingSessions.minutes})::int`,
          avgRating: sql<number>`avg(${readingSessions.rating})`,
        }).from(readingSessions).innerJoin(books, eq(readingSessions.bookId, books.id))
          .where(and(...conditions)).groupBy(books.id).orderBy(desc(sql`avg(${readingSessions.rating})`)).limit(5),
        db.execute(sql<{ name: string; totalMinutes: number }>`
          select author as name, sum(rs.minutes)::int as "totalMinutes"
          from reading_sessions rs
          inner join books b on b.id = rs.book_id
          cross join lateral unnest(b.authors) as author
          where rs.user_id = ${ctx.session.user.id} ${authorDateFilter}
          group by author
          order by sum(rs.minutes) desc
          limit 3
        `),
      ])

      return {
        totalMinutes: Number(summary?.totalMinutes ?? 0),
        totalSessions: Number(summary?.totalSessions ?? 0),
        avgRating: Number(summary?.avgRating ?? 0),
        daysRead: Number(summary?.daysRead ?? 0),
        distinctBooks: Number(summary?.distinctBooks ?? 0),
        topByTime: topByTime.map((row) => ({ ...row, totalMinutes: Number(row.totalMinutes), avgRating: Number(row.avgRating) })),
        topByRating: topByRating.map((row) => ({ ...row, totalMinutes: Number(row.totalMinutes), avgRating: Number(row.avgRating) })),
        topAuthors: (topAuthors as unknown as Array<{ name: string; totalMinutes: number }>).map((row) => ({ ...row, totalMinutes: Number(row.totalMinutes) })),
      }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(readingSessions)
        .where(
          and(
            eq(readingSessions.id, input.id),
            eq(readingSessions.userId, ctx.session.user.id),
          ),
        )
      return { success: true }
    }),

  applyWeeklyFreeze: protectedProcedure
    .mutation(async ({ ctx }) => {
      const today = localDateInTimeZone(new Date(), ctx.activeUser.timezone ?? 'UTC')
      const yesterday = addDaysToDate(today, -1)
      const dayBeforeYesterday = addDaysToDate(today, -2)
      const weekStart = weekStartForDate(today)
      const userId = ctx.session.user.id
      const [[existingSession], [existingFreeze], streak] = await Promise.all([
        db
          .select()
          .from(readingSessions)
          .where(and(
            eq(readingSessions.userId, userId),
            eq(readingSessions.sessionDate, yesterday),
          ))
          .limit(1),
        db
          .select()
          .from(streakFreezes)
          .where(and(
            eq(streakFreezes.userId, userId),
            eq(streakFreezes.frozenDate, yesterday),
          ))
          .limit(1),
        getCurrentStreak(userId, dayBeforeYesterday),
      ])
      if (existingSession || existingFreeze) {
        return { applied: false, reason: 'Yesterday already has reading activity.' }
      }
      if (streak < 1) {
        return { applied: false, reason: 'There is no active streak to protect.' }
      }

      try {
        await db.transaction(async (tx) => {
          const [inserted] = await tx.insert(streakFreezes)
            .values({ userId, frozenDate: yesterday })
            .onConflictDoNothing()
            .returning({ id: streakFreezes.id })
          if (!inserted) {
            throw new Error('FREEZE_ALREADY_APPLIED')
          }
          const [updated] = await tx.update(users)
            .set({ weeklyFreezeUsed: 1, freezeWeekStart: weekStart, updatedAt: new Date() })
            .where(and(
              eq(users.id, userId),
              or(eq(users.weeklyFreezeUsed, 0), ne(users.freezeWeekStart, weekStart)),
            ))
            .returning({ id: users.id })
          if (!updated) {
            throw new Error('FREEZE_UNAVAILABLE')
          }
        })
      } catch (error) {
        if (error instanceof Error && (error.message === 'FREEZE_ALREADY_APPLIED' || error.message === 'FREEZE_UNAVAILABLE')) {
          return { applied: false, reason: 'Your weekly freeze is not available.' }
        }
        throw error
      }

      return { applied: true, reason: null }
    }),
})
