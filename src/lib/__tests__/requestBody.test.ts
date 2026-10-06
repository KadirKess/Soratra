import { describe, expect, it } from 'vitest'
import { readJsonBody, readRequestBody } from '../requestBody'

describe('readJsonBody', () => {
  it('parses a body within the configured limit', async () => {
    const request = new Request('https://instance.test/api/test', {
      method: 'POST',
      body: JSON.stringify({ title: 'A calm reading day' }),
    })
    await expect(readJsonBody(request, 100)).resolves.toEqual({ title: 'A calm reading day' })
  })

  it('rejects a streamed body larger than the configured limit', async () => {
    const request = new Request('https://instance.test/api/test', {
      method: 'POST',
      body: JSON.stringify({ note: 'x'.repeat(1_000) }),
    })
    await expect(readJsonBody(request, 100)).rejects.toThrow('too large')
  })

  it('enforces the limit when a request has no content-length header', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"note":"'))
        controller.enqueue(new TextEncoder().encode('x'.repeat(1_000)))
        controller.enqueue(new TextEncoder().encode('"}'))
        controller.close()
      },
    })
    const request = new Request('https://instance.test/api/test', {
      method: 'POST',
      body,
      headers: { 'content-type': 'application/json' },
      duplex: 'half',
    } as RequestInit & { duplex: 'half' })
    expect(request.headers.has('content-length')).toBe(false)
    await expect(readRequestBody(request, 100)).rejects.toThrow('too large')
  })
})
