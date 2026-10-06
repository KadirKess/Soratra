import type { Metadata } from 'next'
import { siteConfig } from '@/lib/config'
import { auth } from '@/server/auth'

export const metadata: Metadata = {
  title: 'Support',
  description: 'Get help with your Soratra account, privacy, accessibility, or reading journal.',
  alternates: { canonical: '/support' },
  robots: { index: true, follow: true },
}

export default async function SupportPage() {
  const session = await auth()

  return <div className={`${session ? '' : 'public-page-frame '}max-w-xl space-y-4`}><h1 className="text-5xl font-bold" style={{ fontFamily: 'var(--font-cormorant)' }}>Support</h1><p>For account, privacy, or accessibility help, email <a className="underline" href={`mailto:${siteConfig.supportEmail}`}>{siteConfig.supportEmail}</a>.</p></div>
}
