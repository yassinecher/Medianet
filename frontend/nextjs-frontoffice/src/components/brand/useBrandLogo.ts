'use client'
import { useEffect, useState } from 'react'
import { fetchSiteSettings } from '@/lib/siteSettings'

/**
 * Logo override chosen by an admin in the landing-page editor (`logoUrl`).
 * `null` = use the bundled Medianet Incubator SVG. Fetched once per page load
 * and remembered in localStorage so a custom logo doesn't flash the default.
 */
const STORAGE_KEY = 'brand-logo-url'
let cached: string | null | undefined
let inflight: Promise<string | null> | null = null
const listeners = new Set<(url: string | null) => void>()

function readStored(): string | null {
  try { return localStorage.getItem(STORAGE_KEY) || null } catch { return null }
}

/**
 * Push a new logo to every mounted logo immediately. `persist: false` (editor
 * preview of an unpublished logo) skips the localStorage cache so the draft logo
 * never leaks into normal visits.
 */
export function setBrandLogoUrl(url: string | null | undefined, { persist = true }: { persist?: boolean } = {}) {
  cached = url || null
  if (persist) try {
    if (cached) localStorage.setItem(STORAGE_KEY, cached)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {}
  listeners.forEach((l) => l(cached ?? null))
}

export function useBrandLogoUrl(): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    listeners.add(setUrl)
    setUrl(cached !== undefined ? cached : readStored())
    if (cached === undefined) {
      inflight ??= fetchSiteSettings()
        .then((data) => (data ? (data.logoUrl as string) || null : readStored()))
      inflight.then(setBrandLogoUrl)
    }
    return () => { listeners.delete(setUrl) }
  }, [])
  return url
}
