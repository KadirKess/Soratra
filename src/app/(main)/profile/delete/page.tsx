'use client'
import { useSession } from 'next-auth/react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { PageHeader } from '@/components/ui/PageHeader'

export default function DeleteAccountPage() {
  const { data: session } = useSession()
  const [confirm, setConfirm] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const username = session?.user?.name ?? ''
  const canDelete = Boolean(username) && confirm.trim().toLowerCase() === username.toLowerCase() && currentPassword.length > 0

  async function handleDelete() {
    if (!canDelete) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/profile/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: confirm, currentPassword }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(typeof data?.error === 'string' ? data.error : 'Something went wrong. Please try again.')
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
    <div className="max-w-md mx-auto space-y-6">
      <PageHeader title="Delete account" />
      <div
        className="p-5 space-y-4"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Your reading history and relationships are removed immediately. We keep a minimal,
          anonymized deletion record for 30 days so the scheduled purge can complete; it does
          not retain your username, password, or time zone. This cannot be undone.
        </p>
        <div>
          <label
            htmlFor="delete-confirmation"
            className="eyebrow block mb-1"
          >
            Type your username to confirm
          </label>
          <input
            id="delete-confirmation"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={username}
            className="auth-input w-full"
          />
        </div>
        <div>
          <label
            htmlFor="delete-current-password"
            className="eyebrow block mb-1"
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
        {error && <p role="alert" className="form-error">{error}</p>}
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
