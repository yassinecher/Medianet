import * as React from 'react'
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * A single KPI tile — label, value, optional icon and trend. Replaces the
 * ad-hoc `text-2xl font-bold in a bordered box` clusters with one consistent,
 * accessible metric card. Use in a grid: `grid gap-3 sm:grid-cols-2 xl:grid-cols-4`.
 */
export interface StatCardProps {
  label: React.ReactNode
  value: React.ReactNode
  icon?: LucideIcon
  /** Signed percentage/point change; sign drives the up/down colour + arrow. */
  trend?: number
  /** Small caption under the value (e.g. "vs. mois dernier"). */
  hint?: React.ReactNode
  /** Accent tone for the icon tile. */
  tone?: 'brand' | 'emerald' | 'amber' | 'rose' | 'sky' | 'violet'
  className?: string
}

const TONE: Record<NonNullable<StatCardProps['tone']>, string> = {
  brand: 'bg-brand-500/10 text-brand-600 dark:text-brand-400',
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
}

export function StatCard({ label, value, icon: Icon, trend, hint, tone = 'brand', className }: StatCardProps) {
  const up = typeof trend === 'number' && trend >= 0
  return (
    <div className={cn('rounded-xl border border-border bg-card p-4', className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {Icon && (
          <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', TONE[tone])}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className="mt-1.5 text-2xl font-bold text-foreground">{value}</p>
      <div className="mt-0.5 flex items-center gap-1.5">
        {typeof trend === 'number' && (
          <span className={cn('inline-flex items-center gap-0.5 text-xs font-semibold',
            up ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
            {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(trend)}%
          </span>
        )}
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
    </div>
  )
}
