'use client'

interface Props {
	error: Error & { digest?: string }
	reset: () => void
}

// Replaces the root layout when it crashes, so globals.css may not be applied.
// Token vars are used with hex fallbacks to stay on-brand even in that case.
export default function GlobalError({ error, reset }: Props) {
	return (
		<html lang="en">
			<body
				style={{
					minHeight: '100vh',
					margin: 0,
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					justifyContent: 'center',
					textAlign: 'center',
					padding: '1rem',
					background: 'var(--bg, #FAF6EF)',
					color: 'var(--fg, #1C1917)',
					fontFamily: 'system-ui, sans-serif',
				}}
			>
				<div
					style={{
						maxWidth: 420,
						width: '100%',
						background: 'var(--surface, #F0EAD9)',
						border: '2px solid var(--fg, #1C1917)',
						boxShadow: '4px 4px 0 var(--fg, #1C1917)',
						padding: '2rem',
					}}
				>
					<h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.875rem', margin: '0 0 1rem' }}>
						Something went sideways
					</h1>
					<p style={{ fontSize: '0.875rem', opacity: 0.7, margin: '0 0 1rem' }}>
						The app failed to load. Your data is safe — please try again.
					</p>
					{error.digest && (
						<p style={{ fontSize: '0.75rem', fontFamily: 'monospace', opacity: 0.7, margin: '0 0 1rem' }}>
							Reference: {error.digest}
						</p>
					)}
					<button
						type="button"
						onClick={reset}
						style={{
							width: '100%',
							padding: '0.75rem 1rem',
							fontWeight: 600,
							cursor: 'pointer',
							background: 'var(--accent, #E07A3A)',
							color: '#FAF6EF',
							border: '2px solid var(--fg, #1C1917)',
							boxShadow: '4px 4px 0 var(--fg, #1C1917)',
						}}
					>
						Try again
					</button>
				</div>
			</body>
		</html>
	)
}
