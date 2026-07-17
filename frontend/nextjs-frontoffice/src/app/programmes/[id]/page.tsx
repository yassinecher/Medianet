'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Calendar, MapPin, Users, ArrowLeft, ExternalLink,
  Target, CheckCircle2, Clock, BookOpen, Building2,
  Sparkles, Trophy, GraduationCap, Lightbulb
} from 'lucide-react'
import toast from 'react-hot-toast'
import { programmesApi, candidaturesApi } from '@/lib/api'
import { useUser, useAuthStore } from '@/store/auth.store'
import { Navbar } from '@/components/layout/Navbar'
import { AppShell } from '@/components/layout/AppShell'
import { MagicCard } from '@/components/magicui/magic-card'
import { NumberTicker } from '@/components/magicui/number-ticker'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, statusColor } from '@/lib/utils'
import type { Programme, Phase, Criteria, Partner } from '@/types'

const statusLabel: Record<string, string> = {
  OPEN: 'Ouvert', CLOSED: 'Fermé', DRAFT: 'Brouillon', ARCHIVED: 'Archivé',
  IN_PROGRESS: 'En cours', EVALUATION: 'Évaluation', CANCELLED: 'Annulé',
}

// Session type → human label + tone (shown as a badge on each session).
const SESSION_TYPE_LABEL: Record<string, string> = {
  CANDIDATURE_SUBMISSION: 'Candidature', PRESELECTION: 'Présélection', PITCH_DAY: 'Pitch Day',
  ONBOARDING: 'Onboarding', INCUBATION: 'Incubation', DEMO_DAY: 'Demo Day', TRAINING_DAY: 'Formation',
}
const SESSION_TYPE_TONE: Record<string, string> = {
  CANDIDATURE_SUBMISSION: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  PRESELECTION: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  PITCH_DAY: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  DEMO_DAY: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  ONBOARDING: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  TRAINING_DAY: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
  INCUBATION: 'bg-brand-500/10 text-brand-600 dark:text-brand-400',
}
const sessionStatusLabel: Record<string, string> = { UPCOMING: 'À venir', ACTIVE: 'En cours', COMPLETED: 'Terminée' }

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <h2 className="text-xl font-bold text-foreground">{children}</h2>
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}

function StatCard({ value, label, icon: Icon, color }: { value: number; label: string; icon: React.ElementType; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-card p-5 text-center shadow-sm">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl mb-1 ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <span className="text-3xl font-black text-foreground tabular-nums">
        <NumberTicker value={value} />
      </span>
      <span className="text-xs text-muted-foreground leading-tight">{label}</span>
    </div>
  )
}

