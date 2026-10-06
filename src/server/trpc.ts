import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'
import type { Context } from './context'
import { logRequestMetric } from '@/lib/observability'
import { users } from './db'
import { and, eq, isNull } from 'drizzle-orm'

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    if (process.env.NODE_ENV === 'production' && error.code === 'INTERNAL_SERVER_ERROR') {
      return { ...shape, message: 'Something went wrong. Please try again.' }
    }
    return shape
  },
})

export const router = t.router
export const createCallerFactory = t.createCallerFactory
export const publicProcedure = t.procedure.use(async ({ ctx, path, next }) => {
  const startedAt = performance.now()
  try {
    const result = await next()
    logRequestMetric({
      route: path,
      status: result.ok ? 'ok' : 'error',
      durationMs: Math.round(performance.now() - startedAt),
      responseBytes: result.ok ? Buffer.byteLength(JSON.stringify(result.data ?? null)) : 0,
      authMs: ctx.timing?.authMs,
      activeUserMs: ctx.timing?.activeUserMs,
    })
    return result
  } catch (error) {
    logRequestMetric({
      route: path,
      status: 'error',
      durationMs: Math.round(performance.now() - startedAt),
      responseBytes: 0,
      authMs: ctx.timing?.authMs,
      activeUserMs: ctx.timing?.activeUserMs,
    })
    throw error
  }
})
export const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  return next({ ctx: { ...ctx, session: ctx.session! } })
}).use(async ({ ctx, next }) => {
  const user = ctx.activeUser ?? await ctx.db.query.users.findFirst({
    where: and(eq(users.id, ctx.session.user.id), isNull(users.deletedAt)),
  })
  if (!user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  if (user.authVersion !== ctx.session.user.authVersion) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  return next({ ctx: { ...ctx, activeUser: user } })
})
