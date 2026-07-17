/**
 * Aggregations behind the presentation analytics (global / programme / phase).
 *
 * Pure functions over PitchSubmission[] — every level of the hierarchy shows the
 * same numbers computed the same way, so a score on the global page always
 * reconciles with the phase it came from.
 */
import type { PitchSubmission } from '@/lib/api'
import type { PitchAnalysis, Delivery, Dimension } from '@/components/pitch/types'

export interface DimensionStat { name: string; avg: number; best: number; worst: number; n: number }

export interface TrendPoint {
  id: number
  score: number
  kind: 'TRAINING' | 'FINAL'
  at?: string
  label: string
}

export interface PitchStats {
  total: number
  analyzed: number
  training: number
  finals: number
  /** Mean score over analyzed videos. */
  avgScore: number | null
  bestScore: number | null
  /** Score of the most recent analyzed video. */
  latestScore: number | null
  /** Latest training score minus the first — the actual progress made. */
  improvement: number | null
  dimensions: DimensionStat[]
  strongest: DimensionStat | null
  weakest: DimensionStat | null
  /** Averages of the measured delivery signals (only over videos that have them). */
  delivery: {
    fillerSoundsPerMin: number | null
    hedgesPerMin: number | null
    wordsPerMinute: number | null
    speakingRatio: number | null
    loudnessLufs: number | null
  }
  trend: TrendPoint[]
}

export const parseAnalysis = (s: PitchSubmission): PitchAnalysis | null => {
  if (!s.aiAnalysisJson) return null
  try { return JSON.parse(s.aiAnalysisJson) as PitchAnalysis } catch { return null }
}

const round1 = (n: number) => Math.round(n * 10) / 10
const mean = (xs: number[]) => (xs.length ? round1(xs.reduce((a, b) => a + b, 0) / xs.length) : null)

/** Oldest first. Falls back to id when timestamps are missing or equal. */
export const chronological = (subs: PitchSubmission[]) =>
  [...subs].sort((a, b) => {
    const ta = Date.parse(a.analyzedAt ?? a.updatedAt ?? '') || 0
    const tb = Date.parse(b.analyzedAt ?? b.updatedAt ?? '') || 0
    return ta !== tb ? ta - tb : a.id - b.id
  })

/** Average one numeric delivery field across every video that measured it. */
const avgDelivery = (list: PitchAnalysis[], key: keyof Delivery): number | null => {
  const vals = list
    .map((a) => a.delivery?.[key])
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  return mean(vals)
}

export function computeStats(subs: PitchSubmission[]): PitchStats {
  const ordered = chronological(subs)
  const analyzedSubs = ordered.filter((s) => s.aiScore != null)
  const analyses = analyzedSubs.map(parseAnalysis).filter((a): a is PitchAnalysis => !!a)
  const scores = analyzedSubs.map((s) => s.aiScore as number)

  // Per-dimension roll-up, keyed by the dimension name the model returns.
  const byName = new Map<string, number[]>()
  for (const a of analyses) {
    for (const d of (a.dimensions ?? []) as Dimension[]) {
      if (!d?.name || typeof d.score !== 'number') continue
      const arr = byName.get(d.name) ?? []
      arr.push(d.score)
      byName.set(d.name, arr)
    }
  }
  const dimensions: DimensionStat[] = [...byName.entries()].map(([name, xs]) => ({
    name,
    avg: mean(xs) as number,
    best: Math.max(...xs),
    worst: Math.min(...xs),
    n: xs.length,
  }))
  const ranked = [...dimensions].sort((a, b) => a.avg - b.avg)

  // Progress = latest training vs first training. Needs two analyzed trainings,
  // otherwise there is no "before" to compare against and we show nothing.
  const trainings = analyzedSubs.filter((s) => s.kind === 'TRAINING')
  const improvement = trainings.length >= 2
    ? round1((trainings[trainings.length - 1].aiScore as number) - (trainings[0].aiScore as number))
    : null

  // Number the finals too when several are in scope (the global page spans
  // phases): two points both labelled "Final" are impossible to tell apart.
  const finalCount = analyzedSubs.filter((s) => s.kind === 'FINAL').length
  let tIdx = 0, fIdx = 0
  const trend: TrendPoint[] = analyzedSubs.map((s) => {
    const isFinal = s.kind === 'FINAL'
    if (isFinal) fIdx++; else tIdx++
    return {
      id: s.id,
      score: s.aiScore as number,
      kind: isFinal ? 'FINAL' : 'TRAINING',
      at: s.analyzedAt ?? s.updatedAt,
      label: isFinal ? (finalCount > 1 ? `Final ${fIdx}` : 'Final') : `Essai ${tIdx}`,
    }
  })

  return {
    total: subs.length,
    analyzed: analyzedSubs.length,
    training: subs.filter((s) => s.kind === 'TRAINING').length,
    finals: subs.filter((s) => s.kind === 'FINAL').length,
    avgScore: mean(scores),
    bestScore: scores.length ? Math.max(...scores) : null,
    latestScore: scores.length ? scores[scores.length - 1] : null,
    improvement,
    dimensions,
    strongest: ranked.length ? ranked[ranked.length - 1] : null,
    weakest: ranked.length ? ranked[0] : null,
    delivery: {
      fillerSoundsPerMin: avgDelivery(analyses, 'fillerSoundsPerMin'),
      hedgesPerMin: avgDelivery(analyses, 'hedgesPerMin'),
      wordsPerMinute: avgDelivery(analyses, 'wordsPerMinute'),
      speakingRatio: avgDelivery(analyses, 'speakingRatio'),
      loudnessLufs: avgDelivery(analyses, 'integratedLoudnessLufs'),
    },
    trend,
  }
}

/** Flatten the sessions payload of one programme into a plain submission list. */
export const submissionsOf = (sessions: { submissions?: PitchSubmission[] }[]): PitchSubmission[] =>
  sessions.flatMap((s) => s.submissions ?? [])

/** Verdict colouring for a score out of 10 — shared by every level. */
export const scoreTone = (score: number | null | undefined) =>
  score == null ? 'text-muted-foreground'
    : score >= 7 ? 'text-emerald-600 dark:text-emerald-400'
    : score >= 5 ? 'text-amber-600 dark:text-amber-400'
    : 'text-red-600 dark:text-red-400'

export const scoreBg = (score: number | null | undefined) =>
  score == null ? 'bg-muted-foreground/40'
    : score >= 7 ? 'bg-emerald-500'
    : score >= 5 ? 'bg-amber-500'
    : 'bg-red-500'
