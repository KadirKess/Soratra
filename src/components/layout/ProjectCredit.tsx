import Link from 'next/link'

export function ProjectCredit() {
  return (
    <footer className="px-4 py-3 text-center text-xs" style={{ color: 'var(--muted)' }}>
      <Link href="/about" className="underline underline-offset-2">Soratra · About and source</Link>
    </footer>
  )
}
