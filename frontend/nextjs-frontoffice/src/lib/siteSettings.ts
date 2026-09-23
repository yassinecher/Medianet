'use client'
import { landingPageApi } from '@/lib/api'

/**
 * Public site settings (the landing-page document: content, logo, colors).
 * Fetched ONCE per page load and shared by the landing page, the logo and the
 * site-wide theme — instead of each of them calling the API.
 */
let inflight: Promise<any | null> | null = null

export function fetchSiteSettings(): Promise<any | null> {
  inflight ??= landingPageApi.get()
    .then((r) => r.data ?? null)
    .catch(() => {
      inflight = null // allow a retry on the next call
      return null
    })
  return inflight
}
