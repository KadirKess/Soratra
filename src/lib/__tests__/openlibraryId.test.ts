import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
import { openLibraryIdSchema } from '../openlibrary'

describe('Open Library identifiers', () => {
  it('accepts work and edition identifiers only', () => {
    expect(openLibraryIdSchema.safeParse('OL45804W').success).toBe(true)
    expect(openLibraryIdSchema.safeParse('OL123M').success).toBe(true)
    expect(openLibraryIdSchema.safeParse('/works/OL45804W').success).toBe(false)
    expect(openLibraryIdSchema.safeParse('not-an-olid').success).toBe(false)
  })
})
