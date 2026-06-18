'use client'
/**
 * Logged-in jury evaluation form for one assigned candidature.
 * Mirrors the public /evaluate/[token] grid, but identifies the jury via the
 * session (POST /api/candidatures/{id}/evaluate) instead of a token. Criteria are
 * scoped to the evaluating session (my assignment's phaseId → focusCriteriaIds +
 * weights), falling back to all programme criteria.
 */
import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Loader2, AlertTriangle, Send, Star, ClipboardCheck, Sparkles, Wand2, Layers } from 'lucide-react'
import toast from 'react-hot-toast'
import { juryApi, programmesApi, mediApi } from '@/lib/api'
import { AppShell } from '@/components/layout/AppShell'
import { CandidatureDetails } from '@/components/candidature/CandidatureDetails'
import { useAuthStore, useUser, useIsJury } from '@/store/auth.store'

interface Criterion {
  id: number; name: string; description?: string
  weight?: number; criterionOrder?: number; active?: boolean
}

function normalized(criteria: { id: number; weight?: number }[], scoreOf: (id: number) => number) {
  let ws = 0, tw = 0
  for (const c of criteria) {
    const w = c.weight ?? 0
    if (w > 0) { ws += scoreOf(c.id) * w; tw += w }
  }
  return tw > 0 ? ws / tw : null
}

