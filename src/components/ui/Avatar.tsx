import { getPastelColor } from '@/lib/pastel'

const SIZES = { sm: 28, md: 36, lg: 64 } as const

interface AvatarProps {
  username: string
  size?: keyof typeof SIZES
}

// Readers have no photos, so a person is their initial in an ink ring, on a
// pastel picked from the username so the same reader always looks the same.
export function Avatar({ username, size = 'md' }: AvatarProps) {
  const px = SIZES[size]
  const initial = username.trim().charAt(0).toUpperCase() || '?'
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold leading-none select-none"
      style={{
        width: px,
        height: px,
        border: `${size === 'lg' ? 2 : 1.5}px solid var(--fg)`,
        background: getPastelColor(username),
        boxShadow: size === 'lg' ? 'var(--shadow-small)' : undefined,
        fontFamily: 'var(--font-cormorant)',
        fontSize: px * 0.5,
      }}
    >
      {initial}
    </span>
  )
}
