'use client'

import { useId } from 'react'

interface StarRatingProps {
  value: number | null
  onChange: (value: number | null) => void
  readOnly?: boolean
  id?: string
  ariaLabel?: string
  className?: string
}

export function StarRating({ value, onChange, readOnly, id, ariaLabel, className }: StarRatingProps) {
  const rating = value ?? 0

  function handleRatingKey(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault()
      onChange(Math.min(rating + 0.5, 5))
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault()
      const next = Math.max(rating - 0.5, 0)
      onChange(next === 0 ? null : next)
    }
  }

  if (readOnly) {
    return (
      <span role="img" aria-label={value === null ? 'No rating' : `${value} stars`} className={`inline-flex gap-0.5 ${className ?? 'text-2xl sm:text-3xl'}`}>
        {[1, 2, 3, 4, 5].map((star) => <StarShape key={star} fill={starFill(rating, star)} />)}
      </span>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div
        id={id}
        role="group"
        aria-label={ariaLabel ?? 'Rating'}
        className="flex items-center"
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className="flex h-11 w-11 items-center justify-center text-2xl sm:text-3xl"
            onClick={(event) => {
              const bounds = event.currentTarget.getBoundingClientRect()
              const isRightHalf = event.detail === 0 || event.clientX - bounds.left >= bounds.width / 2
              onChange(star - 0.5 + (isRightHalf ? 0.5 : 0))
            }}
            onKeyDown={handleRatingKey}
            aria-label={`Set rating to ${star - 0.5} or ${star} stars; use left or right half of the star`}
            aria-pressed={rating === star - 0.5 || rating === star}
          >
            <StarShape fill={starFill(rating, star)} />
          </button>
        ))}
      </div>
      <span className="text-sm font-semibold" style={{ color: 'var(--muted)' }} aria-live="polite">
        {rating === 0 ? 'No rating' : `${rating} / 5`}
      </span>
      {rating > 0 && (
        <button type="button" onClick={() => onChange(null)} className="h-11 px-2 text-xs" style={{ color: 'var(--muted)' }}>
          Clear
        </button>
      )}
    </div>
  )
}

function starFill(rating: number, star: number): 0 | 0.5 | 1 {
  if (rating >= star) return 1
  if (rating >= star - 0.5) return 0.5
  return 0
}

function StarShape({ fill }: { fill: 0 | 0.5 | 1 }) {
  const clipId = useId().replace(/:/g, '')

  return (
    <svg className="h-[1em] w-[1em]" viewBox="0 0 20 20" aria-hidden="true">
      {fill === 0.5 && (
        <defs>
          <clipPath id={clipId}>
            <rect x="0" y="0" width="10" height="20" />
          </clipPath>
        </defs>
      )}
      <polygon
        points="10,2 12.4,7.8 18.5,8.2 14,12.3 15.5,18.5 10,15.2 4.5,18.5 6,12.3 1.5,8.2 7.6,7.8"
        fill={fill === 1 ? 'var(--accent)' : 'none'}
        stroke="var(--accent)"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {fill === 0.5 && (
        <polygon
          points="10,2 12.4,7.8 18.5,8.2 14,12.3 15.5,18.5 10,15.2 4.5,18.5 6,12.3 1.5,8.2 7.6,7.8"
          fill="var(--accent)"
          clipPath={`url(#${clipId})`}
        />
      )}
    </svg>
  )
}
