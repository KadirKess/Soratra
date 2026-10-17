const STATUS_CONFIG = {
  reading:      { label: 'Reading' },
  read:         { label: 'Read' },
  want_to_read: { label: 'Want to read' },
} as const

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]
  if (!config) return null
  return (
    <span
      className="inline-block px-3 py-1 text-xs font-bold"
      style={{
        background: 'var(--bg)',
        color: 'var(--fg)',
        border: '2px solid var(--fg)',
        borderRadius: '999px',
      }}
    >
      {config.label}
    </span>
  )
}
