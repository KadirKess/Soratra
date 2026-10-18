import { describe, expect, it } from 'vitest'
import { sectionFor } from '../sections'

describe('sectionFor', () => {
  it('maps nav pages to their own section', () => {
    expect(sectionFor('/')).toBe('home')
    expect(sectionFor('/library')).toBe('library')
    expect(sectionFor('/journal')).toBe('journal')
    expect(sectionFor('/friends')).toBe('friends')
    expect(sectionFor('/profile')).toBe('profile')
    expect(sectionFor('/admin')).toBe('admin')
  })

  it('puts book pages and search under the library', () => {
    expect(sectionFor('/books/OL123W')).toBe('library')
    expect(sectionFor('/search')).toBe('library')
  })

  it('tells your account pages from a friend profile', () => {
    expect(sectionFor('/profile/password')).toBe('profile')
    expect(sectionFor('/profile/delete')).toBe('profile')
    expect(sectionFor('/profile/mira')).toBe('friends')
  })

  it('leaves other pages without a section', () => {
    expect(sectionFor('/privacy')).toBeNull()
  })
})
