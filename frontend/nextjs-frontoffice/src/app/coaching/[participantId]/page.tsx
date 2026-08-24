'use client'
/**
 * Coaching workspace for ONE participation (startup × programme). A tabbed,
 * mentor-first home: an at-a-glance overview, then the coaching plan + notes,
 * rendez-vous + availability, the startup's pitchs (mentor), and reviews.
 * Reached from the coaching list, the org page, or the calendar.
 */
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Building2, FolderKanban, Handshake, UserRound, Mail, LayoutDashboard,
  Target, CalendarClock, Presentation, MessageSquareQuote,
} from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { MagicCard } from '@/components/magicui/magic-card'
import { Skeleton } from '@/components/ui/skeleton'
import { participantsApi } from '@/lib/api'
import { useUser } from '@/store/auth.store'
import { CoachingOverview } from '@/components/coaching/CoachingOverview'
import { CoachingPanel } from '@/components/coaching/CoachingPanel'
import { MeetingsPanel } from '@/components/coaching/MeetingsPanel'
import { ReviewsPanel } from '@/components/coaching/ReviewsPanel'
import { AvailabilityPanel } from '@/components/coaching/AvailabilityPanel'
import { MenteePitchPanel } from '@/components/coaching/MenteePitchPanel'

type Part = {
  id: number; programmeId?: number; programmeName?: string
  organizationId?: number; organizationName?: string
  mentorName?: string; porteurName?: string; porteurEmail?: string; status?: string
  mentorUserId?: number; porteurUserId?: number
}
type Tab = 'overview' | 'plan' | 'meetings' | 'pitchs' | 'reviews'
const STATUS: Record<string, string> = { ACTIVE: 'Actif', ALUMNI: 'Alumni', WITHDRAWN: 'Retiré' }
const STATUS_TONE: Record<string, string> = {
  ACTIVE: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  ALUMNI: 'bg-brand-500/15 text-brand-700 dark:text-brand-300',
  WITHDRAWN: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
}

export default function CoachingWorkspacePage() {
  const params = useParams()
  const pid = Number(Array.isArray(params.participantId) ? params.participantId[0] : params.participantId)
  const user = useUser()
  const [p, setP] = useState<Part | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [tab, setTab] = useState<Tab>('overview')

  useEffect(() => {
    if (isNaN(pid)) return
    participantsApi.get(pid)
      .then((r) => setP(r.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [pid])

  const isMentor = !!user && !!p && user.id === p.mentorUserId
  const isPorteur = !!user && !!p && user.id === p.porteurUserId

  const tabs = useMemo(() => {
    const base: { key: Tab; label: string; Icon: typeof Target }[] = [
      { key: 'overview', label: 'Aperçu', Icon: LayoutDashboard },
      { key: 'plan', label: 'Plan & notes', Icon: Target },
      { key: 'meetings', label: 'Rendez-vous', Icon: CalendarClock },
    ]
    if (isMentor) base.push({ key: 'pitchs', label: 'Pitchs', Icon: Presentation })
    base.push({ key: 'reviews', label: 'Avis', Icon: MessageSquareQuote })
    return base
  }, [isMentor])

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-5">
        <Link href="/coaching" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Accompagnement
        </Link>

        {loading ? (
          <><Skeleton className="h-28 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></>
        ) : notFound || !p ? (
          <MagicCard className="p-10 text-center">
            <Handshake className="mx-auto h-10 w-10 text-muted-foreground opacity-30" />
            <p className="mt-3 text-sm font-semibold text-foreground">Suivi introuvable</p>
            <p className="text-xs text-muted-foreground">Vous n’avez pas accès à ce suivi de coaching.</p>
          </MagicCard>
        ) : (
          <>
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-border bg-gradient-to-br from-card to-muted/20 p-5 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500/25 to-brand-500/25 text-purple-600 dark:text-purple-300">
                  <Building2 className="h-7 w-7" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {p.organizationId ? (
                      <Link href={`/organizations/${p.organizationId}`} className="text-xl font-bold text-foreground hover:text-brand-600 dark:hover:text-brand-400">{p.organizationName || `Organisation #${p.organizationId}`}</Link>
                    ) : <span className="text-xl font-bold text-foreground">{p.organizationName}</span>}
                    {p.status && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_TONE[p.status] ?? 'bg-muted text-muted-foreground'}`}>{STATUS[p.status] ?? p.status}</span>}
                    {isMentor && <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-300"><Handshake className="h-3 w-3" />Vous êtes le mentor</span>}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {p.programmeName && <Link href={`/programmes/${p.programmeId}`} className="inline-flex items-center gap-1 hover:text-brand-600"><FolderKanban className="h-3.5 w-3.5" />{p.programmeName}</Link>}
                    <span className="inline-flex items-center gap-1"><UserRound className="h-3.5 w-3.5" />{p.porteurName || 'Porteur'}</span>
                    {p.porteurEmail && <a href={`mailto:${p.porteurEmail}`} className="inline-flex items-center gap-1 hover:text-brand-600"><Mail className="h-3.5 w-3.5" />{p.porteurEmail}</a>}
                    {!isMentor && p.mentorName && <span className="inline-flex items-center gap-1"><Handshake className="h-3.5 w-3.5" />{p.mentorName}</span>}
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="mt-4 flex flex-wrap gap-1 border-t border-border pt-3">
                {tabs.map(({ key, label, Icon }) => (
                  <button key={key} onClick={() => setTab(key)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                      tab === key ? 'bg-brand-500/10 text-brand-700 dark:text-brand-300' : 'text-muted-foreground hover:bg-accent'}`}>
                    <Icon className="h-3.5 w-3.5" />{label}
                  </button>
                ))}
              </div>
            </motion.div>

            {/* Tab content */}
            {tab === 'overview' && <CoachingOverview p={p} isMentor={isMentor} onGoTab={(t) => setTab(t)} />}
            {tab === 'plan' && <CoachingPanel participantId={pid} />}
            {tab === 'meetings' && (
              <div className="space-y-4">
                <MeetingsPanel participantId={pid} />
                <AvailabilityPanel participantId={pid} mentorUserId={p.mentorUserId} porteurUserId={p.porteurUserId} />
              </div>
            )}
            {tab === 'pitchs' && isMentor && <MenteePitchPanel participantId={pid} mentorUserId={p.mentorUserId} />}
            {tab === 'reviews' && <ReviewsPanel participantId={pid} />}
          </>
        )}
      </div>
    </AppShell>
  )
}
