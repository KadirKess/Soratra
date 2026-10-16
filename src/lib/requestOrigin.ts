// Rejects cross-site form posts. req.url can't be used for this: inside the
// container it is always Next's internal address (localhost:3000), whatever
// address or port the browser used. Compare with the host the browser asked
// for instead, as forwarded by a proxy when there is one.
export function isCrossOriginRequest(req: Request) {
  const origin = req.headers.get('origin')
  if (!origin) return false
  const host = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || req.headers.get('host')
  if (!host) return true
  try {
    return new URL(origin).host.toLowerCase() !== host.toLowerCase()
  } catch {
    return true
  }
}
