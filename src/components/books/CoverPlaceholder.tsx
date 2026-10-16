import { getPastelColor } from '@/lib/pastel'

interface CoverPlaceholderProps {
  title: string
  author?: string
  // sm is for thumbnails too small to hold readable text.
  size?: 'sm' | 'md' | 'lg'
}

// Drawn under every cover image, so it also shows while the real cover loads
// and stays if it never does. Decorative: the title is always named nearby.
export function CoverPlaceholder({ title, author, size = 'md' }: CoverPlaceholderProps) {
  const background = getPastelColor(title)
  if (size === 'sm') {
    return <div aria-hidden="true" className="absolute inset-0" style={{ background }} />
  }
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 flex flex-col items-center justify-center text-center"
      style={{ background, padding: size === 'lg' ? '1.5rem 1.25rem' : '1.25rem 0.9rem' }}
    >
      <div className="w-full mb-3" style={{ borderTop: '1px solid var(--rule)' }} />
      <span
        className="font-semibold leading-snug line-clamp-5"
        style={{ fontFamily: 'var(--font-cormorant)', fontSize: size === 'lg' ? '1.4rem' : '1.05rem' }}
      >
        {title}
      </span>
      {author && (
        <span
          className="mt-2 line-clamp-1 uppercase"
          style={{ fontSize: '0.6rem', letterSpacing: '0.14em', color: 'var(--muted-strong)' }}
        >
          {author}
        </span>
      )}
      <div className="w-full mt-3" style={{ borderTop: '1px solid var(--rule)' }} />
    </div>
  )
}
