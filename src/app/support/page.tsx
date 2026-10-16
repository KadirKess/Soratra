import type { Metadata } from 'next'
import { auth } from '@/server/auth'
import { getInstance } from '@/server/instance'
import { OperatorContact } from '@/components/layout/OperatorContact'

export const metadata: Metadata = {
  title: 'Support',
  description: 'Get help with your Soratra account, privacy, accessibility, or reading journal.',
  alternates: { canonical: '/support' },
  robots: { index: true, follow: true },
}

export default async function SupportPage() {
  const [session, instance] = await Promise.all([auth(), getInstance()])

  return <div className={`${session ? '' : 'public-page-frame '}max-w-xl space-y-4`}>
    <h1 className="text-5xl font-medium" style={{ fontFamily: 'var(--font-cormorant)' }}>Support</h1>
    <p>This Soratra is run by {instance.operatorName}. For help with your account, a forgotten password, privacy, or accessibility, <OperatorContact contact={instance.contact} />.</p>
  </div>
}
