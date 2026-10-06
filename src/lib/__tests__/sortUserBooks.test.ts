import { describe, it, expect } from 'vitest'
import { sortByReleaseDate } from '../sortUserBooks'

function row(id: string, publishedDate: string | null) {
  return { id, book: { publishedDate } }
}

describe('sortByReleaseDate', () => {
  it('orders most-recent first', () => {
    const out = sortByReleaseDate([
      row('a', '1999'),
      row('b', '2021'),
      row('c', '2005'),
    ])
    expect(out.map((r) => r.id)).toEqual(['b', 'c', 'a'])
  })

  it('pushes unknown (null) dates to the end', () => {
    const out = sortByReleaseDate([
      row('a', null),
      row('b', '2010'),
      row('c', null),
      row('d', '2020'),
    ])
    expect(out.map((r) => r.id)).toEqual(['d', 'b', 'a', 'c'])
  })

  it('compares mixed year and full-date strings lexically', () => {
    const out = sortByReleaseDate([
      row('a', '2020'),
      row('b', '2020-06-01'),
      row('c', '1999-12-31'),
    ])
    // '2020-06-01' > '2020' > '1999-12-31' lexically
    expect(out.map((r) => r.id)).toEqual(['b', 'a', 'c'])
  })

  it('does not mutate the input array', () => {
    const input = [row('a', '2000'), row('b', '2010')]
    const snapshot = input.map((r) => r.id)
    sortByReleaseDate(input)
    expect(input.map((r) => r.id)).toEqual(snapshot)
  })

  it('treats two unknown dates as equal (stable-ish, both at end)', () => {
    const out = sortByReleaseDate([row('a', null), row('b', null)])
    expect(out.map((r) => r.id).sort()).toEqual(['a', 'b'])
  })
})