export default function ProgrammeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const user = useUser()
  const router = useRouter()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => { setHydrated(true) }, [])
  // Logged-in users see the programme inside the dashboard shell (sidebar);
  // anonymous visitors keep the marketing navbar. Wait for hydration to avoid
  // flashing the wrong chrome.
  const wrap = (node: React.ReactNode) =>
    hydrated && isAuthenticated
      ? <AppShell>{node}</AppShell>
      : <div className="min-h-screen bg-background"><Navbar />{node}</div>
  const [programme, setProgramme] = useState<Programme | null>(null)
  const [phases, setPhases] = useState<Phase[]>([])
  const [criteria, setCriteria] = useState<Criteria[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  /** The porteur's own candidature status on this programme, if any. */
  const [myApplication, setMyApplication] = useState<string | null>(null)

  useEffect(() => {
    const pid = Number(id)
    Promise.all([
      programmesApi.get(pid),
      programmesApi.phases(pid),
      programmesApi.criteria(pid),
      programmesApi.partners(pid).catch(() => ({ data: [] })),
    ])
      .then(([pr, ph, cr, pt]) => {
        setProgramme(pr.data)
        setPhases(ph.data ?? [])
        setCriteria(cr.data ?? [])
        setPartners(pt.data ?? [])
      })
      .catch(() => toast.error('Programme introuvable'))
      .finally(() => setLoading(false))
  }, [id])

  // Has the logged-in porteur already applied to this programme?
  useEffect(() => {
    if (!user) { setMyApplication(null); return }
    candidaturesApi.myList()
      .then((r) => {
        const list: any[] = r.data?.content ?? r.data ?? []
        const mine = list.find((c) => c.programmeId === Number(id))
        setMyApplication(mine?.status ?? null)
      })
      .catch(() => {})
  }, [id, user])

  const handleApply = () => {
    if (!user) { router.push('/login'); return }
    // Only open external URL if it's a real absolute http(s) link.
    // Otherwise fall back to the internal multi-step form.
    const ext = programme?.applicationUrl?.trim()
    if (ext && /^https?:\/\//i.test(ext)) {
      window.open(ext, '_blank', 'noopener,noreferrer')
      return
    }
    router.push(`/programmes/${id}/candidater`)
  }

  const hasStats = programme && (
    programme.expertCount || programme.trainingSessionsCount ||
    programme.mentoringHoursPerMonth || programme.maxStartups
  )
  const activeCriteria = criteria.filter((c) => c.active)

  if (loading) return wrap(
    <>
      <Skeleton className="h-72 w-full" />
      <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
          </div>
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </main>
    </>
  )

  if (!programme) return null

  // Front-office visitors must not see draft / archived / cancelled programmes.
  if (['DRAFT', 'ARCHIVED', 'CANCELLED'].includes(programme.status)) {
    return wrap(
      <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 text-center">
        <BookOpen className="mb-3 h-10 w-10 text-muted-foreground/40" />
        <h1 className="text-xl font-bold text-foreground">Programme non disponible</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ce programme n&apos;est pas ouvert au public pour le moment.
        </p>
        <Link href="/programmes" className="mt-4">
          <Button variant="outline" className="gap-1.5"><ArrowLeft className="h-4 w-4" />Voir les programmes</Button>
        </Link>
      </main>,
    )
  }

  // Accepting candidatures = inside the candidature-session window (computed by the API);
  // fall back to the raw OPEN status for older payloads.
  const isOpen = programme.acceptingApplications ?? (programme.status === 'OPEN')
  const alreadyApplied = !!myApplication
  const APPLIED_LABEL: Record<string, string> = {
    PENDING: 'Candidature soumise', UNDER_EVALUATION: 'En évaluation',
    ACCEPTED: 'Candidature acceptée ✓', REJECTED: 'Candidature refusée',
  }

  /** Shown in the apply slots when the porteur has already candidated. */
  const AppliedChip = ({ light }: { light?: boolean }) => (
    <Link href="/candidatures" className="inline-flex">
      <span className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold ${
        light ? 'bg-white/20 text-white backdrop-blur-sm' : 'border border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-300'
      }`}>
        <CheckCircle2 className="h-4 w-4" />{APPLIED_LABEL[myApplication!] ?? 'Déjà candidaté'}
      </span>
    </Link>
  )

  return wrap(
    <>
      {/* ── Hero ── */}
      <div className="relative w-full overflow-hidden">
        {/* Banner */}
        {programme.bannerImageUrl ? (
          <div className="relative h-72 sm:h-96">
            <img src={programme.bannerImageUrl} alt={programme.title} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
          </div>
        ) : (
          <div className="relative h-72 sm:h-96 bg-gradient-to-br from-brand-700 via-brand-600 to-purple-700 dark:from-brand-900 dark:via-brand-800 dark:to-purple-900">
            <div className="absolute inset-0 opacity-20"
              style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
          </div>
        )}

        {/* Hero content overlay */}
        <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-10">
          <div className="mx-auto w-full max-w-6xl">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <button onClick={() => router.back()}
                className="mb-4 flex items-center gap-1.5 text-sm text-white/80 hover:text-white transition-colors">
                <ArrowLeft className="h-4 w-4" />Retour
              </button>
              <div className="flex items-end gap-4">
                {programme.logoUrl && (
                  <div className="hidden sm:flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-2 border-white/20 bg-white/10 backdrop-blur-sm overflow-hidden">
                    <img src={programme.logoUrl} alt={`${programme.title} logo`} className="h-full w-full object-contain p-2" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColor(programme.status)}`}>
                      {statusLabel[programme.status]}
                    </span>
                    {programme.type && (
                      <span className="rounded-full bg-white/20 backdrop-blur-sm px-2.5 py-0.5 text-xs font-medium text-white">
                        {programme.type === 'PUBLIC' ? 'Public' : 'Privé'}
                      </span>
                    )}
                  </div>
                  <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight">{programme.title ?? programme.name}</h1>
                  {programme.tagline && (
                    <p className="mt-1 text-lg text-white/80 font-medium">{programme.tagline}</p>
                  )}
                </div>
                {alreadyApplied ? (
                  <div className="hidden sm:block shrink-0"><AppliedChip light /></div>
                ) : isOpen && (
                  <div className="hidden sm:block shrink-0">
                    <Button size="lg" onClick={handleApply}
                      className="bg-white text-brand-700 hover:bg-white/90 font-bold shadow-xl gap-2">
                      {programme.applicationUrl ? <ExternalLink className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                      Rejoindre le programme
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Mobile apply CTA */}
      {alreadyApplied ? (
        <div className="sm:hidden px-4 py-3 bg-brand-600 flex justify-center"><AppliedChip light /></div>
      ) : isOpen && (
        <div className="sm:hidden px-4 py-3 bg-brand-600">
          <Button className="w-full bg-white text-brand-700 hover:bg-white/90 font-bold" onClick={handleApply}>
            <Sparkles className="h-4 w-4" />
            Rejoindre le programme
          </Button>
        </div>
      )}

      {/* ── Stats bar ── */}
      {hasStats && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <div className="border-b border-border bg-card/60 backdrop-blur-sm">
            <div className="mx-auto max-w-6xl px-4 py-5">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {programme.maxStartups && (
                  <StatCard value={programme.maxStartups} label="Startups sélectionnées" icon={Trophy} color="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" />
                )}
                {programme.expertCount && (
                  <StatCard value={programme.expertCount} label="Experts & mentors" icon={GraduationCap} color="bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400" />
                )}
                {programme.trainingSessionsCount && (
                  <StatCard value={programme.trainingSessionsCount} label="Sessions de formation" icon={BookOpen} color="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" />
                )}
                {programme.mentoringHoursPerMonth && (
                  <StatCard value={programme.mentoringHoursPerMonth} label="Heures de mentorat/mois" icon={Clock} color="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" />
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Main content ── */}
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-8 lg:grid-cols-3">

          {/* Left column — 2/3 */}
          <div className="space-y-10 lg:col-span-2">

            {/* Empty programme — friendly placeholder instead of a blank column */}
            {!programme.description && !(programme.sectors?.length) && !(programme.objectives?.length)
              && phases.length === 0 && !(programme.benefits?.length) && activeCriteria.length === 0
              && partners.length === 0 && (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
                <BookOpen className="h-10 w-10 text-muted-foreground opacity-30" />
                <p className="font-semibold text-foreground">Programme en préparation</p>
                <p className="text-sm text-muted-foreground max-w-md">
                  Les détails de ce programme (description, calendrier, critères de sélection)
                  seront publiés prochainement. Revenez bientôt !
                </p>
              </div>
            )}

            {/* Description */}
            {programme.description && (
              <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <SectionTitle>À propos du programme</SectionTitle>
                <p className="text-muted-foreground leading-relaxed text-base whitespace-pre-line">{programme.description}</p>
              </motion.section>
            )}

            {/* Sectors */}
            {programme.sectors && programme.sectors.length > 0 && (
              <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                <SectionTitle>Secteurs ciblés</SectionTitle>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {programme.sectors.map((s) => (
                    <div key={s} className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-3.5 shadow-sm">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500/10">
                        <Lightbulb className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                      </div>
                      <span className="text-sm font-medium text-foreground leading-tight">{s}</span>
                    </div>
                  ))}
                </div>
              </motion.section>
            )}

            {/* Objectives */}
            {programme.objectives && programme.objectives.length > 0 && (
              <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <SectionTitle>Objectifs du programme</SectionTitle>
                <ul className="space-y-3">
                  {programme.objectives.map((obj, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-brand-600 dark:text-brand-400">
                        <Target className="h-3 w-3" />
                      </span>
                      <span className="text-sm text-muted-foreground leading-relaxed">{obj}</span>
                    </li>
                  ))}
                </ul>
              </motion.section>
            )}

            {/* Timeline / Sessions */}
            {phases.length > 0 && (
              <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                <SectionTitle>Calendrier du programme</SectionTitle>
                <div className="relative space-y-0">
                  {phases.map((ph, i) => (
                    <div key={ph.id} className="relative flex gap-4">
                      {/* Timeline spine */}
                      <div className="flex flex-col items-center">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 font-bold text-sm z-10
                          ${i === 0 ? 'border-brand-500 bg-brand-500 text-white' : 'border-brand-300 bg-background text-brand-600 dark:text-brand-400'}`}>
                          {i + 1}
                        </div>
                        {i < phases.length - 1 && <div className="w-0.5 flex-1 bg-border mt-1" style={{ minHeight: '1.5rem' }} />}
                      </div>
                      {/* Content */}
                      <div className={`pb-6 flex-1 ${i < phases.length - 1 ? '' : ''}`}>
                        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-foreground">{ph.title ?? ph.name}</p>
                            {ph.sessionType && (
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${SESSION_TYPE_TONE[ph.sessionType] ?? 'bg-muted text-muted-foreground'}`}>
                                {SESSION_TYPE_LABEL[ph.sessionType] ?? ph.sessionType}
                              </span>
                            )}
                            {ph.status && ph.status !== 'UPCOMING' && (
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${ph.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                                {sessionStatusLabel[ph.status] ?? ph.status}
                              </span>
                            )}
                          </div>
                          {ph.description && <p className="mt-1 text-sm text-muted-foreground">{ph.description}</p>}
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            {(ph.startDate || ph.endDate) && (
                              <span className="flex items-center gap-1.5">
                                <Calendar className="h-3 w-3" />
                                {ph.startDate ? formatDate(ph.startDate) : ''}
                                {ph.startDate && ph.endDate && ' → '}
                                {ph.endDate ? formatDate(ph.endDate) : ''}
                              </span>
                            )}
                            {ph.location && <span className="flex items-center gap-1.5"><MapPin className="h-3 w-3" />{ph.location}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.section>
            )}

            {/* Benefits */}
            {programme.benefits && programme.benefits.length > 0 && (
              <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <SectionTitle>Ce que vous gagnez</SectionTitle>
                <div className="grid gap-3 sm:grid-cols-2">
                  {programme.benefits.map((b, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-green-500" />
                      <span className="text-sm text-foreground leading-relaxed">{b}</span>
                    </div>
                  ))}
                </div>
              </motion.section>
            )}

            {/* Evaluation criteria */}
            {activeCriteria.length > 0 && (
              <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                <SectionTitle>Critères de sélection</SectionTitle>
                <div className="space-y-4">
                  {activeCriteria.sort((a, b) => a.criterionOrder - b.criterionOrder).map((c) => (
                    <div key={c.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                      <div className="mb-2 flex justify-between text-sm">
                        <span className="font-semibold text-foreground">{c.name}</span>
                        <span className="text-brand-600 dark:text-brand-400 font-bold">{Math.round(c.weight * 100)}%</span>
                      </div>
                      {c.description && <p className="mb-2 text-xs text-muted-foreground">{c.description}</p>}
                      <Progress value={c.weight * 100} className="h-1.5" />
                    </div>
                  ))}
                </div>
              </motion.section>
            )}

            {/* Partners */}
            {partners.length > 0 && (
              <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                <SectionTitle>Nos partenaires</SectionTitle>
                <div className="flex flex-wrap gap-4">
                  {partners.map((p) => (
                    <div key={p.id}
                      className="flex h-16 w-32 items-center justify-center rounded-xl border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md">
                      {p.logoUrl ? (
                        <img src={p.logoUrl} alt={p.name} className="max-h-full max-w-full object-contain" />
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <Building2 className="h-5 w-5 text-muted-foreground" />
                          <span className="text-[10px] text-center text-muted-foreground font-medium leading-tight">{p.name}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </motion.section>
            )}
          </div>

          {/* Right column — sticky info card */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-6 space-y-4">
              <MagicCard className="p-6">
                <h3 className="mb-4 font-bold text-foreground text-lg">Informations clés</h3>
                <div className="space-y-3.5">
                  {(programme.location ?? programme.region) && (
                    <div className="flex items-start gap-3 text-sm">
                      <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-brand-500" />
                      <span className="text-muted-foreground">{programme.location ?? programme.region}</span>
                    </div>
                  )}
                  {programme.startDate && (
                    <div className="flex items-start gap-3 text-sm">
                      <Calendar className="h-4 w-4 mt-0.5 shrink-0 text-brand-500" />
                      <div>
                        <p className="text-xs text-muted-foreground">Début du programme</p>
                        <p className="font-medium text-foreground">{formatDate(programme.startDate)}</p>
                      </div>
                    </div>
                  )}
                  {programme.endDate && (
                    <div className="flex items-start gap-3 text-sm">
                      <Calendar className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Fin du programme</p>
                        <p className="font-medium text-foreground">{formatDate(programme.endDate)}</p>
                      </div>
                    </div>
                  )}
                  {(programme.maxApplications ?? programme.maxParticipants) && (
                    <div className="flex items-start gap-3 text-sm">
                      <Users className="h-4 w-4 mt-0.5 shrink-0 text-brand-500" />
                      <div>
                        <p className="text-xs text-muted-foreground">Candidatures max</p>
                        <p className="font-medium text-foreground">{programme.maxApplications ?? programme.maxParticipants}</p>
                      </div>
                    </div>
                  )}
                  {programme.maxStartups && (
                    <div className="flex items-start gap-3 text-sm">
                      <Trophy className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
                      <div>
                        <p className="text-xs text-muted-foreground">Startups sélectionnées</p>
                        <p className="font-bold text-foreground">{programme.maxStartups}</p>
                      </div>
                    </div>
                  )}
                </div>

                {alreadyApplied && (
                  <div className="mt-6 space-y-2 text-center">
                    <AppliedChip />
                    <p className="text-xs text-muted-foreground">
                      Vous avez déjà candidaté à ce programme.{' '}
                      <Link href="/candidatures" className="text-brand-600 hover:underline">Voir ma candidature</Link>
                    </p>
                  </div>
                )}
                {!alreadyApplied && isOpen && (
                  <div className="mt-6 space-y-3">
                    <Button className="w-full gap-2 bg-gradient-to-r from-brand-600 to-purple-600 text-white font-bold shadow-lg hover:shadow-brand-500/30 hover:shadow-xl transition-all"
                      size="lg" onClick={handleApply}>
                      {programme.applicationUrl ? <ExternalLink className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                      Rejoindre le programme
                    </Button>
                    {!user && (
                      <p className="text-center text-xs text-muted-foreground">
                        <Link href="/login" className="text-brand-600 hover:underline">Connectez-vous</Link> pour postuler
                      </p>
                    )}
                  </div>
                )}
              </MagicCard>

              {/* Sectors mini-card in sidebar (if no main column sections) */}
              {programme.sectors && programme.sectors.length > 0 && (
                <MagicCard className="p-5">
                  <h3 className="mb-3 text-sm font-bold text-foreground">Secteurs</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {programme.sectors.map((s) => (
                      <span key={s} className="rounded-full bg-brand-500/10 px-2.5 py-1 text-xs font-medium text-brand-700 dark:text-brand-300">{s}</span>
                    ))}
                  </div>
                </MagicCard>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
