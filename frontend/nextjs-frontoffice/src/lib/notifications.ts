/**
 * Front-office notifications feed. There is no dedicated notification store yet,
 * so the feed is composed from the two things a user actually needs to act on:
 *   • invitations addressed to them (join a programme, be a jury, a mentor…),
 *   • tasks assigned to them.
 * Both endpoints are recipient-scoped by the auth token, so no identity is passed.
 * Failures are tolerated (a user may lack one of the roles/permissions).
 */
import { notificationsApi, tasksApi } from '@/lib/api'

export type NotificationKind = 'invitation' | 'task'

export interface NotificationItem {
  id: string
  kind: NotificationKind
  title: string
  body: string
  /** ISO timestamp used for ordering + relative display. */
  at: string
  /** Actionable / not yet resolved — drives the unread badge. */
  unread: boolean
  /** Where clicking the notification navigates. */
  href?: string
  /** For a pending RSVP invitation. */
  invitationToken?: string
  status?: string
}

const INVITE_TITLE: Record<string, string> = {
  PORTEUR: 'Invitation à candidater',
  JURY: 'Invitation en tant que jury',
  MENTOR: 'Invitation en tant que mentor',
  MEMBER: 'Ajout à une organisation',
  ORGANISATEUR: 'Invitation à co-organiser',
  GUEST: 'Invitation',
  GENERAL: 'Annonce',
}

const iso = (v: any): string => {
  if (!v) return new Date(0).toISOString()
  try { return new Date(v).toISOString() } catch { return new Date(0).toISOString() }
}

function fromInvitation(i: any): NotificationItem {
  const scope = i.activityName || i.phaseName || i.programmeName || ''
  const base = INVITE_TITLE[i.type] ?? 'Invitation'
  const title = scope ? `${base} — « ${scope} »` : base
  const pending = (i.status ?? 'PENDING') === 'PENDING'
  return {
    id: `inv-${i.id}`,
    kind: 'invitation',
    title,
    body: i.subject || (i.message ? String(i.message).replace(/\s+/g, ' ').slice(0, 120) : `De ${i.sentByAdminName || 'l’équipe'}`),
    at: iso(i.createdAt || i.sentAt),
    unread: pending,
    href: i.programmeId ? `/programmes/${i.programmeId}` : undefined,
    invitationToken: pending && i.requiresRsvp ? i.token : undefined,
    status: i.status,
  }
}

const TASK_DONE = new Set(['COMPLETED', 'CANCELLED'])

function fromTask(t: any): NotificationItem {
  const where = t.phaseName || t.programmeName
  return {
    id: `task-${t.id}`,
    kind: 'task',
    title: `Tâche assignée : ${t.title ?? 'Sans titre'}`,
    body: [where && `« ${where} »`, t.dueDate && `échéance ${String(t.dueDate).slice(0, 10)}`].filter(Boolean).join(' · ')
      || (t.description ? String(t.description).slice(0, 120) : 'Nouvelle tâche'),
    at: iso(t.updatedAt || t.createdAt),
    unread: !TASK_DONE.has(t.status ?? 'PENDING'),
    href: '/tasks',
    status: t.status,
  }
}

/** The merged, newest-first notifications feed for the current user. */
export async function fetchNotifications(): Promise<NotificationItem[]> {
  const [inv, tasks] = await Promise.allSettled([
    notificationsApi.myInvitations(),
    tasksApi.myTasks(),
  ])
  const items: NotificationItem[] = []
  if (inv.status === 'fulfilled') for (const i of (inv.value.data ?? [])) items.push(fromInvitation(i))
  if (tasks.status === 'fulfilled') for (const t of (tasks.value.data ?? [])) items.push(fromTask(t))
  items.sort((a, b) => b.at.localeCompare(a.at))
  return items
}

/** Human relative time, e.g. "il y a 3 h". */
export function relTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then) || then === 0) return ''
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (s < 60) return "à l'instant"
  const m = Math.floor(s / 60); if (m < 60) return `il y a ${m} min`
  const h = Math.floor(m / 60); if (h < 24) return `il y a ${h} h`
  const d = Math.floor(h / 24); if (d < 7) return `il y a ${d} j`
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
