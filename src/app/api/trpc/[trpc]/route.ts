import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from '@/server/router'
import { createContext } from '@/server/context'
import { readRequestBody } from '@/lib/requestBody'

// Open Library calls are bounded at 8s in the OL client; give the function
// headroom above that so a legitimately slow response can still complete
// instead of being cut short by a platform request timeout.
export const maxDuration = 20

// Largest legit input is a 2000-char review; tRPC batches calls, so this leaves
// ample room while refusing oversized bodies before they reach a procedure.
const MAX_BODY_BYTES = 100_000
const MAX_BATCH_CALLS = 10

function exceedsBatchLimit(req: Request) {
  const url = new URL(req.url)
  if (url.searchParams.get('batch') !== '1') return false

  try {
    return decodeURIComponent(url.pathname.slice('/api/trpc/'.length)).split(',').length > MAX_BATCH_CALLS
  } catch {
    return false
  }
}

const handler = async (req: Request) => {
  if (exceedsBatchLimit(req)) {
    return new Response(JSON.stringify({ error: 'Too many batched calls' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (req.method === 'POST') {
    let body: Uint8Array
    try {
      body = await readRequestBody(req, MAX_BODY_BYTES)
    } catch {
      return new Response(JSON.stringify({ error: 'Request body too large' }), {
        status: 413,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const headers = new Headers(req.headers)
    headers.set('content-length', String(body.byteLength))
    req = new Request(req.url, {
      method: req.method,
      headers,
      body: new TextDecoder().decode(body),
      signal: req.signal,
    })
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Request body too large' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext,
  })
}

export { handler as GET, handler as POST }
