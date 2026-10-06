import { sql } from 'drizzle-orm'
import { addDaysToDate } from '@/lib/dates'
import { db } from '@/server/db'

export async function getCurrentStreak(userId: string, today: string) {
  const yesterday = addDaysToDate(today, -1)
  const [row] = await db.execute(sql<{ streak: number }>`
    with recursive chain(day) as (
      select case
        when exists (select 1 from reading_sessions where user_id = ${userId} and session_date = ${today})
          or exists (select 1 from streak_freezes where user_id = ${userId} and frozen_date = ${today}) then ${today}
        else ${yesterday}
      end
      where exists (select 1 from reading_sessions where user_id = ${userId} and session_date in (${today}, ${yesterday}))
        or exists (select 1 from streak_freezes where user_id = ${userId} and frozen_date in (${today}, ${yesterday}))
      union all
      select to_char((chain.day::date - interval '1 day'), 'YYYY-MM-DD')
      from chain
      where exists (select 1 from reading_sessions where user_id = ${userId} and session_date = to_char((chain.day::date - interval '1 day'), 'YYYY-MM-DD'))
        or exists (select 1 from streak_freezes where user_id = ${userId} and frozen_date = to_char((chain.day::date - interval '1 day'), 'YYYY-MM-DD'))
    )
    select count(*)::int as streak from chain
  `)
  return Number(row?.streak ?? 0)
}
