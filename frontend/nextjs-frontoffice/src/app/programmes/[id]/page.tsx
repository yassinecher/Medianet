'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Calendar, ArrowLeft, ExternalLink, CheckCircle2, Clock, BookOpen, Building2,
  Sparkles, Trophy, Scale, ListChecks, ArrowRight, EyeOff, PlusCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { programmesApi, candidaturesApi, juryApi, participantsApi } from '@/lib/api'
import { useUser, useAuthStore, frontofficeRolesOf } from '@/store/auth.store'
import { Navbar } from '@/components/layout/Navbar'
import { AppShell } from '@/components/layout/AppShell'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ProgrammeHero } from '@/components/programme-page/ProgrammeHero'
import {
  ProgrammeBlockView, programmeBlockHasContent,
  type ApplyState, type PageCtx, type ResolvedBackground,
} from '@/components/programme-page/ProgrammeSections'
import {
  HERO_ID, NAV_LABEL, parseProgrammePage, type ProgrammePage,
} from '@/lib/programmePage'
import { isEditorOrigin } from '@/lib/landingBlocks'
import { formatDate, cn } from '@/lib/utils'
import type { Programme, Phase, Criteria, Partner } from '@/types'

// ── Personalized role panels (porteur progress / jury workspace / mentor) ───
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
    <div className="rounded-2xl border border-brand-400/40 bg-gradient-to-br from-brand-500/5 to-brand-accent/5 p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold text-foreground"><Trophy className="h-4 w-4 text-brand-500" />Votre parcours dans le programme</h3>
        <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-xs font-bold text-brand-700 dark:text-brand-300">{pct}%</span>
      </div>
      <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-accent transition-all" style={{ width: `${Math.max(4, pct)}%` }} />
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
          <p className="rounded-xl border border-emerald-400/40 bg-emerald-500/5 p-2.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">Toutes les étapes sont terminées. Félicitations !</p>
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
          : <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">Terminé</span>}
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

/** Sticky in-page navigation with scroll-spy, plus the apply button on wide screens. */
function SectionNav({ items, topClass, action }: {
  items: { id: string; label: string }[]; topClass: string; action?: React.ReactNode
}) {
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
    <div className={cn('sticky z-30 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70', topClass)}>
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 sm:px-6">
        <nav className="flex min-w-0 flex-1 gap-1 overflow-x-auto py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((i) => (
            <a key={i.id} href={`#${i.id}`}
              className={cn('shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                active === i.id ? 'bg-brand-500 text-white shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}>
              {i.label}
            </a>
          ))}
        </nav>
        {action && <div className="hidden shrink-0 md:block">{action}</div>}
      </div>
    </div>
  )
}

/**
 * Public programme page. Its sections, their order and titles come from the
 * « Page publique » builder (programme.pageJson, default layout otherwise).
 *
 * With `?edit=1` it is the back-office builder's live preview: the editor
 * pushes its working copy (`programme-preview`: edited fields + layout) and
 * clicking a section selects it in the editor.
 */
