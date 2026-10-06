import type { Metadata } from 'next'
import Link from 'next/link'
import { siteConfig } from '@/lib/config'
import { auth } from '@/server/auth'

export const metadata: Metadata = {
  title: 'Terms of use',
  description: 'Read the terms for using Soratra, a private reading journal shared with close friends.',
  alternates: { canonical: '/terms' },
  robots: { index: true, follow: true },
}

export default async function TermsPage() {
  const session = await auth()

  return <article className={`${session ? '' : 'public-page-frame '}max-w-3xl space-y-6`}>
    {!session && <Link href="/landing" className="public-home-link">Back to home</Link>}
    <h1 className="text-5xl font-bold" style={{ fontFamily: 'var(--font-cormorant)' }}>Terms of use</h1>
    <p>Last updated: 30 September 2026. These terms govern Soratra, operated by {siteConfig.legalName}. Questions can be sent to <a className="underline" href={`mailto:${siteConfig.supportEmail}`}>{siteConfig.supportEmail}</a>.</p>
    <section className="space-y-2"><h2 className="text-2xl font-bold">Using Soratra</h2><p>Soratra is a personal reading journal. Keep your account credentials confidential and use the service lawfully and respectfully. Do not attempt to access another reader's private data or interfere with the service.</p></section>
    <section className="space-y-2"><h2 className="text-2xl font-bold">Friends</h2><p>You may connect only by entering the exact username someone has shared with you. Friend requests require acceptance. Accepted friends can see the reading shelves, journal entries, ratings, and reviews described in the Privacy Policy. Spoiler-marked notes and reviews are hidden until a friend chooses to reveal them. Email addresses and time zones remain private. You can decline, cancel, or remove a connection at any time; removal immediately ends shared reading access for both people.</p></section>
    <section className="space-y-2"><h2 className="text-2xl font-bold">Availability</h2><p>Soratra is provided without a guarantee of uninterrupted availability. Book metadata is supplied by Open Library. Back up anything important through the built-in export feature.</p></section>
    <section className="space-y-2"><h2 className="text-2xl font-bold">Changes</h2><p>Material changes to these terms or the Privacy Policy will be published here with a revised date.</p></section>
    <p className="text-sm" style={{ color: 'var(--muted)' }}>Read the <Link className="underline" href="/privacy">Privacy Policy</Link>.</p>
  </article>
}
