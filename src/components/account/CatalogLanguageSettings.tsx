'use client'

import { useState } from 'react'
import { catalogLanguages, type CatalogLanguage } from '@/lib/catalogLanguages'
import { trpc } from '@/lib/trpc/client'

export function CatalogLanguageSettings() {
  const { data: me } = trpc.users.me.useQuery()
  const [selection, setPreferredLanguage] = useState<CatalogLanguage | null>(null)
  const preferredLanguage = selection ?? me?.preferredLanguage ?? 'en'
  const save = trpc.users.setPreferredLanguage.useMutation()

  return <div className="brutalist-card tint-sky p-5 sm:p-6 space-y-3">
    <div>
      <p className="eyebrow">Book titles</p>
      <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Search favors editions in this language. English is used when Open Library returns it instead.</p>
    </div>
    <label htmlFor="catalog-language" className="text-sm font-semibold">Preferred language</label>
    <select id="catalog-language" value={preferredLanguage} disabled={!me} onChange={(event) => setPreferredLanguage(event.target.value as CatalogLanguage)} className="brutalist-input w-full">
      {catalogLanguages.map((language) => <option key={language.code} value={language.code}>{language.label}</option>)}
    </select>
    {save.error && <p className="form-error" role="alert">{save.error.message}</p>}
    <button type="button" onClick={() => save.mutate({ preferredLanguage })} disabled={!me || save.isPending} className="btn-secondary">
      {save.isPending ? 'Saving...' : 'Save preferred language'}
    </button>
  </div>
}
