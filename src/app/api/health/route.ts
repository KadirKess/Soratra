import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { db } from '@/server/db'
import { assertProductionConfiguration } from '@/lib/config'

export async function GET() {
  try {
    assertProductionConfiguration()
    await db.execute(sql`select 1`)
    return NextResponse.json({ status: 'ok' })
  } catch {
    return NextResponse.json({ status: 'unavailable' }, { status: 503 })
  }
}