export default function JuryEvaluatePage() {
  const params = useParams()
  const router = useRouter()
  const id = Number(Array.isArray(params.id) ? params.id[0] : params.id)
  const user = useUser()
  const isJury = useIsJury()
  const hydrated = useAuthStore((s) => s.isAuthenticated)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cand, setCand] = useState<any | null>(null)
  const [criteria, setCriteria] = useState<Criterion[]>([])
  const [scores, setScores] = useState<Record<number, number>>({})
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [ai, setAi] = useState<any | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  // The evaluation session (phase) this page scores. Read from ?phase= so a jury
  // assigned to the same candidature in several evaluation sessions gets a separate
  // evaluation per session. Falls back to the jury's (single) assignment.
  const [phaseId, setPhaseId] = useState<number | null>(null)
  const [sessionName, setSessionName] = useState<string>('')

  useEffect(() => {
    if (!hydrated) return
    if (!isJury) { setError('Espace réservé aux membres du jury.'); setLoading(false); return }
    let cancelled = false
    ;(async () => {
      try {
        const r = await juryApi.candidature(id)
        const c = r.data
        if (cancelled) return
        setCand(c)

        // Which evaluation session are we scoring? Prefer ?phase= (lets the same
        // candidature be evaluated in several sessions), else the jury's assignment.
        const qPhaseRaw = typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('phase') : null
        const qPhase = qPhaseRaw != null && qPhaseRaw !== '' ? Number(qPhaseRaw) : null
        const myAssigns = (c.juryAssignments ?? []).filter((a: any) => a.juryId === user?.id)
        const myAssign = (qPhase != null ? myAssigns.find((a: any) => a.phaseId === qPhase) : null)
          ?? myAssigns[0] ?? null
        const activePhase: number | null = qPhase ?? myAssign?.phaseId ?? c.phaseId ?? null
        setPhaseId(activePhase)

        // My existing evaluation FOR THIS SESSION (prefill + read-only summary).
        const mine = (c.evaluations ?? []).find((e: any) =>
          e.juryId === user?.id && (e.phaseId ?? null) === (activePhase ?? null)) ?? null
        setComment(mine?.comment ?? '')
        setDone(!!mine)
        const pre: Record<number, number> = {}
        mine?.criteriaScores?.forEach((cs: any) => { if (cs.criteriaId != null && cs.score != null) pre[cs.criteriaId] = cs.score })

        if (c.programmeId) {
          let list: Criterion[] = ((await programmesApi.criteria(c.programmeId)).data ?? [])
            .filter((x: Criterion) => x.active !== false)
            .sort((a: Criterion, b: Criterion) => (a.criterionOrder ?? 0) - (b.criterionOrder ?? 0))
          // Scope to the evaluating session's criteria + weights.
          if (activePhase) {
            try {
              const phase = ((await programmesApi.phases(c.programmeId)).data ?? []).find((p: any) => p.id === activePhase)
              if (phase) {
                setSessionName(phase.title ?? phase.name ?? '')
                const focus: number[] = phase.focusCriteriaIds ?? []
                if (focus.length) list = list.filter((x) => focus.includes(x.id))
                let w: Record<string, number> = {}
                try { if (phase.criterionWeightsJson) w = JSON.parse(phase.criterionWeightsJson) } catch { /* ignore */ }
                list = list.map((x) => (w[x.id] != null ? { ...x, weight: w[x.id] } : x))
              }
            } catch { /* session scoping optional */ }
          }
          if (cancelled) return
          setCriteria(list)
          const init: Record<number, number> = {}
          list.forEach((x) => { init[x.id] = pre[x.id] ?? 5 })
          setScores(init)
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.response?.data?.message ?? 'Candidature introuvable ou non assignée.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [hydrated, isJury, id, user?.id])

  const liveTotal = useMemo(() => normalized(criteria, (cid) => scores[cid] ?? 0), [criteria, scores])

  const submit = async () => {
    setSubmitting(true)
    try {
      const r = await juryApi.evaluate(id, {
        phaseId: phaseId ?? undefined,
        comment,
        criteriaScores: criteria.map((c) => ({
          criteriaId: c.id, criteriaName: c.name, score: scores[c.id] ?? 0, weight: c.weight ?? 0,
        })),
      })
      setCand(r.data)
      setDone(true)
      toast.success('Évaluation enregistrée. Merci !')
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Échec de l'envoi")
    } finally { setSubmitting(false) }
  }

  const runMedi = async () => {
    setAiLoading(true)
    try {
      const r = await mediApi.score(id)
      if (r.data?.aiEnhanced === false) toast.error(r.data?.error ?? "L'évaluation IA a échoué")
      setAi(r.data)
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? e?.response?.data?.error ?? "Échec de l'évaluation Medi")
    } finally { setAiLoading(false) }
  }

  // Prefill the jury sliders from Medi's per-criterion scores (match by name).
  const applyAiNotes = () => {
    const aic: any[] = ai?.criteria ?? []
    if (!aic.length) return
    const norm = (s: string) => (s ?? '').toLowerCase().trim()
    setScores((prev) => {
      const next = { ...prev }
      for (const c of criteria) {
        const hit = aic.find((x) => norm(x.name) === norm(c.name))
        if (hit && hit.score != null) next[c.id] = Math.round(Number(hit.score))
      }
      return next
    })
    toast.success('Notes Medi appliquées — ajustez si besoin')
  }

  const STATUS_LABEL: Record<string, string> = {
    PENDING: 'En attente', UNDER_EVALUATION: 'En évaluation', ACCEPTED: 'Acceptée', REJECTED: 'Refusée',
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl">
        <Link href="/evaluations" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Mes évaluations
        </Link>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
            <Loader2 className="h-7 w-7 animate-spin" /><p className="text-sm">Chargement…</p>
          </div>
        ) : error || !cand ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="rounded-full bg-rose-500/10 p-3"><AlertTriangle className="h-7 w-7 text-rose-500" /></div>
            <h1 className="text-lg font-bold text-foreground">Évaluation indisponible</h1>
            <p className="max-w-sm text-sm text-muted-foreground">{error ?? 'Candidature introuvable.'}</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="h-2 bg-gradient-to-r from-brand-500 via-brand-600 to-emerald-500" />
              <div className="flex flex-wrap items-start justify-between gap-3 p-5">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-brand-500">Évaluation</p>
                  <h1 className="mt-0.5 text-2xl font-bold text-foreground">
                    {cand.projectName || cand.companyName || `Candidature #${cand.id}`}
                  </h1>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    {cand.programmeId && (
                      <Link href={`/programmes/${cand.programmeId}`} className="inline-flex items-center gap-1 rounded-full bg-brand-500/10 px-2 py-0.5 text-xs font-medium text-brand-600 hover:bg-brand-500/20 dark:text-brand-400">
                        <Layers className="h-3 w-3" />{cand.programmeName ?? 'Programme'}
                      </Link>
                    )}
                    {cand.companyName && cand.projectName && <span>{cand.companyName}</span>}
                    {cand.porteurName && <span>· {cand.porteurName}</span>}
                    {sessionName && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                        <ClipboardCheck className="h-3 w-3" />Session : {sessionName}
                      </span>
                    )}
                  </div>
                </div>
                {cand.status && (
                  <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">{STATUS_LABEL[cand.status] ?? cand.status}</span>
                )}
              </div>
            </div>

            {/* Two-column: details (left, scroll) + scoring (right, sticky) */}
            <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-start">
              {/* Details */}
              <div className="min-w-0 flex-1">
                <CandidatureDetails c={cand} embedded />
              </div>

              {/* Scoring panel */}
              <aside className="w-full shrink-0 lg:w-[380px] lg:sticky lg:top-20">
                <div className="rounded-2xl border border-border bg-card shadow-sm">
                  <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                    <ClipboardCheck className="h-4 w-4 text-brand-500" />
                    <h2 className="text-sm font-bold text-foreground">Grille de notation</h2>
                  </div>

                  <div className="max-h-[calc(100vh-16rem)] space-y-3 overflow-y-auto p-4">
                    {done && (
                      <div className="flex items-center gap-2 rounded-xl border border-emerald-300/40 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />Déjà évaluée — vous pouvez ajuster vos notes.
                      </div>
                    )}

                    {/* Medi (AI) assistance */}
                    <div className="rounded-xl border border-purple-300/40 bg-purple-500/5 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-700 dark:text-purple-300"><Sparkles className="h-3.5 w-3.5" />Évaluation Medi</span>
                        <button onClick={runMedi} disabled={aiLoading}
                          className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-purple-600 to-brand-600 px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-60">
                          {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}{ai ? 'Relancer' : 'Demander à Medi'}
                        </button>
                      </div>
                      {!ai && !aiLoading && <p className="mt-1 text-[11px] text-muted-foreground">Une notation indicative basée sur le programme, l&apos;organisation, l&apos;équipe et la candidature.</p>}
                      {aiLoading && <p className="mt-1 text-[11px] text-muted-foreground">Medi analyse la candidature…</p>}
                      {ai && ai.aiEnhanced !== false && (
                        <div className="mt-2 space-y-1.5">
                          <div className="flex items-center gap-2 text-[11px]">
                            {ai.recommendation && <span className="rounded-full bg-purple-500/15 px-2 py-0.5 font-bold text-purple-700 dark:text-purple-300">{ai.recommendation}</span>}
                            {ai.weightedScore != null && <span className="font-bold text-foreground">Note IA : {Number(ai.weightedScore).toFixed(1)}/10</span>}
                          </div>
                          {(ai.criteria ?? []).length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {ai.criteria.map((cr: any, i: number) => (
                                <span key={i} className="inline-flex items-center gap-1 rounded-full bg-card border border-border px-2 py-0.5 text-[10px]" title={cr.comment ?? ''}>
                                  {cr.name}<span className="font-bold text-purple-600">{cr.score}</span>
                                </span>
                              ))}
                            </div>
                          )}
                          {ai.globalCommentary && <p className="text-[11px] text-muted-foreground">{ai.globalCommentary}</p>}
                          {criteria.length > 0 && (
                            <button onClick={applyAiNotes} className="inline-flex items-center gap-1 rounded-md border border-purple-400/50 px-2 py-1 text-[11px] font-semibold text-purple-700 hover:bg-purple-500/10 dark:text-purple-300">
                              <Wand2 className="h-3 w-3" />Utiliser ces notes
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {criteria.length === 0 ? (
                      <p className="rounded-xl border border-border bg-background/50 p-3 text-xs text-muted-foreground">
                        Aucun critère défini — laissez une appréciation globale ci-dessous.
                      </p>
                    ) : (
                      criteria.map((c) => (
                        <div key={c.id} className="rounded-xl border border-border bg-background/50 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground">{c.name}</p>
                              {c.weight != null && c.weight > 0 && (
                                <p className="text-[10px] text-muted-foreground">Poids {Math.round(c.weight * 100)}%</p>
                              )}
                            </div>
                            <span className="flex shrink-0 items-center gap-1 rounded-lg bg-brand-500/10 px-2 py-0.5 text-sm font-bold text-brand-600">
                              <Star className="h-3.5 w-3.5" />{scores[c.id] ?? 0}<span className="text-[10px] font-normal text-muted-foreground">/10</span>
                            </span>
                          </div>
                          <input type="range" min={0} max={10} step={1} value={scores[c.id] ?? 0}
                            onChange={(e) => setScores((s) => ({ ...s, [c.id]: Number(e.target.value) }))}
                            className="mt-2 w-full accent-brand-500" />
                        </div>
                      ))
                    )}

                    <div>
                      <label className="text-xs font-semibold text-foreground">Commentaire / note finale</label>
                      <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4}
                        placeholder="Appréciation globale, points forts, réserves…"
                        className="mt-1.5 w-full rounded-lg border border-border bg-background p-2.5 text-sm outline-none focus:border-brand-500" />
                    </div>
                  </div>

                  {/* Sticky footer: score + submit */}
                  <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/20 px-4 py-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Score pondéré</p>
                      <p className="text-2xl font-extrabold text-foreground leading-none">
                        {liveTotal != null ? liveTotal.toFixed(1) : '—'}<span className="text-sm font-medium text-muted-foreground">/10</span>
                      </p>
                    </div>
                    <button onClick={submit} disabled={submitting}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg disabled:opacity-60">
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {done ? 'Mettre à jour' : 'Envoyer'}
                    </button>
                  </div>
                </div>
              </aside>
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
