'use client'
/**
 * Per-user notification UI state. The feed itself is synthesized client-side
 * (invitations + tasks) with no backend store, so "seen / deleted / archived"
 * live in localStorage, namespaced by user id. Any mutation dispatches a
 * `fo-notif-changed` event so the bell badge and the page stay in sync.
 */
import { useAuthStore } from '@/store/auth.store'
import type { NotificationItem } from '@/lib/notifications'

export interface NotifState { seen: string[]; deleted: string[]; archived: string[] }
export interface DecoratedNotif extends NotificationItem { seen: boolean; archived: boolean }

const EMPTY: NotifState = { seen: [], deleted: [], archived: [] }
export const NOTIF_EVENT = 'fo-notif-changed'

function key(): string {
  const uid = typeof window !== 'undefined' ? useAuthStore.getState().user?.id : undefined
  return `fo-notif-state:${uid ?? 'anon'}`
}

export function getState(): NotifState {
  if (typeof window === 'undefined') return { ...EMPTY }
  try {
    const raw = localStorage.getItem(key())
    if (!raw) return { ...EMPTY }
    const p = JSON.parse(raw)
    return { seen: p.seen ?? [], deleted: p.deleted ?? [], archived: p.archived ?? [] }
  } catch { return { ...EMPTY } }
}

function save(s: NotifState) {
  try { localStorage.setItem(key(), JSON.stringify(s)) } catch { /* quota / SSR */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(NOTIF_EVENT))
}

const add = (arr: string[], id: string) => (arr.includes(id) ? arr : [...arr, id])
const drop = (arr: string[], id: string) => arr.filter((x) => x !== id)

export function markSeen(id: string) { const s = getState(); s.seen = add(s.seen, id); save(s) }
export function markUnseen(id: string) { const s = getState(); s.seen = drop(s.seen, id); save(s) }
export function markAllSeen(ids: string[]) { const s = getState(); ids.forEach((id) => { s.seen = add(s.seen, id) }); save(s) }
export function removeNotif(id: string) { const s = getState(); s.deleted = add(s.deleted, id); save(s) }
export function archiveNotif(id: string) { const s = getState(); s.archived = add(s.archived, id); s.seen = add(s.seen, id); save(s) }
export function unarchiveNotif(id: string) { const s = getState(); s.archived = drop(s.archived, id); save(s) }

/** Apply the stored state to a feed: drop deleted, flag seen/archived. */
export function decorate(items: NotificationItem[], s: NotifState): DecoratedNotif[] {
  const seen = new Set(s.seen), deleted = new Set(s.deleted), archived = new Set(s.archived)
  return items
    .filter((n) => !deleted.has(n.id))
    // A resolved item (not `unread`) counts as already seen.
    .map((n) => ({ ...n, seen: seen.has(n.id) || !n.unread, archived: archived.has(n.id) }))
}

/** Critical-unseen first, then unseen, then newest — for any list. */
export function notifSort(a: DecoratedNotif, b: DecoratedNotif): number {
  const rank = (n: DecoratedNotif) => (n.critical && !n.seen ? 0 : !n.seen ? 1 : 2)
  return rank(a) - rank(b) || b.at.localeCompare(a.at)
}

/** Count that drives the bell badge: unseen and not archived. */
export function unseenCount(items: DecoratedNotif[]): number {
  return items.filter((n) => !n.seen && !n.archived).length
}
