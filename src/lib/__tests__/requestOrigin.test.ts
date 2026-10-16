import { describe, expect, it } from 'vitest'
import { isCrossOriginRequest } from '../requestOrigin'

// Inside the container Next always sees its own address, whatever the browser used.
const internalUrl = 'http://localhost:3000/api/setup'

function request(headers: Record<string, string>) {
  return new Request(internalUrl, { method: 'POST', headers })
}

describe('isCrossOriginRequest', () => {
  it('accepts a browser on another port or a LAN address', () => {
    expect(isCrossOriginRequest(request({ origin: 'http://localhost:3423', host: 'localhost:3423' }))).toBe(false)
    expect(isCrossOriginRequest(request({ origin: 'http://192.168.1.20:3000', host: '192.168.1.20:3000' }))).toBe(false)
  })

  it('accepts a domain behind a TLS-terminating proxy', () => {
    expect(isCrossOriginRequest(request({
      origin: 'https://books.example.org', host: 'app:3000', 'x-forwarded-host': 'books.example.org',
    }))).toBe(false)
  })

  it('rejects a post from another site', () => {
    expect(isCrossOriginRequest(request({ origin: 'https://attacker.example', host: 'books.example.org' }))).toBe(true)
    expect(isCrossOriginRequest(request({ origin: 'null', host: 'books.example.org' }))).toBe(true)
  })

  it('allows requests that carry no Origin, as before', () => {
    expect(isCrossOriginRequest(request({ host: 'books.example.org' }))).toBe(false)
  })
})
