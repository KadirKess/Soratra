import { contactHref, getInstance } from '@/server/instance'

export const dynamic = 'force-dynamic'

export async function GET() {
  const expiry = process.env.SECURITY_EXPIRES
  const instanceContact = (await getInstance()).contact
  const contact = process.env.SECURITY_CONTACT?.trim() || (instanceContact ? contactHref(instanceContact) : null) || ''
  if (!expiry || !Number.isFinite(Date.parse(expiry)) || Date.parse(expiry) <= Date.now() ||
      !/^(mailto:[^\s]+@[^\s]+|https:\/\/[^\s]+)$/.test(contact)) {
    return new Response(null, { status: 404 })
  }
  return new Response(`Contact: ${contact}\nExpires: ${new Date(expiry).toISOString()}\nPreferred-Languages: en\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
