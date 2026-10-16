const PASTELS = ['var(--sage)', 'var(--blush)', 'var(--sky)', 'var(--straw)']

export function getPastelColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return PASTELS[Math.abs(hash) % PASTELS.length]
}
