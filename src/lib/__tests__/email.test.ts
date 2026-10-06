import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
import { sendPasswordResetEmail } from '../email'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('password reset delivery', () => {
  it('does not deliver or log a reset link when email is disabled', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('EMAIL_MODE', 'disabled')
    const fetch = vi.fn()
    const log = vi.spyOn(console, 'info')
    vi.stubGlobal('fetch', fetch)
    await expect(sendPasswordResetEmail('reader@example.com', 'private-token')).rejects.toMatchObject({ code: 'EMAIL_DISABLED' })
    expect(fetch).not.toHaveBeenCalled()
    expect(log).not.toHaveBeenCalled()
    log.mockRestore()
  })

  it('uses the current instance origin and sender for delivery', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('EMAIL_MODE', 'resend')
    vi.stubEnv('RESEND_API_KEY', 'fixture-key')
    vi.stubEnv('SITE_URL', 'https://instance.test')
    vi.stubEnv('EMAIL_FROM', 'sender@instance.test')
    vi.stubEnv('SUPPORT_EMAIL', 'support@instance.test')
    const fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    await sendPasswordResetEmail('reader@example.com', 'fixture-token')
    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body.from).toBe('sender@instance.test')
    expect(body.reply_to).toBe('support@instance.test')
    expect(body.text).toContain('https://instance.test/reset-password?token=fixture-token')
  })
})
