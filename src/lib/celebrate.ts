import { toast } from 'sonner'

// Streak lengths worth a moment of acknowledgement. Fires on reaching one,
// never on missing one -- celebration, not pressure.
const MILESTONES = [7, 14, 30, 50, 100, 150, 200, 365]

export function celebrateSession(prevStreak: number, newStreak: number) {
  const milestone = MILESTONES.find((m) => newStreak >= m && prevStreak < m)
  if (milestone) {
    toast(`${milestone}-day streak`, {
      description: 'Beautiful, steady reading. Keep going.',
      duration: 6000,
    })
    return
  }
  stampLogged()
}

// The one bit of motion the app spends on purpose: a check-in presses in like
// an ink stamp, then lifts away. It replaces the toast rather than joining it,
// and readers who ask for reduced motion get the toast instead.
function stampLogged() {
  if (typeof window === 'undefined') return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    toast.success('Logged')
    return
  }
  const stamp = document.createElement('div')
  stamp.className = 'ink-stamp'
  stamp.setAttribute('role', 'status')
  stamp.setAttribute('aria-live', 'polite')
  stamp.innerHTML = '<span class="ink-stamp__mark">Logged</span>'
  stamp.addEventListener('animationend', () => stamp.remove(), { once: true })
  document.body.appendChild(stamp)
  // Fallback in case the animation never runs, for example in a hidden tab.
  window.setTimeout(() => stamp.remove(), 2000)
}

export function celebrateFinished(title?: string) {
  toast(title ? `Finished ${title}` : 'Book finished', {
    description: 'One more for the year. Well read.',
    duration: 6000,
  })
}
