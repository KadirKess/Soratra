import { auth, signOut } from '@/server/auth'
import Link from 'next/link'
import { TimezoneSettings } from '@/components/account/TimezoneSettings'
import { CatalogLanguageSettings } from '@/components/account/CatalogLanguageSettings'
import { siteConfig } from '@/lib/config'

export default async function ProfilePage() {
  const session = await auth()

  return (
    <div className="max-w-md space-y-8">
      <h1 className="text-4xl font-bold" style={{ fontFamily: 'var(--font-cormorant)' }}>
        Profile
      </h1>

      <div className="space-y-0.5">
        <p className="text-base font-bold" style={{ color: 'var(--fg)' }}>
          {session?.user?.name}
        </p>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          {session?.user?.email}
        </p>
      </div>

      <div className="brutalist-card p-5 space-y-4">
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
          Privacy & Data
        </p>
        <div className="flex flex-col gap-2.5">
          <a href="/api/profile/export" download className="btn-secondary text-center">
            Export my data (JSON)
          </a>
          <Link href="/profile/delete" className="btn-danger text-center">
            Delete my account
          </Link>
          <Link href="/profile/password" className="btn-secondary text-center">
            Change password
          </Link>
          <Link href="/privacy" className="btn-ghost text-center">Privacy policy</Link>
          <Link href="/terms" className="btn-ghost text-center">Terms of use</Link>
        </div>
      </div>

      <TimezoneSettings />

      <CatalogLanguageSettings />

      <div className="brutalist-card p-5 space-y-2 md:hidden" style={{ background: 'var(--surface)' }}>
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
          Instance support
        </p>
        <p className="text-sm leading-6" style={{ color: 'var(--muted)' }}>
          Feedback or a bug? Write to{' '}
          <a href={`mailto:${siteConfig.supportEmail}`} className="font-semibold hover:underline" style={{ color: 'var(--fg)' }}>
            {siteConfig.supportEmail}
          </a>
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
