'use client'
/**
 * EvaluationDashboard — the « Évaluations » tab of a programme. A consolidated,
 * read-only view of all the details: KPIs, a leaderboard, a candidatures × jurys
 * score matrix, a per-criterion breakdown for a selected candidature, all jury
 * comments, charts and CSV export. Data: candidaturesApi.byProgramme +
 * programmesApi.criteria (everything else is computed client-side). The in-overlay
 * PreselectionPhasePanel stays for quick per-session jury actions.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Trophy, Users, CheckCircle2, Clock, Gauge, ListChecks, Download, ClipboardList,
  Loader2, MessageSquare, ChevronDown, ChevronRight, Star, BarChart3, Eye,
} from 'lucide-react'
import { CandidatureReview } from './CandidatureReview'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { candidaturesApi, programmesApi } from '@/lib/api'
import { MagicCard } from '@/components/magicui/magic-card'
import { statusColor, scoreColor } from '@/lib/utils'

interface Phase { id?: number; title?: string; sessionType?: string; focusCriteriaIds?: number[]; criterionWeightsJson?: string }
interface CriteriaScore { criteriaId?: number; criteriaName?: string; score?: number; weight?: number }
interface Evaluation { juryId?: number; phaseId?: number; juryEmail?: string; juryName?: string; weightedScore?: number; comment?: string; criteriaScores?: CriteriaScore[] }
interface JuryAssignment { id?: number; juryId?: number; phaseId?: number; juryEmail?: string; juryName?: string; status?: string }

/** Session types whose purpose is jury/admin evaluation — a candidature is scored
 *  afresh in each of these sessions. */
const EVAL_SESSION_TYPES = ['PRESELECTION', 'PITCH_DAY']
interface Cand {
  id: number; projectName?: string; companyName?: string; porteurName?: string; porteurEmail?: string
  sector?: string; status?: string; totalScore?: number
  evaluations?: Evaluation[]; juryAssignments?: JuryAssignment[]
}
interface Criterion { id: number; name: string; weight?: number; active?: boolean; criterionOrder?: number }

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'En attente', UNDER_EVALUATION: 'En évaluation', UNDER_REVIEW: 'En revue',
  ACCEPTED: 'Acceptée', REJECTED: 'Refusée',
}
const PIE_COLORS = ['#f59e0b', '#0ea5e9', '#10b981', '#ef4444', '#a855f7']

const juryKey = (x: { juryEmail?: string; juryName?: string } | undefined) =>
  (x?.juryEmail || x?.juryName || '').toLowerCase().trim()
const juryLabel = (x: { juryEmail?: string; juryName?: string } | undefined) =>
  x?.juryName || x?.juryEmail || '—'

// Compact, read-only renderer of all submitted candidature/organisation fields.
const fmtVal = (v: any): string => {
  if (v == null || v === '') return ''
  if (typeof v === 'boolean') return v ? 'Oui' : 'Non'
  if (Array.isArray(v)) return v.join(', ')
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}
const prettyKey = (k: string) =>
  k.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^\w/, (c) => c.toUpperCase())

