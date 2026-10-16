import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const { createPasswordResetToken, createInviteToken } = vi.hoisted(() => ({
  createPasswordResetToken: vi.fn(),
  createInviteToken: vi.fn(),
}))
vi.mock('@/server/tokens', () => ({ createPasswordResetToken, createInviteToken }))
vi.mock('@/server/db', async () => ({ ...await import('@/server/db/schema'), db: {} }))

import { createCallerFactory } from '@/server/trpc'
import { adminRouter } from '../admin'
import { db } from '@/server/db'

const adminId = '11111111-1111-4111-8111-111111111111'
const memberId = '22222222-2222-4222-8222-222222222222'

function caller(isAdmin: boolean) {
  const activeUser = { id: adminId, authVersion: 0, isAdmin, deletedAt: null }
  return createCallerFactory(adminRouter)({ session: { user: { id: adminId, authVersion: 0 } }, activeUser, db } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  const dbMock = db as unknown as Record<string, unknown>
  dbMock.query = { users: { findFirst: vi.fn().mockResolvedValue({ id: memberId, username: 'friend' }) } }
  createPasswordResetToken.mockResolvedValue({ path: '/reset-password?token=t', expiresAt: new Date() })
  createInviteToken.mockResolvedValue({ path: '/signup?invite=t', expiresAt: new Date() })
})

describe('admin router', () => {
  it('is closed to readers who are not the admin', async () => {
    await expect(caller(false).createInvite()).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(caller(false).createResetLink({ userId: memberId })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(createInviteToken).not.toHaveBeenCalled()
    expect(createPasswordResetToken).not.toHaveBeenCalled()
  })

  it('makes a reset link for another reader', async () => {
    const result = await caller(true).createResetLink({ userId: memberId })
    expect(result).toEqual(expect.objectContaining({ path: '/reset-password?token=t', username: 'friend' }))
    expect(createPasswordResetToken).toHaveBeenCalledWith(db, memberId)
  })

  it('does not make a reset link for the admin themself', async () => {
    await expect(caller(true).createResetLink({ userId: adminId })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    expect(createPasswordResetToken).not.toHaveBeenCalled()
  })

  it('makes invite links on behalf of the admin', async () => {
    const result = await caller(true).createInvite()
    expect(result.path).toBe('/signup?invite=t')
    expect(createInviteToken).toHaveBeenCalledWith(db, adminId)
  })
})
