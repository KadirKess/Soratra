'use client'
import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PasswordInput } from '@/components/ui/PasswordInput'

type Audience = 'me' | 'invited' | 'anyone'

const audiences: { value: Audience; title: string; copy: string }[] = [
  { value: 'me', title: 'Just me, for now', copy: 'Nobody else can sign up. You can invite people later.' },
  { value: 'invited', title: 'Me and people I invite', copy: 'Friends join with a one-time link you send them.' },
  { value: 'anyone', title: 'Anyone who can open this page', copy: 'Open sign-up. Best on a private network.' },
]

function firstFieldErrors(data: unknown): Record<string, string> {
  if (!data || typeof data !== 'object' || !('fieldErrors' in data) || !data.fieldErrors || typeof data.fieldErrors !== 'object') return {}
  return Object.fromEntries(
    Object.entries(data.fieldErrors).flatMap(([field, messages]) =>
      Array.isArray(messages) && typeof messages[0] === 'string' ? [[field, messages[0]]] : [],
    ),
  )
}

export function SetupForm() {
  const router = useRouter()
  const [audience, setAudience] = useState<Audience>('invited')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setFieldErrors({})
    const form = new FormData(event.currentTarget)
    const username = String(form.get('username') ?? '')
    const password = String(form.get('password') ?? '')
    try {
      const response = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          registration: audience === 'anyone' ? 'open' : 'invite',
        }),
      })
      if (!response.ok) {
        const data: unknown = await response.json().catch(() => null)
        const errors = firstFieldErrors(data)
        // A 409 without field errors means someone else finished setup first.
        if (response.status === 409 && Object.keys(errors).length === 0) {
          router.replace('/signin')
          return
        }
        setFieldErrors(errors)
        setError(data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
          ? data.error
          : 'Setup failed. Please try again.')
        return
      }
      const result = await signIn('credentials', { username, password, redirect: false })
      if (result?.error) {
        router.replace('/signin')
        return
      }
      router.replace(audience === 'invited' ? '/admin?welcome=1' : '/')
      router.refresh()
    } catch {
      setError('We could not reach Soratra. Check that it is still running and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-card auth-card--wide">
      <p className="auth-kicker">Soratra</p>
      <h1 className="auth-title">Welcome to your Soratra</h1>
      <p className="auth-subtitle">
        A quiet place for your reading. Create your account first; it will be the one that looks after this instance.
      </p>
      <form method="post" onSubmit={handleSubmit} noValidate className="auth-form">
        <p className="auth-step">1 · Your account</p>
        <label htmlFor="setup-username" className="sr-only">Username</label>
        <input id="setup-username" name="username" type="text" placeholder="Username" required minLength={2} maxLength={30} pattern="[A-Za-z0-9_]+" autoComplete="username" autoFocus aria-invalid={Boolean(fieldErrors.username)} aria-describedby={fieldErrors.username ? 'setup-username-error' : 'setup-username-hint'} className="auth-input" />
        {fieldErrors.username
          ? <p id="setup-username-error" className="auth-field-error">{fieldErrors.username}</p>
          : <p id="setup-username-hint" className="auth-field-hint">2-30 letters, numbers, or underscores. Friends find you by it.</p>}
        <label htmlFor="setup-password" className="sr-only">Password</label>
        <PasswordInput id="setup-password" name="password" placeholder="Password (min 8 chars)" required minLength={8} autoComplete="new-password" aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? 'setup-password-error' : 'setup-password-hint'} className="auth-input" />
        {fieldErrors.password
          ? <p id="setup-password-error" className="auth-field-error">{fieldErrors.password}</p>
          : <p id="setup-password-hint" className="auth-field-hint">Soratra does not send email, so keep this somewhere safe.</p>}

        <fieldset className="choice-list">
          <legend className="auth-step mb-3 mt-2">2 · Who will use it?</legend>
          {audiences.map((option) => (
            <label key={option.value} className="choice-card">
              <input type="radio" name="audience" value={option.value} checked={audience === option.value} onChange={() => setAudience(option.value)} />
              <span className="choice-title">{option.title}</span>
              <span className="choice-copy">{option.copy}</span>
            </label>
          ))}
        </fieldset>

        {error && <p className="auth-error" role="alert">{error}</p>}
        <button type="submit" disabled={loading} className="auth-btn">
          {loading ? 'Setting up...' : 'Start my journal'}
        </button>
      </form>
      <p className="auth-footer">You can change all of this later from your profile.</p>
    </div>
  )
}
