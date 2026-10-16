export async function register() {
  // Node-only work lives in its own module so the edge build never bundles it.
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NEXT_PHASE !== 'phase-production-build') {
    const { startServer } = await import('@/server/startup')
    await startServer()
  }
}
