import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { isSetupComplete } from '@/server/instance'
import { SetupForm } from './SetupForm'

export const metadata: Metadata = {
  title: 'Welcome',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function SetupPage() {
  if (await isSetupComplete()) redirect('/signin')
  return <SetupForm />
}
