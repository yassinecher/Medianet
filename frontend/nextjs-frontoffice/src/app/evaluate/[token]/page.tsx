'use client'
/**
 * Public, no-login jury evaluation page. A jury opens this from the email link
 * (`/evaluate/{token}`); the token resolves the candidature + jury identity on the
 * server. No account or login is required. Criteria come from the public programme
 * endpoint; scores + a final note are submitted back by the same token.
 */
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle2, Loader2, AlertTriangle, Send, Star } from 'lucide-react'
import toast from 'react-hot-toast'
import { evaluationApi, programmesApi } from '@/lib/api'

interface Criterion {
  id: number; name: string; description?: string
  weight?: number; criterionOrder?: number; active?: boolean
}
interface CriteriaScore { criteriaId: number; criteriaName?: string; score?: number; weight?: number }
interface TokenEval {
  candidatureId: number
  projectName?: string
  companyName?: string
  porteurName?: string
  programmeId?: number
  phaseId?: number
  candidatureStatus?: string
  juryName?: string
  juryEmail?: string
  submitted?: boolean
  evaluation?: { criteriaScores?: CriteriaScore[]; comment?: string; weightedScore?: number } | null
}

function normalized(criteria: { id: number; weight?: number }[], scoreOf: (id: number) => number) {
  let ws = 0, tw = 0
  for (const c of criteria) {
    const w = c.weight ?? 0
    if (w > 0) { ws += scoreOf(c.id) * w; tw += w }
  }
  return tw > 0 ? ws / tw : null
}

