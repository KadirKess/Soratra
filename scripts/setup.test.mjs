import assert from 'node:assert/strict'
import { mkdtemp, readFile, stat, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const script = fileURLToPath(new URL('./setup.mjs', import.meta.url))

test('setup generates private unique configuration and refuses to replace it', async () => {
  const first = await mkdtemp(join(tmpdir(), 'soratra-setup-'))
  const second = await mkdtemp(join(tmpdir(), 'soratra-setup-'))
  try {
    const run = cwd => spawnSync(process.execPath, [script], { cwd, encoding: 'utf8' })
    const firstRun = run(first)
    assert.equal(firstRun.status, 0)
    assert.equal(run(second).status, 0)
    const original = await readFile(join(first, '.env'), 'utf8')
    const other = await readFile(join(second, '.env'), 'utf8')
    const parse = value => Object.fromEntries(value.trim().split('\n').map(line => {
      const index = line.indexOf('=')
      return [line.slice(0, index), line.slice(index + 1)]
    }))
    const firstEnv = parse(original)
    const secondEnv = parse(other)
    for (const key of ['POSTGRES_PASSWORD', 'AUTH_SECRET', 'CRON_SECRET']) {
      assert.match(firstEnv[key], /^[0-9a-f]{64}$/)
      assert.notEqual(firstEnv[key], secondEnv[key])
      assert.ok(!firstRun.stdout.includes(firstEnv[key]))
    }
    assert.equal(new Set([firstEnv.POSTGRES_PASSWORD, firstEnv.AUTH_SECRET, firstEnv.CRON_SECRET]).size, 3)
    assert.equal(firstEnv.DEPLOYMENT_MODE, 'local')
    assert.equal(firstEnv.EMAIL_MODE, 'disabled')
    assert.equal(new URL(firstEnv.POSTGRES_URL).password, firstEnv.POSTGRES_PASSWORD)
    assert.equal((await stat(join(first, '.env'))).mode & 0o777, 0o600)
    assert.equal(run(first).status, 1)
    assert.equal(await readFile(join(first, '.env'), 'utf8'), original)
  } finally {
    await rm(first, { recursive: true, force: true })
    await rm(second, { recursive: true, force: true })
  }
})
