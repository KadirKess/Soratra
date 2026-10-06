import Image from 'next/image'
import Link from 'next/link'
import type { Book } from '@/server/db'

export function CurrentlyReading({ book }: { book: Book }) {
  const slug = encodeURIComponent(book.openLibraryId)

  return (
    <Link href={`/books/${slug}`} className="block group">
      <div
        className="relative overflow-hidden flex items-end"
        style={{
          height: '12rem',
          background: 'var(--surface)',
          border: '2px solid var(--fg)',
          borderRadius: '12px',
          boxShadow: '4px 4px 0 var(--fg)',
        }}
      >
        {book.coverUrl && (
          <Image
            src={book.coverUrl}
            alt={book.title}
            fill
            className="object-cover opacity-30 blur-lg scale-110"
            sizes="100vw"
          />
        )}
        <div className="relative z-10 p-6 flex items-end gap-5 w-full">
          {book.coverUrl && (
            <div
              className="shrink-0 shadow-lg"
              style={{ width: '5rem', aspectRatio: '2/3', position: 'relative' }}
            >
              <Image
                src={book.coverUrl}
                alt={book.title}
                fill
                className="object-cover"
                sizes="80px"
              />
            </div>
          )}
          <div className="min-w-0">
            <p
              className="text-xs uppercase tracking-widest mb-1"
              style={{ color: 'var(--accent)' }}
            >
              Currently reading
            </p>
            <p
              className="text-2xl font-light leading-tight line-clamp-2"
              style={{ fontFamily: 'var(--font-cormorant)', color: 'var(--fg)' }}
            >
              {book.title}
            </p>
            <p className="text-sm mt-0.5 truncate" style={{ color: 'var(--muted)' }}>
              {book.authors.join(', ')}
            </p>
          </div>
        </div>
      </div>
    </Link>
  )
}
