export function calculateStreak(
  sessionDates: string[],
  today: string,
  frozenDates: string[] = [],
): number {
  const allDates = [...new Set([...sessionDates, ...frozenDates])].sort()
  if (allDates.length === 0) return 0

  const last = allDates[allDates.length - 1]
  const todayDate = new Date(today)
  const lastDate = new Date(last)
  const diffDays = Math.round((todayDate.getTime() - lastDate.getTime()) / 86_400_000)

  if (diffDays > 1) return 0

  let streak = 0
  let cursor = new Date(diffDays === 0 ? today : last)

  for (let i = allDates.length - 1; i >= 0; i--) {
    const d = new Date(allDates[i])
    const gap = Math.round((cursor.getTime() - d.getTime()) / 86_400_000)
    if (gap > 1) break
    streak++
    cursor = d
  }

  return streak
}
