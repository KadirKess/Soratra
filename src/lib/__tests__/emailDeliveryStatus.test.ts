import { afterEach, describe, expect, it } from 'vitest'
import {
  clearEmailDeliveryStatus,
  emailDeliveryIssueFromCode,
  getEmailDeliveryStatus,
  recordEmailDeliveryIssue,
} from '../emailDeliveryStatus'

afterEach(() => clearEmailDeliveryStatus())

describe('email delivery status', () => {
  it('keeps a daily quota status for 24 hours', () => {
    const now = Date.UTC(2026, 6, 31, 8)
    recordEmailDeliveryIssue('daily_quota', now)

    expect(getEmailDeliveryStatus(now)).toEqual({
      issue: 'daily_quota',
      expiresAt: now + 24 * 60 * 60_000,
    })
    expect(getEmailDeliveryStatus(now + 24 * 60 * 60_000)).toBeNull()
  })

  it('maps Resend quota errors to their public status', () => {
    expect(emailDeliveryIssueFromCode('RESEND_DAILY_QUOTA_EXCEEDED')).toBe('daily_quota')
    expect(emailDeliveryIssueFromCode('RESEND_MONTHLY_QUOTA_EXCEEDED')).toBe('monthly_quota')
    expect(emailDeliveryIssueFromCode('RESEND_UNEXPECTED')).toBe('unavailable')
  })
})
