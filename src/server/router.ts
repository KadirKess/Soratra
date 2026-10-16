import { router } from './trpc'
import { booksRouter } from './routers/books'
import { userBooksRouter } from './routers/userBooks'
import { usersRouter } from './routers/users'
import { readingSessionsRouter } from './routers/readingSessions'
import { friendshipsRouter } from './routers/friendships'
import { adminRouter } from './routers/admin'

export const appRouter = router({
  books: booksRouter,
  userBooks: userBooksRouter,
  users: usersRouter,
  readingSessions: readingSessionsRouter,
  friendships: friendshipsRouter,
  admin: adminRouter,
})

export type AppRouter = typeof appRouter
