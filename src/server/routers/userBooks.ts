import { z } from 'zod'
import { router, protectedProcedure } from '../trpc'
import { db, userBooks, books, readingSessions } from '../db'
import { eq, and, sql, desc, asc, count } from 'drizzle-orm'
import { sortByReleaseDate } from '@/lib/sortUserBooks'
import { localDateInTimeZone } from '@/lib/dates'

const statusEnum = z.enum(['want_to_read', 'reading', 'read'])
const LEGACY_GET_ALL_LIMIT = 60

export const userBooksRouter = router({
  upsert: protectedProcedure
    .input(z.object({
      bookId: z.string().uuid(),
      status: statusEnum,
      rating: z.number().min(0.5).max(5).multipleOf(0.5).nullable().optional(),
      review: z.string().max(2000).nullable().optional(),
      reviewHasSpoiler: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const isRead = input.status === 'read'
      const finishedAt = isRead ? new Date() : null
      const reviewHasSpoiler = isRead && Boolean(input.review) && input.reviewHasSpoiler ? 1 : 0

      const [result] = await db
        .insert(userBooks)
        .values({
          userId,
          bookId: input.bookId,
          status: input.status,
          rating: isRead ? input.rating?.toString() ?? null : null,
          review: isRead ? input.review ?? null : null,
          reviewHasSpoiler,
          finishedAt,
        })
        .onConflictDoUpdate({
          target: [userBooks.userId, userBooks.bookId],
          set: {
            status: input.status,
            rating: isRead ? input.rating?.toString() ?? null : null,
            review: isRead ? input.review ?? null : null,
            reviewHasSpoiler,
            finishedAt: isRead
              ? sql`case when ${userBooks.status} = 'read' then ${userBooks.finishedAt} else now() end`
              : null,
            updatedAt: new Date(),
          },
        })
        .returning()

      return result
    }),

  remove: protectedProcedure
    .input(z.object({ bookId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await db.delete(userBooks).where(
        and(
          eq(userBooks.userId, ctx.session.user.id),
          eq(userBooks.bookId, input.bookId)
        )
      )
    }),

  getForBook: protectedProcedure
    .input(z.object({ bookId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return (await db.query.userBooks.findFirst({
        where: and(
          eq(userBooks.userId, ctx.session.user.id),
          eq(userBooks.bookId, input.bookId)
        ),
      })) ?? null
    }),

  getAll: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.session.user.id
      const today = localDateInTimeZone(new Date(), ctx.activeUser.timezone ?? 'UTC')
      const [rows, todaySessions] = await Promise.all([
      db.query.userBooks.findMany({
          where: eq(userBooks.userId, userId),
          with: { book: true },
          orderBy: (ub, { desc: d }) => [d(ub.updatedAt)],
          limit: LEGACY_GET_ALL_LIMIT + 1,
        }),
        db
          .select({ bookId: readingSessions.bookId })
          .from(readingSessions)
          .where(and(
            eq(readingSessions.userId, userId),
            eq(readingSessions.sessionDate, today),
          )),
      ])

      return {
        books: rows.slice(0, LEGACY_GET_ALL_LIMIT),
        todayDate: today,
        todayLogged: todaySessions.map(({ bookId }) => bookId),
        hasMore: rows.length > LEGACY_GET_ALL_LIMIT,
      }
    }),

  library: protectedProcedure
    .input(z.object({
      status: statusEnum.optional(),
      sort: z.enum(['date_added', 'date_released']).optional().default('date_added'),
      author: z.string().min(1).max(200).optional(),
      genre: z.string().min(1).max(200).optional(),
      offset: z.number().int().min(0).max(10_000).optional().default(0),
      limit: z.number().int().min(1).max(60).optional().default(42),
    }).optional())
    .query(async ({ ctx, input }) => {
      const today = localDateInTimeZone(new Date(), ctx.activeUser.timezone ?? 'UTC')
      const filters = [eq(userBooks.userId, ctx.session.user.id)]
      if (input?.status) filters.push(eq(userBooks.status, input.status))
      if (input?.author) filters.push(sql`${books.authors} @> array[${input.author}]::text[]`)
      if (input?.genre) filters.push(sql`${books.genres} @> array[${input.genre}]::text[]`)
      const sort = input?.sort ?? 'date_added'
      const limit = input?.limit ?? 42
      const offset = input?.offset ?? 0
      const [rows, [totalRow], [authorFacet], [genreFacet], todaySessions] = await Promise.all([
        db.select({ userBook: userBooks, book: books })
          .from(userBooks)
          .innerJoin(books, eq(userBooks.bookId, books.id))
          .where(and(...filters))
          .orderBy(...(sort === 'date_released'
            ? [asc(sql`case when ${books.publishedDate} is null then 1 else 0 end`), asc(books.publishedDate), desc(userBooks.updatedAt)]
            : [desc(userBooks.updatedAt)]))
          .limit(limit)
          .offset(offset),
        db.select({ count: count() }).from(userBooks).innerJoin(books, eq(userBooks.bookId, books.id)).where(and(...filters)),
        db.execute(sql<{ values: string[] }>`
          select coalesce(array_agg(distinct author order by author), array[]::text[]) as values
          from user_books ub
          inner join books b on b.id = ub.book_id
          cross join lateral unnest(b.authors) as author
          where ub.user_id = ${ctx.session.user.id}
        `),
        db.execute(sql<{ values: string[] }>`
          select coalesce(array_agg(distinct genre order by genre), array[]::text[]) as values
          from user_books ub
          inner join books b on b.id = ub.book_id
          cross join lateral unnest(b.genres) as genre
          where ub.user_id = ${ctx.session.user.id}
        `),
        db
          .select({ bookId: readingSessions.bookId })
          .from(readingSessions)
          .where(and(
            eq(readingSessions.userId, ctx.session.user.id),
            eq(readingSessions.sessionDate, today),
          )),
      ])

      return {
        books: rows.map(({ userBook, book }) => ({ ...userBook, book })),
        total: Number(totalRow?.count ?? 0),
        authors: (authorFacet as { values?: string[] } | undefined)?.values ?? [],
        genres: (genreFacet as { values?: string[] } | undefined)?.values ?? [],
        hasMore: offset + rows.length < Number(totalRow?.count ?? 0),
        todayDate: today,
        todayLogged: todaySessions.map(({ bookId }) => bookId),
      }
    }),

  myAuthors: protectedProcedure.query(async ({ ctx }) => {
    const data = await db.query.userBooks.findMany({
      where: eq(userBooks.userId, ctx.session.user.id),
      with: { book: { columns: { authors: true } } },
    })
    const all = data.flatMap(d => d.book.authors)
    return [...new Set(all)].sort()
  }),

  myGenres: protectedProcedure.query(async ({ ctx }) => {
    const data = await db.query.userBooks.findMany({
      where: eq(userBooks.userId, ctx.session.user.id),
      with: { book: { columns: { genres: true } } },
    })
    const all = data.flatMap(d => d.book.genres)
    return [...new Set(all)].sort()
  }),
})
