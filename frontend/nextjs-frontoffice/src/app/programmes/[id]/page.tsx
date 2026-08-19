'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Calendar, MapPin, Users, ArrowLeft, ExternalLink,
  Target, CheckCircle2, Clock, BookOpen, Building2,
  Sparkles, Trophy, GraduationCap, Lightbulb,
  Images, Scale, ListChecks, ArrowRight,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { programmesApi, candidaturesApi, juryApi, participantsApi } from '@/lib/api'
import { PhotoGallery } from '@/components/media/PhotoGallery'
import { useUser, useAuthStore, frontofficeRolesOf } from '@/store/auth.store'
import { Navbar } from '@/components/layout/Navbar'
import { AppShell } from '@/components/layout/AppShell'
import { MagicCard } from '@/components/magicui/magic-card'
import { NumberTicker } from '@/components/magicui/number-ticker'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, statusColor, cn } from '@/lib/utils'
import type { Programme, Phase, Criteria, Partner } from '@/types'
import { SiteFooter } from '@/components/layout/SiteFooter'

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

// ── Personalized role panels (porteur progress / jury workspace) ────────────
function MiniStat({ icon: Icon, label, value, tone }: { icon: React.ElementType; label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-2.5">
      <Icon className={`mx-auto h-4 w-4 ${tone}`} />
      <p className="mt-1 text-lg font-black tabular-nums text-foreground">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  )
}

function StepRow({ label, phase, tone }: { label: string; phase: Phase; tone: 'brand' | 'muted' }) {
  const on = tone === 'brand'
  return (
    <div className={`rounded-xl border p-2.5 ${on ? 'border-brand-400/50 bg-brand-500/5' : 'border-border bg-card/60'}`}>
      <p className={`text-[10px] font-bold uppercase tracking-wide ${on ? 'text-brand-600 dark:text-brand-400' : 'text-muted-foreground'}`}>{label}</p>
      <p className="truncate text-sm font-semibold text-foreground">{phase.title ?? phase.name}</p>
      {(phase.startDate || phase.endDate) && (
        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
          <Calendar className="h-3 w-3" />
          {phase.startDate ? formatDate(phase.startDate) : ''}{phase.startDate && phase.endDate && ' → '}{phase.endDate ? formatDate(phase.endDate) : ''}
        </p>
      )}
    </div>
  )
}

