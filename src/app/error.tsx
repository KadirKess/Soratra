'use client'

interface Props {
	error: Error & { digest?: string }
	reset: () => void
}

export default function RootError({ error, reset }: Props) {
	return (
		<div
			className="min-h-screen flex flex-col items-center justify-center px-4 text-center"
			style={{ background: 'var(--bg)', color: 'var(--fg)' }}
		>
			<div className="brutalist-card p-8 max-w-md w-full space-y-4">
				<h1
					className="text-3xl font-bold"
					style={{ fontFamily: 'var(--font-cormorant)' }}
				>
					Something went sideways
				</h1>
				<p className="text-sm" style={{ color: 'var(--muted)' }}>
					An unexpected error occurred. Your data is safe.
				</p>
				{error.digest && (
					<p className="text-xs font-mono" style={{ color: 'var(--muted)' }}>
						Reference: {error.digest}
					</p>
				)}
				<button type="button" onClick={reset} className="btn-primary w-full">
					Try again
				</button>
			</div>
		</div>
	)
}
