import { siteConfig } from '@/lib/config'

export const dynamic = 'force-dynamic'

export function GET() {
  const expiry = process.env.SECURITY_EXPIRES
  const contact = process.env.SECURITY_CONTACT?.trim() || `mailto:${siteConfig.supportEmail}`
  if (!expiry || !Number.isFinite(Date.parse(expiry)) || Date.parse(expiry) <= Date.now() ||
      !/^(mailto:[^\s]+@[^\s]+|https:\/\/[^\s]+)$/.test(contact)) {
    return new Response(null, { status: 404 })
  }
  return new Response(`Contact: ${contact}\nExpires: ${new Date(expiry).toISOString()}\nPreferred-Languages: en\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