export default function EvaluateTokenPage() {
  const params = useParams()
  const token = Array.isArray(params.token) ? params.token[0] : (params.token as string)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<TokenEval | null>(null)
  const [criteria, setCriteria] = useState<Criterion[]>([])
  const [scores, setScores] = useState<Record<number, number>>({})
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await evaluationApi.getByToken(token)
        const d: TokenEval = r.data
        if (cancelled) return
        setData(d)
        setComment(d.evaluation?.comment ?? '')
        setDone(!!d.submitted)

        const pre: Record<number, number> = {}
        d.evaluation?.criteriaScores?.forEach((cs) => {
          if (cs.criteriaId != null && cs.score != null) pre[cs.criteriaId] = cs.score
        })

        if (d.programmeId) {
          try {
            const cr = await programmesApi.criteria(d.programmeId)
            if (cancelled) return
            let list: Criterion[] = (cr.data ?? [])
              .filter((c: Criterion) => c.active !== false)
              .sort((a: Criterion, b: Criterion) => (a.criterionOrder ?? 0) - (b.criterionOrder ?? 0))
            // Scope to the evaluating (préselection) session's criteria + weights.
            if (d.phaseId) {
              try {
                const ph = await programmesApi.phases(d.programmeId)
                const phase = (ph.data ?? []).find((p: any) => p.id === d.phaseId)
                if (phase) {
                  const focus: number[] = phase.focusCriteriaIds ?? []
                  if (focus.length) list = list.filter((c) => focus.includes(c.id))
                  let w: Record<string, number> = {}
                  try { if (phase.criterionWeightsJson) w = JSON.parse(phase.criterionWeightsJson) } catch { /* ignore */ }
                  list = list.map((c) => (w[c.id] != null ? { ...c, weight: w[c.id] } : c))
                }
              } catch { /* session scoping optional */ }
            }
            if (cancelled) return
            setCriteria(list)
            const init: Record<number, number> = {}
            list.forEach((c) => { init[c.id] = pre[c.id] ?? 5 })
            setScores(init)
          } catch { /* criteria are optional */ }
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.response?.data?.message ?? "Lien d'évaluation invalide ou expiré.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [token])

  const liveTotal = useMemo(
    () => normalized(criteria, (id) => scores[id] ?? 0),
    [criteria, scores],
  )

  const submit = async () => {
    setSubmitting(true)
    try {
      const r = await evaluationApi.submitByToken(token, {
        comment,
        criteriaScores: criteria.map((c) => ({
          criteriaId: c.id,
          criteriaName: c.name,
          score: scores[c.id] ?? 0,
          weight: c.weight ?? 0,
        })),
      })
      setData(r.data)
      setDone(true)
      toast.success('Évaluation envoyée. Merci !')
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Échec de l'envoi")
    } finally {
      setSubmitting(false)
    }
  }

  // ── States ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Shell>
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
          <Loader2 className="h-7 w-7 animate-spin" />
          <p className="text-sm">Chargement de l&apos;évaluation…</p>
        </div>
      </Shell>
    )
  }

  if (error || !data) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="rounded-full bg-rose-500/10 p-3"><AlertTriangle className="h-7 w-7 text-rose-500" /></div>
          <h1 className="text-lg font-bold text-foreground">Évaluation indisponible</h1>
          <p className="max-w-sm text-sm text-muted-foreground">{error ?? 'Lien invalide.'}</p>
        </div>
      </Shell>
    )
  }

  const total = done ? (data.evaluation?.weightedScore ?? liveTotal) : liveTotal

  return (
    <Shell>
      {/* Candidature header */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-brand-500">Grille d&apos;évaluation</p>
        <h1 className="mt-1 text-xl font-bold text-foreground">
          {data.projectName || data.companyName || `Candidature #${data.candidatureId}`}
        </h1>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {data.companyName && data.projectName && <span>{data.companyName}</span>}
          {data.porteurName && <span>· {data.porteurName}</span>}
        </div>
        {data.juryName && (
          <p className="mt-3 text-sm text-muted-foreground">
            Bonjour <span className="font-semibold text-foreground">{data.juryName}</span>, merci d&apos;évaluer
            cette candidature.
          </p>
        )}
      </div>

      {done ? (
        <div className="mt-4 rounded-2xl border border-emerald-300/40 bg-emerald-500/5 p-6 text-center">
          <div className="mx-auto mb-2 w-fit rounded-full bg-emerald-500/15 p-3">
            <CheckCircle2 className="h-7 w-7 text-emerald-500" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Évaluation enregistrée</h2>
          <p className="mt-1 text-sm text-muted-foreground">Merci pour votre contribution.</p>
          {total != null && (
            <p className="mt-4 text-3xl font-extrabold text-emerald-600">{total.toFixed(1)}<span className="text-base font-medium text-muted-foreground">/10</span></p>
          )}
          {(data.evaluation?.criteriaScores?.length ?? 0) > 0 && (
            <div className="mx-auto mt-4 max-w-sm space-y-1.5 text-left">
              {data.evaluation!.criteriaScores!.map((cs) => (
                <div key={cs.criteriaId} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{cs.criteriaName}</span>
                  <span className="font-semibold text-foreground">{cs.score}/10</span>
                </div>
              ))}
            </div>
          )}
          {data.evaluation?.comment && (
            <p className="mx-auto mt-4 max-w-sm rounded-lg bg-card border border-border p-3 text-left text-sm text-muted-foreground italic">
              “{data.evaluation.comment}”
            </p>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {criteria.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
              Aucun critère défini pour ce programme — laissez un commentaire global ci-dessous.
            </div>
          ) : (
            criteria.map((c) => (
              <div key={c.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{c.name}</p>
                    {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
                    {c.weight != null && c.weight > 0 && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">Poids : {Math.round(c.weight * 100)}%</p>
                    )}
                  </div>
                  <span className="flex shrink-0 items-center gap-1 rounded-lg bg-brand-500/10 px-2.5 py-1 text-sm font-bold text-brand-600">
                    <Star className="h-3.5 w-3.5" />{scores[c.id] ?? 0}<span className="text-xs font-normal text-muted-foreground">/10</span>
                  </span>
                </div>
                <input
                  type="range" min={0} max={10} step={1}
                  value={scores[c.id] ?? 0}
                  onChange={(e) => setScores((s) => ({ ...s, [c.id]: Number(e.target.value) }))}
                  className="mt-3 w-full accent-brand-500"
                />
              </div>
            ))
          )}

          <div className="rounded-2xl border border-border bg-card p-4">
            <label className="text-sm font-semibold text-foreground">Commentaire / note finale</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              placeholder="Votre appréciation globale, points forts, réserves…"
              className="mt-2 w-full rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Score pondéré</p>
              <p className="text-2xl font-extrabold text-foreground">
                {liveTotal != null ? liveTotal.toFixed(1) : '—'}<span className="text-sm font-medium text-muted-foreground">/10</span>
              </p>
            </div>
            <button
              onClick={submit}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Envoyer l&apos;évaluation
            </button>
          </div>
        </div>
      )}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/40 to-background px-4 py-10">
      <div className="mx-auto w-full max-w-xl">{children}</div>
    </div>
  )
}
