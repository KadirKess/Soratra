import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Create account',
  description: 'Create a Soratra account and start your reading journal.',
  robots: { index: false, follow: true },
}

export default function SignUpLayout({ children }: { children: React.ReactNode }) {
  return children
}
