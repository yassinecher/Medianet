'use client'
import { useMemo } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ChevronLeft, Layers, Trophy, ArrowRight, Dumbbell, CalendarClock, CheckCircle2, AlertCircle,
} from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { MagicCard } from '@/components/magicui/magic-card'
import { Skeleton } from '@/components/ui/skeleton'
import { usePitchData } from '@/lib/use-pitch-data'
import { computeStats, submissionsOf, scoreTone } from '@/lib/pitch-analytics'
import { StatsOverview, ScoreTrend, DimensionBars, DeliveryAverages, FocusCallout } from '@/components/pitch/Analytics'
import { formatDate } from '@/lib/utils'

/**
 * Level 2 — the phases of one programme.
 *
 * Same analytics as the global page, scoped to this programme, then one card per
 * phase. Still no videos: a phase card summarises, the phase page holds them.
 */
export default function ProgrammePhasesPage() {
  const params = useParams()
  const programmeId = Number(params?.programmeId)
  const { programmes, sessionsByProg, loading } = usePitchData(programmeId)

  const prog = programmes.find((p) => p.programmeId === programmeId)
  const sessions = sessionsByProg[programmeId] ?? []
  const stats = useMemo(() => computeStats(submissionsOf(sessions)), [sessions])

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <Link href="/presentations" className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-3 w-3" />Toutes mes présentations
          </Link>
          <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Layers className="h-6 w-6 text-brand-500" />
            {loading && !prog ? 'Chargement…' : prog?.programmeName ?? `Programme #${programmeId}`}
          </motion.h1>
          <p className="text-muted-foreground">
            Chaque phase regroupe vos vidéos d’entraînement et votre pitch final.
          </p>
        </div>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 rounded-2xl" />
            {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
          </div>
        ) : sessions.length === 0 ? (
          <MagicCard className="p-10 text-center">
            <Layers className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">Aucune phase d’analyse vidéo dans ce programme</p>
          </MagicCard>
        ) : (
          <>
            {stats.total > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-foreground">Vue d’ensemble du programme</h2>
                <StatsOverview stats={stats} scope="programme" />
                {stats.analyzed > 0 && (
                  <>
                    <FocusCallout stats={stats} />
                    <div className="grid gap-3 lg:grid-cols-2">
                      <ScoreTrend trend={stats.trend} />
                      <DimensionBars stats={stats} />
                    </div>
                    <DeliveryAverages stats={stats} />
                  </>
                )}
              </section>
            )}

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Phases</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {sessions.map((s) => {
                  const subs = s.submissions ?? []
                  const st = computeStats(subs)
                  const hasFinal = subs.some((x) => x.kind === 'FINAL')
                  const deadlinePassed = s.pitchDeadline
                    && new Date(s.pitchDeadline) < new Date(new Date().toDateString())
                  return (
                    <Link key={s.sessionId} href={`/presentations/programme/${programmeId}/session/${s.sessionId}`} className="group block">
                      <MagicCard className="h-full p-4 transition-colors group-hover:border-brand-400">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-foreground">{s.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {s.startDate && formatDate(s.startDate)}
                              {s.pitchDeadline && (
                                <span className={deadlinePassed ? 'text-red-500' : ''}>
                                  {s.startDate ? ' · ' : ''}dépôt avant le {formatDate(s.pitchDeadline)}
                                </span>
                              )}
                            </p>
                          </div>
                          {st.bestScore != null && (
                            <span className={`flex shrink-0 items-center gap-1 rounded-full bg-brand-500/10 px-2 py-0.5 text-xs font-bold ${scoreTone(st.bestScore)}`}>
                              <Trophy className="h-3 w-3" />{st.bestScore}/10
                            </span>
                          )}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-1.5 text-[10px]">
                          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-muted-foreground">
                            <Dumbbell className="h-2.5 w-2.5" />{st.training} entraînement{st.training > 1 ? 's' : ''}
                          </span>
                          {hasFinal ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-700 dark:text-emerald-300">
                              <CheckCircle2 className="h-2.5 w-2.5" />pitch final déposé
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-amber-700 dark:text-amber-300">
                              <AlertCircle className="h-2.5 w-2.5" />pitch final manquant
                            </span>
                          )}
                          {st.improvement != null && st.improvement !== 0 && (
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-bold ${
                              st.improvement > 0
                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                : 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300'}`}>
                              {st.improvement > 0 ? '+' : ''}{st.improvement} depuis le 1er essai
                            </span>
                          )}
                          {!s.open && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-muted-foreground">
                              <CalendarClock className="h-2.5 w-2.5" />clôturée
                            </span>
                          )}
                        </div>

                        <p className="mt-3 flex items-center gap-1 text-[11px] font-medium text-brand-600 dark:text-brand-400">
                          Ouvrir la phase<ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                        </p>
                      </MagicCard>
                    </Link>
                  )
                })}
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  )
}
