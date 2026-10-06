import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to Soratra, your personal reading journal.',
  robots: { index: false, follow: true },
}

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return children
}
