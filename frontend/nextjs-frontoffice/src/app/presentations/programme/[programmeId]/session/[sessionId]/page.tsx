'use client'
import { useMemo } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { ChevronLeft, Dumbbell, Trophy, Presentation, Info } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { MagicCard } from '@/components/magicui/magic-card'
import { Skeleton } from '@/components/ui/skeleton'
import { usePitchData } from '@/lib/use-pitch-data'
import { computeStats, chronological } from '@/lib/pitch-analytics'
import { StatsOverview, ScoreTrend, DimensionBars, DeliveryAverages, FocusCallout } from '@/components/pitch/Analytics'
import { PitchVideoCard } from '@/components/pitch/PitchVideoCard'
import { PitchUpload } from '@/components/pitch/PitchUpload'
import { formatDate } from '@/lib/utils'

/**
 * Level 3 — one phase: its training videos, its final pitch, its analytics.
 *
 * Videos are summary cards that link to the workspace. The analysis itself is
 * never inlined here — that is what buried the important panels before.
 */
export default function SessionPhasePage() {
  const params = useParams()
  const programmeId = Number(params?.programmeId)
  const sessionId = Number(params?.sessionId)
  const { programmes, sessionsByProg, loading, reload } = usePitchData(programmeId)

  const prog = programmes.find((p) => p.programmeId === programmeId)
  const session = (sessionsByProg[programmeId] ?? []).find((s) => s.sessionId === sessionId)
  const subs = useMemo(() => session?.submissions ?? [], [session])

  const trainings = useMemo(() => chronological(subs.filter((s) => s.kind === 'TRAINING')), [subs])
  const final = useMemo(() => subs.find((s) => s.kind === 'FINAL'), [subs])
  const stats = useMemo(() => computeStats(subs), [subs])

  const deadlinePassed = session?.pitchDeadline
    && new Date(session.pitchDeadline) < new Date(new Date().toDateString())

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            <Link href="/presentations" className="hover:text-foreground">Mes présentations</Link>
            <ChevronLeft className="h-3 w-3 rotate-180" />
            <Link href={`/presentations/programme/${programmeId}`} className="hover:text-foreground">
              {prog?.programmeName ?? `Programme #${programmeId}`}
            </Link>
          </div>
          <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Presentation className="h-6 w-6 text-brand-500" />
            {loading && !session ? 'Chargement…' : session?.title ?? `Phase #${sessionId}`}
          </motion.h1>
          {session && (
            <p className="text-muted-foreground">
              {session.startDate && formatDate(session.startDate)}
              {session.pitchDeadline && (
                <span className={deadlinePassed ? 'text-red-500' : ''}>
                  {session.startDate ? ' · ' : ''}dépôt du pitch final avant le {formatDate(session.pitchDeadline)}
                </span>
              )}
            </p>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
        ) : !session ? (
          <MagicCard className="p-10 text-center">
            <Presentation className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">Phase introuvable</p>
            <p className="mt-1 text-xs text-muted-foreground">Elle a peut-être été fermée ou retirée du programme.</p>
          </MagicCard>
        ) : (
          <>
            {stats.total > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-foreground">Analyse de la phase</h2>
                <StatsOverview stats={stats} scope="session" />
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

            {/* Training — repeat as often as you like */}
            <section className="space-y-2">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Dumbbell className="h-4 w-4 text-sky-500" />Entraînement
                <span className="text-xs font-normal text-muted-foreground">
                  — répétez autant que vous voulez, seul le pitch final compte
                </span>
              </h2>
              {trainings.length > 0 ? (
                <div className="grid gap-2 lg:grid-cols-2">
                  {trainings.map((t, i) => <PitchVideoCard key={t.id} sub={t} index={i + 1} />)}
                </div>
              ) : (
                <p className="flex items-center gap-1.5 rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                  <Info className="h-3.5 w-3.5" />Aucune vidéo d’entraînement pour l’instant — la première vous
                  donnera une base de comparaison.
                </p>
              )}
              {session.open !== false && (
                <PitchUpload
                  ctx={{ programmeId, organizationId: prog?.organizationId, companyName: prog?.companyName, projectName: prog?.projectName }}
                  sessionId={sessionId} kind="TRAINING"
                  label={trainings.length ? 'Nouvelle vidéo d’entraînement' : 'Déposer une première vidéo d’entraînement'}
                  onSaved={reload}
                />
              )}
            </section>

            {/* The real one */}
            <section className="space-y-2">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Trophy className="h-4 w-4 text-purple-500" />Pitch final
                <span className="text-xs font-normal text-muted-foreground">— votre présentation officielle</span>
              </h2>
              {final ? (
                <PitchVideoCard sub={final} />
              ) : session.open !== false ? (
                <PitchUpload
                  ctx={{ programmeId, organizationId: prog?.organizationId, companyName: prog?.companyName, projectName: prog?.projectName }}
                  sessionId={sessionId} kind="FINAL"
                  label="Déposer votre pitch final"
                  onSaved={reload}
                />
              ) : (
                <p className="rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                  Phase clôturée — aucun pitch final n’a été déposé.
                </p>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  )
}
