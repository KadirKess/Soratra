import 'server-only'
import { createCallerFactory } from '@/server/trpc'
import { appRouter } from '@/server/router'
import { createContext } from '@/server/context'

const createCaller = createCallerFactory(appRouter)

export const api = async () => {
  const ctx = await createContext()
  return createCaller(ctx)
}
