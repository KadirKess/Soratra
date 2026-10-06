import type { Metadata } from 'next'
import Link from 'next/link'
import { auth } from '@/server/auth'
import { redirect } from 'next/navigation'
import { siteConfig } from '@/lib/config'

export const metadata: Metadata = {
  title: { absolute: 'Book Tracker & Reading Journal | Soratra' },
  description: 'Track books, log your reading, write reviews, and share your shelves with friends.',
  alternates: { canonical: '/landing' },
  openGraph: {
    type: 'website',
    url: '/landing',
    siteName: 'Soratra',
    title: 'Soratra — Your reading life, collected',
    description: 'Track books, log your reading, write reviews, and share your shelves with friends.',
    images: [{ url: '/landing/opengraph-image', width: 1200, height: 630, alt: 'Soratra, a book tracker and reading journal' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Soratra — Your reading life, collected',
    description: 'Track books, log your reading, write reviews, and share your shelves with friends.',
    images: ['/landing/opengraph-image'],
  },
  robots: { index: true, follow: true },
}

const principles = [
  {
    number: '01',
    title: 'Build your shelves',
    copy: 'Keep the books you want to read, are reading, and have finished in one place.',
    tone: 'var(--sky)',
  },
  {
    number: '02',
    title: 'Log the reading',
    copy: 'Record the time you spend with a book, then leave a note for your future self.',
    tone: 'var(--straw)',
  },
  {
    number: '03',
    title: 'Compare notes',
    copy: 'See what your friends are reading, then share the books and thoughts you want to talk about.',
    tone: 'var(--sage)',
  },
]

export default async function LandingPage() {
  const session = await auth()
  if (session) redirect('/')

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: 'Soratra',
        url: siteConfig.siteUrl,
        email: siteConfig.supportEmail,
      },
      {
        '@type': 'WebApplication',
        name: 'Soratra',
        url: new URL('/landing', siteConfig.siteUrl).toString(),
        applicationCategory: 'LifestyleApplication',
        operatingSystem: 'Web',
        description: 'Track books, log your reading, write reviews, and share your shelves with friends.',
      },
    ],
  }

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 sm:py-8" id="main-content">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <a href="#landing-intro" className="skip-link">Skip to the introduction</a>
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between gap-4 border-b-2 pb-5" style={{ borderColor: 'var(--border)' }}>
          <Link href="/landing" className="flex items-baseline gap-3" aria-label="Soratra home">
            <span className="display text-4xl font-semibold leading-none">Soratra</span>
            <span className="hidden text-xs font-semibold uppercase tracking-[0.18em] sm:inline" style={{ color: 'var(--muted)' }}>Reading journal</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/signin" className="text-sm font-semibold underline underline-offset-4">Sign in</Link>
            <Link href="/signup" className="btn-primary px-4 py-2">Create account</Link>
          </div>
        </header>

        <section id="landing-intro" className="grid gap-8 py-12 md:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)] md:items-end md:py-20">
          <div className="max-w-3xl">
            <p className="mb-5 text-xs font-bold uppercase tracking-[0.22em]" style={{ color: 'var(--accent-ink)' }}>A home for your reading life</p>
            <h1 className="display max-w-3xl text-6xl font-semibold leading-none sm:text-7xl md:text-8xl">
              Keep a life in books.
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8" style={{ color: 'var(--muted-strong)' }}>
              Track, rate, and review books. Keep up with what your friends are reading.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/signup" className="btn-primary px-5 py-3 text-base">Start your journal</Link>
              <Link href="/signin" className="btn-secondary px-5 py-3 text-base">I already have an account</Link>
            </div>
          </div>

          <aside className="brutalist-card overflow-hidden" style={{ background: 'var(--surface)' }} aria-label="A glimpse of a reading journal">
            <div className="border-b-2 px-5 py-4" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--muted)' }}>Today&apos;s page</p>
            </div>
            <div className="space-y-5 p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-20 w-14 shrink-0 items-center justify-center border-2 text-3xl" style={{ borderColor: 'var(--border)', background: 'var(--blush)', fontFamily: 'var(--font-cormorant)' }}>S</div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--muted)' }}>Currently reading</p>
                  <p className="display mt-1 text-3xl font-semibold leading-none">A book worth lingering over</p>
                </div>
              </div>
              <div className="border-y-2 py-4" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-baseline justify-between gap-4">
                  <p className="text-sm font-semibold">Today&apos;s reading</p>
                  <p className="display text-3xl font-semibold">47 min</p>
                </div>
                <div className="mt-3 h-3 border-2" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                  <div className="h-full w-[58%]" style={{ background: 'var(--sage)' }} />
                </div>
              </div>
              <p className="text-sm leading-6" style={{ color: 'var(--muted-strong)' }}>The point is not to perform a perfect streak. It is to leave a small, honest record of the time you found.</p>
            </div>
          </aside>
        </section>

        <section className="border-y-2 py-8 sm:py-10" style={{ borderColor: 'var(--border)' }} aria-labelledby="landing-principles">
          <div className="mb-7 flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="landing-principles" className="display text-4xl font-semibold sm:text-5xl">A book tracker for the books that matter.</h2>
            <p className="text-sm font-semibold" style={{ color: 'var(--muted)' }}>Built for readers, not an audience.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {principles.map((principle) => (
              <article key={principle.number} className="brutalist-card min-h-56 p-5" style={{ background: principle.tone }}>
                <p className="text-xs font-bold tracking-[0.18em]" style={{ color: 'var(--muted-strong)' }}>{principle.number}</p>
                <h3 className="display mt-8 text-3xl font-semibold leading-none">{principle.title}</h3>
                <p className="mt-4 text-sm leading-6" style={{ color: 'var(--muted-strong)' }}>{principle.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-6 py-12 sm:py-16 md:grid-cols-3" aria-labelledby="landing-how-it-works">
          <div className="md:col-span-1">
            <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: 'var(--accent-ink)' }}>A simple reading log</p>
            <h2 id="landing-how-it-works" className="display mt-3 text-5xl font-semibold leading-[0.9]">Everything you want to remember about reading.</h2>
          </div>
          <div className="space-y-4 text-base leading-7 md:col-span-2" style={{ color: 'var(--muted-strong)' }}>
            <p>Keep the books you want to read, are reading, and have finished. Log the time you spend reading, rate the books you finish, and leave a small note for your future self.</p>
            <p>Share your shelves and reading journal with friends, without turning reading into a performance.</p>
          </div>
        </section>

        <section className="grid gap-6 py-12 sm:py-16 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h2 className="display max-w-2xl text-5xl font-semibold leading-[0.9] sm:text-6xl">Keep close what matters.</h2>
            <p className="mt-5 max-w-xl text-base leading-7" style={{ color: 'var(--muted-strong)' }}>
              Build your shelves, log your reading, and keep up with the friends who make you want to read more.
            </p>
          </div>
          <Link href="/signup" className="btn-primary w-fit px-5 py-3 text-base">Create a free account</Link>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-4 border-t-2 py-6 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
          <p>Made for the love of reading.</p>
          <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Footer">
            <Link href="/privacy" className="underline underline-offset-4">Privacy</Link>
            <Link href="/terms" className="underline underline-offset-4">Terms</Link>
            <Link href="/support" className="underline underline-offset-4">Support</Link>
          </nav>
        </footer>
      </div>
    </main>
  )
}
