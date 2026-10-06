import type { Metadata } from 'next'
import Link from 'next/link'
import { getSourceCodeUrl } from '@/lib/config'

export const metadata: Metadata = {
  title: 'About Soratra',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default function AboutPage() {
  const sourceUrl = getSourceCodeUrl()

  return (
    <article className="public-page-frame max-w-3xl space-y-5">
      <Link href="/landing" className="public-home-link">Back to home</Link>
      <h1 className="text-5xl font-bold" style={{ fontFamily: 'var(--font-cormorant)' }}>About Soratra</h1>
      <p>A reading journal you can run for yourself and your friends.</p>
      <p>Based on Soratra. Copyright (C) 2026 KadirKess and contributors.</p>
      <p>
        Licensed under the GNU Affero General Public License, version 3 only.
        You may use, modify, and redistribute this software under that license, including for commercial purposes.
        Soratra comes without any warranty, to the extent permitted by applicable law.
      </p>
      <p>
        <a className="underline" href={sourceUrl}>Get the corresponding source</a>
        {' · '}
        <a className="underline" href="/license.txt">Read the license</a>
        {' · '}
        <a className="underline" href="/notices.txt">Read the notices</a>
      </p>
      <p className="text-sm" style={{ color: 'var(--muted)' }}>
        This instance is independently operated. Its operator handles your data and support requests.
        See its <Link className="underline" href="/privacy">privacy policy</Link> and <Link className="underline" href="/support">support page</Link>.
      </p>
    </article>
  )
}
