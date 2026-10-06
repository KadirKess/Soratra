import { getActiveSession } from '@/server/activeSession'
import { redirect } from 'next/navigation'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await getActiveSession()
  if (!session) redirect('/landing')
  return <>{children}</>
}