export default function ProgrammeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const user = useUser()
  const router = useRouter()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => { setHydrated(true) }, [])
  const [editMode] = useState(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('edit') === '1')

  // Logged-in users see the programme inside the dashboard shell (sidebar);
  // anonymous visitors (and the editor preview) keep the public navbar.
  const inShell = hydrated && isAuthenticated && !editMode
  // In the preview the WHOLE page (navbar + footer) is measured to size the
  // editor's iframe — and it must not be min-h-screen, or it would only grow.
  const wrap = (node: React.ReactNode) =>
    inShell ? <AppShell>{node}</AppShell>
      : <div ref={pageRef} className={cn('bg-background', !editMode && 'min-h-screen')}><Navbar />{node}<SiteFooter /></div>

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

  // ── Editor preview state ──
  const [override, setOverride] = useState<{ fields?: Partial<Programme>; page?: ProgrammePage } | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const editorOrigin = useRef<string | null>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const reportedHeight = useRef(0)
  const [scrolledPastHero, setScrolledPastHero] = useState(false)

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
    if (!user || !isPorteur || editMode) { setMyApplication(null); return }
    candidaturesApi.myList()
      .then((r) => {
        const list: any[] = r.data?.content ?? r.data ?? []
        const mine = list.find((c) => c.programmeId === Number(id))
        setMyApplication(mine?.status ?? null)
      })
      .catch(() => {})
  }, [id, user, isPorteur, editMode])

  // Jury: the candidatures of THIS programme assigned to me.
  useEffect(() => {
    if (!user || !isJury || editMode) { setJuryItems([]); return }
    juryApi.myAssignments()
      .then((r) => setJuryItems((r.data ?? []).filter((c: any) => Number(c.programmeId) === Number(id))))
      .catch(() => {})
  }, [id, user, isJury, editMode])

  // Mentor: the startups I'm the référent of, in THIS programme.
  useEffect(() => {
    if (!user || !isMentor || editMode) { setMentorItems([]); return }
    participantsApi.mine()
      .then((r) => setMentorItems((r.data ?? []).filter((p: any) => Number(p.programmeId) === Number(id))))
      .catch(() => {})
  }, [id, user, isMentor, editMode])

  // Mobile apply bar appears once the hero's buttons are out of view.
  useEffect(() => {
    if (editMode) return
    const onScroll = () => setScrolledPastHero(window.scrollY > 520)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [editMode])

  // ── Editor preview: report height, receive the working copy ──
  useEffect(() => {
    if (!editMode || !pageRef.current || window.parent === window) return
    const el = pageRef.current
    const report = () => {
      const height = Math.ceil(el.getBoundingClientRect().height)
      if (height === reportedHeight.current) return
      reportedHeight.current = height
      window.parent.postMessage({ type: 'landing-preview-height', height }, editorOrigin.current ?? '*')
    }
    report()
    const ro = new ResizeObserver(report)
    ro.observe(el)
    return () => ro.disconnect()
  })

  useEffect(() => {
    if (!editMode) return
    const onMsg = (e: MessageEvent) => {
      if (!isEditorOrigin(e.origin)) return
      const m = e.data
      if (!m || typeof m !== 'object') return
      editorOrigin.current = e.origin
      if (m.type === 'programme-preview' && m.doc?.page?.blocks) {
        setOverride({ fields: m.doc.fields ?? {}, page: m.doc.page })
      } else if (m.type === 'select-block') {
        setSelectedId(m.id ?? null)
        if (m.scroll && m.id) {
          requestAnimationFrame(() => {
            const el = document.querySelector(`[data-block="${CSS.escape(m.id)}"]`)
            if (!el) return
            if (window.parent === window) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return }
            const top = el.getBoundingClientRect().top + window.scrollY
            window.parent.postMessage({ type: 'landing-preview-scroll', top }, editorOrigin.current ?? '*')
          })
        }
      }
    }
    window.addEventListener('message', onMsg)
    window.parent?.postMessage({ type: 'landing-preview-ready' }, '*') // carries no data
    return () => window.removeEventListener('message', onMsg)
  }, [editMode])

  // What the page shows: saved programme, overlaid with the editor's working copy.
  const view = useMemo<Programme | null>(
    () => (programme ? { ...programme, ...(override?.fields ?? {}) } : null), [programme, override])
  const page = useMemo<ProgrammePage>(
    () => override?.page ?? parseProgrammePage(programme?.pageJson), [override, programme?.pageJson])

  const handleApply = () => {
    if (editMode) { toast('Aperçu : le bouton est inactif ici.', { id: 'preview-apply' }); return }
    if (!user) { router.push('/login'); return }
    // Only porteurs can join a programme — jury/mentor accounts evaluate, they don't apply.
    if (!isPorteur) {
      toast.error('Seuls les porteurs de projet peuvent candidater à un programme.')
      return
    }
    // Only open an external URL if it's a real absolute http(s) link;
    // otherwise fall back to the internal multi-step form.
    const ext = programme?.applicationUrl?.trim()
    if (ext && /^https?:\/\//i.test(ext)) {
      window.open(ext, '_blank', 'noopener,noreferrer')
      return
    }
    router.push(`/programmes/${id}/candidater`)
  }

  if (loading) return wrap(
    <>
      <Skeleton className="h-[560px] w-full rounded-none" />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-10">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
      </main>
    </>
  )

  if (!programme || !view) return null

  // Front-office visitors must not see draft / archived / cancelled programmes.
  if (!editMode && ['DRAFT', 'ARCHIVED', 'CANCELLED'].includes(programme.status)) {
    return wrap(
      <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 text-center">
        <BookOpen className="mb-3 h-10 w-10 text-muted-foreground/40" />
        <h1 className="text-xl font-bold text-foreground">Programme non disponible</h1>
        <p className="mt-1 text-sm text-muted-foreground">Ce programme n&apos;est pas ouvert au public pour le moment.</p>
        <Link href="/programmes" className="mt-4">
          <Button variant="outline" className="gap-1.5"><ArrowLeft className="h-4 w-4" />Voir les programmes</Button>
        </Link>
      </main>,
    )
  }

  // Accepting candidatures = inside the candidature-session window (computed by the API);
  // fall back to the raw OPEN status for older payloads. Only porteurs (or anonymous
  // visitors, who'd be prompted to log in) see the apply CTAs.
  const isOpen = programme.acceptingApplications ?? (programme.status === 'OPEN')
  const canApply = editMode || !user || isPorteur
  const apply: ApplyState = {
    show: isOpen && canApply,
    applied: myApplication,
    external: !!programme.applicationUrl && /^https?:\/\//i.test(programme.applicationUrl),
    deadlineDays: daysUntil(programme.candidatureDeadline ?? programme.applicationDeadline),
    loggedIn: !!user,
    onApply: handleApply,
  }
  const ctx: PageCtx = {
    programme: view, phases, criteria: criteria.filter((c) => c.active), partners, apply, preview: editMode,
  }

  // ── Personal bands ──
  const phSt = (p: Phase) => (p.status ?? (p.isActive ? 'ACTIVE' : 'UPCOMING'))
  const doneCount = phases.filter((p) => phSt(p) === 'COMPLETED').length
  const currentPhase = phases.find((p) => phSt(p) === 'ACTIVE')
  const nextPhase = phases.find((p) => phSt(p) === 'UPCOMING')
  const progressPct = phases.length ? Math.round((doneCount / phases.length) * 100) : 0
  const isEnrolled = isPorteur && myApplication === 'ACCEPTED'
  const juryDone = juryItems.filter((c) =>
    (c.evaluations ?? []).some((e: any) => (e.juryEmail ?? '').toLowerCase() === (user?.email ?? '').toLowerCase())).length
  const showJury = isJury && juryItems.length > 0
  const showMentor = isMentor && mentorItems.length > 0

  // ── Sections: visible + non-empty (the preview also shows hidden / empty ones) ──
  let shown = 0
  const sections = page.blocks
    .filter((b) => editMode || b.visible !== false)
    .map((b) => ({ b, has: programmeBlockHasContent(b, ctx) }))
    .filter((s) => editMode || s.has)
    .map((s) => {
      const setting = s.b.data?.background ?? 'auto'
      // 'auto' alternates plain / tinted bands so consecutive sections stay distinct.
      const bg: ResolvedBackground = setting === 'auto' ? (shown % 2 === 0 ? 'default' : 'muted') : setting
      if (s.has && s.b.visible !== false) shown++
      return { ...s, bg, anchor: `s-${s.b.id}` }
    })
  const live = sections.filter((s) => s.has && s.b.visible !== false)
  const toc = live
    .filter((s) => s.b.type !== 'apply' && s.b.type !== 'cta')
    .map((s) => ({ id: s.anchor, label: (s.b.data?.navLabel || NAV_LABEL[s.b.type] || s.b.data?.title || 'Section') as string }))
  const journeyAnchor = live.find((s) => s.b.type === 'journey')?.anchor
  const applyButton = apply.show && !apply.applied && (
    <Button size="sm" onClick={handleApply} className="gap-1.5 bg-gradient-to-r from-brand-600 to-brand-accent font-semibold text-white shadow">
      {apply.external ? <ExternalLink className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}Candidater
    </Button>
  )

  // Preview: click a section to edit it; links open in a new tab instead of leaving.
  const selectable = (blockId: string) => !editMode ? {} : {
    onClick: (e: React.MouseEvent) => {
      const target = e.target as HTMLElement
      const link = target.closest('a[href]') as HTMLAnchorElement | null
      if (link) {
        e.preventDefault(); e.stopPropagation()
        const href = link.getAttribute('href') || ''
        if (!href.startsWith('#')) window.open(href.startsWith('/') ? window.location.origin + href : href, '_blank', 'noopener,noreferrer')
        return
      }
      if (target.closest('button, input, select, textarea, iframe, [role="button"]')) return
      setSelectedId(blockId)
      window.parent?.postMessage({ type: 'edit-section', section: blockId }, editorOrigin.current ?? '*')
    },
    className: cn('relative cursor-pointer outline outline-2 -outline-offset-2 transition-[outline-color]',
      selectedId === blockId ? 'outline-brand-500' : 'outline-transparent hover:outline-brand-500/50'),
  }

  return wrap(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="bg-background">
      <div data-block={HERO_ID} {...selectable(HERO_ID)}>
        <ProgrammeHero programme={view} settings={page.hero ?? {}} apply={apply} journeyAnchor={journeyAnchor} />
      </div>

      <SectionNav items={toc} topClass={inShell ? 'top-14' : 'top-16'} action={applyButton || undefined} />

      {/* Personalized band — porteur progress, jury workspace, mentor startups */}
      {(isEnrolled || showJury || showMentor) && (
        <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
          <div className={`grid gap-4 ${[isEnrolled, showJury, showMentor].filter(Boolean).length > 1 ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
            {isEnrolled && <PorteurProgressCard phases={phases} done={doneCount} current={currentPhase} next={nextPhase} pct={progressPct} />}
            {showJury && <JuryPanelCard items={juryItems} done={juryDone} email={user?.email ?? ''} />}
            {showMentor && <MentorPanelCard mentees={mentorItems} />}
          </div>
        </div>
      )}

      {live.length === 0 && !editMode && (
        <div className="mx-auto max-w-3xl px-4 py-20">
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground opacity-30" />
            <p className="font-semibold text-foreground">Programme en préparation</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Les détails de ce programme (description, calendrier, critères de sélection) seront publiés prochainement.
            </p>
          </div>
        </div>
      )}

      {sections.map(({ b, has, bg, anchor }) => {
        if (!editMode) return <ProgrammeBlockView key={b.id} block={b} ctx={ctx} bg={bg} anchor={anchor} />
        const hidden = b.visible === false
        return (
          <div key={b.id} data-block={b.id} {...selectable(b.id)}>
            {hidden && (
              <span className="pointer-events-none absolute right-3 top-3 z-20 inline-flex items-center gap-1 rounded-full bg-slate-900/85 px-2.5 py-1 text-[11px] font-semibold text-white shadow">
                <EyeOff className="h-3 w-3" />Masqué — invisible pour les visiteurs
              </span>
            )}
            <div className={cn(hidden && 'opacity-40')}>
              {has ? (
                <ProgrammeBlockView block={b} ctx={ctx} bg={bg} anchor={anchor} />
              ) : (
                <div className="flex items-center justify-center gap-2 border-y border-dashed border-border bg-muted/20 px-4 py-10 text-sm text-muted-foreground">
                  <PlusCircle className="h-4 w-4" />« {(b.data?.title || NAV_LABEL[b.type]) as string} » est vide : ajoutez du contenu dans l&apos;éditeur
                </div>
              )}
            </div>
          </div>
        )
      })}

      {/* Phones: the apply button follows the visitor once the hero is passed. */}
      {!editMode && applyButton && <div className="h-16 md:hidden" aria-hidden />}
      {!editMode && applyButton && scrolledPastHero && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur md:hidden">
          <Button onClick={handleApply} className="w-full gap-2 bg-gradient-to-r from-brand-600 to-brand-accent font-bold text-white">
            {apply.external ? <ExternalLink className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            {page.hero?.ctaLabel?.trim() || 'Rejoindre le programme'}
          </Button>
        </div>
      )}
    </motion.div>,
  )
}
