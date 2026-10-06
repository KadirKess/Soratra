import { describe, expect, it } from 'vitest'
import { isValidUsername, normalizeUsername, normalizeUsernameLookup } from '../usernames'

describe('username normalization', () => {
  it('preserves display casing separately from normalized identity', () => {
    expect(normalizeUsername(' Kadir_42 ')).toBe('kadir_42')
  })

  it('accepts an optional leading at-sign for exact lookups', () => {
    expect(normalizeUsernameLookup('@Kadir_42')).toBe('kadir_42')
  })

  it('uses the account username grammar', () => {
    expect(isValidUsername('Kadir_42')).toBe(true)
    expect(isValidUsername('kadir-name')).toBe(false)
  })
})
