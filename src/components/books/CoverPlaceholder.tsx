import type { CSSProperties } from 'react'
import { coverTitle, coverTitleSize } from '@/lib/coverTitle'
import { getPastelColor } from '@/lib/pastel'

interface CoverPlaceholderProps {
  title: string
  author?: string
  // sm is for thumbnails too small to hold readable text.
  size?: 'sm' | 'md' | 'lg'
}

// Drawn under every cover image, so it also shows while the real cover loads
// and stays if it never does. Decorative: the title is always named nearby.
// The type scales with the cover (see .cover-placeholder), so md and lg only
// differ in how big the cover is.
export function CoverPlaceholder({ title, author, size = 'md' }: CoverPlaceholderProps) {
  const background = getPastelColor(title)
  if (size === 'sm') {
    return <div aria-hidden="true" className="absolute inset-0" style={{ background }} />
  }
  const shown = coverTitle(title)
  return (
    <div aria-hidden="true" className="cover-placeholder" style={{ background }}>
      <div className="cover-placeholder__inner">
        <span className="cover-placeholder__title" style={{ '--title-size': `${coverTitleSize(shown)}cqw` } as CSSProperties}>
          {shown}
        </span>
        {author && <span className="cover-placeholder__author">{author}</span>}
      </div>
    </div>
  )
}
