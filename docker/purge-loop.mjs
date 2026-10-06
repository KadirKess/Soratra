const secret = process.env.CRON_SECRET
if (!secret) throw new Error('CRON_SECRET is required.')
const url = process.env.PURGE_URL || 'http://app:3000/api/cron/purge-deleted-users'
const day = 24 * 60 * 60 * 1000

async function purge() {
  try {
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(30000),
    })
    if (!response.ok) throw new Error('Purge request failed.')
    const result = await response.json()
    console.info(JSON.stringify({
      event: 'scheduled_purge',
      users: result.purged,
      rateLimitBuckets: result.expiredRateLimitBuckets,
    }))
    return true
  } catch {
    console.error('Scheduled purge failed; retrying in five minutes.')
    return false
  }
}

while (true) {
  const succeeded = await purge()
  await new Promise(resolve => setTimeout(resolve, succeeded ? day : 5 * 60 * 1000))
}
