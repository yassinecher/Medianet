'use client'
import { useEffect } from 'react'
import { fetchSiteSettings } from '@/lib/siteSettings'
import { buildSiteThemeCss } from '@/lib/landingTheme'

/** localStorage key + <style> id shared with the pre-paint script in app/layout.tsx. */
export const SITE_THEME_KEY = 'site-theme-css'
export const SITE_THEME_STYLE_ID = 'site-theme'

/** Write the theme CSS into the page (creating the <style> tag if needed). */
export function applySiteThemeCss(css: string) {
  let el = document.getElementById(SITE_THEME_STYLE_ID) as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = SITE_THEME_STYLE_ID
    document.head.appendChild(el)
  }
  if (el.textContent !== css) el.textContent = css
  try {
    if (css) localStorage.setItem(SITE_THEME_KEY, css)
    else localStorage.removeItem(SITE_THEME_KEY)
  } catch {}
}

/**
 * Applies the admin's front-office colors ("Couleurs du reste du site") to every
 * page. The last known CSS is already injected before first paint by the inline
 * script in the root layout; this refreshes it from the server.
 */
export function SiteTheme() {
  useEffect(() => {
    fetchSiteSettings().then((s) => { if (s) applySiteThemeCss(buildSiteThemeCss(s)) })
  }, [])
  return null
}
