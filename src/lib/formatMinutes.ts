// Adaptive duration label: "47 min", "1h 20m", "2h".
export function formatMinutes(total: number): string {
  if (total < 60) return `${total} min`
  const hours = Math.floor(total / 60)
  const mins = total % 60
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`
}
