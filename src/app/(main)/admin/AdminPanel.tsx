'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { trpc } from '@/lib/trpc/client'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { CopyLink } from '@/components/ui/CopyLink'
import { CopyCommand } from '@/components/ui/CopyCommand'
import { PageHeader } from "@/components/ui/PageHeader";
import { Avatar } from '@/components/ui/Avatar'

const dateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
const dateTimeFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

type Registration = 'invite' | 'open'

const registrationOptions: { value: Registration; title: string; copy: string }[] = [
  { value: 'invite', title: 'Only people I invite', copy: 'New readers need a one-time invite link from you.' },
  { value: 'open', title: 'Anyone who can open this page', copy: 'Fine on a home network or Tailscale. Think twice on a public domain.' },
]

export function AdminPanel({ welcome }: { welcome: boolean }) {
  const utils = trpc.useUtils()
  const confirm = useConfirm()
  const overview = trpc.admin.overview.useQuery()
  const [newInvite, setNewInvite] = useState<{ path: string; expiresAt: Date } | null>(null)
  const [resetLink, setResetLink] = useState<{ userId: string; path: string; expiresAt: Date } | null>(null)

  const createInvite = trpc.admin.createInvite.useMutation({
    onSuccess: (invite) => {
      setNewInvite(invite)
      void utils.admin.overview.invalidate()
    },
    onError: (error) => toast.error(error.message),
  })
  const revokeInvite = trpc.admin.revokeInvite.useMutation({
    onSuccess: () => {
      toast.success('Invite link revoked.')
      void utils.admin.overview.invalidate()
    },
    onError: (error) => toast.error(error.message),
  })
  const createResetLink = trpc.admin.createResetLink.useMutation({
    onSuccess: (link, input) => setResetLink({ userId: input.userId, path: link.path, expiresAt: link.expiresAt }),
    onError: (error) => toast.error(error.message),
  })

  async function handleRevoke(id: string) {
    const ok = await confirm({
      title: 'Revoke invite?',
      message: 'Anyone holding this link will no longer be able to join with it.',
      confirmLabel: 'Revoke',
      danger: true,
    })
    if (ok) revokeInvite.mutate({ id })
  }

  async function handleResetLink(userId: string, username: string) {
    const ok = await confirm({
      title: `Help @${username} back in?`,
      message: `This makes a one-time link that lets @${username} choose a new password. Their current password stops working once they use it. Only send it to them.`,
      confirmLabel: 'Make link',
    })
    if (ok) createResetLink.mutate({ userId })
  }

  if (overview.isLoading) return <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading your Soratra…</p>
  if (!overview.data) return <p className="text-sm" style={{ color: 'var(--muted)' }}>We could not load your Soratra. Refresh to try again.</p>
  const { members, pendingInvites, acceptedInvites, settings, version } = overview.data

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <PageHeader
        title="Your Soratra"
        description={<>Who reads here, and how new readers join. You never see anyone&apos;s shelves or journal from this page.</>}
      />

      {welcome && (
        <p className="auth-notice" role="status">
          You&apos;re all set. Make an invite link below and send it to a friend however you like.
        </p>
      )}

      <UpdateNotice />

      <section className="brutalist-card tint-section p-5 sm:p-6 space-y-4" aria-labelledby="invite-heading">
        <div>
          <h2 id="invite-heading" className="text-xl font-bold" style={{ fontFamily: 'var(--font-cormorant)' }}>Invite someone</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-strong)' }}>
            Each link works once and lasts seven days. Send it by message, in person, however you like.
          </p>
        </div>
        {newInvite && (
          <div className="space-y-2">
            <CopyLink path={newInvite.path} label="New invite link" />
            <p className="text-xs" style={{ color: 'var(--muted-strong)' }}>
              Expires {dateTimeFormat.format(newInvite.expiresAt)}. It won&apos;t be shown again.
            </p>
          </div>
        )}
        <button type="button" onClick={() => createInvite.mutate()} disabled={createInvite.isPending} className="btn-primary justify-center">
          {createInvite.isPending ? 'Making link...' : newInvite ? 'Make another link' : 'Make an invite link'}
        </button>
        {(pendingInvites.length > 0 || acceptedInvites.length > 0) && (
          <ul className="space-y-2 text-sm">
            {pendingInvites.map((invite) => (
              <li key={invite.id} className="flex items-center justify-between gap-3 border-t pt-2" style={{ borderColor: 'var(--rule)' }}>
                <span>Unused link, expires {dateFormat.format(invite.expiresAt)}</span>
                <button type="button" onClick={() => handleRevoke(invite.id)} disabled={revokeInvite.isPending} className="btn-ghost text-xs">Revoke</button>
              </li>
            ))}
            {acceptedInvites.map((invite) => (
              <li key={invite.id} className="border-t pt-2" style={{ borderColor: 'var(--rule)', color: 'var(--muted-strong)' }}>
                {invite.username ? <>Joined as <strong>@{invite.username}</strong></> : 'Used'} on {dateFormat.format(invite.usedAt)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="members-heading">
        <h2 id="members-heading" className="eyebrow">
          Readers · {members.length}
        </h2>
        {members.map((member) => (
          <div key={member.id} className="card-flat p-4 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar username={member.username} />
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">@{member.username}{member.isAdmin && <span className="eyebrow ml-2" style={{ color: 'var(--accent-ink)' }}>You</span>}</p>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>Joined {dateFormat.format(member.createdAt)}</p>
                </div>
              </div>
              {!member.isAdmin && (
                <button type="button" onClick={() => handleResetLink(member.id, member.username)} disabled={createResetLink.isPending} className="btn-secondary justify-center">
                  Password reset link
                </button>
              )}
            </div>
            {resetLink?.userId === member.id && (
              <div className="space-y-2">
                <CopyLink path={resetLink.path} label={`Password reset link for ${member.username}`} />
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  Works once, until {dateTimeFormat.format(resetLink.expiresAt)}. Send it to @{member.username} privately.
                </p>
              </div>
            )}
          </div>
        ))}
      </section>

      {/* Not keyed on the saved values: a remount after the refetch would wipe the Saved state. */}
      <InstanceSettings initial={settings} />

      <p className="text-xs" style={{ color: 'var(--muted)' }}>
        {version ? `Soratra ${version}` : 'A development build of Soratra'}
        {version && !settings.checkForUpdates && ' · Checking for new releases is off'}
      </p>
    </div>
  )
}

function InstanceSettings({ initial }: { initial: { operatorName: string; contact: string; registration: Registration; checkForUpdates: boolean } }) {
  const utils = trpc.useUtils()
  const [operatorName, setOperatorName] = useState(initial.operatorName)
  const [contact, setContact] = useState(initial.contact)
  const [registration, setRegistration] = useState<Registration>(initial.registration)
  const [checkForUpdates, setCheckForUpdates] = useState(initial.checkForUpdates)
  const [saved, setSaved] = useState(false)
  const update = trpc.admin.updateSettings.useMutation({
    onSuccess: () => {
      setSaved(true)
      toast.success('Settings saved.')
      void utils.admin.overview.invalidate()
      void utils.admin.updateStatus.invalidate()
    },
    onError: (error) => toast.error(error.message),
  })

  useEffect(() => setSaved(false), [operatorName, contact, registration, checkForUpdates])

  return (
    <section className="brutalist-card p-5 sm:p-6 space-y-5" style={{ background: 'var(--surface)' }} aria-labelledby="settings-heading">
      <h2 id="settings-heading" className="text-xl font-bold" style={{ fontFamily: 'var(--font-cormorant)' }}>Settings</h2>
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault()
          update.mutate({ operatorName, contact, registration, checkForUpdates })
        }}
      >
        <fieldset className="choice-list">
          <legend className="eyebrow mb-3">Who can join</legend>
          {registrationOptions.map((option) => (
            <label key={option.value} className="choice-card">
              <input type="radio" name="registration" value={option.value} checked={registration === option.value} onChange={() => setRegistration(option.value)} />
              <span className="choice-title">{option.title}</span>
              <span className="choice-copy">{option.copy}</span>
            </label>
          ))}
        </fieldset>

        <div className="space-y-1.5">
          <label htmlFor="operator-name" className="field-label">Your name, as readers see it</label>
          <input id="operator-name" value={operatorName} onChange={(event) => setOperatorName(event.target.value)} maxLength={80} placeholder="Defaults to your username" className="auth-input" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="operator-contact" className="field-label">How readers can reach you</label>
          <input id="operator-contact" value={contact} onChange={(event) => setContact(event.target.value)} maxLength={200} placeholder="An email, a link, or a short note" className="auth-input" />
          <p className="text-xs" style={{ color: 'var(--muted)' }}>Shown on the support, privacy, and forgot-password pages. Optional.</p>
        </div>

        <fieldset className="choice-list">
          <legend className="eyebrow mb-3">Updates</legend>
          <label className="choice-card">
            <input type="checkbox" checked={checkForUpdates} onChange={(event) => setCheckForUpdates(event.target.checked)} />
            <span className="choice-title">Tell me when a new release is out</span>
            <span className="choice-copy">When you open this page, at most once a day, the server asks GitHub for the latest release. Only the server&apos;s address reaches GitHub, nothing about your readers.</span>
          </label>
        </fieldset>

        <button type="submit" disabled={update.isPending} className="btn-primary justify-center">
          {update.isPending ? 'Saving...' : saved ? 'Saved' : 'Save settings'}
        </button>
      </form>
    </section>
  )
}

const UPDATE_COMMANDS = ['docker compose pull', 'docker compose up -d']

function UpdateNotice() {
  const utils = trpc.useUtils()
  const status = trpc.admin.updateStatus.useQuery({ check: true }, { retry: false })

  // Lets the sidebar dot show without waiting for its own, fetch-free query.
  useEffect(() => {
    if (status.data) utils.admin.updateStatus.setData({ check: false }, status.data)
  }, [status.data, utils])

  const data = status.data
  if (!data?.updateAvailable || !data.latest || !data.current) return null
  const { latest, current, majorUpdate } = data
  const nextMajor = latest.version.split('.')[0]
  const notesLink = (
    <a href={latest.url} target="_blank" rel="noreferrer" className="btn-secondary justify-center">
      Read the release notes
    </a>
  )

  return (
    <section className="brutalist-card p-5 sm:p-6 space-y-4" aria-labelledby="update-heading">
      <div className="space-y-1">
        <p className="eyebrow">New release</p>
        <h2 id="update-heading" className="text-xl font-bold" style={{ fontFamily: 'var(--font-cormorant)' }}>
          Soratra {latest.version} is out, you&apos;re on {current}
        </h2>
      </div>

      {majorUpdate ? (
        <>
          <p className="text-sm leading-6" style={{ color: 'var(--muted-strong)' }}>
            This is a new major version, so a plain pull won&apos;t fetch it. Read the release notes first: they say what changes and whether there is anything to do before updating.
          </p>
          {notesLink}
          <ol className="list-decimal pl-5 space-y-2 text-sm leading-6">
            <li>If the notes say <code className="font-mono text-xs">compose.yaml</code> changed, download the new one from the release and replace yours.</li>
            <li>In <code className="font-mono text-xs">.env</code>, set <code className="font-mono text-xs">SORATRA_VERSION={nextMajor}</code>.</li>
            <li>In the folder with <code className="font-mono text-xs">compose.yaml</code>, run:</li>
          </ol>
          <CopyCommand lines={UPDATE_COMMANDS} label="Update commands" />
        </>
      ) : (
        <>
          <p className="text-sm leading-6" style={{ color: 'var(--muted-strong)' }}>
            In the folder with <code className="font-mono text-xs">compose.yaml</code>, run these. The app updates its database when it starts.
          </p>
          <CopyCommand lines={UPDATE_COMMANDS} label="Update commands" />
          <p className="text-xs leading-5" style={{ color: 'var(--muted)' }}>
            If your <code className="font-mono">.env</code> pins <code className="font-mono">SORATRA_VERSION</code> to a release such as {current} or {current.split('.').slice(0, 2).join('.')}, change it to {latest.version} first.
          </p>
          {notesLink}
        </>
      )}
    </section>
  )
}
