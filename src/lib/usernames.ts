const USERNAME_PATTERN = /^[a-zA-Z0-9_]{2,30}$/

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase()
}

export function normalizeUsernameLookup(value: string) {
  return normalizeUsername(value.replace(/^@/, ''))
}

export function isValidUsername(value: string) {
  return USERNAME_PATTERN.test(value.trim())
}
