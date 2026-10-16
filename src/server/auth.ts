import NextAuth, { CredentialsSignin } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { db, users } from '@/server/db'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { rateLimit, rateLimitKey, getClientIp } from '@/lib/rateLimit'
import { isSupportedPassword } from '@/server/password'
import { getAuthSecret } from '@/server/instance'

const signInSchema = z.object({
  username: z.string().trim().min(1).max(30),
  password: z.string().refine(isSupportedPassword),
})

class RateLimitedSignInError extends CredentialsSignin {
  code = 'rate_limited'
}

// Lazy config so the secret can come from the database. trustHost lets the same
// instance answer on localhost, a LAN address or a domain without a fixed URL.
export const { handlers, auth, signIn, signOut } = NextAuth(async () => ({
  secret: await getAuthSecret(),
  trustHost: true,
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

        const [ipLimit, usernameLimit] = await Promise.all([
          rateLimit(rateLimitKey('signin:ip', getClientIp(request)), 10, 5 * 60_000),
          rateLimit(rateLimitKey('signin:username', parsed.data.username), 10, 5 * 60_000),
        ])
        if (!ipLimit.ok || !usernameLimit.ok) {
          throw new RateLimitedSignInError()
        }

        const user = await db.query.users.findFirst({
          where: eq(users.usernameNormalized, parsed.data.username.toLowerCase()),
        })

        if (!user || user.deletedAt || !user.passwordHash) return null

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash)
        if (!valid) return null

        return { id: user.id, name: user.username, authVersion: user.authVersion }
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
}))
