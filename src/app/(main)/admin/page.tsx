import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { and, eq, isNull } from 'drizzle-orm'
import { auth } from '@/server/auth'
import { db, users } from '@/server/db'
import { AdminPanel } from './AdminPanel'

export const metadata: Metadata = {
  title: 'Your Soratra',
  robots: { index: false, follow: false },
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const session = await auth()
  const account = session?.user?.id
    ? await db.query.users.findFirst({ where: and(eq(users.id, session.user.id), isNull(users.deletedAt)), columns: { isAdmin: true } })
    : null
  if (!account?.isAdmin) redirect('/profile')
  const { welcome } = await searchParams
  return <AdminPanel welcome={welcome === '1'} />
}
