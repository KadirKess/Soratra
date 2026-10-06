import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc'
import { db, friendships, users } from '../db'
import { eq, and, isNull, or } from 'drizzle-orm'
import { rateLimit, rateLimitKey } from '@/lib/rateLimit'
import { isValidUsername, normalizeUsernameLookup } from '@/lib/usernames'
import { socialAudit } from '@/lib/socialAudit'

const FRIEND_REQUEST_WINDOW_MS = 24 * 60 * 60_000

function throwRequestLimit(retryAfter: number, actorId: string, subjectId: string) {
  socialAudit('request_rate_limited', actorId, subjectId)
  throw new TRPCError({
    code: 'TOO_MANY_REQUESTS',
    message: `Too many friend requests. Try again in ${retryAfter} seconds.`,
  })
}

export const friendshipsRouter = router({
  findByUsername: protectedProcedure
    .input(z.object({ username: z.string().min(1).max(31) }))
    .query(async ({ ctx, input }) => {
      const username = normalizeUsernameLookup(input.username)
      if (!isValidUsername(username)) return null

      const reader = await db.query.users.findFirst({
        where: and(eq(users.usernameNormalized, username), isNull(users.deletedAt)),
        columns: { id: true, username: true },
      })
      if (!reader || reader.id === ctx.session.user.id) return null
      return reader
    }),

  sendRequest: protectedProcedure
    .input(z.object({ addresseeId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const me = ctx.session.user.id
      if (me === input.addresseeId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot send friend request to yourself' })
      }
      const addressee = await db.query.users.findFirst({
        where: and(eq(users.id, input.addresseeId), isNull(users.deletedAt)),
        columns: { id: true },
      })
      if (!addressee) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Reader not found' })
      }

      const existing = await db.query.friendships.findFirst({
        where: or(
          and(eq(friendships.requesterId, me), eq(friendships.addresseeId, input.addresseeId)),
          and(eq(friendships.requesterId, input.addresseeId), eq(friendships.addresseeId, me)),
        ),
      })

      if (existing?.status === 'accepted') {
        socialAudit('request_conflict', me, input.addresseeId)
        throw new TRPCError({ code: 'CONFLICT', message: 'You are already friends' })
      }
      if (existing?.requesterId === me) {
        socialAudit('request_conflict', me, input.addresseeId)
        throw new TRPCError({ code: 'CONFLICT', message: 'Friend request already sent' })
      }
      if (existing) {
        socialAudit('request_conflict', me, input.addresseeId)
        throw new TRPCError({ code: 'CONFLICT', message: 'This reader has already sent you a request' })
      }

      const senderLimit = await rateLimit(rateLimitKey('friend-request:sender', me), 10, FRIEND_REQUEST_WINDOW_MS)
      if (!senderLimit.ok) throwRequestLimit(senderLimit.retryAfter, me, input.addresseeId)
      const recipientLimit = await rateLimit(rateLimitKey('friend-request:recipient', input.addresseeId), 20, FRIEND_REQUEST_WINDOW_MS)
      if (!recipientLimit.ok) throwRequestLimit(recipientLimit.retryAfter, me, input.addresseeId)

      let friendship
      try {
        [friendship] = await db
          .insert(friendships)
          .values({ requesterId: me, addresseeId: input.addresseeId, status: 'pending' })
          .returning()
      } catch (error) {
        if (typeof error === 'object' && error && 'code' in error && error.code === '23505') {
          socialAudit('request_conflict', me, input.addresseeId)
          throw new TRPCError({ code: 'CONFLICT', message: 'Friend request already exists' })
        }
        throw error
      }

      if (!friendship) {
        socialAudit('request_conflict', me, input.addresseeId)
        throw new TRPCError({ code: 'CONFLICT', message: 'Friend request already exists' })
      }

      socialAudit('request_created', me, input.addresseeId)
      return friendship
    }),

  accept: protectedProcedure
    .input(z.object({ requesterId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const me = ctx.session.user.id
      const [updated] = await db
        .update(friendships)
        .set({ status: 'accepted', updatedAt: new Date() })
        .where(
          and(
            eq(friendships.requesterId, input.requesterId),
            eq(friendships.addresseeId, me),
            eq(friendships.status, 'pending'),
          ),
        )
        .returning()

      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Friend request not found' })
      }

      socialAudit('request_accepted', me, input.requesterId)
      return updated
    }),

  decline: protectedProcedure
    .input(z.object({ requesterId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const me = ctx.session.user.id
      const deleted = await db
        .delete(friendships)
        .where(
          and(
            eq(friendships.requesterId, input.requesterId),
            eq(friendships.addresseeId, me),
            eq(friendships.status, 'pending'),
          ),
        )
        .returning({ id: friendships.id })

      if (!deleted[0]) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Friend request not found' })
      }
      socialAudit('request_declined', me, input.requesterId)
    }),

  cancelSentRequest: protectedProcedure
    .input(z.object({ addresseeId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const me = ctx.session.user.id
      const deleted = await db
        .delete(friendships)
        .where(and(
          eq(friendships.requesterId, me),
          eq(friendships.addresseeId, input.addresseeId),
          eq(friendships.status, 'pending'),
        ))
        .returning({ id: friendships.id })

      if (!deleted[0]) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Sent friend request not found' })
      }
      socialAudit('request_cancelled', me, input.addresseeId)
    }),

  remove: protectedProcedure
    .input(z.object({ friendId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const me = ctx.session.user.id
      const deleted = await db
        .delete(friendships)
        .where(and(
          or(
            and(eq(friendships.requesterId, me), eq(friendships.addresseeId, input.friendId)),
            and(eq(friendships.requesterId, input.friendId), eq(friendships.addresseeId, me)),
          ),
          eq(friendships.status, 'accepted'),
        ))
        .returning({ id: friendships.id })

      if (!deleted[0]) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Connection not found' })
      }
      socialAudit('friend_removed', me, input.friendId)
    }),

  list: protectedProcedure
    .query(async ({ ctx }) => {
      const me = ctx.session.user.id
      const rows = await db.query.friendships.findMany({
        where: and(
          eq(friendships.status, 'accepted'),
          or(eq(friendships.requesterId, me), eq(friendships.addresseeId, me)),
        ),
        with: {
          requester: { columns: { id: true, username: true } },
          addressee: { columns: { id: true, username: true } },
        },
      })
      return rows.map((friendship) => ({
        friend: friendship.requesterId === me ? friendship.addressee : friendship.requester,
      }))
    }),

  pendingReceived: protectedProcedure
    .query(async ({ ctx }) => {
      const me = ctx.session.user.id
      const rows = await db.query.friendships.findMany({
        where: and(eq(friendships.addresseeId, me), eq(friendships.status, 'pending')),
        with: { requester: { columns: { id: true, username: true } } },
      })
      return rows.map((request) => ({ requester: request.requester }))
    }),

  pendingSent: protectedProcedure
    .query(async ({ ctx }) => {
      const me = ctx.session.user.id
      const rows = await db.query.friendships.findMany({
        where: and(eq(friendships.requesterId, me), eq(friendships.status, 'pending')),
        with: { addressee: { columns: { id: true, username: true } } },
      })
      return rows.map((request) => ({ addressee: request.addressee }))
    }),

  summary: protectedProcedure
    .query(async ({ ctx }) => {
      const pending = await db.query.friendships.findMany({
        where: and(eq(friendships.addresseeId, ctx.session.user.id), eq(friendships.status, 'pending')),
        with: { requester: { columns: { id: true } } },
      })
      return { pendingReceivedCount: pending.filter((request) => request.requester).length }
    }),

  statusWith: protectedProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const me = ctx.session.user.id
      const friendship = await db.query.friendships.findFirst({
        where: or(
          and(eq(friendships.requesterId, me), eq(friendships.addresseeId, input.userId)),
          and(eq(friendships.requesterId, input.userId), eq(friendships.addresseeId, me)),
        ),
      })
      if (!friendship) return { status: 'none' as const }
      if (friendship.status === 'accepted') return { status: 'friends' as const }
      if (friendship.requesterId === me) return { status: 'sent' as const }
      return { status: 'received' as const }
    }),

})
