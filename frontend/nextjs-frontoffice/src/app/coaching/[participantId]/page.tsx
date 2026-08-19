'use client'
/**
 * Coaching workspace for ONE participation (startup × programme). The detailed,
 * dedicated home for the coaching plan, meetings and session notes — reached
 * from the coaching list, the org page, or the calendar.
 */
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, Building2, FolderKanban, Handshake, UserRound } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { MagicCard } from '@/components/magicui/magic-card'
import { Skeleton } from '@/components/ui/skeleton'
import { participantsApi } from '@/lib/api'
import { CoachingPanel } from '@/components/coaching/CoachingPanel'
import { MeetingsPanel } from '@/components/coaching/MeetingsPanel'
import { ReviewsPanel } from '@/components/coaching/ReviewsPanel'
import { AvailabilityPanel } from '@/components/coaching/AvailabilityPanel'
import { MenteePitchPanel } from '@/components/coaching/MenteePitchPanel'

type Part = {
  id: number; programmeId?: number; programmeName?: string
  organizationId?: number; organizationName?: string
  mentorName?: string; porteurName?: string; status?: string
  mentorUserId?: number; porteurUserId?: number
}
const STATUS: Record<string, string> = { ACTIVE: 'Actif', ALUMNI: 'Alumni', WITHDRAWN: 'Retiré' }

export default function CoachingWorkspacePage() {
  const params = useParams()
  const pid = Number(Array.isArray(params.participantId) ? params.participantId[0] : params.participantId)
  const [p, setP] = useState<Part | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (isNaN(pid)) return
    participantsApi.get(pid)
      .then((r) => setP(r.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [pid])

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-5">
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
              className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500/20 to-brand-500/20">
                  <Building2 className="h-6 w-6 text-purple-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {p.organizationId ? (
                      <Link href={`/organizations/${p.organizationId}`} className="text-lg font-bold text-foreground hover:text-brand-600 dark:hover:text-brand-400">{p.organizationName || `Organisation #${p.organizationId}`}</Link>
                    ) : <span className="text-lg font-bold text-foreground">{p.organizationName}</span>}
                    {p.status && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{STATUS[p.status] ?? p.status}</span>}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {p.programmeName && <Link href={`/programmes/${p.programmeId}`} className="inline-flex items-center gap-1 hover:text-brand-600"><FolderKanban className="h-3.5 w-3.5" />{p.programmeName}</Link>}
                    {p.porteurName && <span className="inline-flex items-center gap-1"><UserRound className="h-3.5 w-3.5" />{p.porteurName}</span>}
                    <span className="inline-flex items-center gap-1"><Handshake className="h-3.5 w-3.5" />{p.mentorName || 'Aucun référent'}</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* The coaching plan + notes, then meetings, availability, pitchs, reviews */}
            <CoachingPanel participantId={pid} />
            <MeetingsPanel participantId={pid} />
            <AvailabilityPanel participantId={pid} mentorUserId={p.mentorUserId} porteurUserId={p.porteurUserId} />
            <MenteePitchPanel participantId={pid} mentorUserId={p.mentorUserId} />
            <ReviewsPanel participantId={pid} />
          </>
        )}
      </div>
    </AppShell>
  )
}
