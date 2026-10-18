import type { SVGProps } from 'react'

// One small icon family: 24-unit grid, round caps, and a stroke that renders
// close to the 2px ink border at the sizes we use.

type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & { size?: number | string }

function base({ size = '1em', strokeWidth = 2, ...props }: IconProps): SVGProps<SVGSVGElement> {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    focusable: false,
    ...props,
  }
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

// Same outline as the rating stars, so a "4.5 ★" meta line matches the picker.
export function StarIcon({ filled = true, ...props }: IconProps & { filled?: boolean }) {
  return (
    <svg {...base({ strokeWidth: 1.6, ...props })}>
      <path
        d="M12 2.6l2.8 6 6.5.6-4.9 4.4 1.5 6.4L12 16.7 6.1 20l1.5-6.4L2.7 9.2l6.5-.6z"
        fill={filled ? 'currentColor' : 'none'}
      />
    </svg>
  )
}

// An ink-drawn flame for the reading streak, unlit when there is no streak.
// It is shown large, so the stroke is pinned to the 2px ink border width.
export function FlameIcon({ lit = true, ...props }: IconProps & { lit?: boolean }) {
  return (
    <svg {...base({ strokeWidth: 2, ...props })} stroke={lit ? 'var(--fg)' : 'var(--muted)'}>
      <path
        vectorEffect="non-scaling-stroke"
        d="M12 22c-4 0-7-2.9-7-6.8 0-2.7 1.4-4.6 3-6.3.3 1.6 1.1 2.8 2.3 3.3C10 8.7 11 5.3 13.5 2c.4 3.2 2.3 5.3 3.9 7.4 1.1 1.5 1.6 3.1 1.6 4.8 0 4.4-3 7.8-7 7.8z"
        fill={lit ? 'var(--accent)' : 'none'}
      />
      <path
        vectorEffect="non-scaling-stroke"
        d="M12 22c-1.9 0-3.2-1.4-3.2-3.2 0-1.6 1-2.6 2.2-3.8.3 1 .8 1.6 1.5 1.8.1-1.4.6-2.6 1.6-3.6.9 1.6 2.1 2.8 2.1 4.9 0 2.3-1.6 3.9-4.2 3.9z"
        fill={lit ? 'var(--straw)' : 'none'}
      />
    </svg>
  )
}

// Navigation. Slightly heavier, since they sit at 20px next to labels.
export function HomeIcon(props: IconProps) {
  return (
    <svg {...base({ strokeWidth: 2.25, ...props })}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

export function LibraryIcon(props: IconProps) {
  return (
    <svg {...base({ strokeWidth: 2.25, ...props })}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  )
}

export function JournalIcon(props: IconProps) {
  return (
    <svg {...base({ strokeWidth: 2.25, ...props })}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  )
}

export function FriendsIcon(props: IconProps) {
  return (
    <svg {...base({ strokeWidth: 2.25, ...props })}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

export function ProfileIcon(props: IconProps) {
  return (
    <svg {...base({ strokeWidth: 2.25, ...props })}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

// "Your Soratra": the person who runs it holds the key.
export function KeyIcon(props: IconProps) {
  return (
    <svg {...base({ strokeWidth: 2.25, ...props })}>
      <circle cx="8" cy="15" r="4.5" />
      <path d="M11.2 11.8L20 3" />
      <path d="M16.5 6.5l2.5 2.5" />
      <path d="M14 9l2 2" />
    </svg>
  )
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...base({ strokeWidth: 2.5, ...props })}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  )
}
