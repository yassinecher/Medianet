'use client'
import { Check, X, Target, Lightbulb, TrendingUp } from 'lucide-react'
import type { CriterionMapping } from './types'

/**
 * Official programme criteria, each with what the AI found, what's missing, why
 * points were lost and how many are recoverable.
 */
export function CriterionCards({ criteria }: { criteria: CriterionMapping[] }) {
  if (!criteria?.length) return null
  return (
    <div className="space-y-2">
      {criteria.map((c, i) => {
        const max = Number(c.maxScore ?? c.weight ?? 0)
        const got = Number(c.aiScore ?? 0)
        const pct = max > 0 ? Math.min(100, (got / max) * 100) : 0
        const tone = pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-brand-500' : pct >= 30 ? 'bg-amber-500' : 'bg-red-500'
        return (
          <div key={i} className="rounded-xl border border-border bg-card p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Target className="h-3.5 w-3.5 text-brand-500" />
              <p className="text-sm font-semibold text-foreground">{c.name}</p>
              {c.weight != null && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">poids {c.weight}</span>}
              <span className="ml-auto text-sm font-black tabular-nums text-foreground">
                {c.aiScore ?? '—'}<span className="text-xs font-medium text-muted-foreground">/{c.maxScore ?? c.weight ?? '—'}</span>
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
            </div>

            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {c.evidenceFound && c.evidenceFound.length > 0 && (
                <div>
                  <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-green-700 dark:text-green-400">Preuves trouvées</p>
                  <ul className="space-y-0.5">
                    {c.evidenceFound.map((e, j) => (
                      <li key={j} className="flex items-start gap-1 text-[11px] text-muted-foreground">
                        <Check className="mt-0.5 h-2.5 w-2.5 shrink-0 text-green-500" />{e}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {c.evidenceMissing && c.evidenceMissing.length > 0 && (
                <div>
                  <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700 dark:text-red-400">Preuves manquantes</p>
                  <ul className="space-y-0.5">
                    {c.evidenceMissing.map((e, j) => (
                      <li key={j} className="flex items-start gap-1 text-[11px] text-muted-foreground">
                        <X className="mt-0.5 h-2.5 w-2.5 shrink-0 text-red-500" />{e}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {c.advice && (
              <p className="mt-2 flex items-start gap-1 rounded-lg bg-brand-500/5 p-1.5 text-[11px] text-brand-700 dark:text-brand-300">
                <Lightbulb className="mt-0.5 h-3 w-3 shrink-0" />{c.advice}
              </p>
            )}
            {c.recoverablePoints ? (
              <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="h-3 w-3" />+{c.recoverablePoints} point(s) récupérable(s) en appliquant ce conseil
              </p>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
