const PASTELS = ['sage', 'blush', 'sky', 'straw'] as const

// A book keeps one pastel everywhere: its placeholder cover, journal entries
// and lists all hash the title the same way.
function pastelFor(str: string) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return PASTELS[Math.abs(hash) % PASTELS.length]
}

export function getPastelColor(str: string): string {
  return `var(--${pastelFor(str)})`
}

/** The matching .tint-* class, which also swaps in the stronger muted grey. */
export function getPastelTint(str: string): string {
  return `tint-${pastelFor(str)}`
}
