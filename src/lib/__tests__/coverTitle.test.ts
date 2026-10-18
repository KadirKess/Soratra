import { describe, expect, it } from 'vitest'
import { coverTitle, coverTitleSize } from '../coverTitle'

describe('coverTitle', () => {
  it('drops the subtitle after a colon', () => {
    expect(coverTitle('Gödel, Escher, Bach: an Eternal Golden Braid')).toBe('Gödel, Escher, Bach')
  })

  it('keeps titles without a subtitle as they are', () => {
    expect(coverTitle('  Politiques du désordre ')).toBe('Politiques du désordre')
  })

  it('keeps the whole title when it starts with a colon', () => {
    expect(coverTitle(': a strange title')).toBe(': a strange title')
  })
})

describe('coverTitleSize', () => {
  it('uses the full size for short titles', () => {
    expect(coverTitleSize('Walden')).toBe(14)
    expect(coverTitleSize('Politiques du désordre')).toBe(14)
  })

  it('shrinks so a long word fits on one line', () => {
    const size = coverTitleSize('Die Unwahrscheinlichkeit der Kommunikation')
    expect(size).toBeLessThan(14)
    expect('Unwahrscheinlichkeit'.length * size * 0.48).toBeLessThanOrEqual(84)
  })

  it('shrinks long titles to keep them within four lines', () => {
    expect(coverTitleSize('Les Structures élémentaires de la parenté')).toBe(13)
    expect(coverTitleSize('The Strange Case of Dr Jekyll and Mr Hyde and Other Tales of Terror')).toBeLessThan(13)
  })

  it('never goes below the smallest size', () => {
    expect(coverTitleSize('Donaudampfschifffahrtsgesellschaftskapitän')).toBe(8)
  })
})
