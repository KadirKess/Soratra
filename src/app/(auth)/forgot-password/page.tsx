'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 12_000)
    try {
      const response = await fetch('/api/auth/password-reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        signal: controller.signal,
      })
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null)
        const message = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
          ? body.error
          : 'We could not send a reset link. Please try again.'
        setError(message)
        return
      }
      setSent(true)
    } catch {
      setError('We could not send a reset link. Check your connection and try again.')
    } finally {
      window.clearTimeout(timeout)
      setLoading(false)
    }
  }

  return <div className="auth-card">
    <p className="auth-kicker">Soratra</p>
    <h1 className="auth-title">Reset your password</h1>
    <p className="auth-subtitle">Enter your email and we will send a reset link if an account exists.</p>
    {sent ? <p className="auth-notice" role="status">Check your inbox for a reset link.</p> : <form onSubmit={submit} className="auth-form">
      <label htmlFor="reset-email" className="sr-only">Email</label>
      <input id="reset-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required className="auth-input" placeholder="Email" />
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button type="submit" disabled={loading} className="auth-btn">{loading ? 'Sending...' : 'Send reset link'}</button>
    </form>}
    <p className="auth-footer"><Link href="/signin">Back to sign in</Link></p>
  </div>
}
