'use client'
/**
 * Front-office notifications — the full feed behind the topbar bell. Aggregates
 * the user's invitations and assigned tasks (see lib/notifications). Pending RSVP
 * invitations can be accepted/declined straight from here (via the existing
 * token pages); everything else links to the relevant programme or the tasks page.
 */
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Bell, Mail, CheckSquare, ArrowRight, Check, X } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { MagicCard } from '@/components/magicui/magic-card'
import { Skeleton } from '@/components/ui/skeleton'
import { fetchNotifications, relTime, type NotificationItem } from '@/lib/notifications'

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'En attente', ACCEPTED: 'Acceptée', DECLINED: 'Déclinée',
  IN_PROGRESS: 'En cours', COMPLETED: 'Terminée', CANCELLED: 'Annulée', SUBMITTED: 'Soumise',
}
const STATUS_TONE: Record<string, string> = {
  PENDING: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  ACCEPTED: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  COMPLETED: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  DECLINED: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  CANCELLED: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  IN_PROGRESS: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  SUBMITTED: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
}

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'todo' | 'all'>('todo')

  useEffect(() => { fetchNotifications().then(setItems).finally(() => setLoading(false)) }, [])

  const unread = items.filter((n) => n.unread).length
  const shown = useMemo(() => (tab === 'todo' ? items.filter((n) => n.unread) : items), [items, tab])

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
            <Bell className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
            <p className="text-sm text-muted-foreground">
              {unread > 0 ? `${unread} notification(s) à traiter` : 'Vous êtes à jour'}
            </p>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
          {([['todo', `À traiter${unread ? ` (${unread})` : ''}`], ['all', 'Toutes']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === k ? 'bg-brand-500/10 text-brand-700 dark:text-brand-300' : 'text-muted-foreground hover:bg-accent'}`}>
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/10 p-12 text-center">
            <Bell className="mb-2 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">{tab === 'todo' ? 'Rien à traiter' : 'Aucune notification'}</p>
            <p className="mt-1 text-xs text-muted-foreground">Les invitations et les tâches qui vous sont assignées apparaîtront ici.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {shown.map((n) => {
              const Icon = n.kind === 'task' ? CheckSquare : Mail
              return (
                <MagicCard key={n.id} className="p-4">
                  <div className="flex gap-3">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      n.kind === 'task' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-brand-500/10 text-brand-600 dark:text-brand-400'}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{n.title}</p>
                        {n.status && (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_TONE[n.status] ?? 'bg-muted text-muted-foreground'}`}>
                            {STATUS_LABEL[n.status] ?? n.status}
                          </span>
                        )}
                        {n.unread && <span className="h-2 w-2 rounded-full bg-brand-500" />}
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{relTime(n.at)}</p>

                      {/* actions */}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {n.invitationToken ? (
                          <>
                            <Link href={`/invitations/${n.invitationToken}/accept`}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600">
                              <Check className="h-3.5 w-3.5" />Accepter
                            </Link>
                            <Link href={`/invitations/${n.invitationToken}/decline`}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-accent">
                              <X className="h-3.5 w-3.5" />Décliner
                            </Link>
                          </>
                        ) : n.href ? (
                          <Link href={n.href}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-500/40 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-500/10 dark:text-brand-300">
                            Ouvrir<ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </MagicCard>
              )
            })}
          </div>
        )}
      </div>
    </AppShell>
  )
}
