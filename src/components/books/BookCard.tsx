'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { getPastelColor } from '@/lib/pastel'
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
  const fallbackColor = getPastelColor(canonicalTitle)
  const showCover = coverUrl && !imgError

  return (
    <Link href={href} prefetch={false} className="group block cursor-pointer">
      <div
        className="brutalist-card brutalist-card-hover relative overflow-hidden"
        style={{ aspectRatio: '2/3' }}
      >
        {showCover ? (
          <>
            <Image
              src={coverUrl}
              alt={canonicalTitle}
              fill
				className="object-cover transition-transform duration-300 group-hover:scale-105 rounded-[10px]"
              sizes="(max-width: 768px) 50vw, 200px"
              onError={() => setImgError(true)}
            />
            <div
				className="absolute inset-0 flex flex-col justify-end p-3 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-200 rounded-[10px]"
              style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 60%)' }}
            >
              <p className="text-white text-sm font-semibold leading-tight line-clamp-2">{canonicalTitle}</p>
              {localizedTitle && <p className="text-white/70 text-xs mt-0.5 truncate">{localizedTitle}</p>}
              <p className="text-white/70 text-xs mt-0.5 truncate">{authors.join(', ')}</p>
            </div>
          </>
        ) : (
          <div
            className="w-full h-full flex flex-col items-center justify-center px-4 py-5 rounded-[10px] relative overflow-hidden"
            style={{ background: fallbackColor }}
          >
            {/* Top rule */}
            <div className="w-full mb-3" style={{ borderTop: '1.5px solid rgba(28,25,23,0.25)' }} />

            <span
              className="text-center leading-snug font-semibold line-clamp-5 px-1"
              style={{ fontFamily: 'var(--font-cormorant)', color: 'var(--fg)', fontSize: '1.05rem' }}
            >
              {canonicalTitle}
            </span>

            {authors[0] && (
              <span
                className="text-center mt-2 line-clamp-1 tracking-widest uppercase"
                style={{ color: 'var(--fg)', fontSize: '0.6rem', opacity: 0.55 }}
              >
                {authors[0]}
              </span>
            )}

            {/* Bottom rule */}
            <div className="w-full mt-3" style={{ borderTop: '1.5px solid rgba(28,25,23,0.25)' }} />

            {/* Hover overlay — consistent with cover cards */}
            <div
				className="absolute inset-0 flex flex-col justify-end p-3 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-200 rounded-[10px]"
              style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 55%)' }}
            >
              <p className="text-white text-sm font-semibold leading-tight line-clamp-2">{canonicalTitle}</p>
              {localizedTitle && <p className="text-white/70 text-xs mt-0.5 truncate">{localizedTitle}</p>}
              <p className="text-white/70 text-xs mt-0.5 truncate">{authors.join(', ')}</p>
            </div>
          </div>
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
