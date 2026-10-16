import { z } from 'zod'
import { and, asc, desc, eq, gt, isNull, isNotNull, or } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { router, adminProcedure } from '../trpc'
import { db, instanceSettings, invites, users } from '../db'
import { createInviteToken, createPasswordResetToken } from '../tokens'

// The admin sees usernames and join dates only, never anyone's reading data.
export const adminRouter = router({
  overview: adminProcedure.query(async () => {
    const now = new Date()
    const [settings, members, inviteRows] = await Promise.all([
      db.query.instanceSettings.findFirst({ where: eq(instanceSettings.id, 1) }),
      db.query.users.findMany({
        where: isNull(users.deletedAt),
        columns: { id: true, username: true, isAdmin: true, createdAt: true },
        orderBy: [desc(users.isAdmin), asc(users.createdAt)],
      }),
      db.query.invites.findMany({
        where: or(and(isNull(invites.usedAt), gt(invites.expiresAt, now)), isNotNull(invites.usedAt)),
        orderBy: [desc(invites.createdAt)],
        limit: 50,
      }),
    ])
    const usernames = new Map(members.map((member) => [member.id, member.username]))
    return {
      settings: {
        operatorName: settings?.operatorName ?? '',
        contact: settings?.contact ?? '',
        registration: (settings?.registration ?? 'invite') as 'invite' | 'open',
      },
      members,
      pendingInvites: inviteRows
        .filter((invite) => !invite.usedAt)
        .map(({ id, createdAt, expiresAt }) => ({ id, createdAt, expiresAt })),
      acceptedInvites: inviteRows
        .filter((invite) => invite.usedAt)
        .map(({ id, usedAt, usedBy }) => ({ id, usedAt: usedAt!, username: usedBy ? usernames.get(usedBy) ?? null : null })),
    }
  }),

  updateSettings: adminProcedure
    .input(z.object({
      operatorName: z.string().trim().max(80, 'Keep the name under 80 characters.'),
      contact: z.string().trim().max(200, 'Keep the contact under 200 characters.'),
      registration: z.enum(['invite', 'open']),
    }))
    .mutation(async ({ input }) => {
      await db.update(instanceSettings)
        .set({
          operatorName: input.operatorName || null,
          contact: input.contact || null,
          registration: input.registration,
          updatedAt: new Date(),
        })
        .where(eq(instanceSettings.id, 1))
      return { ok: true }
    }),

  createInvite: adminProcedure.mutation(async ({ ctx }) => {
    const { path, expiresAt } = await createInviteToken(db, ctx.activeUser.id)
    return { path, expiresAt }
  }),

  revokeInvite: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await db.delete(invites).where(and(eq(invites.id, input.id), isNull(invites.usedAt)))
      return { ok: true }
    }),

  createResetLink: adminProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.activeUser.id) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Change your own password from your profile.' })
      }
      const member = await db.query.users.findFirst({
        where: and(eq(users.id, input.userId), isNull(users.deletedAt)),
        columns: { id: true, username: true },
      })
      if (!member) throw new TRPCError({ code: 'NOT_FOUND', message: 'That member no longer exists.' })
      const { path, expiresAt } = await createPasswordResetToken(db, member.id)
      return { path, expiresAt, username: member.username }
    }),
})
