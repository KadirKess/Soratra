const PASTELS = ['#C8DDB8', '#F2C4AE', '#B8D0E0', '#EDD98A']

export function getPastelColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return PASTELS[Math.abs(hash) % PASTELS.length]
}
