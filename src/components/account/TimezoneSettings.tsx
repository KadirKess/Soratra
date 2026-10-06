'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc/client'

function getTimeZones() {
  const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
  const supported = typeof Intl.supportedValuesOf === 'function'
    ? Intl.supportedValuesOf('timeZone')
    : []

  return [...new Set(['UTC', detected, ...supported])].sort((a, b) => a.localeCompare(b))
}

export function TimezoneSettings() {
  const { data: me } = trpc.users.me.useQuery()
  const [selection, setTimezone] = useState<string | null>(null)
  const timezone = selection ?? me?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  const save = trpc.users.setTimezone.useMutation()
  const timeZones = getTimeZones()

  return <div className="brutalist-card p-5 space-y-3">
    <div>
      <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Reading day</p>
      <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Your streak and check-ins use this time zone.</p>
    </div>
    <label htmlFor="timezone" className="text-sm font-semibold">Time zone</label>
    <select id="timezone" value={timezone} disabled={!me} onChange={(event) => setTimezone(event.target.value)} className="brutalist-input w-full" aria-describedby="timezone-help">
      {timeZones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
    </select>
    <p id="timezone-help" className="text-xs" style={{ color: 'var(--muted)' }}>We detected {Intl.DateTimeFormat().resolvedOptions().timeZone} on this device.</p>
    {save.error && <p className="text-sm" role="alert" style={{ color: 'var(--accent)' }}>{save.error.message}</p>}
    <button type="button" onClick={() => save.mutate({ timezone })} disabled={!me || save.isPending || !timezone} className="btn-secondary">
      {save.isPending ? 'Saving...' : 'Save time zone'}
    </button>
  </div>
}
