// The Soratra wordmark with the vermilion full stop, as on soratra.app.
export function Wordmark({ size = '1.75rem' }: { size?: string }) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-cormorant)',
        fontSize: size,
        fontWeight: 600,
        color: 'var(--fg)',
        letterSpacing: '-0.02em',
        lineHeight: 1,
      }}
    >
      Soratra<span style={{ color: 'var(--accent)' }}>.</span>
    </span>
  )
}
