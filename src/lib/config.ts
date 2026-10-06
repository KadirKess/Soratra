import 'server-only'

export const siteConfig = {
  get siteUrl() { return process.env.SITE_URL?.trim() || 'http://localhost:3000' },
  get supportEmail() { return process.env.SUPPORT_EMAIL?.trim() || 'support@example.com' },
  get legalName() { return process.env.LEGAL_NAME?.trim() || 'Local instance operator' },
  get emailFrom() { return process.env.EMAIL_FROM?.trim() || 'noreply@example.com' },
}

export function getSourceCodeUrl() {
  const value = process.env.SOURCE_CODE_URL?.trim() || '/source.tar.gz'
  if (value === '/source.tar.gz') return value
  try {
    const url = new URL(value)
    if (url.protocol === 'https:' && !url.username && !url.password) return value
  } catch {}
  throw new Error('SOURCE_CODE_URL must be an HTTPS URL without credentials.')
}

export function isEmailDisabled() {
  return process.env.EMAIL_MODE === 'disabled'
}

function configuredValue(name: string) {
  const value = process.env[name]?.trim()
  if (!value || /(?:\.example|@example\.com)/i.test(value)) {
    throw new Error(`Configure ${name} for this instance.`)
  }
  return value
}

export function assertProductionConfiguration() {
  if (process.env.NODE_ENV !== 'production') return
  getSourceCodeUrl()
  const mode = process.env.DEPLOYMENT_MODE ?? 'public'
  const emailMode = process.env.EMAIL_MODE ?? 'resend'
  if (!['local', 'public'].includes(mode)) throw new Error('DEPLOYMENT_MODE must be local or public.')
  if (!['disabled', 'resend'].includes(emailMode)) throw new Error('EMAIL_MODE must be disabled or resend.')

  let site: URL
  let auth: URL
  try {
    site = new URL(process.env.SITE_URL?.trim() || '')
    auth = new URL(process.env.AUTH_URL ?? '')
  } catch {
    throw new Error('SITE_URL and AUTH_URL must be valid URLs.')
  }
  if (site.origin !== auth.origin || site.username || site.password || auth.username || auth.password ||
      site.pathname !== '/' || auth.pathname !== '/' || site.search || auth.search || site.hash || auth.hash) {
    throw new Error('SITE_URL and AUTH_URL must be the same origin without credentials, paths, queries, or fragments.')
  }
  if (mode === 'local') {
    if (!['localhost', '127.0.0.1', '[::1]'].includes(site.hostname) || !['http:', 'https:'].includes(site.protocol)) {
      throw new Error('Local deployments require a loopback HTTP or HTTPS origin.')
    }
  } else {
    if (site.protocol !== 'https:') throw new Error('Public deployments require HTTPS.')
    configuredValue('SITE_URL')
    configuredValue('SUPPORT_EMAIL')
    configuredValue('LEGAL_NAME')
    if (emailMode !== 'resend') throw new Error('Public deployments require Resend email delivery.')
  }
  if (emailMode === 'resend') {
    configuredValue('RESEND_API_KEY')
    configuredValue('EMAIL_FROM')
  }
  for (const name of ['POSTGRES_URL', 'AUTH_SECRET', 'CRON_SECRET']) configuredValue(name)
  const header = process.env.TRUSTED_PROXY_IP_HEADER
  if (header && (!/^[a-z0-9-]+$/i.test(header) || header.toLowerCase() === 'x-forwarded-for')) {
    throw new Error('TRUSTED_PROXY_IP_HEADER must name a single-address header, not x-forwarded-for.')
  }
  if (process.env.SECURITY_EXPIRES && !Number.isFinite(Date.parse(process.env.SECURITY_EXPIRES))) {
    throw new Error('SECURITY_EXPIRES must be an ISO date.')
  }
  if (process.env.SECURITY_CONTACT && !/^(mailto:[^\s]+@[^\s]+|https:\/\/[^\s]+)$/.test(process.env.SECURITY_CONTACT)) {
    throw new Error('SECURITY_CONTACT must be a mailto or HTTPS URL.')
  }
}
