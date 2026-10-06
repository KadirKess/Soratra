'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PasswordInput } from '@/components/ui/PasswordInput'

type FieldErrors = Record<string, string>

function errorDetails(data: unknown): { error: string; fieldErrors: FieldErrors } {
  if (!data || typeof data !== 'object') {
    return { error: 'Registration failed. Please try again.', fieldErrors: {} }
  }

  const response = data as { error?: unknown; fieldErrors?: unknown }
  const fieldErrors = response.fieldErrors && typeof response.fieldErrors === 'object'
    ? Object.fromEntries(
      Object.entries(response.fieldErrors).flatMap(([field, messages]) =>
        Array.isArray(messages) && typeof messages[0] === 'string' ? [[field, messages[0]]] : [],
      ),
    )
    : {}

  return {
    error: typeof response.error === 'string' ? response.error : 'Registration failed. Please try again.',
    fieldErrors,
  }
}

function emailValidationMessage(input: HTMLInputElement) {
  return input.value.trim() ? 'Enter a valid email address.' : 'Enter your email address.'
}

export default function SignUpPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formElement = e.currentTarget
    const emailInput = formElement.elements.namedItem('email')
    if (!(emailInput instanceof HTMLInputElement) || !emailInput.validity.valid) {
      const message = emailInput instanceof HTMLInputElement
        ? emailValidationMessage(emailInput)
        : 'Enter a valid email address.'
      setError(message)
      setFieldErrors({ email: message })
      return
    }

    setLoading(true)
    setError(null)
    setFieldErrors({})
    const form = new FormData(formElement)

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.get('email'),
          username: form.get('username'),
          password: form.get('password'),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          gdprConsent: form.get('gdprConsent') === 'on',
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        const details = errorDetails(data)
        setError(details.error)
        setFieldErrors(details.fieldErrors)
        return
      }
      router.push('/signin?registered=1')
    } catch {
      setError('We could not create your account. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-card">
      <p className="auth-kicker"><Link href="/landing" className="auth-brand-link" aria-label="Soratra home">Soratra</Link></p>
      <h1 className="auth-title">Create your journal</h1>
      <p className="auth-subtitle">
        Save books, track your reading rhythm, and make your shelves feel like home.
      </p>
      <form onSubmit={handleSubmit} noValidate className="auth-form">
        <label htmlFor="signup-email" className="sr-only">Email</label>
        <input id="signup-email" name="email" type="email" placeholder="Email" required autoComplete="email" aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? 'signup-email-error' : undefined} className="auth-input" />
        {fieldErrors.email && <p id="signup-email-error" className="auth-field-error">{fieldErrors.email}</p>}
        <label htmlFor="signup-username" className="sr-only">Username</label>
        <input id="signup-username" name="username" type="text" placeholder="Username" required minLength={2} maxLength={30} pattern="[A-Za-z0-9_]+" title="Use 2-30 letters, numbers, or underscores." autoComplete="username" aria-invalid={Boolean(fieldErrors.username)} aria-describedby={fieldErrors.username ? 'signup-username-error' : 'signup-username-hint'} className="auth-input" />
        {fieldErrors.username ? <p id="signup-username-error" className="auth-field-error">{fieldErrors.username}</p> : <p id="signup-username-hint" className="auth-field-hint">2-30 letters, numbers, or underscores.</p>}
        <label htmlFor="signup-password" className="sr-only">Password</label>
        <PasswordInput id="signup-password" name="password" placeholder="Password (min 8 chars)" required minLength={8} autoComplete="new-password" aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? 'signup-password-error' : undefined} className="auth-input" />
        {fieldErrors.password && <p id="signup-password-error" className="auth-field-error">{fieldErrors.password}</p>}
        <label className="auth-consent">
          <input name="gdprConsent" type="checkbox" required aria-invalid={Boolean(fieldErrors.gdprConsent)} aria-describedby={fieldErrors.gdprConsent ? 'signup-consent-error' : undefined} />
          <span>
            I agree to the storage of my data for the purpose of this service under the <Link href="/privacy">Privacy Policy</Link> and <Link href="/terms">Terms of Use</Link>.
            I can request export or deletion at any time from my profile.
          </span>
        </label>
        {fieldErrors.gdprConsent && <p id="signup-consent-error" className="auth-field-error">{fieldErrors.gdprConsent}</p>}
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button type="submit" disabled={loading} className="auth-btn">
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>
      <p className="auth-footer">
        Already have an account? <Link href="/signin">Sign in</Link>
      </p>
    </div>
  )
}
