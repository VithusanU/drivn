import { encrypt, decrypt } from './encryption'

// Generates a URL-safe token that encodes the user's ID.
// Used for the public calendar subscription feed — no auth cookies needed.
export function generateCalendarToken(userId: string): string {
  const encrypted = encrypt(userId) // "iv:tag:data" — may contain / and +
  return Buffer.from(encrypted).toString('base64url')
}

export function verifyCalendarToken(token: string): string | null {
  try {
    const encrypted = Buffer.from(token, 'base64url').toString('utf8')
    return decrypt(encrypted)
  } catch {
    return null
  }
}
