const STATUS_CONFIG = {
  reading:      { label: 'Reading',      bg: 'var(--sage)',  color: 'var(--fg)' },
  read:         { label: 'Read',         bg: 'var(--blush)', color: 'var(--fg)' },
  want_to_read: { label: 'Want to read', bg: 'var(--straw)', color: 'var(--fg)' },
} as const

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]
  if (!config) return null
  return (
    <span
      className="inline-block px-3 py-1 text-xs font-bold"
      style={{
        background: config.bg,
        color: config.color,
        border: '2px solid var(--fg)',
        borderRadius: '8px',
        boxShadow: '2px 2px 0 var(--fg)',
      }}
    >
      {config.label}
    </span>
  )
}
