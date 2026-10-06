import NextAuth, { CredentialsSignin } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { db, users } from '@/server/db'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { rateLimit, rateLimitKey, getClientIp } from '@/lib/rateLimit'
import { isSupportedPassword } from '@/server/password'

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().refine(isSupportedPassword),
})

class RateLimitedSignInError extends CredentialsSignin {
  code = 'rate_limited'
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/signin',
  },
  providers: [
    Credentials({
      async authorize(credentials, request) {
        // Throttle brute-force / password-spraying per source IP.
        const parsed = signInSchema.safeParse(credentials)
        if (!parsed.success) return null

        const [ipLimit, emailLimit] = await Promise.all([
          rateLimit(rateLimitKey('signin:ip', getClientIp(request)), 10, 5 * 60_000),
          rateLimit(rateLimitKey('signin:email', parsed.data.email), 10, 5 * 60_000),
        ])
        if (!ipLimit.ok || !emailLimit.ok) {
          throw new RateLimitedSignInError()
        }

        const user = await db.query.users.findFirst({
          where: eq(users.email, parsed.data.email),
        })

        if (!user || user.deletedAt || !user.passwordHash) return null

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash)
        if (!valid) return null

        return { id: user.id, email: user.email, name: user.username, authVersion: user.authVersion }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.authVersion = Number(user.authVersion)
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.id as string
      session.user.authVersion = Number(token.authVersion ?? 0)
      return session
    },
  },
})
