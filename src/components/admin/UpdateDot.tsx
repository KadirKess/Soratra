// Always in Your Soratra's ink, wherever it shows. Decorative only; the link's
// accessible name says an update is available.
export function UpdateDot({ className = "" }: { className?: string }) {
	return <span aria-hidden="true" data-section="admin" className={`block w-2 h-2 rounded-full ${className}`} style={{ background: "var(--section-ink)" }} />;
}
