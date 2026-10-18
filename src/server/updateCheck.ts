import 'server-only'
import { z } from 'zod'

// Asks GitHub for the latest release, at most once a day and only while an
// admin is looking at their page. Nothing about the installation is sent; GitHub
// sees the server's IP address and a User-Agent naming the running version.
const LATEST_RELEASE_URL = 'https://api.github.com/repos/KadirKess/Soratra/releases/latest'
const RELEASES_PREFIX = 'https://github.com/KadirKess/Soratra/releases/'
const TIMEOUT_MS = 5_000
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000

export type Version = { major: number; minor: number; patch: number }

export type LatestRelease = { version: string; url: string }

export type UpdateStatus = {
  // null when the image wasn't built for a release (dev, ci, local builds).
  current: string | null
  latest: LatestRelease | null
  updateAvailable: boolean
  majorUpdate: boolean
}

// Only plain releases count. Prereleases and build tags such as dev or ci
// never take part in the comparison.
export function parseVersion(value: string | null | undefined): Version | null {
  const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value?.trim() ?? '')
  if (!match) return null
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) }
}

export function compareVersions(a: Version, b: Version) {
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch
}

export function currentVersion() {
  const version = parseVersion(process.env.SORATRA_VERSION)
  return version ? formatVersion(version) : null
}

function formatVersion({ major, minor, patch }: Version) {
  return `${major}.${minor}.${patch}`
}

const releaseSchema = z.object({
  tag_name: z.string(),
  html_url: z.string(),
  draft: z.boolean().optional(),
  prerelease: z.boolean().optional(),
})

async function fetchLatestRelease(current: string): Promise<LatestRelease | null> {
  const response = await fetch(LATEST_RELEASE_URL, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': `Soratra/${current}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  // 404 means no published release yet, which is not a failure.
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`GitHub answered ${response.status}`)
  const release = releaseSchema.parse(await response.json())
  const version = parseVersion(release.tag_name)
  if (!version || release.draft || release.prerelease) return null
  // The link ends up on the admin page, so only accept one into this repo's releases.
  if (!release.html_url.startsWith(RELEASES_PREFIX)) return null
  return { version: formatVersion(version), url: release.html_url }
}

type CacheEntry = { checkedAt: number; latest: LatestRelease | null }

let cached: CacheEntry | null = null
let inflight: Promise<CacheEntry> | null = null

function checkNow(current: string) {
  inflight ??= fetchLatestRelease(current)
    .catch((error: unknown) => {
      // Failures wait for the next daily check like successes do, so GitHub
      // being down costs one log line a day.
      console.error(JSON.stringify({
        event: 'update_check_failed',
        error: (error instanceof Error ? `${error.name}: ${error.message}` : 'unknown').slice(0, 200),
      }))
      return null
    })
    .then((latest) => {
      cached = { checkedAt: Date.now(), latest }
      return cached
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

function toStatus(current: string | null, latest: LatestRelease | null): UpdateStatus {
  const running = parseVersion(current)
  const newest = parseVersion(latest?.version)
  const updateAvailable = Boolean(running && newest && compareVersions(newest, running) > 0)
  return {
    current,
    latest: updateAvailable ? latest : null,
    updateAvailable,
    majorUpdate: Boolean(updateAvailable && newest && running && newest.major > running.major),
  }
}

// With fetch false this only reads what an earlier check found, so the sidebar
// can show a dot without making requests of its own.
export async function getUpdateStatus({ enabled, fetch: allowFetch }: { enabled: boolean; fetch: boolean }) {
  const current = currentVersion()
  if (!enabled || !current) return toStatus(current, null)
  const fresh = cached && Date.now() - cached.checkedAt < CHECK_INTERVAL_MS
  if (!fresh && allowFetch) await checkNow(current)
  return toStatus(current, cached?.latest ?? null)
}

export function resetUpdateCheckForTests() {
  cached = null
  inflight = null
}
