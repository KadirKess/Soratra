import { readFile, writeFile, rename, lstat, rm } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'

const [action, ...args] = process.argv.slice(2)
const allowed = new Set(['APP_PORT', 'LEGAL_NAME', 'SUPPORT_EMAIL', 'EMAIL_MODE', 'EMAIL_FROM', 'RESEND_API_KEY', 'DEPLOYMENT_MODE', 'PUBLIC_HOST', 'SITE_URL', 'AUTH_URL', 'TRUSTED_PROXY_IP_HEADER', 'SECURITY_CONTACT', 'SECURITY_EXPIRES', 'SOURCE_CODE_URL', 'POSTGRES_POOL_MAX', 'PUBLIC_DEPLOYMENT'])

function parse(text) {
  const values = {}
  for (const line of text.split('\n')) {
    const match = line.match(/^([A-Z_]+)=(.*)$/)
    if (!match) continue
    let value = match[2].trim()
    if (value.startsWith('"')) value = JSON.parse(value)
    else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1)
    values[match[1]] = value
  }
  return values
}

function validate(key, value) {
  if (!allowed.has(key)) throw new Error(`Unsupported setting: ${key}`)
  if (/[\x00-\x1f\x7f$\\]/.test(value)) throw new Error(`${key} contains unsupported characters.`)
  if (key === 'APP_PORT' && (!/^[1-9]\d*$/.test(value) || Number(value) < 1024 || Number(value) > 65535)) {
    throw new Error('Choose a port between 1024 and 65535.')
  }
  if (key === 'LEGAL_NAME' && (!value.trim() || value.length > 200)) throw new Error('Enter an operator name of 1 to 200 characters.')
  if (key === 'SUPPORT_EMAIL' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error('Enter a valid support email address.')
}

function url(value, protocols) {
  const parsed = new URL(value)
  if (!protocols.includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('Use a URL without embedded credentials.')
  return parsed
}

function validateAdvanced(key, value) {
  validate(key, value)
  if (key === 'EMAIL_MODE' && !['disabled', 'resend'].includes(value)) throw new Error('Email mode must be disabled or resend.')
  if (key === 'DEPLOYMENT_MODE' && !['local', 'public'].includes(value)) throw new Error('Hosting mode must be local or public.')
  if (['SITE_URL', 'AUTH_URL'].includes(key)) {
    const parsed = url(value, ['http:', 'https:'])
    if (parsed.pathname !== '/' || parsed.search || parsed.hash) throw new Error('Use an origin without a path, query, or fragment.')
  }
  if (key === 'PUBLIC_HOST' && value && !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(value)) throw new Error('Use a domain without a scheme, port, or path.')
  if (key === 'SOURCE_CODE_URL' && value && value !== '/source.tar.gz') url(value, ['https:'])
  if (key === 'SECURITY_CONTACT' && value && !/^mailto:[^\s]+@[^\s]+$/.test(value)) url(value, ['https:'])
  if (key === 'SECURITY_EXPIRES' && value && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value) || !Number.isFinite(Date.parse(value)) || Date.parse(value) <= Date.now())) throw new Error('Security expiry must be a future UTC timestamp, such as 2027-09-30T00:00:00Z.')
  if (key === 'POSTGRES_POOL_MAX' && value && (!/^[1-9]\d*$/.test(value) || Number(value) > 20)) throw new Error('Database connections must be between 1 and 20.')
  if (key === 'TRUSTED_PROXY_IP_HEADER' && value && (!/^[a-z0-9-]+$/i.test(value) || value.toLowerCase() === 'x-forwarded-for')) throw new Error('Use one single-address proxy header, such as x-real-ip.')
  if (key === 'PUBLIC_DEPLOYMENT' && !['preview', 'public', 'production'].includes(value)) throw new Error('Search visibility must be preview or public.')
}

