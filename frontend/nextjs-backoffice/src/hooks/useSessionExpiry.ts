'use client'
import { useEffect, useRef } from 'react'
import Cookies from 'js-cookie'
import { isTokenExpired, tokenExpiresAt } from '@/lib/session'

/**
 * Calls `onExpire` as soon as the session token (read from `cookieName`) is
 * gone or past its expiry: on mount, at the expiry moment, and whenever the tab
 * becomes visible / focused again — timers are throttled in background tabs and
 * paused while the computer sleeps. `dep` = the store's token, so a refreshed
 * token reschedules the check.
 */
export function useSessionExpiry(cookieName: string, onExpire: () => void, dep?: unknown) {
  const cb = useRef(onExpire)
  cb.current = onExpire

  useEffect(() => {
    let fired = false
    const check = () => {
      if (fired) return
      if (isTokenExpired(Cookies.get(cookieName))) { fired = true; cb.current() }
    }
    check()
    const exp = tokenExpiresAt(Cookies.get(cookieName))
    // setTimeout caps at ~24.8 days; tokens are far shorter-lived.
    const timer = exp ? setTimeout(check, Math.min(Math.max(0, exp - Date.now()) + 500, 2_000_000_000)) : undefined
    const onWake = () => { if (document.visibilityState === 'visible') check() }
    window.addEventListener('focus', onWake)
    document.addEventListener('visibilitychange', onWake)
    return () => {
      if (timer) clearTimeout(timer)
      window.removeEventListener('focus', onWake)
      document.removeEventListener('visibilitychange', onWake)
    }
  }, [cookieName, dep])
}
