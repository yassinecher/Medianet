/**
 * Front-office (public site) base URL — landing preview iframe, "open site"
 * link, « Mot de passe oublié » (the reset pages live on the front office).
 * Prefers the build-time env; otherwise derives it from the admin host with the
 * SAME protocol (an http://localhost URL would be blocked as mixed content on
 * the HTTPS admin site).
 */
export function frontofficeBase(): string {
  const env = process.env.NEXT_PUBLIC_FRONTOFFICE_URL
  if (env) return env.replace(/\/+$/, '')
  if (typeof window === 'undefined') return 'http://localhost:3000'
  const { protocol, host } = window.location
  let fo = host
    .replace('incubatoradmin', 'incubator')   // medianetincubatoradmin.duckdns.org → medianetincubator…
    .replace('backoffice', 'frontoffice')
    .replace(/(^|\.)admin\./, '$1app.')        // admin.medianet.dz → app.medianet.dz
  if (fo === host && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) fo = host.replace(/:\d+$/, '') + ':3000' // dev
  return `${protocol}//${fo}`
}
