/**
 * Session expiry from the JWT itself. The `exp` claim is read WITHOUT checking
 * the signature — only so the UI never keeps showing a logged-in screen for a
 * dead token (cookie still present, persisted profile still there). The API
 * still verifies every request. Works in the browser and in the edge middleware.
 */

/** Expiry time (ms since epoch) from the token's `exp` claim, or null if unreadable. */
export function tokenExpiresAt(token?: string | null): number | null {
  const part = token?.split('.')[1]
  if (!part) return null
  try {
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '=')))
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

/** True when there is no usable token: missing, unreadable, or past its expiry. */
export function isTokenExpired(token?: string | null, now = Date.now()): boolean {
  const exp = tokenExpiresAt(token)
  return exp == null || exp <= now
}

/** Cookie lifetime matching the token (js-cookie `expires`); 1 day if unreadable. */
export function cookieExpiry(token: string): Date | number {
  const exp = tokenExpiresAt(token)
  return exp ? new Date(exp) : 1
}
