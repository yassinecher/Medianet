'use client'
import { Lightbulb, Play, Target } from 'lucide-react'
import { fmtTime, SEVERITY_STYLE, type Highlight } from './types'

/**
 * AI findings as cards. Each maps to a programme criterion, carries its score
 * impact and confidence, and jumps the video to the exact moment when clicked.
 */
export function HighlightsPanel({ highlights, onSeek, activeTime }: {
  highlights: Highlight[]
  onSeek: (t: number) => void
  activeTime?: number
}) {
  if (!highlights?.length) return null
  return (
    <div className="space-y-2">
      {highlights.slice().sort((a, b) => a.timeSec - b.timeSec).map((h, i) => {
        const st = SEVERITY_STYLE[h.severity] ?? SEVERITY_STYLE.medium
        const near = activeTime != null && Math.abs(activeTime - h.timeSec) < 3
        return (
          <button key={i} type="button" onClick={() => onSeek(h.timeSec)}
            className={`w-full rounded-xl border p-3 text-left transition-all hover:shadow-md ${
              near ? 'border-brand-500 bg-brand-500/5 ring-1 ring-brand-500/30' : 'border-border bg-card hover:border-brand-400'}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1 rounded-md bg-black/80 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                <Play className="h-2.5 w-2.5" />{fmtTime(h.timeSec)}
              </span>
              <span className="text-sm font-semibold text-foreground">{h.topic}</span>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${st.chip}`}>{st.label}</span>
              {h.scoreImpact != null && h.scoreImpact !== 0 && (
                <span className={`ml-auto text-xs font-bold tabular-nums ${h.scoreImpact < 0 ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                  {h.scoreImpact > 0 ? '+' : ''}{h.scoreImpact}%
                </span>
              )}
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{h.observation}</p>
            {h.advice && (
              <p className="mt-1.5 flex items-start gap-1 rounded-lg bg-brand-500/5 p-1.5 text-[11px] text-brand-700 dark:text-brand-300">
                <Lightbulb className="mt-0.5 h-3 w-3 shrink-0" />{h.advice}
              </p>
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
              {h.criterion && <span className="flex items-center gap-1"><Target className="h-2.5 w-2.5" />{h.criterion}</span>}
              {h.confidence != null && <span>· confiance {Math.round(h.confidence * 100)}%</span>}
            </div>
          </button>
        )
      })}
    </div>
  )
}
