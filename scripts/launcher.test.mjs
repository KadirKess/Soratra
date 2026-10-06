import assert from 'node:assert/strict'
import { mkdtemp, mkdir, copyFile, chmod, writeFile, readFile, stat, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = fileURLToPath(new URL('../', import.meta.url))
async function fixture() {
  const cwd = await mkdtemp(join(tmpdir(), 'soratra-launcher-'))
  await mkdir(join(cwd, 'scripts'))
  await mkdir(join(cwd, 'bin'))
  for (const file of ['soratra.sh', 'scripts/setup.mjs', 'scripts/launcher-config.mjs', 'scripts/launcher-advanced.sh']) {
    await copyFile(join(root, file), join(cwd, file))
  }
  await writeFile(join(cwd, 'bin/docker'), `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$FAKE_DOCKER_LOG"
case "$*" in
  'info'|'compose version'|'image inspect '*) exit 0 ;;
  compose*)
    echo 'DOCKER BUILD DETAIL: internal dependency download'
    if [ \"\${FAKE_COMPOSE_ERROR:-}\" = yes ] && [[ \"$*\" == *\"run --rm migrate\"* ]]; then echo 'Migration fixture failure' >&2; exit 9; fi
    ;;
  run*)
    if [ "\${FAKE_NETWORK_ERROR:-}" = yes ]; then echo 'network connection failed' >&2; exit 125; fi
    if [[ "$*" == *"scripts/launcher-config.mjs"* || "$*" == *"scripts/setup.mjs"* ]]; then
      while [ \"$1\" != node ]; do shift; done
      shift
      exec \"$FAKE_NODE\" \"$@\"
    fi
    if [[ "$*" == *"127.0.0.1:\${FAKE_BUSY_PORT:-none}:"* ]]; then echo 'port is already allocated' >&2; exit 125; fi
    ;;
esac
exit 0
`)
  await chmod(join(cwd, 'bin/docker'), 0o755)
  const env = { ...process.env, PATH: `${join(cwd, 'bin')}:${process.env.PATH}`, FAKE_DOCKER_LOG: join(cwd, 'docker.log'), FAKE_NODE: process.execPath }
  const run = (args, extra = {}) => spawnSync('bash', [join(cwd, 'soratra.sh'), ...args], { cwd, env: { ...env, ...extra }, encoding: 'utf8' })
  const config = (...args) => spawnSync(process.execPath, [join(cwd, 'scripts/launcher-config.mjs'), ...args], { cwd, encoding: 'utf8' })
  return { cwd, run, config, clean: () => rm(cwd, { recursive: true, force: true }) }
}

test('first launch saves settings and subsequent launches preserve credentials', async () => {
  const f = await fixture()
  try {
    const first = f.run(['--yes', '--no-open', '--name', 'A reader', '--support-email', 'reader@example.test'], { FAKE_BUSY_PORT: '3000' })
    assert.equal(first.status, 0, first.stderr)
    const original = await readFile(join(f.cwd, '.env'), 'utf8')
    assert.match(original, /APP_PORT="3001"/)
    assert.match(original, /SITE_URL="http:\/\/localhost:3001"/)
    assert.match(original, /LEGAL_NAME="A reader"/)
    assert.equal((await stat(join(f.cwd, '.env'))).mode & 0o777, 0o600)
    assert.equal(f.run(['configure', '--yes']).status, 0)
    assert.equal(await readFile(join(f.cwd, '.env'), 'utf8'), original)
    assert.equal(f.run(['--port', '3040', '--support-email', '', '--no-open']).status, 0)
    const edited = await readFile(join(f.cwd, '.env'), 'utf8')
    assert.match(edited, /SUPPORT_EMAIL=""/)
    for (const key of ['POSTGRES_PASSWORD', 'AUTH_SECRET', 'CRON_SECRET']) {
      const secret = original.match(new RegExp(`^${key}=(.*)$`, 'm'))[1]
      assert.ok(edited.includes(`${key}=${secret}`))
      assert.ok(!first.stdout.includes(secret))
    }
    assert.equal(f.run(['stop']).status, 0)
    const commands = await readFile(join(f.cwd, 'docker.log'), 'utf8')
    assert.match(commands, /run --rm migrate/)
    assert.match(commands, /compose -f compose.yaml stop/)
    assert.ok(!commands.includes('--volumes'))
  } finally { await f.clean() }
})

test('invalid values, busy explicit ports, and Docker failures leave no configuration', async () => {
  for (const [args, env] of [
    [['--name', 'bad\nname'], {}],
    [['--support-email', 'bad'], {}],
    [['--port', '03000'], {}],
    [['--port', '3000'], { FAKE_BUSY_PORT: '3000' }],
    [[], { FAKE_NETWORK_ERROR: 'yes' }],
  ]) {
    const f = await fixture()
    try {
      assert.notEqual(f.run([...args, '--yes', '--no-open'], env).status, 0)
      await assert.rejects(readFile(join(f.cwd, '.env')), { code: 'ENOENT' })
    } finally { await f.clean() }
  }
})

test('configuration edits preserve public origins and reject execution characters', async () => {
  const f = await fixture()
  try {
    await writeFile(join(f.cwd, '.env'), 'DEPLOYMENT_MODE=public\nSITE_URL=https://books.example.test\nAUTH_URL=https://books.example.test\nLEGAL_NAME=Saved operator\nSUPPORT_EMAIL=reader@example.test\nAPP_PORT=3000\nAUTH_SECRET=keep-this\n')
    assert.equal(f.run(['configure', '--yes', '--port', '3050']).status, 0)
    const saved = await readFile(join(f.cwd, '.env'), 'utf8')
    assert.match(saved, /SITE_URL=https:\/\/books.example.test/)
    assert.match(saved, /SUPPORT_EMAIL=reader@example.test/)
    assert.equal(f.config('edit', 'LEGAL_NAME', '$(touch should-not-exist)').status, 1)
    assert.equal(await readFile(join(f.cwd, '.env'), 'utf8'), saved)
    assert.equal(f.run(['status']).status, 0)
    assert.match(await readFile(join(f.cwd, 'docker.log'), 'utf8'), /-f compose.public.yaml ps --all/)
  } finally { await f.clean() }
})


test('launcher runs configuration through Docker when host Node is unavailable', async () => {
  const f = await fixture()
  try {
    await writeFile(join(f.cwd, 'bin/node'), '#!/bin/sh\nexit 1\n')
    await chmod(join(f.cwd, 'bin/node'), 0o755)
    const result = f.run(['--yes', '--no-open'])
    assert.equal(result.status, 0, result.stderr)
    assert.match(await readFile(join(f.cwd, 'docker.log'), 'utf8'), /run --rm -i .*--mount .*node:24-bookworm-slim node scripts\/setup.mjs/)
    assert.match(await readFile(join(f.cwd, '.env'), 'utf8'), /APP_PORT="3000"/)
  } finally { await f.clean() }
})


test('normal progress is quiet, verbose output is optional, and failures show their logs', async () => {
  const f = await fixture()
  try {
    const quiet = f.run(['--yes', '--no-open', '--no-color'])
    assert.equal(quiet.status, 0, quiet.stderr)
    assert.match(quiet.stdout, /Building Soratra\s+\[done\]/)
    assert.match(quiet.stdout, /YOUR JOURNAL IS READY/)
    assert.match(quiet.stdout, /no API key is needed/)
    assert.ok(!quiet.stdout.includes('DOCKER BUILD DETAIL'))
    assert.ok(!quiet.stdout.includes('Instance operator'))
    assert.ok(!quiet.stdout.includes('\x1b'))
    const verbose = f.run(['--no-open', '--verbose'])
    assert.equal(verbose.status, 0, verbose.stderr)
    assert.match(verbose.stdout, /DOCKER BUILD DETAIL/)
    const failure = f.run(['--no-open'], { FAKE_COMPOSE_ERROR: 'yes' })
    assert.notEqual(failure.status, 0)
    assert.match(failure.stderr, /Preparing database\s+\[failed\]/)
    assert.match(failure.stderr, /Migration fixture failure/)
    assert.ok(!failure.stdout.includes('YOUR JOURNAL IS READY'))
  } finally { await f.clean() }
})

test('advanced saves are atomic, validate public hosting, and keep credentials private', async () => {
  const f = await fixture()
  try {
    assert.equal(f.run(['--yes', '--no-open']).status, 0)
    const original = await readFile(join(f.cwd, '.env'), 'utf8')
    const edit = (entries) => spawnSync(process.execPath, [join(f.cwd, 'scripts/launcher-config.mjs'), 'edit-fields'], {
      cwd: f.cwd, encoding: 'utf8', input: entries.flat().join('\0') + '\0',
    })
    const incomplete = edit([['DEPLOYMENT_MODE', 'public'], ['PUBLIC_HOST', 'books.reader.test'], ['SITE_URL', 'https://books.reader.test'], ['AUTH_URL', 'https://books.reader.test']])
    assert.notEqual(incomplete.status, 0)
    assert.match(incomplete.stderr, /Public hosting needs/)
    assert.equal(await readFile(join(f.cwd, '.env'), 'utf8'), original)
    assert.equal(edit([['SOURCE_CODE_URL', '/source.tar.gz'], ['PUBLIC_DEPLOYMENT', 'production'], ['POSTGRES_POOL_MAX', '']]).status, 0)
    const key = 're_fixture_private_mail_key'
    const complete = edit([
      ['LEGAL_NAME', 'A Reader'], ['SUPPORT_EMAIL', 'reader@reader.test'],
      ['EMAIL_MODE', 'resend'], ['EMAIL_FROM', 'Soratra <books@reader.test>'], ['RESEND_API_KEY', key],
      ['DEPLOYMENT_MODE', 'public'], ['PUBLIC_HOST', 'books.reader.test'],
      ['SITE_URL', 'https://books.reader.test'], ['AUTH_URL', 'https://books.reader.test'],
      ['TRUSTED_PROXY_IP_HEADER', 'x-real-ip'], ['POSTGRES_POOL_MAX', '8'],
    ])
    assert.equal(complete.status, 0, complete.stderr)
    assert.ok(!complete.stdout.includes(key))
    assert.equal(f.config('get', 'RESEND_API_KEY').status, 1)
    const saved = await readFile(join(f.cwd, '.env'), 'utf8')
    for (const name of ['POSTGRES_PASSWORD', 'AUTH_SECRET', 'CRON_SECRET']) {
      assert.ok(saved.includes(original.match(new RegExp(`^${name}=.*$`, 'm'))[0]))
    }
    for (const entry of [['POSTGRES_POOL_MAX', '21'], ['SOURCE_CODE_URL', 'http://reader.test/source'], ['PUBLIC_HOST', 'https://reader.test'], ['SECURITY_EXPIRES', '2020-01-01T00:00:00Z']]) {
      assert.notEqual(edit([entry]).status, 0)
      assert.equal(await readFile(join(f.cwd, '.env'), 'utf8'), saved)
    }
    assert.notEqual(f.run(['advanced', '--yes']).status, 0)
  } finally { await f.clean() }
})
