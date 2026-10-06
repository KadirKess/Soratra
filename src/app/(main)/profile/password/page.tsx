'use client'

import { signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { PasswordInput } from '@/components/ui/PasswordInput'

export default function ChangePasswordPage() {
  const router = useRouter()
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/profile/password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword, password }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        setError(data?.error ?? 'Password could not be changed.')
        return
      }
      await signOut({ redirect: false })
      router.push('/signin?reset=1')
    } catch {
      setError('We could not change your password. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return <div className="max-w-md space-y-6">
    <h1 className="text-4xl font-bold" style={{ fontFamily: 'var(--font-cormorant)' }}>Change password</h1>
    <form onSubmit={submit} className="brutalist-card p-5 space-y-4">
      <div><label htmlFor="current-password" className="block text-sm font-semibold mb-1">Current password</label><PasswordInput id="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} minLength={8} required autoComplete="current-password" className="brutalist-input w-full" /></div>
      <div><label htmlFor="replacement-password" className="block text-sm font-semibold mb-1">New password</label><PasswordInput id="replacement-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required autoComplete="new-password" className="brutalist-input w-full" /></div>
      {error && <p role="alert" className="text-sm" style={{ color: 'var(--accent)' }}>{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Saving...' : 'Change password'}</button>
    </form>
  </div>
}
