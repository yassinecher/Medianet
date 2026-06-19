'use client'
/**
 * ProgrammeDashboard — the « Tableau de bord » tab (default landing) of a
 * programme. Surfaces the essentials at a glance: KPIs, candidate analytics,
 * top candidates, a "missing fields" checklist and a "what to do now" panel
 * driven by the current session (date-derived, like ParcoursFlow).
 */
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Users, CheckCircle2, Clock, ListChecks, AlertTriangle, ArrowRight,
  Trophy, FileText, ClipboardList, CalendarRange, Loader2, Gauge,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { candidaturesApi } from '@/lib/api'
import { MagicCard } from '@/components/magicui/magic-card'
import { statusColor } from '@/lib/utils'
import { SessionNotifier } from './SessionNotifier'

interface Phase {
  id?: number; title?: string; startDate?: string; endDate?: string
  sessionType?: string; parentSessionId?: number | null; focusCriteriaIds?: number[]
}
interface Cand {
  id: number; projectName?: string; companyName?: string; porteurName?: string
  sector?: string; status?: string; totalScore?: number; submittedAt?: string
  evaluations?: { weightedScore?: number }[]; juryAssignments?: unknown[]
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'En attente', UNDER_EVALUATION: 'En évaluation', UNDER_REVIEW: 'En revue',
  ACCEPTED: 'Acceptées', REJECTED: 'Refusées',
}
const PIE_COLORS = ['#f59e0b', '#0ea5e9', '#10b981', '#ef4444', '#a855f7']

const toDate = (s?: string) => (s ? new Date(s + (s.length === 10 ? 'T00:00:00' : '')) : null)

