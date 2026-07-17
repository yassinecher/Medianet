'use client'
import { useMemo, useState } from 'react'
import { LayoutList, AlertTriangle } from 'lucide-react'
import { fmtTime, type Section } from './types'

/** Colour ramp by section quality — reads in light and dark. */
const barColor = (score?: number | null) =>
  score == null ? 'bg-slate-400/70'
    : score >= 8 ? 'bg-emerald-500'
    : score >= 6 ? 'bg-brand-500'
    : score >= 4 ? 'bg-amber-500'
    : 'bg-red-500'

interface Row {
  name: string
  start: number
  end: number
  dur: number
  share: number
  score?: number | null
  missing: string[]
  gap: boolean
}

/**
 * Repair whatever the model returned before drawing it.
 *
 * Sections are free-form LLM output: they arrive with nulls, zero-length spans,
 * ends past the video, overlaps and holes (one real pitch covered only 84% of
 * its runtime). Drawing that raw produced a broken, misleading chart.
 */
function buildRows(sections: Section[], duration: number): { rows: Row[]; coverage: number; total: number } {
  const total = duration > 0
    ? duration
    : Math.max(1, ...sections.map((s) => Number(s.endSec) || 0))

  const clean = sections
    .map((s) => {
      const start = Math.max(0, Math.min(total, Number(s.startSec) || 0))
      const rawEnd = Number(s.endSec)
      const end = Math.max(start, Math.min(total, Number.isFinite(rawEnd) ? rawEnd : start))
      const missing = Array.isArray(s.missing)
        ? s.missing.map((m) => String(m ?? '').trim()).filter(Boolean)
        : typeof s.missing === 'string' && String(s.missing).trim()
          ? [String(s.missing).trim()]
          : []
      return { name: String(s.name ?? '').trim(), start, end, score: s.score, missing }
    })
    // A section with no name or no duration cannot be shown or seeked to.
    .filter((s) => s.name && s.end > s.start)
    .sort((a, b) => a.start - b.start)

  const rows: Row[] = []
  let cursor = 0
  let covered = 0
  for (const s of clean) {
    // Surface the holes instead of leaving an unexplained blank in the chart —
    // dead air the pitch never accounted for is itself a structural finding.
    if (s.start > cursor + 2) {
      const dur = s.start - cursor
      rows.push({ name: 'Non couvert', start: cursor, end: s.start, dur,
        share: dur / total, score: null, missing: [], gap: true })
    }
    const start = Math.max(s.start, cursor) // clip overlaps so shares still sum to <=100%
    const dur = Math.max(0, s.end - start)
    if (dur > 0) {
      rows.push({ name: s.name, start, end: s.end, dur, share: dur / total,
        score: s.score, missing: s.missing, gap: false })
      covered += dur
    }
    cursor = Math.max(cursor, s.end)
  }
  if (total - cursor > 2) {
    const dur = total - cursor
    rows.push({ name: 'Non couvert', start: cursor, end: total, dur,
      share: dur / total, score: null, missing: [], gap: true })
  }
  return { rows, coverage: total > 0 ? covered / total : 0, total }
}

/** @internal — exported for unit tests only. */
export const __test_buildRows = buildRows

/**
 * Presentation balance: how long the pitch spent on each section, how good it
 * was, and what's missing. Clicking anything jumps to that part of the video.
 */
