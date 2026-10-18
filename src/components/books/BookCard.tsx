'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { CoverPlaceholder } from './CoverPlaceholder'
import { titlesMatch } from '@/lib/titles'

interface BookCardProps {
  openLibraryId: string
  title: string
  originalTitle?: string
  authors: string[]
  coverUrl: string | null
  publishedDate?: string | null
  compact?: boolean
}

export function BookCard({ openLibraryId, title, originalTitle, authors, coverUrl, publishedDate, compact }: BookCardProps) {
  const [imgError, setImgError] = useState(false)
  const slug = encodeURIComponent(openLibraryId)
  const href = `/books/${slug}`
  const canonicalTitle = originalTitle ?? title
  const localizedTitle = titlesMatch(title, canonicalTitle) ? null : title
  const showCover = coverUrl && !imgError

  return (
    <Link href={href} prefetch={false} className="group block cursor-pointer">
      <div className="cover cover-raised brutalist-card-hover">
        <CoverPlaceholder title={canonicalTitle} author={authors[0]} />
        {showCover && (
          <Image
            src={coverUrl}
            alt={canonicalTitle}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 768px) 50vw, 200px"
            onError={() => setImgError(true)}
          />
        )}
      </div>
      {compact && (
		<div className="mt-2 px-0.5">
          <p className="text-sm font-semibold leading-tight line-clamp-2" style={{ color: 'var(--fg)' }}>
            {canonicalTitle}
          </p>
          {authors[0] && (
            <p className="text-xs truncate mt-0.5" style={{ color: 'var(--muted)' }}>
              {authors.join(', ')}
            </p>
          )}
        </div>
      )}
      {!compact && (
        <div className="mt-2 px-0.5">
          <p data-testid="book-card-original-title" className="text-sm font-semibold leading-tight line-clamp-2" style={{ color: 'var(--fg)' }}>
            {canonicalTitle}
          </p>
          {localizedTitle && (
            <p data-testid="book-card-localized-title" className="mt-0.5 leading-snug line-clamp-2" style={{ color: 'var(--fg)', fontFamily: 'var(--font-cormorant)', fontSize: '1.05rem' }}>
              {localizedTitle}
            </p>
          )}
          <p className="text-xs truncate mt-0.5" style={{ color: 'var(--muted)' }}>
            {authors.join(', ')}
            {publishedDate ? ` · ${publishedDate}` : ''}
          </p>
        </div>
      )}
    </Link>
  )
}
