import { describe, expect, it } from 'vitest'
import { formatPosition, pagesPerHour, progressFraction, sessionPages, suggestStartPage, summarizePages } from '../pages'

describe('sessionPages', () => {
  it('counts pages only when both ends are known', () => {
    expect(sessionPages({ startPage: 120, endPage: 150 })).toBe(30)
    expect(sessionPages({ startPage: 0, endPage: 0 })).toBe(0)
    expect(sessionPages({ startPage: null, endPage: 210 })).toBeNull()
    expect(sessionPages({ startPage: null, endPage: null })).toBeNull()
  })
})

describe('summarizePages and pagesPerHour', () => {
  it('leaves bookmarks and page-less sessions out of both pages and minutes', () => {
    const summary = summarizePages([
      { startPage: 0, endPage: 30, minutes: 40 },
      { startPage: 30, endPage: 70, minutes: 50 },
      { startPage: null, endPage: 210, minutes: 45 },
      { startPage: null, endPage: null, minutes: 90 },
      { startPage: 210, endPage: 250, minutes: 30 },
    ])
    expect(summary).toEqual({ pagesRead: 110, pagedSessions: 3, pagedMinutes: 120 })
    expect(pagesPerHour(summary)).toBe(55)
  })

  it('stays quiet until there are enough sittings and minutes', () => {
    expect(pagesPerHour({ pagesRead: 30, pagedSessions: 1, pagedMinutes: 10 })).toBeNull()
    expect(pagesPerHour({ pagesRead: 90, pagedSessions: 3, pagedMinutes: 45 })).toBeNull()
    expect(pagesPerHour({ pagesRead: 90, pagedSessions: 2, pagedMinutes: 120 })).toBeNull()
    expect(pagesPerHour({ pagesRead: 90, pagedSessions: 3, pagedMinutes: 60 })).toBe(90)
  })
})

describe('suggestStartPage', () => {
  const sessions = [
    { sessionDate: '2026-06-01', endPage: 80 },
    { sessionDate: '2026-06-02', endPage: 120 },
    { sessionDate: '2026-06-05', endPage: 200 },
  ]

  it('starts a first session at the beginning', () => {
    expect(suggestStartPage([], '2026-06-01', 320)).toEqual({ startPage: 0, lastRecordedPage: null })
    expect(suggestStartPage(sessions, '2026-05-30', 320)).toEqual({ startPage: 0, lastRecordedPage: null })
  })

  it('picks up from the session before the date, not the newest one', () => {
    expect(suggestStartPage(sessions, '2026-06-03', 320)).toEqual({ startPage: 120, lastRecordedPage: 120 })
    expect(suggestStartPage(sessions, '2026-06-06', 320)).toEqual({ startPage: 200, lastRecordedPage: 200 })
  })

  it('ignores the session being edited on the same date', () => {
    expect(suggestStartPage(sessions, '2026-06-02', 320)).toEqual({ startPage: 80, lastRecordedPage: 80 })
  })

  it('leaves the field empty after a sitting without a page', () => {
    const withGap = [...sessions, { sessionDate: '2026-06-06', endPage: null }]
    expect(suggestStartPage(withGap, '2026-06-07', 320)).toEqual({ startPage: null, lastRecordedPage: 200 })
    expect(suggestStartPage([{ sessionDate: '2026-06-01', endPage: null }], '2026-06-02', null)).toEqual({ startPage: null, lastRecordedPage: null })
  })

  it('starts over on a reread once the last session reached the end', () => {
    const finished = [{ sessionDate: '2026-06-01', endPage: 320 }]
    expect(suggestStartPage(finished, '2026-07-01', 320)).toEqual({ startPage: 0, lastRecordedPage: 320 })
    expect(suggestStartPage(finished, '2026-07-01', null)).toEqual({ startPage: 320, lastRecordedPage: 320 })
  })
})

describe('positions', () => {
  it('reads as page of total, capped at the end', () => {
    expect(formatPosition(150, 320)).toBe('Page 150 of 320')
    expect(formatPosition(340, 320)).toBe('Page 320 of 320')
    expect(formatPosition(1500, null)).toBe('Page 1,500')
    expect(progressFraction(160, 320)).toBe(0.5)
    expect(progressFraction(400, 320)).toBe(1)
    expect(progressFraction(10, null)).toBeNull()
  })
})
