import { NextResponse } from 'next/server'
import { purgeDeletedUsers } from '@/server/cron/purgeDeletedUsers'

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const purged = await purgeDeletedUsers()

    return NextResponse.json({ purged: purged.users, expiredRateLimitBuckets: purged.rateLimitBuckets })
  } catch {
    return NextResponse.json({ error: 'Purge failed' }, { status: 500 })
  }
}
