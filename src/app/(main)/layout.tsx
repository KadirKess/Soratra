import { getActiveSession } from '@/server/activeSession'
import { redirect } from 'next/navigation'
import { requireSetup } from '@/server/setupGate'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  await requireSetup()
  const session = await getActiveSession()
  if (!session) redirect('/landing')
  return <>{children}</>
}
