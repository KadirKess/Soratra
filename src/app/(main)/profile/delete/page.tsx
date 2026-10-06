'use client'
import { useSession } from 'next-auth/react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PasswordInput } from '@/components/ui/PasswordInput'

export default function DeleteAccountPage() {
  const { data: session } = useSession()
  const [confirm, setConfirm] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const email = session?.user?.email ?? ''
  const canDelete = confirm === email && currentPassword.length > 0

  async function handleDelete() {
    if (!canDelete) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/profile/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: confirm, currentPassword }),
      })
      if (!res.ok) {
        setError('Something went wrong. Please try again.')
        return
      }
      router.push('/signin?deleted=1')
    } catch {
      setError('We could not delete your account. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-4xl font-light" style={{ fontFamily: 'var(--font-cormorant)' }}>
        Delete account
      </h1>
      <div
        className="p-5 space-y-4"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Your reading history and relationships are removed immediately. We keep a minimal,
          anonymized deletion record for 30 days so the scheduled purge can complete; it does
          not retain your email, password, or time zone. This cannot be undone.
        </p>
        <div>
          <label
            htmlFor="delete-confirmation"
            className="block text-xs uppercase tracking-wider mb-1"
            style={{ color: 'var(--muted)' }}
          >
            Type your email to confirm
          </label>
          <input
            id="delete-confirmation"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={email}
            className="auth-input w-full"
          />
        </div>
        <div>
          <label
            htmlFor="delete-current-password"
            className="block text-xs uppercase tracking-wider mb-1"
            style={{ color: 'var(--muted)' }}
          >
            Confirm your current password
          </label>
          <PasswordInput
            id="delete-current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            className="auth-input w-full"
          />
        </div>
        {error && <p className="text-xs" style={{ color: 'var(--accent)' }}>{error}</p>}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleDelete}
            disabled={!canDelete || loading}
            className="px-4 py-2 text-sm font-medium"
            style={{
              background: canDelete ? 'var(--accent)' : 'var(--border)',
              color: 'white',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Deleting...' : 'Delete my account'}
          </button>
          <Link
            href="/profile"
            className="px-4 py-2 text-sm inline-flex items-center"
            style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}
          >
            Cancel
          </Link>
        </div>
      </div>
    </div>
  )
}
