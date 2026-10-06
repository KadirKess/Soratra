'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import type { Book } from '@/server/db'
import { trpc } from '@/lib/trpc/client'
import { CheckInModal } from './CheckInModal'

export function StartReadingButton({ book }: { book: Book }) {
  const [open, setOpen] = useState(false)
  const utils = trpc.useUtils()
	const { data: userBook, isSuccess: shelfResolved } = trpc.userBooks.getForBook.useQuery({ bookId: book.id })
  const startReading = trpc.userBooks.upsert.useMutation({
		onSuccess: (entry) => {
			utils.userBooks.getForBook.setData({ bookId: book.id }, entry)
			utils.userBooks.library.invalidate()
			utils.users.dashboard.invalidate()
			setOpen(true)
    },
    onError: () => toast.error('Could not start this book. Please try again.'),
  })

	if (!shelfResolved || (userBook && !open)) return null

  return (
    <>
      <button type="button" className="btn-primary" onClick={() => startReading.mutate({ bookId: book.id, status: 'reading' })} disabled={startReading.isPending}>
        {startReading.isPending ? 'Starting…' : 'Start reading & log a session'}
      </button>
      {open && createPortal(
        <CheckInModal
          book={book}
          onClose={() => setOpen(false)}
          onSuccess={() => {
            utils.users.dashboard.invalidate()
            utils.readingSessions.journal.invalidate()
            setOpen(false)
          }}
        />,
        document.body,
      )}
    </>
  )
}
