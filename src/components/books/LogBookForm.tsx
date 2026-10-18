'use client'
import { trpc } from '@/lib/trpc/client'
import { StarRating } from './StarRating'
import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { celebrateFinished } from '@/lib/celebrate'

const STATUS_OPTIONS = [
  { value: 'want_to_read', label: 'Want to read' },
  { value: 'reading',      label: 'Reading' },
  { value: 'read',         label: 'Read' },
] as const

type Status = 'want_to_read' | 'reading' | 'read'

const STATUS_LABELS: Record<Status, string> = { want_to_read: 'Want to read', reading: 'Reading', read: 'Read' }

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
      } else if (!ctx?.prev) {
        toast.success(`Added to your library as ${STATUS_LABELS[vars.status].toLowerCase()}`)
      } else if (ctx.prev.status !== vars.status) {
        toast.success(`Moved to ${STATUS_LABELS[vars.status].toLowerCase()}`)
      } else {
        toast.success('Review saved')
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

  function save(nextStatus: Status, nextRating: number | null, nextReview: string, nextSpoiler: boolean) {
    upsert.mutate({
      bookId,
      status: nextStatus,
      rating: nextStatus === 'read' ? nextRating : null,
      review: nextStatus === 'read' ? nextReview || null : null,
      reviewHasSpoiler: nextStatus === 'read' && Boolean(nextReview.trim()) && nextSpoiler,
    })
  }

  // Choosing a status saves it straight away, like logging a session does.
  function selectStatus(nextStatus: Status) {
    if (userBook && nextStatus === status) return
    hasEdited.current = true
    setStatus(nextStatus)
    const keepsReview = nextStatus === 'read'
    if (!keepsReview) {
      setRating(null)
      setReview('')
      setReviewHasSpoiler(false)
    }
    save(nextStatus, keepsReview ? rating : null, keepsReview ? review : '', keepsReview && reviewHasSpoiler)
  }

  const savedRating = userBook?.rating ? Number(userBook.rating) : null
  const reviewChanged =
    status === 'read' &&
    Boolean(userBook) &&
    (rating !== savedRating || review !== (userBook?.review ?? '') || reviewHasSpoiler !== (userBook?.reviewHasSpoiler === 1))

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
    <div className="brutalist-card space-y-5 p-5 sm:p-6">
      <div>
        <p className="eyebrow mb-2.5">{userBook ? 'On your shelf' : 'Add to your shelf'}</p>
        <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label="Reading status">
          {STATUS_OPTIONS.map(({ value, label }) => {
            const active = status === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => selectStatus(value)}
                disabled={isLoading || upsert.isPending}
                role="radio"
                aria-checked={Boolean(userBook) && active}
                className="chip"
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
            <p className="eyebrow mb-2.5">
              Rating
            </p>
            <StarRating value={rating} onChange={setRating} />
          </div>

          <div>
            <p className="eyebrow mb-2.5">
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

      {(reviewChanged || userBook) && (
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {reviewChanged ? (
            <button
              type="button"
              onClick={() => save(status, rating, review, reviewHasSpoiler)}
              disabled={upsert.isPending}
              className="btn-primary"
            >
              {upsert.isPending ? 'Saving…' : 'Save review'}
            </button>
          ) : <span />}
          {userBook && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={remove.isPending}
              className="btn-quiet is-danger text-sm -mr-3"
            >
              {remove.isPending ? 'Removing…' : 'Remove from library'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
