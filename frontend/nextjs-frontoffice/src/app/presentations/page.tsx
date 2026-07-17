'use client'
import { useMemo } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Presentation, Trophy, ArrowRight, Layers, Dumbbell, CheckCircle2, AlertCircle,
} from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { MagicCard } from '@/components/magicui/magic-card'
import { Skeleton } from '@/components/ui/skeleton'
import { usePitchData } from '@/lib/use-pitch-data'
import { computeStats, submissionsOf, scoreTone } from '@/lib/pitch-analytics'
import { StatsOverview, ScoreTrend, DimensionBars, DeliveryAverages, FocusCallout } from '@/components/pitch/Analytics'

/**
 * Level 1 — your programmes.
 *
 * Deliberately shows no videos: this page answers "where do I stand overall and
 * which programme needs work", then hands off to the programme. Videos live two
 * levels down, under the phase they belong to.
 */
export default function PresentationsPage() {
  const { programmes, sessionsByProg, loading } = usePitchData()

  const withWork = useMemo(
    () => programmes.filter((p) => (sessionsByProg[p.programmeId] ?? []).length > 0),
    [programmes, sessionsByProg],
  )
  const allSubs = useMemo(
    () => withWork.flatMap((p) => submissionsOf(sessionsByProg[p.programmeId] ?? [])),
    [withWork, sessionsByProg],
  )
  const stats = useMemo(() => computeStats(allSubs), [allSubs])

  return (
    <AppShell>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Presentation className="h-6 w-6 text-brand-500" />Mes présentations
          </h1>
          <p className="text-muted-foreground">
            Choisissez un programme pour voir ses phases d’entraînement, y déposer vos vidéos
            et ouvrir l’analyse détaillée de chacune.
          </p>
        </motion.div>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 rounded-2xl" />
            {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
        ) : withWork.length === 0 ? (
          <MagicCard className="p-10 text-center">
            <Presentation className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">Aucune session d’analyse vidéo ouverte pour le moment</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Quand un programme active l’analyse vidéo IA sur une session, vous pourrez y déposer vos vidéos ici.
            </p>
          </MagicCard>
        ) : (
          <>
            {/* Global picture across every programme */}
            {stats.total > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-foreground">Vue d’ensemble</h2>
                <StatsOverview stats={stats} scope="global" />
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
              <h2 className="text-sm font-semibold text-foreground">Programmes</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {withWork.map((p) => {
                  const sessions = sessionsByProg[p.programmeId] ?? []
                  const subs = submissionsOf(sessions)
                  const st = computeStats(subs)
                  const missingFinal = sessions.filter((s) => !(s.submissions ?? []).some((x) => x.kind === 'FINAL'))
                  return (
                    <Link key={p.programmeId} href={`/presentations/programme/${p.programmeId}`} className="group block">
                      <MagicCard className="h-full p-4 transition-colors group-hover:border-brand-400">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-foreground">{p.programmeName}</p>
                            {p.projectName && <p className="truncate text-xs text-muted-foreground">{p.projectName}</p>}
                          </div>
                          {st.bestScore != null && (
                            <span className={`flex shrink-0 items-center gap-1 rounded-full bg-brand-500/10 px-2 py-0.5 text-xs font-bold ${scoreTone(st.bestScore)}`}>
                              <Trophy className="h-3 w-3" />{st.bestScore}/10
                            </span>
                          )}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-1.5 text-[10px]">
                          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-muted-foreground">
                            <Layers className="h-2.5 w-2.5" />{sessions.length} phase{sessions.length > 1 ? 's' : ''}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-muted-foreground">
                            <Dumbbell className="h-2.5 w-2.5" />{st.training} entraînement{st.training > 1 ? 's' : ''}
                          </span>
                          {missingFinal.length === 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-700 dark:text-emerald-300">
                              <CheckCircle2 className="h-2.5 w-2.5" />pitchs finaux déposés
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-amber-700 dark:text-amber-300">
                              <AlertCircle className="h-2.5 w-2.5" />{missingFinal.length} pitch final manquant{missingFinal.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>

                        <p className="mt-3 flex items-center gap-1 text-[11px] font-medium text-brand-600 dark:text-brand-400">
                          Ouvrir les phases<ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
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
