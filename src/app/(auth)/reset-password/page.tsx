'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { PasswordInput } from '@/components/ui/PasswordInput'

export default function ResetPasswordPage() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/auth/password-reset/confirm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        setError(data?.error ?? 'This reset link is invalid or expired.')
        return
      }
      router.push('/signin?reset=1')
    } catch {
      setError('We could not reset your password. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return <div className="auth-card">
    <p className="auth-kicker">Soratra</p>
    <h1 className="auth-title auth-title--standalone">Choose a new password</h1>
    <form onSubmit={submit} className="auth-form">
      <label htmlFor="new-password" className="sr-only">New password</label>
      <PasswordInput id="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required autoComplete="new-password" className="auth-input" placeholder="New password (min 8 chars)" />
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button type="submit" disabled={loading || !token} className="auth-btn">{loading ? 'Saving...' : 'Reset password'}</button>
    </form>
    <p className="auth-footer"><Link href="/signin">Back to sign in</Link></p>
  </div>
}