export function CandFields({ c }: { c: Cand & Record<string, any> }) {
  const groups: { title: string; fields: { label: string; value: any }[] }[] = [
    { title: 'Entreprise & équipe', fields: [
      { label: 'Entreprise', value: c.companyName }, { label: 'Fondateur', value: c.founderName },
      { label: 'Email fondateur', value: c.founderEmail }, { label: 'Co-fondateurs', value: c.coFounders },
      { label: "Parcours de l'équipe", value: c.teamBackground }, { label: "Taille de l'équipe", value: c.teamSize },
      { label: 'Email de contact', value: c.contactEmail }, { label: 'Téléphone', value: c.contactPhone },
    ] },
    { title: 'Projet', fields: [
      { label: 'Description', value: c.projectDescription }, { label: 'Problème', value: c.problemStatement },
      { label: 'Solution', value: c.solutionDescription }, { label: 'Avantage concurrentiel', value: c.competitiveAdvantage },
      { label: 'Technologie', value: c.technologyDescription }, { label: 'Secteur', value: c.sector },
      { label: 'Stade actuel', value: c.currentStage }, { label: 'Stack technique', value: c.techStack },
    ] },
    { title: 'Marché & business', fields: [
      { label: 'Marché cible', value: c.targetMarket }, { label: 'A des clients', value: c.hasCustomers },
      { label: 'Modèle économique', value: c.businessModel }, { label: 'Canaux de distribution', value: c.distributionChannels },
      { label: 'Financement recherché', value: c.fundingRequired },
    ] },
    { title: 'Motivation & besoins', fields: [
      { label: 'Motivation', value: c.motivation }, { label: "Besoins d'accompagnement", value: c.supportNeeds },
      { label: 'Attentes du programme', value: c.programmeExpectations }, { label: 'Pitch deck', value: c.pitchDeckUrl },
    ] },
  ]
  let custom: Record<string, any> = {}
  try { if (c.customAnswers) custom = JSON.parse(c.customAnswers) } catch { /* ignore */ }
  const customEntries = Object.entries(custom).filter(([, v]) => fmtVal(v) !== '')

  return (
    <div className="rounded-xl border border-border bg-muted/10 p-3 space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Détails de la candidature & organisation</p>
      {groups.map((g) => {
        const rows = g.fields.filter((f) => fmtVal(f.value) !== '')
        if (!rows.length) return null
        return (
          <div key={g.title}>
            <p className="text-[11px] font-bold text-foreground mb-1">{g.title}</p>
            <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
              {rows.map((f) => (
                <div key={f.label} className="min-w-0">
                  <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{f.label}</dt>
                  <dd className="text-xs text-foreground whitespace-pre-wrap break-words">{fmtVal(f.value)}</dd>
                </div>
              ))}
            </dl>
          </div>
        )
      })}
      {customEntries.length > 0 && (
        <div>
          <p className="text-[11px] font-bold text-foreground mb-1">Réponses au formulaire</p>
          <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
            {customEntries.map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{prettyKey(k)}</dt>
                <dd className="text-xs text-foreground whitespace-pre-wrap break-words">{fmtVal(v)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  )
}

function Kpi({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string | number; tone: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${tone}`}><Icon className="h-4 w-4" /></div>
      <p className="mt-2 text-2xl font-extrabold text-foreground tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  )
}

export function EvaluationDashboard({ programmeId, criteria: criteriaProp, phases }: {
  programmeId: number
  programme?: any
  criteria?: Criterion[]
  phases?: Phase[]
}) {
  const [cands, setCands] = useState<Cand[]>([])
  const [criteria, setCriteria] = useState<Criterion[]>(criteriaProp ?? [])
  const [loading, setLoading] = useState(true)
  const [openCand, setOpenCand] = useState<number | null>(null)
  const [phaseId, setPhaseId] = useState<number | ''>('')
  const [reviewCand, setReviewCand] = useState<Cand | null>(null)

  const load = useCallback(() => {
    Promise.allSettled([
      candidaturesApi.byProgramme(programmeId),
      programmesApi.criteria(programmeId),
    ]).then(([c, cr]) => {
      if (c.status === 'fulfilled') setCands(c.value.data ?? [])
      if (cr.status === 'fulfilled') setCriteria(cr.value.data ?? [])
    }).finally(() => setLoading(false))
  }, [programmeId])

  useEffect(() => { load() }, [load])

  // Evaluation sessions (présélection, pitch day…). Selecting one scopes the
  // whole dashboard so each candidature is shown/scored PER SESSION — a candidature
  // with no score in the selected session must be (re)evaluated there.
  const evalPhases = (phases ?? []).filter((p) => EVAL_SESSION_TYPES.includes(p.sessionType ?? ''))

  // The criteria (with weights) used for the per-criterion detail, scoped to the
  // selected phase when one is chosen.
  const scopedCriteria = useMemo(() => {
    let list = (criteria ?? []).filter((c) => c.active !== false)
      .sort((a, b) => (a.criterionOrder ?? 0) - (b.criterionOrder ?? 0))
    const phase = evalPhases.find((p) => p.id === phaseId)
    if (phase) {
      const focus = phase.focusCriteriaIds ?? []
      if (focus.length) list = list.filter((c) => focus.includes(c.id))
      let w: Record<string, number> = {}
      try { if (phase.criterionWeightsJson) w = JSON.parse(phase.criterionWeightsJson) } catch { /* ignore */ }
      list = list.map((c) => (w[c.id] != null ? { ...c, weight: w[c.id] } : c))
    }
    return list
  }, [criteria, evalPhases, phaseId])

  // Phase-scoped views of a candidature's evaluations/assignments. When a session
  // is selected, only that session's data counts — so the dashboard reflects the
  // (re)evaluation happening in THAT session.
  const evalsOf = useCallback((c: Cand) =>
    (c.evaluations ?? []).filter((e) => phaseId === '' || (e.phaseId ?? null) === phaseId), [phaseId])
  const assignsOf = useCallback((c: Cand) =>
    (c.juryAssignments ?? []).filter((a) => phaseId === '' || (a.phaseId ?? null) === phaseId), [phaseId])

  // Distinct jury columns across the (scoped) programme.
  const juryCols = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of cands) {
      for (const a of assignsOf(c)) { const k = juryKey(a); if (k) map.set(k, juryLabel(a)) }
      for (const e of evalsOf(c)) { const k = juryKey(e); if (k) map.set(k, juryLabel(e)) }
    }
    return Array.from(map.entries()).map(([key, label]) => ({ key, label }))
  }, [cands, assignsOf, evalsOf])

  // Helpers per candidature (scoped to the selected session).
  const evalOf = (c: Cand, key: string) => evalsOf(c).find((e) => juryKey(e) === key)
  const assignOf = (c: Cand, key: string) => assignsOf(c).find((a) => juryKey(a) === key)
  const submittedCount = (c: Cand) =>
    assignsOf(c).filter((a) => a.status === 'SUBMITTED' || !!evalOf(c, juryKey(a))).length
  const avgOf = (c: Cand): number | null => {
    const xs = evalsOf(c).map((e) => e.weightedScore).filter((x): x is number => x != null)
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
  }

  // KPIs (scoped to the selected session when one is chosen).
  const totalAssignments = cands.reduce((n, c) => n + assignsOf(c).length, 0)
  const totalSubmitted = cands.reduce((n, c) => n + submittedCount(c), 0)
  const evaluatedCands = cands.filter((c) => submittedCount(c) > 0).length
  const noJury = cands.filter((c) => assignsOf(c).length === 0).length
  const activeJurys = juryCols.filter((j) => cands.some((c) => !!evalOf(c, j.key))).length
  const scoredCands = cands.map(avgOf).filter((x): x is number => x != null)
  const globalAvg = scoredCands.length ? scoredCands.reduce((a, b) => a + b, 0) / scoredCands.length : null
  const completion = totalAssignments ? Math.round((totalSubmitted / totalAssignments) * 100) : 0

  // Charts data.
  const statusData = useMemo(() => {
    const m: Record<string, number> = {}
    for (const c of cands) { const s = c.status ?? 'PENDING'; m[s] = (m[s] ?? 0) + 1 }
    return Object.entries(m).map(([k, v]) => ({ name: STATUS_LABEL[k] ?? k, value: v }))
  }, [cands])
  const scoreDist = useMemo(() => {
    const buckets = [0, 0, 0, 0, 0] // 0-2,2-4,4-6,6-8,8-10
    for (const s of scoredCands) buckets[Math.min(4, Math.floor(s / 2))]++
    return ['0–2', '2–4', '4–6', '6–8', '8–10'].map((label, i) => ({ label, n: buckets[i] }))
  }, [scoredCands])

  // Per-session score when a session is selected; otherwise the global total.
  const scoreFor = (c: Cand) => (phaseId === '' ? (c.totalScore ?? avgOf(c)) : avgOf(c))

  // Leaderboard (ranked by the scoped score).
  const leaderboard = useMemo(() =>
    [...cands].sort((a, b) => (scoreFor(b) ?? -1) - (scoreFor(a) ?? -1)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cands, phaseId])

  const exportCsv = () => {
    const head = ['Rang', 'Projet', 'Porteur', 'Email', 'Statut', 'Score', ...juryCols.map((j) => j.label)]
    const rows = leaderboard.map((c, i) => [
      i + 1, c.projectName || c.companyName || `#${c.id}`, c.porteurName || '', c.porteurEmail || '',
      STATUS_LABEL[c.status ?? ''] ?? c.status ?? '', scoreFor(c)?.toFixed(1) ?? '',
      ...juryCols.map((j) => evalOf(c, j.key)?.weightedScore?.toFixed(1) ?? ''),
    ])
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const csv = '﻿' + [head, ...rows].map((r) => r.map(esc).join(';')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url; a.download = `evaluations-programme-${programmeId}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
  }
  if (cands.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-border bg-muted/10 p-12 text-center">
        <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground opacity-30 mb-3" />
        <p className="text-sm text-muted-foreground">Aucune candidature à évaluer pour ce programme pour l&apos;instant.</p>
      </div>
    )
  }

  const selectedPhase = evalPhases.find((p) => p.id === phaseId)

  return (
    <div className="space-y-5">
      {/* Evaluation-session scope — pick a session to (re)evaluate its candidatures */}
      {evalPhases.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-muted/10 p-3">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground">
            <ListChecks className="h-4 w-4 text-amber-500" />Session d&apos;évaluation
          </div>
          <select value={phaseId} onChange={(e) => setPhaseId(e.target.value ? Number(e.target.value) : '')}
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm">
            <option value="">Toutes les sessions (global)</option>
            {evalPhases.map((p) => <option key={p.id} value={p.id}>{p.title || `Session ${p.id}`}</option>)}
          </select>
          <p className="text-xs text-muted-foreground">
            {phaseId === ''
              ? 'Vue cumulée de toutes les évaluations.'
              : 'Scores, jurys et classement de cette session uniquement — chaque candidature y est évaluée à nouveau.'}
          </p>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi icon={Users} label="Candidatures" value={cands.length} tone="bg-brand-500/15 text-brand-600 dark:text-brand-400" />
        <Kpi icon={CheckCircle2} label="Évaluées" value={evaluatedCands} tone="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" />
        <Kpi icon={Clock} label="Sans jury" value={noJury} tone="bg-amber-500/15 text-amber-600 dark:text-amber-400" />
        <Kpi icon={ListChecks} label="Évaluations soumises" value={`${totalSubmitted}/${totalAssignments}`} tone="bg-sky-500/15 text-sky-600 dark:text-sky-400" />
        <Kpi icon={Trophy} label="Score moyen" value={globalAvg != null ? globalAvg.toFixed(1) : '—'} tone="bg-purple-500/15 text-purple-600 dark:text-purple-400" />
        <Kpi icon={Gauge} label="Complétion" value={`${completion}%`} tone="bg-indigo-500/15 text-indigo-600 dark:text-indigo-400" />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <MagicCard className="p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground"><BarChart3 className="h-4 w-4 text-brand-500" />Distribution des scores</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={scoreDist}>
              <XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="n" radius={[6, 6, 0, 0]} fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </MagicCard>
        <MagicCard className="p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground"><ClipboardList className="h-4 w-4 text-brand-500" />Statut des candidatures</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={(e: any) => `${e.name} (${e.value})`} labelLine={false} fontSize={11}>
                {statusData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </MagicCard>
      </div>

      {/* Leaderboard */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground"><Trophy className="h-4 w-4 text-amber-500" />Classement</h3>
          <button onClick={exportCsv} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground">
            <Download className="h-3.5 w-3.5" />Exporter (CSV)
          </button>
        </div>
        <div className="space-y-1.5">
          {leaderboard.slice(0, 10).map((c, i) => {
            const s = scoreFor(c)
            return (
              <div key={c.id} className="flex items-center gap-3 rounded-lg border border-border bg-background/50 px-3 py-2">
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${i < 3 ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300' : 'bg-muted text-muted-foreground'}`}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <Link href={`/candidatures?programme=${programmeId}`} className="text-sm font-semibold text-foreground truncate hover:text-brand-600">{c.projectName || c.companyName || `Candidature #${c.id}`}</Link>
                  <p className="text-[11px] text-muted-foreground truncate">{c.porteurName || ''}{c.porteurEmail ? ` · ${c.porteurEmail}` : ''}</p>
                </div>
                <span className="text-[11px] text-muted-foreground whitespace-nowrap">{submittedCount(c)}/{assignsOf(c).length} jury</span>
                <span className={`inline-flex items-center gap-1 text-sm font-bold tabular-nums ${s != null ? scoreColor(s) : 'text-muted-foreground'}`}>
                  <Star className="h-3.5 w-3.5" />{s != null ? s.toFixed(1) : '—'}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusColor(c.status ?? 'PENDING')}`}>{STATUS_LABEL[c.status ?? ''] ?? c.status}</span>
                <button onClick={() => setReviewCand(c)} title="Revue détaillée (vue jury + IA)"
                  className="inline-flex items-center gap-1 rounded-md border border-brand-500/40 px-2 py-1 text-[11px] font-semibold text-brand-700 hover:bg-brand-500/10 dark:text-brand-300 shrink-0">
                  <Eye className="h-3 w-3" />Revue
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Matrix candidatures × jurys */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground"><Users className="h-4 w-4 text-brand-500" />Matrice candidatures × jurys</h3>
        {juryCols.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Aucun jury assigné pour l&apos;instant.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-card px-2 py-2 text-left font-bold text-muted-foreground min-w-[180px]">Candidature</th>
                  {juryCols.map((j) => (
                    <th key={j.key} className="px-2 py-2 text-center font-semibold text-muted-foreground whitespace-nowrap max-w-[120px] truncate" title={j.label}>{j.label}</th>
                  ))}
                  <th className="px-2 py-2 text-center font-bold text-muted-foreground">Moy.</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((c) => {
                  const avg = scoreFor(c)
                  return (
                    <tr key={c.id} className="border-t border-border">
                      <td className="sticky left-0 z-10 bg-card px-2 py-1.5 font-semibold text-foreground min-w-[180px] truncate" title={c.projectName || c.companyName}>{c.projectName || c.companyName || `#${c.id}`}</td>
                      {juryCols.map((j) => {
                        const ev = evalOf(c, j.key)
                        const assigned = !!assignOf(c, j.key)
                        const sc = ev?.weightedScore
                        return (
                          <td key={j.key} className="px-2 py-1.5 text-center">
                            {sc != null ? (
                              <span className={`font-bold tabular-nums ${scoreColor(sc)}`}>{sc.toFixed(1)}</span>
                            ) : assigned ? (
                              <span className="text-amber-500" title="En attente">⏳</span>
                            ) : (
                              <span className="text-muted-foreground/30">·</span>
                            )}
                          </td>
                        )
                      })}
                      <td className={`px-2 py-1.5 text-center font-extrabold tabular-nums ${avg != null ? scoreColor(avg) : 'text-muted-foreground'}`}>{avg != null ? avg.toFixed(1) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Per-criterion detail + comments (per candidature, expandable) */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground"><ClipboardList className="h-4 w-4 text-brand-500" />Détail par critère & commentaires</h3>
          {selectedPhase && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">Session : {selectedPhase.title || `#${selectedPhase.id}`}</span>}
        </div>
        <div className="space-y-2">
          {leaderboard.map((c) => {
            const open = openCand === c.id
            const evals = evalsOf(c)
            return (
              <div key={c.id} className="rounded-xl border border-border">
                <button onClick={() => setOpenCand(open ? null : c.id)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent/30">
                  {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  <span className="flex-1 text-sm font-semibold text-foreground truncate">{c.projectName || c.companyName || `Candidature #${c.id}`}</span>
                  <span className="text-[11px] text-muted-foreground">{evals.length} évaluation(s)</span>
                </button>
                {open && (
                  <div className="border-t border-border p-3 space-y-3">
                    <CandFields c={c as any} />
                    {evals.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">Aucune évaluation soumise pour cette candidature.</p>
                    ) : (
                      <>
                        {/* Per-criterion table: criteria × jurys */}
                        {scopedCriteria.length > 0 && (
                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-xs">
                              <thead>
                                <tr>
                                  <th className="px-2 py-1 text-left font-bold text-muted-foreground">Critère</th>
                                  {evals.map((e, i) => <th key={i} className="px-2 py-1 text-center font-semibold text-muted-foreground max-w-[110px] truncate" title={juryLabel(e)}>{juryLabel(e)}</th>)}
                                </tr>
                              </thead>
                              <tbody>
                                {scopedCriteria.map((cr) => (
                                  <tr key={cr.id} className="border-t border-border">
                                    <td className="px-2 py-1 font-medium text-foreground">
                                      {cr.name}{cr.weight != null && cr.weight > 0 && <span className="ml-1 text-[10px] text-muted-foreground">({Math.round(cr.weight * 100)}%)</span>}
                                    </td>
                                    {evals.map((e, i) => {
                                      const cs = (e.criteriaScores ?? []).find((x) => x.criteriaId === cr.id)
                                      return <td key={i} className="px-2 py-1 text-center tabular-nums">{cs?.score != null ? <span className={scoreColor(cs.score)}>{cs.score}</span> : '—'}</td>
                                    })}
                                  </tr>
                                ))}
                                <tr className="border-t border-border bg-muted/20">
                                  <td className="px-2 py-1 font-bold text-foreground">Score pondéré</td>
                                  {evals.map((e, i) => <td key={i} className={`px-2 py-1 text-center font-extrabold tabular-nums ${e.weightedScore != null ? scoreColor(e.weightedScore) : 'text-muted-foreground'}`}>{e.weightedScore != null ? e.weightedScore.toFixed(1) : '—'}</td>)}
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        )}
                        {/* Comments */}
                        <div className="space-y-1.5">
                          {evals.filter((e) => e.comment).map((e, i) => (
                            <div key={i} className="flex gap-2 rounded-lg bg-muted/20 px-3 py-2">
                              <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />
                              <div className="min-w-0">
                                <p className="text-[11px] font-bold text-foreground">{juryLabel(e)}{e.weightedScore != null && <span className="ml-1 font-normal text-amber-600">· {e.weightedScore.toFixed(1)}/10</span>}</p>
                                <p className="text-xs text-muted-foreground">{e.comment}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Jury-style review modal (details + AI + jury management) */}
      {reviewCand && (
        <CandidatureReview
          candidature={reviewCand}
          criteria={scopedCriteria}
          phaseId={typeof phaseId === 'number' ? phaseId : undefined}
          phaseTitle={selectedPhase?.title}
          onClose={() => setReviewCand(null)}
          onChanged={load}
        />
      )}
    </div>
  )
}
