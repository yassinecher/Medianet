'use client'
import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  FileText, CheckSquare, FolderKanban, Clock, ArrowRight, Calendar,
  Briefcase, Sparkles, GraduationCap, TrendingUp, Award, Users,
  AlertCircle, Plus, Search, Star, MapPin,
} from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { MagicCard } from '@/components/magicui/magic-card'
import { NumberTicker } from '@/components/magicui/number-ticker'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { candidaturesApi, tasksApi, programmesApi, juryApi } from '@/lib/api'
import { useUser, useActiveRole, useIsJury } from '@/store/auth.store'
import { formatRelativeDate, statusColor, scoreColor, formatDate } from '@/lib/utils'
import type { Candidature, Task, Programme } from '@/types'

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Soumise',
  UNDER_EVALUATION: 'En évaluation',
  ACCEPTED: 'Acceptée',
  REJECTED: 'Refusée',
}

const TASK_STATUS_LABEL: Record<string, string> = {
  PENDING:     'À faire',
  IN_PROGRESS: 'En cours',
  COMPLETED:   'Terminée',
  CANCELLED:   'Annulée',
}

const ROLE_HERO: Record<string, { icon: any; gradient: string; tagline: string }> = {
  PORTEUR: {
    icon: Briefcase,
    gradient: 'from-brand-500 via-brand-600 to-purple-600',
    tagline: 'Découvrez les programmes ouverts et suivez vos candidatures.',
  },
  MENTOR: {
    icon: Sparkles,
    gradient: 'from-emerald-500 via-teal-600 to-cyan-600',
    tagline: 'Accompagnez les porteurs et suivez l\'avancement de leurs projets.',
  },
  JURY: {
    icon: GraduationCap,
    gradient: 'from-amber-500 via-orange-600 to-red-600',
    tagline: 'Évaluez les candidatures qui vous sont assignées.',
  },
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const user = useUser()
  const activeRole = useActiveRole() ?? 'PORTEUR'
  const isJury = useIsJury()
  const [candidatures, setCandidatures] = useState<Candidature[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [programmes, setProgrammes] = useState<Programme[]>([])
  const [myProgrammes, setMyProgrammes] = useState<Programme[]>([])
  const [juryItems, setJuryItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.allSettled([
      candidaturesApi.myList().then((r) => setCandidatures(r.data?.content ?? r.data ?? [])).catch(() => {}),
      tasksApi.myTasks().then((r) => setTasks(r.data?.content ?? r.data ?? [])).catch(() => {}),
      // publicOnly: don't surface draft/archived programmes in recommendations.
      programmesApi.list({ status: 'OPEN', publicOnly: true }).then((r) => setProgrammes(r.data?.content ?? r.data ?? [])).catch(() => {}),
      isJury ? juryApi.myAssignments().then((r) => setJuryItems(r.data ?? [])).catch(() => {}) : Promise.resolve(),
    ]).finally(() => setLoading(false))
  }, [isJury])

  // "Mes programmes en cours" — the incubation space: programmes the porteur was
  // ACCEPTED into. Fetch each so we can show a rich card.
  useEffect(() => {
    const ids = Array.from(new Set(
      candidatures.filter((c) => c.status === 'ACCEPTED').map((c) => c.programmeId).filter(Boolean),
    )) as number[]
    if (ids.length === 0) { setMyProgrammes([]); return }
    Promise.all(ids.map((pid) => programmesApi.get(pid).then((r) => r.data).catch(() => null)))
      .then((list) => setMyProgrammes(list.filter(Boolean) as Programme[]))
  }, [candidatures])

  // ── Jury-derived values ─────────────────────────────────────────────────
  const myEvalOf = (c: any) => (c.evaluations ?? []).find((e: any) => e.juryId === user?.id) ?? null
  const juryEvaluated = juryItems.filter((c) => myEvalOf(c))
  const juryPending = juryItems.length - juryEvaluated.length
  const juryAvg = juryEvaluated.length
    ? juryEvaluated.reduce((sum, c) => sum + Number(myEvalOf(c)?.weightedScore ?? 0), 0) / juryEvaluated.length
    : 0

  // ── Derived values ─────────────────────────────────────────────────────
  const pendingTasks = tasks.filter((t) => t.status === 'PENDING' || t.status === 'IN_PROGRESS')
  const completedTasks = tasks.filter((t) => t.status === 'COMPLETED').length
  const acceptedCount = candidatures.filter((c) => c.status === 'ACCEPTED').length
  const evaluatingCount = candidatures.filter((c) => c.status === 'UNDER_EVALUATION').length

  // Programmes the user hasn't applied to yet (recommendations)
  const appliedProgIds = new Set(candidatures.map((c) => c.programmeId).filter(Boolean))
  const recommendedProgrammes = programmes.filter((p) => !appliedProgIds.has(p.id)).slice(0, 3)

  // Upcoming task: closest due date
  const nextDeadline = useMemo(() => {
    const withDue = pendingTasks
      .filter((t) => t.dueDate)
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
    return withDue[0]
  }, [pendingTasks])

  // Progress: % of tasks completed
  const taskProgress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0

  const hero = ROLE_HERO[activeRole] ?? ROLE_HERO.PORTEUR
  const HeroIcon = hero.icon

  // ── Stats config (role-aware) ──────────────────────────────────────────
  const stats = activeRole === 'PORTEUR' ? [
    { label: 'Mes candidatures', value: candidatures.length, sub: `${acceptedCount} acceptée(s)`,
      icon: FileText, color: 'text-brand-600 dark:text-brand-400', bg: 'bg-brand-500/10' },
    { label: 'En évaluation', value: evaluatingCount, sub: 'examinées par le jury',
      icon: Clock, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Tâches actives', value: pendingTasks.length, sub: `sur ${tasks.length} total`,
      icon: CheckSquare, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Programmes ouverts', value: programmes.length, sub: 'à découvrir',
      icon: FolderKanban, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-500/10' },
  ] : activeRole === 'MENTOR' ? [
    { label: 'Porteurs assignés', value: 0, sub: 'en cours d\'accompagnement',
      icon: Users, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Sessions à venir', value: pendingTasks.length, sub: 'cette semaine',
      icon: Calendar, color: 'text-brand-600 dark:text-brand-400', bg: 'bg-brand-500/10' },
    { label: 'Tâches actives', value: pendingTasks.length, sub: `sur ${tasks.length} total`,
      icon: CheckSquare, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Programmes actifs', value: programmes.length, sub: 'que je peux suivre',
      icon: FolderKanban, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-500/10' },
  ] : [ // JURY
    { label: 'À évaluer', value: juryPending, sub: 'candidatures en attente',
      icon: AlertCircle, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Évalués', value: juryEvaluated.length, sub: `sur ${juryItems.length} assignée(s)`,
      icon: Award, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Score moyen donné', value: Math.round(juryAvg * 10) / 10, sub: 'sur 10',
      icon: Star, color: 'text-brand-600 dark:text-brand-400', bg: 'bg-brand-500/10' },
    { label: 'Programmes', value: programmes.length, sub: 'auxquels je participe',
      icon: FolderKanban, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-500/10' },
  ]

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">

        {/* ── Hero greeting ─────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${hero.gradient} p-6 sm:p-8 text-white shadow-xl`}>
            <div className="absolute inset-0 opacity-20"
              style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
            <div className="relative flex items-start gap-4">
              <div className="hidden sm:flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                <HeroIcon className="h-7 w-7" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="rounded-full bg-white/20 backdrop-blur-sm px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide">
                    Profil {activeRole.toLowerCase()}
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black">
                  Bonjour, {user?.firstName} 👋
                </h1>
                <p className="mt-1 text-sm sm:text-base text-white/90">{hero.tagline}</p>

                {/* Quick actions */}
                <div className="mt-5 flex flex-wrap gap-2">
                  {activeRole === 'PORTEUR' && (
                    <Link href="/programmes">
                      <Button className="bg-white text-brand-700 hover:bg-white/90 gap-1.5 font-bold">
                        <Search className="h-3.5 w-3.5" />Explorer les programmes
                      </Button>
                    </Link>
                  )}
                  {activeRole === 'PORTEUR' && candidatures.length > 0 && (
                    <Link href="/candidatures">
                      <Button variant="outline" className="bg-white/10 border-white/30 text-white hover:bg-white/20 gap-1.5">
                        <FileText className="h-3.5 w-3.5" />Mes candidatures
                      </Button>
                    </Link>
                  )}
                  {isJury && (
                    <Link href="/evaluations">
                      <Button className="bg-white text-amber-700 hover:bg-white/90 gap-1.5 font-bold">
                        <GraduationCap className="h-3.5 w-3.5" />Mes évaluations
                        {juryPending > 0 && (
                          <span className="ml-0.5 rounded-full bg-amber-600 px-1.5 text-[10px] font-bold text-white">{juryPending}</span>
                        )}
                      </Button>
                    </Link>
                  )}
                  <Link href="/tasks">
                    <Button variant="outline" className="bg-white/10 border-white/30 text-white hover:bg-white/20 gap-1.5">
                      <CheckSquare className="h-3.5 w-3.5" />Mes tâches
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Stats grid ────────────────────────────────────────────── */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {loading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />) :
            stats.map((s, i) => {
              const Icon = s.icon
              return (
                <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                  <MagicCard className="p-5 h-full">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground line-clamp-1">{s.label}</p>
                        <p className={`mt-1 text-3xl font-black tabular-nums ${s.color}`}>
                          <NumberTicker value={s.value} />
                        </p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground line-clamp-1">{s.sub}</p>
                      </div>
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${s.bg}`}>
                        <Icon className={`h-5 w-5 ${s.color}`} />
                      </div>
                    </div>
                  </MagicCard>
                </motion.div>
              )
            })
          }
        </div>

        {/* ── Next deadline banner (if any) ─────────────────────────── */}
        {nextDeadline && (
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
            <MagicCard className="p-4 border-l-4 border-amber-500">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold uppercase tracking-wide text-amber-600">Prochaine échéance</p>
                  <p className="text-sm font-semibold text-foreground mt-0.5">{nextDeadline.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(nextDeadline.dueDate)} · {formatRelativeDate(nextDeadline.dueDate!)}
                  </p>
                </div>
                <Link href="/tasks">
                  <Button variant="outline" size="sm" className="gap-1">
                    Voir<ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </MagicCard>
          </motion.div>
        )}

        {/* ── Two-column main content ──────────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-3">

          {/* LEFT (2/3): Recent candidatures + tasks */}
          <div className="lg:col-span-2 space-y-6">

            {/* Mes programmes en cours — incubation space (accepted candidatures) */}
            {activeRole === 'PORTEUR' && myProgrammes.length > 0 && (
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-bold text-foreground flex items-center gap-2">
                    <Award className="h-4 w-4 text-emerald-500" />Mes programmes en cours
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      {myProgrammes.length}
                    </span>
                  </h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {myProgrammes.map((p) => (
                    <Link key={p.id} href={`/programmes/${p.id}`}>
                      <MagicCard className="relative h-full overflow-hidden p-4 transition-transform hover:scale-[1.02]">
                        <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          <CheckSquare className="h-2.5 w-2.5" />Incubé
                        </span>
                        <div className="flex items-start gap-3">
                          {p.logoUrl ? (
                            <img src={p.logoUrl} alt="" className="h-11 w-11 rounded-lg object-contain bg-white" />
                          ) : (
                            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500/20 to-brand-500/20">
                              <FolderKanban className="h-5 w-5 text-emerald-500" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1 pr-14">
                            <p className="line-clamp-1 font-semibold text-sm text-foreground">{p.title ?? p.name}</p>
                            {p.tagline && <p className="line-clamp-1 text-xs text-muted-foreground">{p.tagline}</p>}
                            <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                              {p.location && <span className="flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" />{p.location}</span>}
                              <span className={`rounded-full px-1.5 py-0.5 font-bold ${statusColor(p.status)}`}>{p.status === 'IN_PROGRESS' ? 'En cours' : p.status}</span>
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center gap-1 border-t border-border pt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          Accéder à mon espace <ArrowRight className="h-3 w-3" />
                        </div>
                      </MagicCard>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Recent candidatures (PORTEUR only) */}
            {activeRole === 'PORTEUR' && (
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-bold text-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4 text-brand-500" />Mes candidatures récentes
                  </h2>
                  {candidatures.length > 0 && (
                    <Link href="/candidatures" className="text-xs text-brand-600 hover:underline flex items-center gap-0.5">
                      Tout voir<ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
                {loading ? (
                  <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
                ) : candidatures.length === 0 ? (
                  <MagicCard className="p-8 text-center">
                    <FolderKanban className="mx-auto h-10 w-10 text-muted-foreground opacity-30 mb-2" />
                    <p className="text-sm text-muted-foreground mb-3">Aucune candidature soumise pour l'instant.</p>
                    <Link href="/programmes">
                      <Button variant="brand" className="gap-1.5">
                        <Search className="h-3.5 w-3.5" />Découvrir les programmes
                      </Button>
                    </Link>
                  </MagicCard>
                ) : (
                  <div className="space-y-2">
                    {candidatures.slice(0, 4).map((c) => (
                      <motion.div key={c.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
                        <MagicCard className="p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-sm text-foreground truncate">{c.projectName}</p>
                              <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                {c.programmeName && <span>📦 {c.programmeName}</span>}
                                {c.submittedAt && <span>· {formatRelativeDate(c.submittedAt)}</span>}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusColor(c.status)}`}>
                                {STATUS_LABEL[c.status] ?? c.status}
                              </span>
                              {c.evaluation?.weightedScore !== undefined && (
                                <span className={`text-xs font-bold tabular-nums ${scoreColor(c.evaluation.weightedScore)}`}>
                                  {c.evaluation.weightedScore.toFixed(1)}/10
                                </span>
                              )}
                            </div>
                          </div>
                        </MagicCard>
                      </motion.div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Recommended programmes (PORTEUR only) */}
            {activeRole === 'PORTEUR' && recommendedProgrammes.length > 0 && (
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-bold text-foreground flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-brand-500" />Programmes recommandés
                  </h2>
                  <Link href="/programmes" className="text-xs text-brand-600 hover:underline flex items-center gap-0.5">
                    Tout voir<ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {recommendedProgrammes.map((p) => (
                    <Link key={p.id} href={`/programmes/${p.id}`}>
                      <MagicCard className="p-4 h-full hover:scale-[1.02] transition-transform">
                        <div className="flex items-start gap-3">
                          {p.logoUrl ? (
                            <img src={p.logoUrl} alt="" className="h-10 w-10 rounded-lg object-contain bg-white" />
                          ) : (
                            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-brand-500/20 to-purple-500/20 flex items-center justify-center">
                              <FolderKanban className="h-5 w-5 text-brand-500" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-foreground line-clamp-1">{p.title ?? p.name}</p>
                            {p.tagline && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{p.tagline}</p>}
                            <div className="mt-2 flex gap-2 text-[10px] text-muted-foreground">
                              {p.location && <span className="flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" />{p.location}</span>}
                              {p.applicationDeadline && <span>⏰ {formatDate(p.applicationDeadline)}</span>}
                            </div>
                          </div>
                        </div>
                      </MagicCard>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Task progress ring & list */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-bold text-foreground flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-brand-500" />Tâches en cours
                </h2>
                {tasks.length > 0 && (
                  <Link href="/tasks" className="text-xs text-brand-600 hover:underline flex items-center gap-0.5">
                    Tout voir<ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
              {tasks.length > 0 && (
                <MagicCard className="p-4 mb-3">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-muted-foreground">Progression globale</span>
                        <span className="font-bold text-foreground">{completedTasks} / {tasks.length} terminées</span>
                      </div>
                      <Progress value={taskProgress} className="h-2" />
                    </div>
                    <div className="text-2xl font-black text-brand-600 dark:text-brand-400 tabular-nums">
                      {taskProgress}<span className="text-sm">%</span>
                    </div>
                  </div>
                </MagicCard>
              )}
              {loading ? (
                <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
              ) : pendingTasks.length === 0 ? (
                <MagicCard className="p-6 text-center">
                  <Award className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
                  <p className="text-sm text-muted-foreground">Aucune tâche en cours. Bien joué ! 🎉</p>
                </MagicCard>
              ) : (
                <div className="space-y-2">
                  {pendingTasks.slice(0, 4).map((t) => (
                    <MagicCard key={t.id} className="p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-sm text-foreground">{t.title}</p>
                          <div className="flex gap-3 text-xs text-muted-foreground">
                            {t.programmeName && <span>📦 {t.programmeName}</span>}
                            {t.dueDate && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />{formatRelativeDate(t.dueDate)}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${statusColor(t.status)}`}>
                          {TASK_STATUS_LABEL[t.status] ?? t.status}
                        </span>
                      </div>
                    </MagicCard>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* RIGHT (1/3): Sidebar — quick info + activity */}
          <div className="space-y-4">

            {/* Quick links */}
            <MagicCard className="p-5">
              <h3 className="font-bold text-sm text-foreground mb-3">Accès rapides</h3>
              <div className="space-y-2">
                {[
                  { label: 'Programmes ouverts', href: '/programmes', icon: FolderKanban, badge: programmes.length },
                  ...(activeRole === 'PORTEUR' ? [{ label: 'Mes candidatures', href: '/candidatures', icon: FileText, badge: candidatures.length }] : []),
                  ...(isJury ? [{ label: 'Mes évaluations', href: '/evaluations', icon: GraduationCap, badge: juryPending }] : []),
                  { label: 'Mes tâches', href: '/tasks', icon: CheckSquare, badge: pendingTasks.length },
                ].map((q) => {
                  const Icon = q.icon
                  return (
                    <Link key={q.href} href={q.href}
                      className="flex items-center gap-2 rounded-lg p-2 text-sm hover:bg-accent transition-colors">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 truncate text-foreground">{q.label}</span>
                      {q.badge !== undefined && q.badge > 0 && (
                        <span className="rounded-full bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-bold text-brand-600 dark:text-brand-400">
                          {q.badge}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </MagicCard>

            {/* Acceptance trend (PORTEUR) */}
            {activeRole === 'PORTEUR' && candidatures.length > 0 && (
              <MagicCard className="p-5">
                <h3 className="font-bold text-sm text-foreground mb-3 flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />Mon taux d'acceptation
                </h3>
                <div className="text-center">
                  <p className="text-4xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                    <NumberTicker value={Math.round((acceptedCount / candidatures.length) * 100)} />%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {acceptedCount} acceptée(s) sur {candidatures.length}
                  </p>
                </div>
                <Progress value={(acceptedCount / candidatures.length) * 100} className="h-1.5 mt-3" />
              </MagicCard>
            )}

            {/* Status breakdown */}
            {activeRole === 'PORTEUR' && candidatures.length > 0 && (
              <MagicCard className="p-5">
                <h3 className="font-bold text-sm text-foreground mb-3">Répartition</h3>
                <div className="space-y-2">
                  {Object.entries(STATUS_LABEL).map(([key, label]) => {
                    const count = candidatures.filter((c) => c.status === key).length
                    if (count === 0) return null
                    const pct = (count / candidatures.length) * 100
                    return (
                      <div key={key}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-bold text-foreground tabular-nums">{count}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full ${
                            key === 'ACCEPTED' ? 'bg-green-500' :
                            key === 'REJECTED' ? 'bg-red-500' :
                            key === 'UNDER_EVALUATION' ? 'bg-amber-500' :
                            'bg-blue-500'
                          }`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </MagicCard>
            )}

            {/* Tips card */}
            <MagicCard className="p-5">
              <h3 className="font-bold text-sm text-foreground mb-2">💡 Le saviez-vous ?</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {activeRole === 'PORTEUR' && "Plus votre dossier de candidature est détaillé, plus vos chances d'être sélectionné sont élevées. Soignez la motivation et le pitch deck !"}
                {activeRole === 'MENTOR'  && "Vos sessions de mentorat sont automatiquement enregistrées comme tâches. Cliquez sur \"Terminée\" pour les comptabiliser."}
                {activeRole === 'JURY'    && "Évaluez chaque critère avec attention. Vos scores et commentaires aident l'admin à prendre la décision finale."}
              </p>
            </MagicCard>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
