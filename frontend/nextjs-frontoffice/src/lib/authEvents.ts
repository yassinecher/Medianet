'use client'
import Cookies from 'js-cookie'
import toast from 'react-hot-toast'
import { authApi, streamAuthEvents } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'

/**
 * Singleton subscription to the auth-service live events stream.
 *
 * While a session is open, the backend pushes `permissions-changed` whenever an
 * admin edits the user's roles/permissions (directly, or via a role they hold).
 * We then refresh the JWT — the new claims land in the auth store, and the
 * role/permission-driven layout (sidebar, guards) re-renders live.
 * `account-disabled` logs the session out on the spot.
 */
let started = false

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function startAuthEvents() {
  if (started || typeof window === 'undefined') return
  started = true
  void loop()
}

async function loop() {
  let backoff = 3_000
  for (;;) {
    const token = Cookies.get('token')
    if (!token) { await sleep(3_000); continue }
    try {
      await streamAuthEvents(handleEvent)
      backoff = 3_000 // stream closed cleanly (e.g. backend restart) — quick retry
    } catch {
      backoff = Math.min(backoff * 2, 30_000)
    }
    await sleep(backoff)
  }
}

async function handleEvent(type: string, _payload: any) {
  if (type === 'connected') {
    // Silent sync on (re)connect: picks up permission changes that happened
    // while offline and upgrades tokens minted before new permissions existed.
    await refreshAuth(false)
  } else if (type === 'permissions-changed') {
    await refreshAuth(true)
  } else if (type === 'account-disabled') {
    useAuthStore.getState().logout()
    toast.error('Votre compte a été désactivé par un administrateur', { id: 'account-disabled' })
    window.location.href = '/login'
  }
}

async function refreshAuth(announce: boolean) {
  try {
    const { data } = await authApi.refresh()
    useAuthStore.getState().setAuth(data, data.token)
    if (announce) toast('Vos rôles et permissions ont été mis à jour', { id: 'perms-updated', icon: '🔑' })
  } catch {
    // 401 (token invalidated / account disabled) is handled by the axios interceptor
  }
}
