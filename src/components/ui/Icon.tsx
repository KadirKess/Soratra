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
