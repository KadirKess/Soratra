import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/server/auth'
import { siteConfig } from '@/lib/config'
import { FALLBACK_OPERATOR_NAME, getInstance } from '@/server/instance'
import { requireSetup } from '@/server/setupGate'
import { OperatorContact } from '@/components/layout/OperatorContact'
import { Wordmark } from '@/components/layout/Wordmark'

// Every installation is someone's private Soratra, so its front door stays out
// of search results unless the operator turns SEARCH_INDEXING on. The story of
// the project lives on soratra.app.
export function generateMetadata(): Metadata {
  const indexed = siteConfig.searchIndexing
  return {
    title: { absolute: 'Soratra' },
    description: 'A private reading journal.',
    robots: { index: indexed, follow: indexed },
  }
}

export const dynamic = 'force-dynamic'

export default async function LandingPage() {
  await requireSetup()
  const session = await auth()
  if (session) redirect('/')

  const instance = await getInstance()
  const named = instance.operatorName !== FALLBACK_OPERATOR_NAME
  const open = instance.registration === 'open'

  return (
    <main id="main-content" className="min-h-[calc(100vh-3rem)] flex items-center justify-center px-4 py-10">
      <div className="auth-card auth-card--wide space-y-6">
        <div><Wordmark size="2.25rem" /></div>

        <div className="space-y-2">
          <p className="eyebrow">A private reading journal</p>
          <h1 className="auth-title">{named ? `${instance.operatorName}’s Soratra` : 'This Soratra'}</h1>
          <p className="auth-subtitle" style={{ marginBottom: 0 }}>
            Shelves, a daily reading journal, and notes shared only with the friends you accept.
          </p>
        </div>

        <div className="space-y-3">
          <Link href="/signin" className="auth-btn text-center block">Sign in</Link>
          {open ? (
            <>
              <Link href="/signup" className="btn-secondary w-full justify-center">Create an account</Link>
              <p className="auth-field-hint" style={{ margin: 0 }}>Anyone with this address can join.</p>
            </>
          ) : (
            <p className="text-sm leading-6" style={{ color: 'var(--muted)' }}>
              New here? Joining is by invitation. Ask {instance.operatorName} for an invite link
              {instance.contact ? <>; you can <OperatorContact contact={instance.contact} /></> : null}.
            </p>
          )}
        </div>

        <div className="pt-4 space-y-3 text-xs" style={{ borderTop: '1px solid var(--rule)', color: 'var(--muted)' }}>
          <p>
            Soratra is free, open-source software you can run yourself.{' '}
            <a href="https://soratra.app" className="underline underline-offset-2" style={{ color: 'var(--fg)' }}>About the project</a>
          </p>
          <nav aria-label="This Soratra" className="flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/privacy" className="underline underline-offset-2">Privacy</Link>
            <Link href="/terms" className="underline underline-offset-2">Terms</Link>
            <Link href="/support" className="underline underline-offset-2">Support</Link>
          </nav>
        </div>
      </div>
    </main>
  )
}
