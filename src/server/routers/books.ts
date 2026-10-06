import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc'
import { openLibraryIdSchema, searchWorks } from '@/lib/openlibrary'
import { cacheSearchWorks, getOrCreateBook, searchCachedBooks } from '../books'
import { db, books } from '../db'
import { eq } from 'drizzle-orm'
import { rateLimit, rateLimitKey } from '@/lib/rateLimit'

export const booksRouter = router({
  search: protectedProcedure
    .input(z.object({ query: z.string().trim().min(2).max(200) }))
    .query(async ({ ctx, input }) => {
      const budget = await rateLimit(rateLimitKey('open-library:search:user', ctx.session.user.id), 30, 60_000)
      if (!budget.ok) throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Please wait a moment before searching again.' })
      try {
        const works = await searchWorks(input.query, ctx.activeUser.preferredLanguage)
        await cacheSearchWorks(works)
        return { works, unavailable: false }
      } catch (err) {
        try {
          return { works: await searchCachedBooks(input.query), unavailable: true }
        } catch {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Book search is temporarily unavailable. Please try again.',
            cause: err,
          })
        }
      }
    }),

  getOrCreate: protectedProcedure
    .input(z.object({ openLibraryId: openLibraryIdSchema }))
    .mutation(async ({ ctx, input }) => {
      const budget = await rateLimit(rateLimitKey('open-library:detail:user', ctx.session.user.id), 20, 60_000)
      if (!budget.ok) throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Please wait a moment before opening another book.' })
      const book = await getOrCreateBook(input.openLibraryId)
      if (!book) throw new TRPCError({ code: 'NOT_FOUND', message: 'Book not found' })
      return book
    }),

  getById: protectedProcedure
    .input(z.object({ openLibraryId: openLibraryIdSchema }))
    .query(async ({ input }) => {
      return (await db.query.books.findFirst({
        where: eq(books.openLibraryId, input.openLibraryId),
      })) ?? null
    }),
})
