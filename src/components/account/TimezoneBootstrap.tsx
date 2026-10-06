'use client'

import { useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { trpc } from '@/lib/trpc/client'

export function TimezoneBootstrap() {
  const { status } = useSession()
  const utils = trpc.useUtils()
  const submitted = useRef(false)
  const { data: me } = trpc.users.me.useQuery(undefined, { enabled: status === 'authenticated' })
  const setTimezone = trpc.users.setTimezone.useMutation({
    onSuccess: (user) => {
      utils.users.me.setData(undefined, (current) => current ? { ...current, timezone: user.timezone } : current)
    },
  })

  useEffect(() => {
    if (status !== 'authenticated' || !me || me.timezone || submitted.current) return
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (!timezone) return
    submitted.current = true
    setTimezone.mutate({ timezone })
  }, [me?.timezone, setTimezone, status])

  return null
}
