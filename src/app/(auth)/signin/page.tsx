'use client'
import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { PasswordInput } from '@/components/ui/PasswordInput'

function emailValidationMessage(input: HTMLInputElement) {
  return input.value.trim() ? 'Enter a valid email address.' : 'Enter your email address.'
}

export default function SignInPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const successNotice = searchParams.get('registered')
    ? 'Account created. Sign in to start building your reading ritual.'
    : searchParams.get('deleted')
      ? 'Your account was deleted. You can always come back to Soratra later.'
      : searchParams.get('reset')
        ? 'Password updated. Sign in with your new password.'
      : null

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formElement = e.currentTarget
    const emailInput = formElement.elements.namedItem('email')
    if (!(emailInput instanceof HTMLInputElement) || !emailInput.validity.valid) {
      setEmailError(emailInput instanceof HTMLInputElement ? emailValidationMessage(emailInput) : 'Enter a valid email address.')
      return
    }

    setLoading(true)
    setError(null)
    setEmailError(null)
    const form = new FormData(formElement)
    try {
      const result = await signIn('credentials', {
        email: form.get('email'),
        password: form.get('password'),
        redirect: false,
      })
      if (result?.error) {
        setError(
          result.code === 'rate_limited'
            ? 'Too many sign-in attempts. Please wait a few minutes and try again.'
            : result.error === 'CredentialsSignin'
              ? 'Invalid email or password.'
              : 'We could not sign you in right now. Please try again shortly.',
        )
        return
      }
      router.replace('/')
      router.refresh()
    } catch {
      setError('We could not sign you in. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-card">
      <p className="auth-kicker"><Link href="/landing" className="auth-brand-link" aria-label="Soratra home">Soratra</Link></p>
      <h1 className="auth-title">Welcome back</h1>
      <p className="auth-subtitle">
        Settle in, pick up your current read, and keep the momentum going.
      </p>
      {successNotice && <p className="auth-notice" role="status">{successNotice}</p>}
      <form onSubmit={handleSubmit} noValidate className="auth-form">
        <label htmlFor="signin-email" className="sr-only">Email</label>
        <input id="signin-email" name="email" type="email" placeholder="Email" required autoComplete="email" aria-invalid={Boolean(emailError)} aria-describedby={emailError ? 'signin-email-error' : undefined} onChange={(event) => {
          if (emailError && event.currentTarget.validity.valid) setEmailError(null)
        }} className="auth-input" />
        {emailError && <p id="signin-email-error" className="auth-field-error">{emailError}</p>}
        <label htmlFor="signin-password" className="sr-only">Password</label>
        <PasswordInput id="signin-password" name="password" placeholder="Password" required minLength={8} autoComplete="current-password" className="auth-input" />
        {error && (
          <p className="auth-error" role="alert">
            {error}{error === 'Invalid email or password.' && ' Double-check for typos and use the email you signed up with.'}
          </p>
        )}
        <button type="submit" disabled={loading} className="auth-btn">
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
      <p className="auth-footer">
        <Link href="/forgot-password">Forgot password?</Link><br />
        No account? <Link href="/signup">Create one</Link>
      </p>
    </div>
  )
}
