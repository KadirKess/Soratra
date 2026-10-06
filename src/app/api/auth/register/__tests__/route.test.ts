import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { insert, values, hash, rateLimit } = vi.hoisted(() => ({
  insert: vi.fn(),
  values: vi.fn(),
  hash: vi.fn(),
  rateLimit: vi.fn(),
}))

vi.mock('@/server/db', () => ({ db: { insert }, users: {} }))
vi.mock('bcryptjs', () => ({ default: { hash, truncates: () => false } }))
vi.mock('@/lib/rateLimit', () => ({
  getClientIp: () => '203.0.113.9',
  rateLimit,
  rateLimitKey: (scope: string) => scope,
}))
vi.mock('@/lib/config', () => ({ assertProductionConfiguration: vi.fn() }))

import { POST } from '../route'

function request(body: Record<string, unknown> = {}) {
  return new Request('https://instance.test/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: 'reader@example.com',
      username: 'reader_name',
      password: 'securepassword123',
      timezone: 'UTC',
      gdprConsent: true,
      ...body,
    }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  rateLimit.mockResolvedValue({ ok: true, retryAfter: 0 })
  hash.mockResolvedValue('password-hash')
  insert.mockReturnValue({ values })
  values.mockResolvedValue(undefined)
})

describe('POST /api/auth/register', () => {
  it('creates an account for valid registration details', async () => {
    const response = await POST(request())

    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ ok: true })
    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      email: 'reader@example.com',
      username: 'reader_name',
      passwordHash: 'password-hash',
      preferredLanguage: 'en',
    }))
  })

  it('tells the reader when their username is already taken', async () => {
    values.mockRejectedValue({
      cause: { code: '23505', constraint_name: 'users_username_normalized_unique' },
    })

    const response = await POST(request())

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'That username is already taken. Please choose another.',
      fieldErrors: { username: ['That username is already taken. Please choose another.'] },
    })
  })

  it('tells the reader when their email is already registered', async () => {
    values.mockRejectedValue({
      cause: { code: '23505', constraint_name: 'users_email_unique' },
    })

    const response = await POST(request())

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'This email is already registered. Please sign in.',
      fieldErrors: { email: ['This email is already registered. Please sign in.'] },
    })
  })

  it('returns field-specific validation feedback', async () => {
    const response = await POST(request({ username: 'not allowed!' }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Please correct the highlighted fields.',
      fieldErrors: {
        username: ['Username can use letters, numbers, and underscores only.'],
      },
    })
  })
})
