'use client'

interface QueryErrorCardProps {
  message: string
  onRetry: () => void
  retrying?: boolean
}

export function QueryErrorCard({ message, onRetry, retrying = false }: QueryErrorCardProps) {
  return (
    <div className="brutalist-card p-5 flex flex-wrap items-center justify-between gap-3" style={{ background: 'var(--blush)' }} role="alert">
      <p className="text-sm font-medium">{message}</p>
      <button type="button" onClick={onRetry} disabled={retrying} className="btn-secondary">
        {retrying ? 'Retrying…' : 'Retry'}
      </button>
    </div>
  )
}