export function ProgrammeDashboard({
  programmeId, programme, phases, criteria, onOpenTab,
}: {
  programmeId: number
  programme: any
  phases: Phase[]
  criteria: { id: number; name: string }[]
  onOpenTab: (tab: 'info' | 'phases' | 'criteria' | 'partners' | 'invitations') => void
}) {
  const [cands, setCands] = useState<Cand[]>([])
  const [stats, setStats] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.allSettled([
      candidaturesApi.byProgramme(programmeId),
      candidaturesApi.programmeStats(programmeId),
    ]).then(([c, s]) => {
      if (cancelled) return
      if (c.status === 'fulfilled') setCands(c.value.data ?? [])
      if (s.status === 'fulfilled') setStats(s.value.data ?? {})
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [programmeId])

  // ── Derived ────────────────────────────────────────────────────────────────
  const total = stats.total ?? cands.length
  const accepted = stats.accepted ?? cands.filter(c => c.status === 'ACCEPTED').length
  const underEval = stats.underEvaluation ?? cands.filter(c => c.status === 'UNDER_EVALUATION').length
  const evaluatedCount = cands.filter(c => (c.evaluations?.length ?? 0) > 0).length

  const topSessions = useMemo(
    () => phases.filter(p => p.parentSessionId == null)
      .slice()
      .sort((a, b) => (toDate(a.startDate)?.getTime() ?? 0) - (toDate(b.startDate)?.getTime() ?? 0)),
    [phases],
  )

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }, [])
  const sessionsDone = topSessions.filter(s => { const e = toDate(s.endDate ?? s.startDate); return e && e < today }).length
  const currentStage = useMemo(
    () => topSessions.find(s => { const e = toDate(s.endDate ?? s.startDate); return e && today <= e }) ?? topSessions[topSessions.length - 1],
    [topSessions, today],
  )

  const statusData = useMemo(() => (
    ['PENDING', 'UNDER_EVALUATION', 'ACCEPTED', 'REJECTED']
      .map(k => ({ name: STATUS_LABEL[k], value: cands.filter(c => c.status === k).length }))
      .filter(d => d.value > 0)
  ), [cands])

  const sectorData = useMemo(() => {
    const m = new Map<string, number>()
    cands.forEach(c => { const s = c.sector || 'Autre'; m.set(s, (m.get(s) ?? 0) + 1) })
    return Array.from(m, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6)
  }, [cands])

  const topCandidates = useMemo(
    () => cands.filter(c => c.totalScore != null).sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0)).slice(0, 5),
    [cands],
  )

  // ── Missing-fields checklist ─────────────────────────────────────────────
  const todos: { label: string; tab?: 'info' | 'phases' | 'criteria' }[] = []
  if (!programme?.startDate || !programme?.endDate) todos.push({ label: 'Définir les dates du programme', tab: 'info' })
  if (!programme?.applicationDeadline) todos.push({ label: 'Définir la date limite de candidature', tab: 'info' })
  if (criteria.length === 0) todos.push({ label: 'Ajouter des critères d’évaluation', tab: 'criteria' })
  if (topSessions.length === 0) todos.push({ label: 'Créer des sessions dans le Parcours', tab: 'phases' })
  const undated = topSessions.filter(s => !s.startDate).length
  if (undated > 0) todos.push({ label: `${undated} session(s) sans date de début`, tab: 'phases' })
  const presel = topSessions.find(s => s.sessionType === 'PRESELECTION')
  if (presel && (presel.focusCriteriaIds?.length ?? 0) === 0 && criteria.length === 0)
    todos.push({ label: 'La présélection n’a pas de critères', tab: 'criteria' })

  // ── Next actions for the current stage ─────────────────────────────────────
  const nextActions: { text: string; cta?: { label: string; tab?: 'info' | 'phases'; href?: string } }[] = []
  if (currentStage) {
    const fn = currentStage.sessionType
    if (fn === 'CANDIDATURE_SUBMISSION') {
      nextActions.push({ text: `Phase de candidature « ${currentStage.title} » — ${total} candidature(s) reçue(s).`, cta: { label: 'Voir le formulaire', tab: 'info' } })
      if (!programme?.applicationDeadline) nextActions.push({ text: 'Aucune date limite — les candidats ne voient pas d’échéance.', cta: { label: 'Définir', tab: 'info' } })
    } else if (fn === 'PRESELECTION') {
      nextActions.push({ text: `Présélection « ${currentStage.title} » — ${evaluatedCount}/${total} candidature(s) évaluée(s).`, cta: { label: 'Assigner / évaluer', tab: 'phases' } })
      nextActions.push({ text: `${total - accepted} candidature(s) en attente de décision (accepter/refuser).`, cta: { label: 'Ouvrir', tab: 'phases' } })
    } else {
      nextActions.push({ text: `Étape en cours : « ${currentStage.title} » — préparez l’agenda et les invités.`, cta: { label: 'Ouvrir le Parcours', tab: 'phases' } })
    }
  } else {
    nextActions.push({ text: 'Aucune session planifiée — créez le parcours du programme.', cta: { label: 'Ouvrir le Parcours', tab: 'phases' } })
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
  }

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={Users} label="Candidatures" value={total} tone="sky" />
        <Kpi icon={Gauge} label="En évaluation" value={underEval} tone="amber" />
        <Kpi icon={CheckCircle2} label="Acceptées" value={accepted} tone="emerald" />
        <Kpi icon={CalendarRange} label="Sessions" value={`${sessionsDone}/${topSessions.length}`} tone="violet" sub="terminées" />
      </div>

      {/* Sessions à venir — notifier les participants */}
      <SessionNotifier programmeId={programmeId} programmeName={programme?.title ?? programme?.name ?? 'Programme'} phases={phases as any} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* À faire maintenant */}
        <MagicCard className="p-5 lg:col-span-2">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
            <ArrowRight className="h-4 w-4 text-brand-500" />À faire maintenant
            {currentStage && <span className="ml-1 rounded-full bg-brand-500/10 px-2 py-0.5 text-[11px] font-medium text-brand-600">{currentStage.title}</span>}
          </h3>
          <div className="space-y-2">
            {nextActions.map((a, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                <p className="flex-1 text-sm text-foreground">{a.text}</p>
                {a.cta && (a.cta.href ? (
                  <Link href={a.cta.href} className="shrink-0 rounded-md border border-brand-500/40 px-2.5 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-500/10">{a.cta.label}</Link>
                ) : (
                  <button onClick={() => a.cta!.tab && onOpenTab(a.cta!.tab)} className="shrink-0 rounded-md border border-brand-500/40 px-2.5 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-500/10">{a.cta.label}</button>
                ))}
              </div>
            ))}
          </div>
        </MagicCard>

        {/* À compléter */}
        <MagicCard className="p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
            <ListChecks className="h-4 w-4 text-brand-500" />À compléter
          </h3>
          {todos.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />Tout est configuré.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {todos.map((t, i) => (
                <li key={i}>
                  <button onClick={() => t.tab && onOpenTab(t.tab)} className="flex w-full items-center gap-2 rounded-lg border border-amber-300/40 bg-amber-500/5 px-3 py-2 text-left text-xs text-amber-800 dark:text-amber-200 hover:bg-amber-500/10">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" /><span className="flex-1">{t.label}</span><ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </MagicCard>
      </div>

      {/* Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MagicCard className="p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-foreground"><FileText className="h-4 w-4 text-brand-500" />Candidatures par statut</h3>
          {statusData.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e) => `${e.name} (${e.value})`}>
                  {statusData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </MagicCard>
        <MagicCard className="p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-foreground"><ClipboardList className="h-4 w-4 text-brand-500" />Candidatures par secteur</h3>
          {sectorData.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={sectorData} barSize={28}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </MagicCard>
      </div>

      {/* Top candidates */}
      <MagicCard className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-semibold text-foreground"><Trophy className="h-4 w-4 text-amber-500" />Meilleurs candidats</h3>
          <Link href={`/candidatures?programme=${programmeId}`} className="text-xs text-brand-500 hover:underline">Voir tout</Link>
        </div>
        {topCandidates.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
            <Trophy className="h-8 w-8 text-muted-foreground opacity-30" />
            <p className="text-sm text-muted-foreground">Aucune évaluation pour l’instant.</p>
            <button onClick={() => onOpenTab('phases')}
              className="rounded-md border border-brand-500/40 px-3 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-500/10">
              Assigner des jurés dans le Parcours →
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {topCandidates.map((c, i) => (
              <Link key={c.id} href={`/candidatures/${c.id}`}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-brand-400 hover:bg-accent">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-xs font-bold text-amber-600">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{c.projectName || c.companyName || `Candidature #${c.id}`}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{c.porteurName || ''}{c.sector ? ` · ${c.sector}` : ''}</p>
                </div>
                {c.status && <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusColor(c.status)}`}>{STATUS_LABEL[c.status] ?? c.status}</span>}
                <span className="shrink-0 text-sm font-bold text-amber-600">{Number(c.totalScore).toFixed(1)}</span>
              </Link>
            ))}
          </div>
        )}
      </MagicCard>
    </div>
  )
}

function Kpi({ icon: Icon, label, value, tone, sub }: {
  icon: any; label: string; value: number | string; tone: 'sky' | 'amber' | 'emerald' | 'violet'; sub?: string
}) {
  const tones: Record<string, string> = {
    sky: 'text-sky-600 bg-sky-500/10', amber: 'text-amber-600 bg-amber-500/10',
    emerald: 'text-emerald-600 bg-emerald-500/10', violet: 'text-violet-600 bg-violet-500/10',
  }
  return (
    <MagicCard className="p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}><Icon className="h-5 w-5" /></div>
        <div className="min-w-0">
          <p className="text-2xl font-bold leading-none text-foreground">{value}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{label}{sub ? ` ${sub}` : ''}</p>
        </div>
      </div>
    </MagicCard>
  )
}

function Empty() {
  return (
    <div className="flex h-[220px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 text-center">
      <FileText className="h-8 w-8 text-muted-foreground opacity-30" />
      <p className="text-sm text-muted-foreground">Pas encore de données.</p>
      <p className="text-[11px] text-muted-foreground/70 max-w-[260px]">
        Les graphiques se rempliront dès la première candidature reçue pendant la session de candidature.
      </p>
    </div>
  )
}
