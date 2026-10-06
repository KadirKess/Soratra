import Link from 'next/link'

export default function NotFound() {
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
					Page not found
				</h1>
				<p className="text-sm" style={{ color: 'var(--muted)' }}>
					This page doesn&apos;t exist, or it moved. Nothing was lost.
				</p>
				<Link href="/landing" className="btn-primary w-full inline-block">
					Back home
				</Link>
			</div>
		</div>
	)
}
