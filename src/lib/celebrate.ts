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
  toast.success('Logged for today')
}

export function celebrateFinished(title?: string) {
  toast(title ? `Finished ${title}` : 'Book finished', {
    description: 'One more for the year. Well read.',
    duration: 6000,
  })
}
