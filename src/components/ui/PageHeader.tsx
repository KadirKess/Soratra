import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
}

// The one page header: Cormorant title, one muted line, an optional action.
export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-4xl font-medium leading-none" style={{ fontFamily: 'var(--font-cormorant)' }}>
          {title}
        </h1>
        {description && (
          <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  )
}
