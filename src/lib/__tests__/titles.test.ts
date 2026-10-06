import { describe, expect, it } from 'vitest'
import { titlesMatch } from '../titles'

describe('titlesMatch', () => {
  it('ignores casing, surrounding whitespace, and Unicode compatibility forms', () => {
    expect(titlesMatch('La Peste', ' la peste ')).toBe(true)
    expect(titlesMatch('ＡＢＣ', 'abc')).toBe(true)
  })

  it('keeps genuinely different titles distinct', () => {
    expect(titlesMatch('La Peste', 'The Plague')).toBe(false)
  })
})
