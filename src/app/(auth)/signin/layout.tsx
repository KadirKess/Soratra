import type { Metadata } from 'next'
import { requireSetup } from '@/server/setupGate'

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to Soratra, your personal reading journal.',
  robots: { index: false, follow: true },
}

export const dynamic = 'force-dynamic'

export default async function SignInLayout({ children }: { children: React.ReactNode }) {
  await requireSetup()
  return children
}
