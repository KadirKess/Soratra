import { Suspense } from 'react'
import { getInstance } from '@/server/instance'
import { SignInForm } from './SignInForm'

// Invite-only instances have no sign-up form to send people to, so the
// footer needs to know which mode this Soratra is in.
export default async function SignInPage() {
  const instance = await getInstance()
  return (
    <Suspense>
      <SignInForm openRegistration={instance.registration === 'open'} operatorName={instance.operatorName} />
    </Suspense>
  )
}
