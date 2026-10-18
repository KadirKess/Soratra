// Type for the title printed on placeholder covers. Sizes are in cqw, a
// percentage of the cover's width, so a placeholder looks the same at every
// size. Picked from the text alone, so the server renders the final layout.

// Average Cormorant semibold glyph width, in em, with a little slack for capitals.
const GLYPH_EM = 0.48
// Usable text width after the side padding, in cqw.
const TEXT_WIDTH = 84
const MAX_LINES = 4
const SIZES = [14, 13, 12, 11, 10, 9, 8] as const

/** The main title: a subtitle after a colon doesn't fit on a small cover. */
export function coverTitle(title: string): string {
  const main = title.split(':')[0]?.trim() ?? ''
  return main || title.trim()
}

/** The largest size where the longest word fits on a line and the title in four lines. */
export function coverTitleSize(title: string): number {
  const words = title.split(/\s+/).filter(Boolean)
  const longest = Math.max(1, ...words.map((word) => word.length))
  for (const size of SIZES) {
    const perLine = Math.floor(TEXT_WIDTH / (size * GLYPH_EM))
    if (longest <= perLine && estimateLines(words, perLine) <= MAX_LINES) return size
  }
  return SIZES[SIZES.length - 1]
}

// Greedy word wrap, the way the browser fills lines.
function estimateLines(words: string[], perLine: number): number {
  let lines = 1
  let used = 0
  for (const word of words) {
    const needed = used === 0 ? word.length : used + 1 + word.length
    if (needed <= perLine) {
      used = needed
    } else {
      lines += 1
      used = word.length
    }
  }
  return lines
}
