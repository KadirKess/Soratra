import type { Metadata } from 'next'
import Link from 'next/link'
import { siteConfig } from '@/lib/config'
import { auth } from '@/server/auth'

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: 'Learn how Soratra protects your reading journal, personal data, and private sharing with friends.',
  alternates: { canonical: '/privacy' },
  robots: { index: true, follow: true },
}

export default async function PrivacyPage() {
  const session = await auth()

  return <article className={`${session ? '' : 'public-page-frame '}max-w-3xl space-y-6`}>
    {!session && <Link href="/landing" className="public-home-link">Back to home</Link>}
    <h1 className="text-5xl font-bold" style={{ fontFamily: 'var(--font-cormorant)' }}>Privacy policy</h1>
    <p>Last updated: 30 September 2026. This policy is provided by {siteConfig.legalName}, the operator of this instance. Contact: <a className="underline" href={`mailto:${siteConfig.supportEmail}`}>{siteConfig.supportEmail}</a>.</p>
    <section className="space-y-2"><h2 className="text-2xl font-bold">What Soratra stores</h2><p>Soratra stores your account email, username, password hash, reading shelves, ratings, reviews, check-ins, notes, streak freezes, consent record, and selected time zone so the service can provide your reading journal.</p></section>
    <section className="space-y-2"><h2 className="text-2xl font-bold">Private social activity</h2><p>Signed-in readers can look up an exact username they have been given; Soratra does not provide a public directory, suggestions, or fuzzy people search. Only accepted friends can see your username, reading shelves, reading streak, heatmap, and reading journal. The journal includes a session&apos;s book, local date, minutes, rating, and note, while finished books may include a rating and review. Spoiler-marked notes and reviews stay hidden until a friend chooses to reveal them. Your email address and time zone are never shared with friends. Removing a friend immediately ends shared access for both people.</p></section>
    <section className="space-y-2"><h2 className="text-2xl font-bold">Service providers</h2><p>Account and reading data are stored in the PostgreSQL database managed by this instance operator. Ask the operator about their hosting provider, location, log retention, and backup retention. Book search requests are made server-side to Open Library without forwarding your IP. When email delivery is configured, Resend processes password-reset emails, including the recipient address and reset message. The instance server also fetches book cover images from Open Library through its image proxy. Soratra does not use advertising or third-party analytics trackers. It records first-party operational performance logs containing only a route or metric name, duration/value, and response size; they never include reading data, account identifiers, IP addresses, or a persistent client identifier.</p></section>
    <section className="space-y-2"><h2 className="text-2xl font-bold">Your choices</h2><p>You can export your data from Profile. When you delete your account, Soratra immediately deletes your shelves, reviews, sessions, notes, freezes, friendships, and reset tokens. A pseudonymized account tombstone is retained for 30 days before the scheduled purge. It retains the consent timestamp and consent-version record with that tombstone only to document the consent that permitted processing, then the purge removes it too. Operators must run the scheduled purge. Private backups may retain earlier data until the operator removes them under their backup retention policy.</p></section>
    <section className="space-y-2"><h2 className="text-2xl font-bold">Your rights</h2><p>Depending on your circumstances, you may request access, correction, restriction, objection, portability, or erasure. Contact {siteConfig.supportEmail}; you may also complain to the relevant supervisory authority.</p></section>
    <p className="text-sm" style={{ color: 'var(--muted)' }}>See the <Link className="underline" href="/terms">Terms of Use</Link>.</p>
  </article>
}
