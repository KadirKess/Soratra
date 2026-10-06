'use client'
import { trpc } from '@/lib/trpc/client'
import { StarRating } from './StarRating'
import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { celebrateFinished } from '@/lib/celebrate'

const STATUS_OPTIONS = [
  { value: 'want_to_read', label: 'Want to read', bg: 'var(--straw)' },
  { value: 'reading',      label: 'Reading',      bg: 'var(--sage)'  },
  { value: 'read',         label: 'Read',         bg: 'var(--blush)' },
] as const

type Status = 'want_to_read' | 'reading' | 'read'

interface LogBookFormProps {
  bookId: string
}

export function LogBookForm({ bookId }: LogBookFormProps) {
  const utils = trpc.useUtils()
  const confirm = useConfirm()
  const { data: userBook, isLoading } = trpc.userBooks.getForBook.useQuery({ bookId })

  const [status, setStatus] = useState<Status>('want_to_read')
  const [rating, setRating] = useState<number | null>(null)
  const [review, setReview] = useState('')
  const [reviewHasSpoiler, setReviewHasSpoiler] = useState(false)
  const hasEdited = useRef(false)

  useEffect(() => {
    if (userBook && !hasEdited.current) {
      setStatus(userBook.status as Status)
      setRating(userBook.rating ? Number(userBook.rating) : null)
      setReview(userBook.review ?? '')
      setReviewHasSpoiler(userBook.reviewHasSpoiler === 1)
    }
  }, [userBook])

  const upsert = trpc.userBooks.upsert.useMutation({
    onMutate: async (vars) => {
      await utils.userBooks.getForBook.cancel({ bookId })
      const prev = utils.userBooks.getForBook.getData({ bookId })
      utils.userBooks.getForBook.setData({ bookId }, (old) =>
        old
          ? { ...old, status: vars.status, rating: vars.rating?.toString() ?? null, review: vars.review ?? null, reviewHasSpoiler: vars.reviewHasSpoiler ? 1 : 0 }
          : old
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      utils.userBooks.getForBook.setData({ bookId }, ctx?.prev)
      toast.error('Failed to save — try again')
    },
    onSuccess: (_data, vars, ctx) => {
      const wasRead = ctx?.prev?.status === 'read'
      if (vars.status === 'read' && !wasRead) {
        celebrateFinished()
      } else {
        toast.success(ctx?.prev ? 'Updated' : 'Added to library')
      }
    },
    onSettled: () => {
      utils.userBooks.getForBook.invalidate({ bookId })
      utils.userBooks.library.invalidate()
      utils.users.dashboard.invalidate()
    },
  })

  const remove = trpc.userBooks.remove.useMutation({
    onMutate: async () => {
      await utils.userBooks.getForBook.cancel({ bookId })
      const prev = utils.userBooks.getForBook.getData({ bookId })
      utils.userBooks.getForBook.setData({ bookId }, undefined)
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      utils.userBooks.getForBook.setData({ bookId }, ctx?.prev)
      toast.error('Failed to remove — try again')
    },
    onSuccess: () => {
      setStatus('want_to_read')
      setRating(null)
      setReview('')
    },
    onSettled: () => {
      utils.userBooks.getForBook.invalidate({ bookId })
      utils.userBooks.library.invalidate()
      utils.users.dashboard.invalidate()
    },
  })

  function handleSave() {
    upsert.mutate({
      bookId,
      status,
      rating: status === 'read' ? rating : null,
      review: status === 'read' ? review || null : null,
      reviewHasSpoiler: status === 'read' && Boolean(review.trim()) && reviewHasSpoiler,
    })
  }

  function selectStatus(nextStatus: Status) {
    hasEdited.current = true
    setStatus(nextStatus)
    if (nextStatus !== 'read') {
      setRating(null)
      setReview('')
      setReviewHasSpoiler(false)
    }
  }

  async function handleRemove() {
    const ok = await confirm({
      title: 'Remove from library?',
      message: 'This also clears your rating and review for this book.',
      confirmLabel: 'Remove',
      danger: true,
    })
    if (!ok) return
    const snapshot = { status, rating, review, reviewHasSpoiler }
    remove.mutate(
      { bookId },
      {
        onSuccess: () => {
          toast.success('Removed from library', {
            action: {
              label: 'Undo',
              onClick: () =>
                upsert.mutate({
                  bookId,
                  status: snapshot.status,
                  rating: snapshot.rating,
                  review: snapshot.review || null,
                  reviewHasSpoiler: snapshot.reviewHasSpoiler,
                }),
            },
          })
        },
      }
    )
  }

  return (
    <div className="brutalist-card space-y-5 p-5">
      {/* Status */}
      <div>
        <p className="text-xs font-bold mb-2.5 uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
          Status
        </p>
        <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label="Reading status">
          {STATUS_OPTIONS.map(({ value, label, bg }) => {
            const active = status === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => selectStatus(value)}
                role="radio"
                aria-checked={active}
                className="px-3 py-1.5 text-xs font-bold transition-all"
                style={{
                  background: active ? bg : 'transparent',
                  color: 'var(--fg)',
                  border: `2px solid ${active ? 'var(--fg)' : 'var(--muted)'}`,
                  borderRadius: '8px',
                  boxShadow: active ? '2px 2px 0 var(--fg)' : 'none',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {status === 'read' && (
        <>
          <div>
            <p className="text-xs font-bold mb-2.5 uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
              Rating
            </p>
            <StarRating value={rating} onChange={setRating} />
          </div>

          <div>
            <p className="text-xs font-bold mb-2.5 uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
              Review
            </p>
            <label className="sr-only" htmlFor="book-review">Your note about this book</label>
            <textarea
              id="book-review"
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder="Your thoughts..."
              rows={3}
              maxLength={2000}
              className="brutalist-input resize-none"
            />
            {review.trim() && (
              <label className="mt-3 flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--muted)' }}>
                <input
                  type="checkbox"
                  checked={reviewHasSpoiler}
                  onChange={(event) => setReviewHasSpoiler(event.target.checked)}
                />
                Mark this review as a spoiler for friends
              </label>
            )}
          </div>
        </>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2.5">
        <button
          type="button"
          onClick={handleSave}
          disabled={upsert.isPending || isLoading}
          className="btn-primary"
        >
          {isLoading ? 'Loading…' : upsert.isPending ? 'Saving…' : userBook ? 'Update' : status === 'reading' ? 'Start reading' : 'Add to library'}
        </button>
        {userBook && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={remove.isPending}
            className="btn-danger"
          >
            {remove.isPending ? 'Removing…' : 'Remove'}
          </button>
        )}
      </div>
    </div>
  )
}
