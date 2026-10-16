import Link from 'next/link'
import { getInstance } from '@/server/instance'
import { requireSetup } from '@/server/setupGate'
import { SignUpForm } from './SignUpForm'

export const dynamic = 'force-dynamic'

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ invite?: string | string[] }> }) {
  await requireSetup()
  const [{ invite }, instance] = await Promise.all([searchParams, getInstance()])
  const token = typeof invite === 'string' && invite.length > 0 && invite.length <= 128 ? invite : null

  if (instance.registration === 'invite' && !token) {
    return (
      <div className="auth-card">
        <p className="auth-kicker"><Link href="/landing" className="auth-brand-link" aria-label="Soratra home">Soratra</Link></p>
        <h1 className="auth-title">Invite only</h1>
        <p className="auth-subtitle">
          This Soratra is run by {instance.operatorName}. To join, ask them for an invite link.
        </p>
        <p className="auth-footer">Already have an account? <Link href="/signin">Sign in</Link></p>
      </div>
    )
  }

  return <SignUpForm invite={token} />
}
