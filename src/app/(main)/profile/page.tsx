import { auth, signOut } from '@/server/auth'
import Link from 'next/link'
import { TimezoneSettings } from '@/components/account/TimezoneSettings'
import { CatalogLanguageSettings } from '@/components/account/CatalogLanguageSettings'
import { and, eq, isNull } from 'drizzle-orm'
import { db, users } from '@/server/db'
import { getInstance } from '@/server/instance'
import { PageHeader } from "@/components/ui/PageHeader";

export default async function ProfilePage() {
  const session = await auth()
  const [instance, account] = await Promise.all([
    getInstance(),
    session?.user?.id
      ? db.query.users.findFirst({ where: and(eq(users.id, session.user.id), isNull(users.deletedAt)), columns: { isAdmin: true } })
      : null,
  ])

  return (
    <div className="max-w-md space-y-8">
      <PageHeader
        title="Profile"
        description={<><span className="font-semibold" style={{ color: 'var(--fg)' }}>@{session?.user?.name}</span> · {account?.isAdmin ? 'You run this Soratra' : `Member of ${instance.operatorName}'s Soratra`}</>}
      />

      {account?.isAdmin && (
        <div className="brutalist-card p-5 sm:p-6 space-y-3 tint-straw">
          <p className="eyebrow" style={{ color: 'var(--muted-strong)' }}>
            Your instance
          </p>
          <p className="text-sm leading-6" style={{ color: 'var(--muted-strong)' }}>
            Invite friends, help someone back in after a forgotten password, and choose who can join.
          </p>
          <Link href="/admin" className="btn-primary text-center block">Manage members</Link>
        </div>
      )}

      <div className="brutalist-card p-5 sm:p-6 space-y-4">
        <p className="eyebrow">
          Privacy & Data
        </p>
        <div className="flex flex-col gap-2.5">
          <a href="/api/profile/export" download className="btn-secondary text-center">
            Export my data (JSON)
          </a>
          {!account?.isAdmin && (
            <Link href="/profile/delete" className="btn-danger text-center">
              Delete my account
            </Link>
          )}
          <Link href="/profile/password" className="btn-secondary text-center">
            Change password
          </Link>
          <Link href="/privacy" className="btn-ghost text-center">Privacy policy</Link>
          <Link href="/terms" className="btn-ghost text-center">Terms of use</Link>
        </div>
      </div>

      <TimezoneSettings />

      <CatalogLanguageSettings />

      <div className="brutalist-card p-5 sm:p-6 space-y-2 md:hidden" style={{ background: 'var(--surface)' }}>
        <p className="eyebrow">
          Instance support
        </p>
        <p className="text-sm leading-6" style={{ color: 'var(--muted)' }}>
          Forgot a password or found a bug? Ask{' '}
          <span className="font-semibold" style={{ color: 'var(--fg)' }}>
            {instance.contact ?? instance.operatorName}
          </span>
        </p>
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
