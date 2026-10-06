import 'server-only'

import bcrypt from 'bcryptjs'

export function isSupportedPassword(password: string): boolean {
  return password.length >= 8 && !bcrypt.truncates(password)
}
