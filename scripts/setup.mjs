import { randomBytes } from 'node:crypto'
import { open } from 'node:fs/promises'
import { resolve } from 'node:path'

const password = randomBytes(32).toString('hex')
const lines = [
  `POSTGRES_PASSWORD=${password}`,
  `POSTGRES_URL=postgres://soratra:${password}@localhost:5432/soratra`,
  'POSTGRES_POOL_MAX=5',
  `AUTH_SECRET=${randomBytes(32).toString('hex')}`,
  `CRON_SECRET=${randomBytes(32).toString('hex')}`,
  'AUTH_URL=http://localhost:3000',
  'SITE_URL=http://localhost:3000',
  'DEPLOYMENT_MODE=local',
  'EMAIL_MODE=disabled',
  'TRUSTED_PROXY_IP_HEADER=',
  'SUPPORT_EMAIL=',
  'LEGAL_NAME=Local instance operator',
  'EMAIL_FROM=',
  'RESEND_API_KEY=',
  'SECURITY_CONTACT=',
  'SECURITY_EXPIRES=',
  'PUBLIC_DEPLOYMENT=preview',
  '',
]
let file
try {
  file = await open(resolve('.env'), 'wx', 0o600)
} catch (error) {
  if (error.code === 'EEXIST') {
    console.error('Configuration already exists; refusing to overwrite .env.')
    process.exit(1)
  }
  throw error
}
try {
  await file.writeFile(lines.join('\n'))
} finally {
  await file.close()
}
console.info('Created private .env for localhost. Keep it out of Git and backups of source code.')
