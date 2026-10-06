import { Skeleton } from '@/components/ui/Skeleton'

export default function LoadingBookPage() {
  return (
    <div className="max-w-4xl flex gap-8 flex-col sm:flex-row" aria-busy="true" aria-label="Loading book details">
      <Skeleton className="w-40 sm:w-52 shrink-0" style={{ aspectRatio: '2/3' }} />
      <div className="flex-1 space-y-4">
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-52" />
      </div>
    </div>
  )
}
