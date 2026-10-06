export type EmailDeliveryIssue = 'daily_quota' | 'monthly_quota' | 'unavailable'

interface EmailDeliveryStatus {
  issue: EmailDeliveryIssue
  expiresAt: number
}

let status: EmailDeliveryStatus | null = null

const durationByIssue: Record<EmailDeliveryIssue, number> = {
  daily_quota: 24 * 60 * 60_000,
  monthly_quota: 30 * 24 * 60 * 60_000,
  unavailable: 10 * 60_000,
}

export function getEmailDeliveryStatus(now = Date.now()): EmailDeliveryStatus | null {
  if (status && now >= status.expiresAt) status = null
  return status
}

export function recordEmailDeliveryIssue(issue: EmailDeliveryIssue, now = Date.now()) {
  status = { issue, expiresAt: now + durationByIssue[issue] }
}

export function clearEmailDeliveryStatus() {
  status = null
}

export function emailDeliveryIssueFromCode(code: string | undefined): EmailDeliveryIssue {
  if (code === 'RESEND_DAILY_QUOTA_EXCEEDED') return 'daily_quota'
  if (code === 'RESEND_MONTHLY_QUOTA_EXCEEDED') return 'monthly_quota'
  return 'unavailable'
}
