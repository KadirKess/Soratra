import { redirect } from 'next/navigation'
import { getActiveSession } from '@/server/activeSession'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const session = await getActiveSession()
  if (session) redirect('/')

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: 'var(--bg)' }}>
      {children}
    </div>
  )
}