export function TimelineIntelligence({ sections, duration, onSeek, currentTime }: {
  sections: Section[]
  duration: number
  onSeek: (t: number) => void
  currentTime?: number
}) {
  const [hover, setHover] = useState<number | null>(null)
  const { rows, coverage, total } = useMemo(
    () => buildRows(sections ?? [], duration), [sections, duration],
  )
  // If nothing survived the repair, the only rows left are "Non couvert" filler:
  // a panel saying 100% uncovered is noise, so show nothing at all.
  if (!rows.some((r) => !r.gap)) return null

  const longest = rows.filter((r) => !r.gap).reduce<Row | null>((a, r) => (!a || r.dur > a.dur ? r : a), null)
  const isActive = (r: Row) => currentTime != null && currentTime >= r.start && currentTime < r.end

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <LayoutList className="h-4 w-4 text-brand-500" />Structure & équilibre du pitch
      </p>
      <p className="mb-3 text-[11px] text-muted-foreground">
        Part du temps consacrée à chaque section — repérez d’un coup d’œil ce qui est survolé ou absent.
      </p>

      {/* One ribbon = the whole video, each block proportional to its share.
          This is the balance view; the rows below give the detail. */}
      <div className="mb-1 flex h-6 w-full overflow-hidden rounded-lg border border-border">
        {rows.map((r, i) => (
          <button key={i} type="button" onClick={() => onSeek(r.start)}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            title={`${r.name} — ${fmtTime(r.dur)} (${Math.round(r.share * 100)}%) · dès ${fmtTime(r.start)}`}
            aria-label={`Aller à ${r.name} à ${fmtTime(r.start)}`}
            style={{ width: `${Math.max(1, r.share * 100)}%` }}
            className={`h-full border-r border-card/40 last:border-r-0 transition-opacity ${
              r.gap ? 'bg-[repeating-linear-gradient(45deg,transparent,transparent_3px,rgb(148_163_184/.5)_3px,rgb(148_163_184/.5)_6px)]'
                    : barColor(r.score)
            } ${hover != null && hover !== i ? 'opacity-40' : ''} ${isActive(r) ? 'ring-2 ring-inset ring-white/70' : ''}`} />
        ))}
      </div>
      <div className="mb-3 flex justify-between text-[9px] tabular-nums text-muted-foreground">
        <span>00:00</span><span>{fmtTime(total)}</span>
      </div>

      {coverage < 0.85 && (
        <p className="mb-2 flex items-start gap-1 rounded-lg border border-amber-500/30 bg-amber-500/5 p-1.5 text-[10px] text-amber-700 dark:text-amber-300">
          <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
          {Math.round((1 - coverage) * 100)}% du temps n’appartient à aucune section identifiable
          (digressions ou temps mort) — resserrez le fil du pitch.
        </p>
      )}

      {/* Detail rows. The bar is a SHARE of total time (left-aligned), not a
          position on a timeline: one near-empty track per section was what made
          this panel look broken. Position is what the ribbon above is for. */}
      <div className="space-y-2">
        {rows.map((r, i) => {
          const active = isActive(r)
          return (
            <div key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
              className={`rounded-lg px-1.5 py-1 transition-colors ${hover === i ? 'bg-accent/50' : ''}`}>
              <div className="mb-0.5 flex items-baseline justify-between gap-2 text-[11px]">
                <span className={`truncate font-medium ${
                  r.gap ? 'italic text-muted-foreground'
                        : active ? 'text-brand-600 dark:text-brand-400' : 'text-foreground'}`}>
                  {r.name}
                  {r === longest && !r.gap && (
                    <span className="ml-1 rounded-full bg-muted px-1 py-px text-[8px] font-bold uppercase text-muted-foreground">
                      section la plus longue
                    </span>
                  )}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {fmtTime(r.dur)} · {Math.round(r.share * 100)}%
                  {r.score != null && <> · <span className="font-bold">{r.score}/10</span></>}
                </span>
              </div>
              <button type="button" onClick={() => onSeek(r.start)}
                aria-label={`Aller à ${r.name} (${fmtTime(r.start)})`}
                className="relative block h-2 w-full overflow-hidden rounded-full bg-muted">
                <span className={`absolute inset-y-0 left-0 rounded-full ${
                    r.gap ? 'bg-slate-400/50' : barColor(r.score)} ${active ? 'ring-1 ring-brand-400' : ''}`}
                  style={{ width: `${Math.max(1.5, r.share * 100)}%` }} />
              </button>
              {r.missing.length > 0 && (
                <p className="mt-0.5 text-[10px] text-amber-600 dark:text-amber-400">
                  Manque : {r.missing.join(' · ')}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
