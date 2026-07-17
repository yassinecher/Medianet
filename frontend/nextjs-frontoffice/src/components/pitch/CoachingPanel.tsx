'use client'
import { useMemo } from 'react'
import {
  ThumbsUp, ThumbsDown, ListChecks, TrendingUp, ShieldCheck, Info, Zap, Play,
  Quote, Target, ArrowRight,
} from 'lucide-react'
import { fmtTime, type Coaching, type CoachingAction, type Confidence } from './types'

/** Effort → how it reads to someone deciding what to do tonight. */
const EFFORT = {
  low:    { label: 'rapide',  hint: 'quelques minutes — à corriger avant la prochaine prise', cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
  medium: { label: 'moyen',   hint: 'quelques heures de travail',                             cls: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300' },
  high:   { label: 'lourd',   hint: 'plusieurs jours ou semaines',                            cls: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300' },
} as const

const EFFORT_RANK = { low: 0, medium: 1, high: 2 } as const

/** Older analyses stored plain strings; normalise both shapes into one. */
const toAction = (a: CoachingAction | string): CoachingAction =>
  typeof a === 'string' ? { action: a } : a

/** Which band the score sits in — the thing a porteur actually wants to cross. */
const BANDS = [
  { min: 9, label: 'exceptionnel' },
  { min: 7, label: 'solide' },
  { min: 5, label: 'moyen' },
  { min: 3, label: 'faible' },
  { min: 0, label: 'inexploitable' },
]
const nextBand = (score: number) => [...BANDS].reverse().find((b) => b.min > score)

/**
 * The coaching report: what to do next, why it matters here, and what it buys.
 *
 * Actions are ranked by return on effort rather than listed flat — a porteur
 * with one evening should be able to read the top card and act on it.
 */
export function CoachingPanel({ coaching, confidence, currentScore, onSeek }: {
  coaching?: Coaching
  confidence?: Confidence
  currentScore?: number
  onSeek?: (t: number) => void
}) {
  const actions = useMemo(() => {
    const list = (coaching?.nextActions ?? []).map(toAction).filter((a) => a.action?.trim())
    // Best return first: points per unit of effort, impact breaking ties.
    return [...list].sort((a, b) => {
      const ea = EFFORT_RANK[a.effort ?? 'medium'], eb = EFFORT_RANK[b.effort ?? 'medium']
      const ra = (a.impactPoints ?? 0) / (ea + 1), rb = (b.impactPoints ?? 0) / (eb + 1)
      if (rb !== ra) return rb - ra
      return (b.impactPoints ?? 0) - (a.impactPoints ?? 0)
    })
  }, [coaching])

  if (!coaching && !confidence) return null

  const after = coaching?.estimatedScoreAfter
  const gain = after != null && currentScore != null ? Math.round((after - currentScore) * 10) / 10 : null
  const totalImpact = actions.reduce((s, a) => s + (a.impactPoints ?? 0), 0)
  // A "quick win" is cheap AND actually worth something.
  const quickWins = actions.filter((a) => a.effort === 'low' && (a.impactPoints ?? 0) >= 0.5)
  const band = currentScore != null ? nextBand(currentScore) : null
  const toBand = band && currentScore != null ? Math.round((band.min - currentScore) * 10) / 10 : null

  return (
    <div className="space-y-3">
      {/* The single most useful sentence: what is between you and the next band */}
      {band && toBand != null && toBand > 0 && (
        <div className="rounded-2xl border border-brand-500/30 bg-brand-500/5 p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-brand-700 dark:text-brand-300">
            <Target className="h-3 w-3" />Objectif
          </p>
          <p className="mt-0.5 text-sm text-foreground">
            Il vous manque <strong className="text-brand-600 dark:text-brand-400">{toBand} point{toBand > 1 ? 's' : ''}</strong> pour
            atteindre <strong>{band.min}/10 — « {band.label} »</strong>.
            {totalImpact > 0 && (
              <> Les actions ci-dessous en valent <strong>{Math.round(totalImpact * 10) / 10}</strong>
                {totalImpact >= toBand ? ' — de quoi y arriver.' : ' — un premier pas.'}</>
            )}
          </p>
        </div>
      )}

      {quickWins.length > 0 && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            <Zap className="h-3 w-3" />À corriger tout de suite
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {quickWins.length} action{quickWins.length > 1 ? 's' : ''} peu coûteuse{quickWins.length > 1 ? 's' : ''} pour{' '}
            <strong className="text-emerald-600 dark:text-emerald-400">
              +{Math.round(quickWins.reduce((s, a) => s + (a.impactPoints ?? 0), 0) * 10) / 10} pts
            </strong>{' '}
            — le meilleur rapport effort/résultat avant votre prochaine prise.
          </p>
        </div>
      )}

      {coaching && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <ListChecks className="h-4 w-4 text-brand-500" />Plan de coaching
          </p>

          <div className="grid gap-2 sm:grid-cols-2">
            {coaching.strengths && coaching.strengths.length > 0 && (
              <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-2.5">
                <p className="mb-1 flex items-center gap-1 text-[11px] font-bold text-green-700 dark:text-green-300"><ThumbsUp className="h-3 w-3" />Points forts</p>
                <ul className="space-y-0.5 text-[11px] text-muted-foreground">
                  {coaching.strengths.filter(Boolean).map((s, i) => <li key={i}>• {s}</li>)}
                </ul>
              </div>
            )}
            {coaching.weaknesses && coaching.weaknesses.length > 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-2.5">
                <p className="mb-1 flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-300"><ThumbsDown className="h-3 w-3" />À renforcer</p>
                <ul className="space-y-0.5 text-[11px] text-muted-foreground">
                  {coaching.weaknesses.filter(Boolean).map((s, i) => <li key={i}>• {s}</li>)}
                </ul>
              </div>
            )}
          </div>

          {actions.length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 flex items-baseline gap-1.5 text-[11px] font-bold text-foreground">
                Prochaines actions
                <span className="font-normal text-muted-foreground">— du meilleur rendement au moindre</span>
              </p>
              <ol className="space-y-2">
                {actions.map((a, i) => {
                  const eff = EFFORT[a.effort ?? 'medium']
                  return (
                    <li key={i} className="rounded-xl border border-border p-2.5 transition-colors hover:border-brand-400/60">
                      <div className="flex items-start gap-2">
                        <span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[9px] font-bold text-white">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] font-medium leading-snug text-foreground">{a.action}</p>

                          {/* Why it matters HERE — the evidence, not generic advice */}
                          {a.why && (
                            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{a.why}</p>
                          )}

                          {/* A ready-to-say replacement beats an abstract instruction */}
                          {a.example && (
                            <p className="mt-1.5 flex items-start gap-1 rounded-lg bg-muted/60 p-1.5 text-[11px] italic text-foreground">
                              <Quote className="mt-0.5 h-2.5 w-2.5 shrink-0 text-brand-500" />
                              <span>« {a.example} »</span>
                            </p>
                          )}

                          <div className="mt-1.5 flex flex-wrap items-center gap-1">
                            {a.impactPoints != null && a.impactPoints > 0 && (
                              <span className="inline-flex items-center gap-0.5 rounded-full border border-brand-500/30 bg-brand-500/10 px-1.5 py-0.5 text-[9px] font-bold text-brand-700 dark:text-brand-300"
                                title="Gain estimé sur la note globale">
                                <TrendingUp className="h-2.5 w-2.5" />+{a.impactPoints} pt{a.impactPoints > 1 ? 's' : ''}
                              </span>
                            )}
                            <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${eff.cls}`} title={eff.hint}>
                              effort {eff.label}
                            </span>
                            {a.criterion && (
                              <span className="inline-flex items-center gap-0.5 rounded-full border border-border bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
                                <ArrowRight className="h-2.5 w-2.5" />{a.criterion}
                              </span>
                            )}
                            {a.atSec != null && onSeek && (
                              <button type="button" onClick={() => onSeek(Math.max(0, a.atSec! - 1))}
                                title="Revoir ce moment dans la vidéo"
                                className="inline-flex items-center gap-0.5 rounded-full border border-border px-1.5 py-0.5 text-[9px] font-medium text-brand-600 transition-colors hover:bg-accent dark:text-brand-400">
                                <Play className="h-2.5 w-2.5" />{fmtTime(a.atSec)}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ol>
            </div>
          )}

          {after != null && (
            <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-2.5">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 shrink-0 text-emerald-500" />
                <p className="text-[11px] text-muted-foreground">
                  Score estimé si tout est appliqué :
                  <span className="ml-1 text-sm font-black text-emerald-600 dark:text-emerald-400">{after}/10</span>
                  {gain != null && gain > 0 && <span className="ml-1 font-semibold text-emerald-600 dark:text-emerald-400">(+{gain})</span>}
                </p>
              </div>
              {currentScore != null && (
                // Current score vs projected, on one 0-10 track.
                <div className="relative mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="absolute inset-y-0 left-0 rounded-full bg-emerald-500/30" style={{ width: `${(after / 10) * 100}%` }} />
                  <div className="absolute inset-y-0 left-0 rounded-full bg-brand-500" style={{ width: `${(currentScore / 10) * 100}%` }} />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {confidence && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-brand-500" />
            <p className="text-sm font-semibold text-foreground">Fiabilité de l’analyse</p>
            {confidence.score != null && (
              <span className="ml-auto text-lg font-black tabular-nums text-brand-600 dark:text-brand-400">
                {Math.round(confidence.score * 100)}%
              </span>
            )}
          </div>
          {confidence.score != null && (
            <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-brand-500" style={{ width: `${confidence.score * 100}%` }} />
            </div>
          )}
          {confidence.reasons && confidence.reasons.length > 0 && (
            <ul className="space-y-0.5 text-[11px] text-muted-foreground">
              {confidence.reasons.filter(Boolean).map((r, i) => <li key={i}>✓ {r}</li>)}
            </ul>
          )}
          {confidence.limits && confidence.limits.length > 0 && (
            <div className="mt-1.5 rounded-lg bg-muted/50 p-1.5">
              <p className="flex items-start gap-1 text-[10px] text-muted-foreground">
                <Info className="mt-0.5 h-3 w-3 shrink-0" />
                <span><span className="font-semibold">Limites :</span> {confidence.limits.filter(Boolean).join(' · ')}</span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
