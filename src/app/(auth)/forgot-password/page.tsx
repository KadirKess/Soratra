import Link from 'next/link'
import { getInstance } from '@/server/instance'
import { OperatorContact } from '@/components/layout/OperatorContact'

export const dynamic = 'force-dynamic'

export default async function ForgotPasswordPage() {
  const instance = await getInstance()

  return <div className="auth-card">
    <p className="auth-kicker">Soratra</p>
    <h1 className="auth-title">Forgot your password?</h1>
    <p className="auth-subtitle">
      Soratra does not send email. Instead, {instance.operatorName} can make you a one-time link to choose a new password.
      To ask for one, <OperatorContact contact={instance.contact} />.
    </p>
    <p className="auth-notice">Your shelves and journal stay exactly as they are.</p>
    <p className="auth-footer"><Link href="/signin">Back to sign in</Link></p>
  </div>
}
