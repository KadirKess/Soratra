import { describe, it, expect } from 'vitest'
import { calculateStreak } from '../streak'

describe('calculateStreak', () => {
  it('returns 0 for empty session list', () => {
    expect(calculateStreak([], '2026-03-06')).toBe(0)
  })

  it('returns 1 if only today has a session', () => {
    expect(calculateStreak(['2026-03-06'], '2026-03-06')).toBe(1)
  })

  it('returns streak length for consecutive days ending today', () => {
    expect(calculateStreak(['2026-03-04', '2026-03-05', '2026-03-06'], '2026-03-06')).toBe(3)
  })

  it('counts streak ending yesterday if nothing logged today yet', () => {
    expect(calculateStreak(['2026-03-04', '2026-03-05'], '2026-03-06')).toBe(2)
  })

  it('breaks on gap', () => {
    expect(calculateStreak(['2026-03-01', '2026-03-05', '2026-03-06'], '2026-03-06')).toBe(2)
  })

  it('returns 0 if last session was 2+ days ago', () => {
    expect(calculateStreak(['2026-03-04'], '2026-03-06')).toBe(0)
  })

  it('handles duplicate dates (multiple books same day)', () => {
    expect(calculateStreak(['2026-03-05', '2026-03-05', '2026-03-06'], '2026-03-06')).toBe(2)
  })
})

describe('calculateStreak with frozen dates', () => {
  it('treats a frozen date as a session day', () => {
    expect(calculateStreak(['2026-03-04', '2026-03-06'], '2026-03-06', ['2026-03-05'])).toBe(3)
  })

  it('freeze without a session on that day still closes the gap', () => {
    expect(calculateStreak(['2026-03-01', '2026-03-03'], '2026-03-03', ['2026-03-02'])).toBe(3)
  })

  it('no freeze = streak still breaks on gap', () => {
    expect(calculateStreak(['2026-03-01', '2026-03-03'], '2026-03-03', [])).toBe(1)
  })
})
