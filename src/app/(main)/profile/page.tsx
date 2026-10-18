import { auth, signOut } from '@/server/auth'
import Link from 'next/link'
import { TimezoneSettings } from '@/components/account/TimezoneSettings'
import { CatalogLanguageSettings } from '@/components/account/CatalogLanguageSettings'
import { and, eq, isNull } from 'drizzle-orm'
import { db, users } from '@/server/db'
import { getInstance } from '@/server/instance'
import { PageHeader } from "@/components/ui/PageHeader";
import { Avatar } from "@/components/ui/Avatar";

export default async function ProfilePage() {
  const session = await auth()
  const [instance, account] = await Promise.all([
    getInstance(),
    session?.user?.id
      ? db.query.users.findFirst({ where: and(eq(users.id, session.user.id), isNull(users.deletedAt)), columns: { isAdmin: true } })
      : null,
  ])

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <PageHeader
        leading={session?.user?.name && <Avatar username={session.user.name} size="lg" />}
        title="Profile"
        description={<><span className="font-semibold" style={{ color: 'var(--fg)' }}>@{session?.user?.name}</span> · {account?.isAdmin ? 'You run this Soratra' : `Reader on ${instance.operatorName}'s Soratra`}</>}
      />

      <div className="grid gap-6 md:grid-cols-2 items-start">
        {account?.isAdmin && (
          <div className="brutalist-card tint-mint p-5 sm:p-6 space-y-3 md:col-span-2 md:flex md:items-center md:justify-between md:gap-6 md:space-y-0">
            <div className="space-y-1.5">
              <p className="eyebrow">Your Soratra</p>
              <p className="text-sm leading-6" style={{ color: 'var(--muted)' }}>
                Invite friends, help someone back in after a forgotten password, and choose who can join.
              </p>
            </div>
            <Link href="/admin" className="btn-primary shrink-0">Open Your Soratra</Link>
          </div>
        )}

        <div className="brutalist-card p-5 sm:p-6 space-y-4">
          <p className="eyebrow">Privacy and data</p>
          <div className="flex flex-col gap-2.5">
            <a href="/api/profile/export" download className="btn-secondary text-center">
              Export my data (JSON)
            </a>
            <Link href="/profile/password" className="btn-secondary text-center">
              Change password
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-x-1 pt-1">
            <Link href="/privacy" className="btn-ghost -ml-3">Privacy policy</Link>
            <Link href="/terms" className="btn-ghost">Terms of use</Link>
          </div>
          {!account?.isAdmin && (
            <div className="pt-3" style={{ borderTop: '1px solid var(--rule)' }}>
              <Link href="/profile/delete" className="btn-quiet is-danger -ml-3">Delete my account</Link>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <TimezoneSettings />
          <CatalogLanguageSettings />
        </div>

        <div className="brutalist-card p-5 sm:p-6 space-y-2 md:hidden">
          <p className="eyebrow">Getting help</p>
          <p className="text-sm leading-6" style={{ color: 'var(--muted)' }}>
            Forgot a password or found a bug? Ask{' '}
            <span className="font-semibold" style={{ color: 'var(--fg)' }}>
              {instance.contact ?? instance.operatorName}
            </span>
          </p>
        </div>
      </div>

      <form
        action={async () => {
          'use server'
          await signOut({ redirectTo: '/signin' })
        }}
      >
        <button type="submit" className="btn-ghost">
          Sign out
        </button>
      </form>
    </div>
  )
}