function validateInstallation(values) {
  for (const key of allowed) if (values[key] !== undefined) validateAdvanced(key, values[key])
  const site = url(values.SITE_URL, ['http:', 'https:'])
  const auth = url(values.AUTH_URL, ['http:', 'https:'])
  if (site.origin !== auth.origin) throw new Error('The app and sign-in URLs must match.')
  if (values.DEPLOYMENT_MODE === 'local' && !['localhost', '127.0.0.1', '[::1]'].includes(site.hostname)) throw new Error('Personal hosting must use a localhost origin.')
  if (values.DEPLOYMENT_MODE === 'public') {
    if (site.protocol !== 'https:' || site.hostname !== values.PUBLIC_HOST) throw new Error('Public hosting needs HTTPS and a matching domain.')
    for (const key of ['LEGAL_NAME', 'SUPPORT_EMAIL', 'PUBLIC_HOST']) {
      if (!values[key] || /(?:\.example|@example\.com)/i.test(values[key]) || ['Personal installation', 'Local instance operator'].includes(values[key])) throw new Error(`Public hosting needs your real ${key.toLowerCase().replaceAll('_', ' ')}.`)
    }
    if (values.EMAIL_MODE !== 'resend') throw new Error('Public hosting needs email password recovery. Configure Resend before saving.')
  }
  if (values.EMAIL_MODE === 'resend') {
    for (const key of ['EMAIL_FROM', 'RESEND_API_KEY']) {
      if (!values[key] || /(?:\.example|@example\.com)/i.test(values[key])) throw new Error('Resend needs a real verified sender and an API key.')
    }
  }
}

try {
  if (action === 'validate') {
    if (args.length % 2) throw new Error('Settings need a key and a value.')
    for (let i = 0; i < args.length; i += 2) validate(args[i], args[i + 1])
    process.exit(0)
  }
  const stat = await lstat('.env')
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('.env must be a regular file.')
  let text = await readFile('.env', 'utf8')
  const values = parse(text)
  if (action === 'read') {
    const port = values.APP_PORT || new URL(values.SITE_URL || 'http://localhost:3000').port || '3000'
    validate('APP_PORT', port)
    const origin = new URL(values.SITE_URL || `http://localhost:${port}`)
    if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password) throw new Error('SITE_URL must be an HTTP or HTTPS origin without credentials.')
    const mode = values.DEPLOYMENT_MODE || 'public'
    if (!['local', 'public'].includes(mode)) throw new Error('DEPLOYMENT_MODE must be local or public.')
    console.log([port, origin.origin, mode, values.LEGAL_NAME || 'Local instance operator', values.SUPPORT_EMAIL || ''].join('\n'))
  } else if (action === 'get') {
    const key = args[0]
    if (!allowed.has(key) || key === 'RESEND_API_KEY') throw new Error('This setting cannot be displayed.')
    console.log(values[key] || (key === 'APP_PORT' ? new URL(values.SITE_URL || 'http://localhost:3000').port || '3000' : ''))
  } else if (action === 'has-email-key') {
    console.log(values.RESEND_API_KEY ? 'yes' : 'no')
  } else if (action === 'edit' || action === 'edit-fields') {
    if (action === 'edit-fields') {
      let input = ''
      for await (const chunk of process.stdin) input += chunk
      const fields = input.split('\0')
      if (fields.pop() !== '') throw new Error('Invalid settings input.')
      args.splice(0, args.length, ...fields)
    }
    const edits = {}
    if (args.length % 2) throw new Error('Settings need a key and a value.')
    for (let i = 0; i < args.length; i += 2) {
      validateAdvanced(args[i], args[i + 1])
      edits[args[i]] = args[i + 1]
    }
    if (action === 'edit' || action === 'edit-fields') {
      if (edits.APP_PORT && (edits.DEPLOYMENT_MODE || values.DEPLOYMENT_MODE) === 'local') {
        edits.AUTH_URL = `http://localhost:${edits.APP_PORT}`
        edits.SITE_URL = edits.AUTH_URL
      }
      if (action === 'edit-fields') validateInstallation({ ...values, ...edits })
      for (const [key, value] of Object.entries(edits)) {
        const line = `${key}=${JSON.stringify(value)}`
        const pattern = new RegExp(`^${key}=.*$`, 'gm')
        text = pattern.test(text) ? text.replace(pattern, () => line) : `${text.trimEnd()}\n${line}\n`
      }
      const temporary = `.env.launcher-${randomBytes(8).toString('hex')}`
      try {
        await writeFile(temporary, text, { mode: 0o600, flag: 'wx' })
        await rename(temporary, '.env')
      } finally {
        await rm(temporary, { force: true })
      }
    }
  } else throw new Error('Unknown configuration command.')
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
