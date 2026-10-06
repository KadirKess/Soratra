import { readdir, lstat, copyFile, mkdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const roots = ['src', 'drizzle', 'e2e', 'scripts', 'docker', '.github', 'LICENSES', 'docs', 'public']
const rootFiles = [
  'LICENSE', 'NOTICE', 'TRADEMARKS.md', 'README.md', 'CONTRIBUTING.md', 'AGENTS.md', '.env.example',
  '.gitignore', '.dockerignore', '.nvmrc', 'Dockerfile', 'soratra.sh', 'package.json', 'package-lock.json',
  'next.config.ts', 'tsconfig.json', 'vitest.config.ts', 'playwright.config.ts',
  'postcss.config.mjs', 'drizzle.config.ts',
]
const excluded = new Set(['.git', 'node_modules', '.next', 'test-results', 'playwright-report', 'backups', '.DS_Store'])
const files = []

async function collect(path) {
  let stat
  try {
    stat = await lstat(path)
  } catch (error) {
    if (error.code === 'ENOENT') return
    throw error
  }
  if (stat.isSymbolicLink()) throw new Error(`Source archive cannot include a symlink: ${path}`)
  if (stat.isDirectory()) {
    for (const name of (await readdir(path)).sort()) {
      if (excluded.has(name) || name.startsWith('.env') || /\.(dump|log|sql\.gz)$/.test(name)) continue
      if (path === 'public' && ['source.tar.gz', 'license.txt', 'notices.txt'].includes(name)) continue
      await collect(join(path, name))
    }
  } else if (stat.isFile()) {
    files.push(path)
  }
}

await mkdir('public', { recursive: true })
for (const path of roots) await collect(path)
for (const path of rootFiles) await collect(path)
for (const entry of (await readdir('.')).sort()) {
  if (/^compose(?:\.[a-z-]+)?\.ya?ml$/.test(entry)) await collect(entry)
}
execFileSync('tar', ['-czf', 'public/source.tar.gz', '--null', '-T', '-'], {
  input: files.sort().join('\0') + '\0',
  env: { ...process.env, COPYFILE_DISABLE: '1' },
})
await copyFile('LICENSE', 'public/license.txt')
await copyFile('NOTICE', 'public/notices.txt')
process.stdout.write(`Packaged corresponding source: ${files.length} files.\n`)
