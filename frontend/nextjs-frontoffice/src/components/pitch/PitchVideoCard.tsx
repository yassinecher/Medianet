'use client'
import Link from 'next/link'
import { useMemo } from 'react'
import {
  Sparkles, Trophy, Dumbbell, Loader2, AlertTriangle, Clock, ArrowRight, AudioLines, Video,
} from 'lucide-react'
import type { PitchSubmission } from '@/lib/api'
import { parseAnalysis, scoreTone, scoreBg } from '@/lib/pitch-analytics'
import { formatDate } from '@/lib/utils'

const fmtDur = (s?: number | null) => {
  if (!s) return null
  const m = Math.floor(s / 60)
  return m > 0 ? `${m} min ${String(Math.floor(s % 60)).padStart(2, '0')}` : `${Math.floor(s)}s`
}

/**
 * One video, summarised. Deliberately a SUMMARY that links onward — the full
 * analysis lives at /presentations/[id]; inlining it here is what made the list
 * unreadable.
 */
export function PitchVideoCard({ sub, index }: { sub: PitchSubmission; index?: number }) {
  const analysis = useMemo(() => parseAnalysis(sub), [sub])
  const isFinal = sub.kind === 'FINAL'
  const outOfContext = !!analysis && (analysis.outOfContext === true || analysis.pitchFormat === 'NOT_A_PITCH')
  // An out-of-context clip has a score, but it's meaningless — never surface it.
  const score = outOfContext ? null : (sub.aiScore ?? null)
  const fillers = analysis?.delivery?.fillerSoundsPerMin
  const weakest = useMemo(() => {
    const dims = analysis?.dimensions ?? []
    if (!dims.length) return null
    return [...dims].sort((a, b) => a.score - b.score)[0]
  }, [analysis])

  const busy = sub.status === 'PROCESSING'
  const failed = sub.status === 'FAILED'

  return (
    <Link href={`/presentations/${sub.id}`}
      className="group block rounded-xl border border-border bg-card p-3 transition-colors hover:border-brand-400 hover:bg-accent/40">
      <div className="flex items-start gap-3">
        {/* Score badge — the thing you scan for */}
        <div className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border ${
          outOfContext ? 'border-amber-500/40 bg-amber-500/10' : `border-border ${score != null ? 'bg-muted' : 'bg-muted/40'}`}`}>
          {outOfContext ? <AlertTriangle className="h-5 w-5 text-amber-500" />
            : score != null ? (
            <>
              <span className={`text-lg font-black leading-none ${scoreTone(score)}`}>{score}</span>
              <span className="text-[9px] text-muted-foreground">/ 10</span>
            </>
          ) : busy ? <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
            : failed ? <AlertTriangle className="h-5 w-5 text-red-500" />
            : <Video className="h-5 w-5 text-muted-foreground/50" />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {isFinal ? (
              <span className="flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-300">
                <Trophy className="h-3 w-3" />Pitch final
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-300">
                <Dumbbell className="h-3 w-3" />Essai {index ?? ''}
              </span>
            )}
            {sub.durationSeconds ? (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <Clock className="h-2.5 w-2.5" />{fmtDur(sub.durationSeconds)}
              </span>
            ) : null}
            {sub.updatedAt && <span className="text-[10px] text-muted-foreground">· {formatDate(sub.updatedAt)}</span>}
          </div>

          {score != null && (
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className={`h-full rounded-full ${scoreBg(score)}`} style={{ width: `${(score / 10) * 100}%` }} />
            </div>
          )}

          {outOfContext && (
            <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-2.5 w-2.5" />Hors contexte — ce n’est pas un pitch
            </p>
          )}

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
            {!outOfContext && fillers != null && (
              <span className={`inline-flex items-center gap-0.5 rounded-full border border-border px-1.5 py-0.5 ${
                fillers >= 3 ? 'text-red-600 dark:text-red-400' : fillers >= 1 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                <AudioLines className="h-2.5 w-2.5" />{fillers} tics/min
              </span>
            )}
            {!outOfContext && weakest && (
              <span className="rounded-full border border-border px-1.5 py-0.5 text-muted-foreground">
                à travailler : {weakest.name} ({weakest.score}/10)
              </span>
            )}
            {busy && <span className="text-purple-600 dark:text-purple-400">analyse en cours…</span>}
            {failed && <span className="text-red-500">analyse échouée — rouvrez pour réessayer</span>}
            {!analysis && !busy && !failed && <span className="text-muted-foreground">pas encore analysée</span>}
          </div>
        </div>

        <span className="flex items-center gap-0.5 self-center text-[10px] font-medium text-brand-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-brand-400">
          <Sparkles className="h-3 w-3" />Analyse<ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </Link>
  )
}