function PorteurProgressCard({ phases, done, current, next, pct }: {
  phases: Phase[]; done: number; current?: Phase; next?: Phase; pct: number
}) {
  const upcoming = phases.filter((p) => (p.status ?? 'UPCOMING') === 'UPCOMING').length
  return (
    <div className="rounded-2xl border border-brand-400/40 bg-gradient-to-br from-brand-500/5 to-purple-500/5 p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold text-foreground"><Trophy className="h-4 w-4 text-brand-500" />Votre parcours dans le programme</h3>
        <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-xs font-bold text-brand-700 dark:text-brand-300">{pct}%</span>
      </div>
      <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-purple-500 transition-all" style={{ width: `${Math.max(4, pct)}%` }} />
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <MiniStat icon={CheckCircle2} label="Terminées" value={done} tone="text-emerald-500" />
        <MiniStat icon={Clock} label="En cours" value={current ? 1 : 0} tone="text-brand-500" />
        <MiniStat icon={Calendar} label="À venir" value={upcoming} tone="text-muted-foreground" />
      </div>
      <div className="mt-4 space-y-2">
        {current && <StepRow tone="brand" label="Étape en cours" phase={current} />}
        {next && <StepRow tone="muted" label="Prochaine étape" phase={next} />}
        {!current && !next && phases.length > 0 && (
          <p className="rounded-xl border border-emerald-400/40 bg-emerald-500/5 p-2.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">🎉 Toutes les étapes sont terminées. Félicitations !</p>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/candidatures"><Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs"><BookOpen className="h-3.5 w-3.5" />Ma candidature</Button></Link>
        <Link href="/tasks"><Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs"><ListChecks className="h-3.5 w-3.5" />Mes tâches</Button></Link>
      </div>
    </div>
  )
}

function JuryPanelCard({ items, done, email }: { items: any[]; done: number; email: string }) {
  const todo = items.length - done
  return (
    <div className="rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-500/5 to-orange-500/5 p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold text-foreground"><Scale className="h-4 w-4 text-amber-500" />Votre espace jury</h3>
        {todo > 0
          ? <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-300">{todo} à évaluer</span>
          : <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">Terminé ✓</span>}
      </div>
      <p className="mb-3 text-xs text-muted-foreground">{done}/{items.length} candidature(s) évaluée(s) pour ce programme.</p>
      <div className="space-y-1.5">
        {items.slice(0, 5).map((c) => {
          const evaluated = (c.evaluations ?? []).some((e: any) => (e.juryEmail ?? '').toLowerCase() === email.toLowerCase())
          return (
            <Link key={c.id} href={`/evaluations/${c.id}`}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm transition-colors hover:border-amber-300">
              <span className="min-w-0 flex-1 truncate font-medium text-foreground">{c.projectName || c.companyName || `Candidature #${c.id}`}</span>
              {evaluated
                ? <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" />Évaluée</span>
                : <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-amber-600">Évaluer<ArrowRight className="h-3.5 w-3.5" /></span>}
            </Link>
          )
        })}
      </div>
      {items.length > 5 && (
        <Link href="/evaluations" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:underline dark:text-amber-300">
          Voir toutes mes évaluations<ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  )
}

function MentorPanelCard({ mentees }: { mentees: any[] }) {
  return (
    <div className="rounded-2xl border border-emerald-400/40 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold text-foreground"><Sparkles className="h-4 w-4 text-emerald-500" />Vos startups accompagnées</h3>
        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">{mentees.length}</span>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">Les startups dont vous êtes le référent dans ce programme.</p>
      <div className="space-y-1.5">
        {mentees.slice(0, 6).map((p) => (
          <Link key={p.id} href={`/organizations/${p.organizationId}`}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm transition-colors hover:border-emerald-300">
            <Building2 className="h-4 w-4 shrink-0 text-emerald-500" />
            <span className="min-w-0 flex-1 truncate font-medium text-foreground">{p.organizationName || `Organisation #${p.organizationId}`}</span>
            <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-emerald-600">Suivi &amp; coaching<ArrowRight className="h-3.5 w-3.5" /></span>
          </Link>
        ))}
      </div>
    </div>
  )
}

// Whole days remaining until a deadline (end-of-day). Null when no/invalid date.
function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  return Math.ceil((d.setHours(23, 59, 59, 999) - Date.now()) / 86_400_000)
}

/** A deadline urgency chip — red under a week, amber under a month, else neutral. */
function DeadlineBadge({ days, onLight }: { days: number; onLight?: boolean }) {
  const tone = days <= 7 ? 'red' : days <= 30 ? 'amber' : 'brand'
  const light = onLight
    ? 'bg-white/20 text-white backdrop-blur-sm'
    : tone === 'red' ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
    : tone === 'amber' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
    : 'bg-brand-500/15 text-brand-700 dark:text-brand-300'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${light}`}>
      <Clock className="h-3.5 w-3.5" />
      {days > 0 ? `Clôture dans ${days} jour${days > 1 ? 's' : ''}` : 'Dernier jour !'}
    </span>
  )
}

/** Sticky in-page section navigation with scroll-spy. Hidden when < 2 sections.
 *  `topClass` positions it under the page chrome (public navbar 4rem / shell topbar 3.5rem). */
function SectionNav({ items, topClass = 'top-0' }: { items: { id: string; label: string }[]; topClass?: string }) {
  const [active, setActive] = useState(items[0]?.id)
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (vis) setActive(vis.target.id)
      },
      { rootMargin: '-30% 0px -60% 0px' },
    )
    items.forEach((i) => { const el = document.getElementById(i.id); if (el) obs.observe(el) })
    return () => obs.disconnect()
  }, [items])
  if (items.length < 2) return null
  return (
    <div className={cn('sticky z-30 -mx-4 mb-8 border-b border-border bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70', topClass)}>
      <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((i) => (
          <a key={i.id} href={`#${i.id}`}
            className={cn('shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
              active === i.id ? 'bg-brand-500 text-white shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}>
            {i.label}
          </a>
        ))}
      </nav>
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
      : <div className="min-h-screen bg-background"><Navbar />{node}<SiteFooter/></div>
  const [programme, setProgramme] = useState<Programme | null>(null)
  const [phases, setPhases] = useState<Phase[]>([])
  const [criteria, setCriteria] = useState<Criteria[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  /** The porteur's own candidature status on this programme, if any. */
  const [myApplication, setMyApplication] = useState<string | null>(null)
  /** Candidatures of THIS programme assigned to the logged-in jury. */
  const [juryItems, setJuryItems] = useState<any[]>([])
  /** Participations of THIS programme where the logged-in mentor is the référent. */
  const [mentorItems, setMentorItems] = useState<any[]>([])

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

  const isPorteur = frontofficeRolesOf(user).includes('PORTEUR')
  const isJury = frontofficeRolesOf(user).includes('JURY')
  const isMentor = frontofficeRolesOf(user).includes('MENTOR')

  // Has the logged-in porteur already applied to this programme?
  // (PORTEUR-only endpoint — jury/mentor must not call it.)
  useEffect(() => {
    if (!user || !isPorteur) { setMyApplication(null); return }
    candidaturesApi.myList()
      .then((r) => {
        const list: any[] = r.data?.content ?? r.data ?? []
        const mine = list.find((c) => c.programmeId === Number(id))
        setMyApplication(mine?.status ?? null)
      })
      .catch(() => {})
  }, [id, user, isPorteur])

  // Jury: the candidatures of THIS programme assigned to me.
  useEffect(() => {
    if (!user || !isJury) { setJuryItems([]); return }
    juryApi.myAssignments()
      .then((r) => {
        const list: any[] = r.data ?? []
        setJuryItems(list.filter((c) => Number(c.programmeId) === Number(id)))
      })
      .catch(() => {})
  }, [id, user, isJury])

  // Mentor: the startups I'm the référent of, in THIS programme.
  useEffect(() => {
    if (!user || !isMentor) { setMentorItems([]); return }
    participantsApi.mine()
      .then((r) => {
        const list: any[] = r.data ?? []
        setMentorItems(list.filter((p) => Number(p.programmeId) === Number(id)))
      })
      .catch(() => {})
  }, [id, user, isMentor])

  const handleApply = () => {
    if (!user) { router.push('/login'); return }
    // Only porteurs can join a programme — jury/mentor accounts evaluate, they
    // don't apply.
    if (!isPorteur) {
      toast.error('Seuls les porteurs de projet peuvent candidater à un programme.')
      return
    }
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
  // Only porteurs (or anonymous visitors, who'd be prompted to log in) ever see
  // the apply CTAs — jury & mentor accounts evaluate/accompany, they don't join.
  const canApply = !user || isPorteur
  const showApply = isOpen && canApply

  // ── Porteur journey (what's done / going on / next) ──
  const phSt = (p: Phase) => (p.status ?? (p.isActive ? 'ACTIVE' : 'UPCOMING'))
  const doneCount = phases.filter((p) => phSt(p) === 'COMPLETED').length
  const currentPhase = phases.find((p) => phSt(p) === 'ACTIVE')
  const nextPhase = phases.find((p) => phSt(p) === 'UPCOMING')
  const progressPct = phases.length ? Math.round((doneCount / phases.length) * 100) : 0
  const isEnrolled = isPorteur && myApplication === 'ACCEPTED'
  // ── Jury workspace stats for this programme ──
  const juryDone = juryItems.filter((c) =>
    (c.evaluations ?? []).some((e: any) => (e.juryEmail ?? '').toLowerCase() === (user?.email ?? '').toLowerCase())).length
  const showJury = isJury && juryItems.length > 0
  const showMentor = isMentor && mentorItems.length > 0

  // ── Deadline & in-page navigation (built only from sections that exist) ──
  const deadlineDays = daysUntil(programme.candidatureDeadline ?? programme.applicationDeadline)
  const toc = ([
    programme.description && { id: 'apropos', label: 'À propos' },
    (programme.sectors?.length ?? 0) > 0 && { id: 'pour-qui', label: 'Pour qui ?' },
    (programme.objectives?.length ?? 0) > 0 && { id: 'objectifs', label: 'Objectifs' },
    phases.length > 0 && { id: 'parcours', label: 'Le parcours' },
    (programme.benefits?.length ?? 0) > 0 && { id: 'avantages', label: 'Avantages' },
    (programme.galleryUrls?.length ?? 0) > 0 && { id: 'galerie', label: 'Galerie' },
    activeCriteria.length > 0 && { id: 'criteres', label: 'Critères' },
    partners.length > 0 && { id: 'partenaires', label: 'Partenaires' },
  ].filter(Boolean)) as { id: string; label: string }[]
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
         <div
  className="relative h-72 sm:h-96 dark:brightness-75"
  style={{
    background: 'linear-gradient(90deg, #fbb431 0%, #0a8fb1 35%,  #14c8f3 100%)'
  }}
>    <div className="absolute inset-0 opacity-20"
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
                    {showApply && deadlineDays != null && deadlineDays >= 0 && <DeadlineBadge days={deadlineDays} onLight />}
                  </div>
                  <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight">{programme.title ?? programme.name}</h1>
                  {programme.tagline && (
                    <p className="mt-1 text-lg text-white/80 font-medium">{programme.tagline}</p>
                  )}
                </div>
                {alreadyApplied ? (
                  <div className="hidden sm:block shrink-0"><AppliedChip light /></div>
                ) : showApply && (
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
      ) : showApply && (
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

        {/* Sticky in-page navigation (scroll-spy) — offset under the active chrome */}
        <SectionNav items={toc} topClass={hydrated && isAuthenticated ? 'top-14' : 'top-16'} />

        {/* Personalized band — porteur progress, jury workspace, mentor startups */}
        {(isEnrolled || showJury || showMentor) && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className={`mb-8 grid gap-4 ${[isEnrolled, showJury, showMentor].filter(Boolean).length > 1 ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
            {isEnrolled && <PorteurProgressCard phases={phases} done={doneCount} current={currentPhase} next={nextPhase} pct={progressPct} />}
            {showJury && <JuryPanelCard items={juryItems} done={juryDone} email={user?.email ?? ''} />}
            {showMentor && <MentorPanelCard mentees={mentorItems} />}
          </motion.div>
        )}

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
              <motion.section id="apropos" className="scroll-mt-28" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <SectionTitle>À propos du programme</SectionTitle>
                <p className="text-muted-foreground leading-relaxed text-base whitespace-pre-line">{programme.description}</p>
              </motion.section>
            )}

            {/* Sectors */}
            {programme.sectors && programme.sectors.length > 0 && (
              <motion.section id="pour-qui" className="scroll-mt-28" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                <SectionTitle>Pour qui ? — secteurs ciblés</SectionTitle>
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
              <motion.section id="objectifs" className="scroll-mt-28" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
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
              <motion.section id="parcours" className="scroll-mt-28" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                <SectionTitle>Le parcours du programme</SectionTitle>
                <div className="relative pl-1">
                  {phases.map((ph, i) => {
                    const done = ph.status === 'COMPLETED'
                    const active = ph.status === 'ACTIVE'
                    const last = i === phases.length - 1
                    return (
                      <div key={ph.id} className="relative flex gap-4 pb-6 last:pb-0">
                        {/* Timeline spine */}
                        <div className="relative flex flex-col items-center">
                          <div className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ring-4 ring-background
                            ${done
                              ? 'bg-emerald-500 text-white'
                              : active
                                ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/30'
                                : 'border-2 border-brand-200 bg-background text-brand-600 dark:border-brand-800 dark:text-brand-400'}`}>
                            {active && <span className="absolute inset-0 animate-ping rounded-full bg-brand-500/40" />}
                            {done ? <CheckCircle2 className="h-4 w-4" /> : <span className="relative">{i + 1}</span>}
                          </div>
                          {/* Connector — brand-tinted above the active step, muted after */}
                          {!last && (
                            <div className={`mt-1 w-0.5 flex-1 rounded-full ${done || active ? 'bg-gradient-to-b from-brand-400 to-border' : 'bg-border'}`} style={{ minHeight: '1.75rem' }} />
                          )}
                        </div>
                        {/* Content */}
                        <div className="flex-1">
                          <div className={`group rounded-2xl border bg-card p-4 shadow-sm transition-all hover:shadow-md
                            ${active ? 'border-brand-400/60 ring-1 ring-brand-500/20' : 'border-border hover:border-brand-300/60'}`}>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-bold text-foreground">{ph.title ?? ph.name}</p>
                              {ph.sessionType && (
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${SESSION_TYPE_TONE[ph.sessionType] ?? 'bg-muted text-muted-foreground'}`}>
                                  {SESSION_TYPE_LABEL[ph.sessionType] ?? ph.sessionType}
                                </span>
                              )}
                              {ph.status && ph.status !== 'UPCOMING' && (
                                <span className={`ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${active ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>
                                  {active && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                                  {sessionStatusLabel[ph.status] ?? ph.status}
                                </span>
                              )}
                            </div>
                            {ph.description && <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{ph.description}</p>}
                            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                              {(ph.startDate || ph.endDate) && (
                                <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted/60 px-2 py-1">
                                  <Calendar className="h-3.5 w-3.5 text-brand-500" />
                                  {ph.startDate ? formatDate(ph.startDate) : ''}
                                  {ph.startDate && ph.endDate && ' → '}
                                  {ph.endDate ? formatDate(ph.endDate) : ''}
                                </span>
                              )}
                              {ph.location && (
                                <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted/60 px-2 py-1">
                                  <MapPin className="h-3.5 w-3.5 text-brand-500" />{ph.location}
                                </span>
                              )}
                            </div>
                            {(ph.galleryUrls?.length ?? 0) > 0 && (
                              <div className="mt-3 border-t border-border/60 pt-3">
                                <p className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                                  <Images className="h-3 w-3 text-brand-500" />Photos de la session
                                </p>
                                <PhotoGallery images={ph.galleryUrls} variant="strip" />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </motion.section>
            )}

            {/* Benefits */}
            {programme.benefits && programme.benefits.length > 0 && (
              <motion.section id="avantages" className="scroll-mt-28" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
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

            {/* Retour en images — programme gallery */}
            {(programme.galleryUrls?.length ?? 0) > 0 && (
              <motion.section id="galerie" className="scroll-mt-28" initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }}>
                <SectionTitle>Retour en images</SectionTitle>
                <PhotoGallery images={programme.galleryUrls} />
              </motion.section>
            )}

            {/* Evaluation criteria */}
            {activeCriteria.length > 0 && (
              <motion.section id="criteres" className="scroll-mt-28" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
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
              <motion.section id="partenaires" className="scroll-mt-28" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
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
              {/* Deadline countdown — urgency at a glance */}
              {!alreadyApplied && showApply && deadlineDays != null && deadlineDays >= 0 && (
                <div className="rounded-2xl border border-brand-400/40 bg-gradient-to-br from-brand-500/10 to-purple-500/10 p-4 text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Clôture des candidatures</p>
                  <p className="mt-1 text-4xl font-black leading-none text-brand-600 dark:text-brand-400 tabular-nums">{deadlineDays}</p>
                  <p className="text-xs text-muted-foreground">jour{deadlineDays > 1 ? 's' : ''} restant{deadlineDays > 1 ? 's' : ''}</p>
                  {(programme.candidatureDeadline ?? programme.applicationDeadline) && (
                    <p className="mt-1.5 text-[11px] text-muted-foreground">jusqu&apos;au {formatDate(programme.candidatureDeadline ?? programme.applicationDeadline)}</p>
                  )}
                </div>
              )}
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
                {!alreadyApplied && showApply && (
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

        {/* ── Final call-to-action band ── */}
        {!alreadyApplied && showApply && (
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }}
            className="relative mt-14 overflow-hidden rounded-3xl bg-gradient-to-r from-brand-600 via-brand-600 to-purple-600 p-8 text-center text-white shadow-xl sm:p-12">
            <div className="absolute inset-0 opacity-20"
              style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '28px 28px' }} />
            <div className="relative">
              <h2 className="text-2xl font-black sm:text-3xl">Prêt à faire décoller votre projet ?</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm text-white/90 sm:text-base">
                Rejoignez « {programme.title ?? programme.name} » et bénéficiez d&apos;un accompagnement sur mesure pour concrétiser votre startup.
              </p>
              {deadlineDays != null && deadlineDays >= 0 && (
                <div className="mt-4 flex justify-center"><DeadlineBadge days={deadlineDays} onLight /></div>
              )}
              <div className="mt-6 flex justify-center">
                <Button size="lg" onClick={handleApply} className="gap-2 bg-white font-bold text-brand-700 shadow-lg hover:bg-white/90">
                  {programme.applicationUrl ? <ExternalLink className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                  Rejoindre le programme
                </Button>
              </div>
              {!user && (
                <p className="mt-3 text-xs text-white/80">
                  <Link href="/login" className="underline">Connectez-vous</Link> pour postuler
                </p>
              )}
            </div>
          </motion.div>
        )}
      </main>
    </>
  )
}
