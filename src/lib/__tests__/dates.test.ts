import { describe, expect, it } from 'vitest'
import { addDaysToDate, dateOnlyParts, isValidDateOnly, localDateInTimeZone, weekStartForDate } from '../dates'

describe('date utilities', () => {
  it('validates real calendar dates', () => {
    expect(isValidDateOnly('2026-02-28')).toBe(true)
    expect(isValidDateOnly('2026-02-30')).toBe(false)
    expect(isValidDateOnly('2026/02/28')).toBe(false)
  })

  it('uses the requested IANA time zone at a day boundary', () => {
    const instant = new Date('2026-01-01T00:30:00.000Z')
    expect(localDateInTimeZone(instant, 'America/Los_Angeles')).toBe('2025-12-31')
    expect(localDateInTimeZone(instant, 'Asia/Tokyo')).toBe('2026-01-01')
  })

  it('uses Monday as the weekly freeze boundary', () => {
    expect(weekStartForDate('2026-07-19')).toBe('2026-07-13')
    expect(weekStartForDate('2026-07-20')).toBe('2026-07-20')
    expect(addDaysToDate('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('formats date-only values without UTC day shifts', () => {
    expect(dateOnlyParts('2026-07-21')).toEqual({ month: 'Jul', day: '21' })
  })
})
