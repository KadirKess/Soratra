import { auth } from '@/server/auth'
import { db, friendships, userBooks, readingSessions, streakFreezes, users } from '@/server/db'
import { and, eq, isNull, or } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { rateLimit, rateLimitKey } from '@/lib/rateLimit'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const activeUser = await db.query.users.findFirst({
    where: and(eq(users.id, userId), isNull(users.deletedAt)),
    columns: { authVersion: true },
  })
  if (!activeUser || activeUser.authVersion !== session.user.authVersion) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Export is a heavy, all-data read; cap it per user.
  const limit = await rateLimit(rateLimitKey('export:user', userId), 5, 60 * 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many export requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
    )
  }

  const [account, books, sessions, freezes, friendshipRows] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        username: true,
        timezone: true,
        preferredLanguage: true,
        gdprConsentAt: true,
        gdprConsentVersion: true,
        createdAt: true,
      },
    }),
    db.query.userBooks.findMany({
      where: eq(userBooks.userId, userId),
      with: { book: true },
    }),
    db.query.readingSessions.findMany({
      where: eq(readingSessions.userId, userId),
      with: { book: true },
    }),
    db.query.streakFreezes.findMany({
      where: eq(streakFreezes.userId, userId),
    }),
    db.query.friendships.findMany({
      where: or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId)),
      with: {
        requester: { columns: { id: true, username: true, deletedAt: true } },
        addressee: { columns: { id: true, username: true, deletedAt: true } },
      },
    }),
  ])

  const exportData = {
    exportedAt: new Date().toISOString(),
    version: '1.7',
    account,
    books: books.map(({ book, status, rating, review, reviewHasSpoiler, finishedAt, createdAt, updatedAt }) => ({
      title: book.title,
      authors: book.authors,
      openLibraryId: book.openLibraryId,
      status,
      rating: rating ? Number(rating) : null,
      review,
      reviewHasSpoiler: reviewHasSpoiler === 1,
      finishedAt,
      addedAt: createdAt,
      updatedAt,
    })),
    readingSessions: sessions.map(({ book, sessionDate, rating, minutes, note, hasSpoiler, createdAt }) => ({
      bookTitle: book.title,
      openLibraryId: book.openLibraryId,
      sessionDate,
      rating: rating ? Number(rating) : null,
      minutes,
      note,
      hasSpoiler: hasSpoiler === 1,
      loggedAt: createdAt,
    })),
    streakFreezes: freezes.map(({ frozenDate, createdAt }) => ({
      frozenDate,
      appliedAt: createdAt,
    })),
    friendships: friendshipRows
      .map((friendship) => {
        const counterpart = friendship.requesterId === userId ? friendship.addressee : friendship.requester
        if (counterpart.deletedAt) return null
        return {
          counterpartUsername: counterpart.username,
          direction: friendship.requesterId === userId ? 'sent' : 'received',
          status: friendship.status,
          createdAt: friendship.createdAt,
          updatedAt: friendship.updatedAt,
        }
      })
      .filter((friendship): friendship is NonNullable<typeof friendship> => friendship !== null),
  }

  const json = JSON.stringify(exportData, null, 2)
  const date = new Date().toISOString().split('T')[0]

  return new Response(json, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="soratra-export-${date}.json"`,
      'Cache-Control': 'private, no-store, max-age=0',
      Pragma: 'no-cache',
      'X-Robots-Tag': 'noindex',
    },
  })
}
