/**
 * Base URL of the back-office (admin) app. Prefers the build-time env; otherwise
 * derives it from the current host — the mirror of the back-office's own
 * frontofficeBase() mapping (medianetincubator.… → medianetincubatoradmin.…).
 */
export function backofficeBase(): string {
  const env = process.env.NEXT_PUBLIC_BACKOFFICE_URL
  if (env) return env.replace(/\/+$/, '')
  if (typeof window === 'undefined') return 'http://localhost:3001'
  const { protocol, host } = window.location
  let bo = host
    .replace(/incubator(?=\.)/, 'incubatoradmin')
    .replace('frontoffice', 'backoffice')
    .replace(/(^|\.)app\./, '$1admin.')
  if (bo === host && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) bo = host.replace(/:\d+$/, '') + ':3001' // dev
  return `${protocol}//${bo}`
}
