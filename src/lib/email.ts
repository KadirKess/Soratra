import 'server-only'
import { assertProductionConfiguration, isEmailDisabled, siteConfig } from '@/lib/config'

export class EmailDeliveryError extends Error {
  code: string

  constructor(code: string) {
    super('Password reset email delivery failed.')
    this.name = 'EmailDeliveryError'
    this.code = code
  }
}

async function resendErrorCode(response: Response) {
  const body = await response.json().catch(() => null)
  const name = body && typeof body === 'object' && 'name' in body && typeof body.name === 'string'
    ? body.name
    : String(response.status)
  return `RESEND_${name.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character]!)
}

export async function sendPasswordResetEmail(email: string, token: string) {
  assertProductionConfiguration()
  if (isEmailDisabled()) throw new EmailDeliveryError('EMAIL_DISABLED')
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new EmailDeliveryError('RESEND_API_KEY_MISSING')

  const resetUrl = new URL('/reset-password', siteConfig.siteUrl)
  resetUrl.searchParams.set('token', token)
  const resetUrlText = resetUrl.toString()
  const safeResetUrl = escapeHtml(resetUrlText)

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Soratra password reset',
    },
    body: JSON.stringify({
      from: siteConfig.emailFrom,
      to: [email],
      reply_to: siteConfig.supportEmail,
      subject: 'Reset your Soratra password',
      text: `Reset your Soratra password\n\nUse this link to choose a new password. It expires in one hour:\n${resetUrlText}\n\nIf you did not request this, you can safely ignore this email.`,
      html: `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#faf6ef;color:#1c1917;font-family:Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="padding:32px 16px;background:#faf6ef;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#f0ead9;border:2px solid #1c1917;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 20px;border-bottom:2px solid #1c1917;">
                <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#6b6258;">Soratra</p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:32px;line-height:1.05;color:#1c1917;">Choose a new password</h1>
                <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#3d3934;">We received a request to reset your Soratra password. This link expires in one hour.</p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="border-radius:10px;background:#e07a3a;border:2px solid #1c1917;">
                      <a href="${safeResetUrl}" style="display:inline-block;padding:13px 20px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">Reset password</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:28px 0 0;font-size:13px;line-height:1.55;color:#6b6258;">If you did not request this, you can safely ignore this email. Your password will not change.</p>
              </td>
            </tr>
          </table>
          <p style="max-width:560px;margin:16px 0 0;font-size:12px;line-height:1.5;color:#6b6258;">Having trouble with the button? Copy this link into your browser:<br><a href="${safeResetUrl}" style="color:#1c1917;word-break:break-all;">${safeResetUrl}</a></p>
        </td>
      </tr>
    </table>
  </body>
</html>`,
    }),
    signal: AbortSignal.timeout(8_000),
  })

  if (!response.ok) throw new EmailDeliveryError(await resendErrorCode(response))

  const dailyQuota = Number(response.headers.get('x-resend-daily-quota'))
  return { dailyQuota: Number.isFinite(dailyQuota) ? dailyQuota : null }
}
