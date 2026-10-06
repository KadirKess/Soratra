import { describe, it, expect } from 'vitest'
import { formatMinutes } from '../formatMinutes'

describe('formatMinutes', () => {
  it('shows bare minutes under an hour', () => {
    expect(formatMinutes(1)).toBe('1 min')
    expect(formatMinutes(47)).toBe('47 min')
    expect(formatMinutes(59)).toBe('59 min')
  })

  it('drops the minutes part on whole hours', () => {
    expect(formatMinutes(60)).toBe('1h')
    expect(formatMinutes(120)).toBe('2h')
  })

  it('shows hours and minutes otherwise', () => {
    expect(formatMinutes(80)).toBe('1h 20m')
    expect(formatMinutes(185)).toBe('3h 5m')
  })
})
