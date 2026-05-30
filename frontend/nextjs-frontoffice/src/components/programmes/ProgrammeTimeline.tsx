'use client'
import { motion } from 'framer-motion'
import { CheckCircle2, Circle, Clock, Lock } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import type { Phase } from '@/types'

export function ProgrammeTimeline({ phases }: { phases: Phase[] }) {
  const sorted = [...phases].sort((a, b) => a.phaseOrder - b.phaseOrder)
  const now = new Date()

  const state = (p: Phase) => {
    if (!p.startDate) return 'locked'
    const s = new Date(p.startDate), e = p.endDate ? new Date(p.endDate) : null
    if (e && now > e) return 'completed'
    if (now >= s) return 'active'
    return 'upcoming'
  }

  const icons = { completed: CheckCircle2, active: Clock, upcoming: Circle, locked: Lock }
  const colors = { completed: 'text-emerald-500 border-emerald-500', active: 'text-brand-500 border-brand-500 shadow-md shadow-brand-500/30', upcoming: 'text-muted-foreground border-muted-foreground/30', locked: 'text-muted-foreground/40 border-muted-foreground/20' }

  return (
    <div className="space-y-0">
      {sorted.map((phase, i) => {
        const s = state(phase)
        const Icon = icons[s]
        const isLast = i === sorted.length - 1
        return (
          <motion.div key={phase.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 bg-background', colors[s])}>
                <Icon className="h-4 w-4" />
              </div>
              {!isLast && <div className="mt-1 w-0.5 flex-1 bg-border" style={{ minHeight: 28 }} />}
            </div>
            <div className={cn('pb-8 min-w-0', isLast && 'pb-0')}>
              <div className={cn('rounded-xl border p-4', s === 'active' ? 'border-brand-500/30 bg-brand-500/5' : 'border-border bg-card')}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-foreground">{phase.name}</p>
                  {s === 'active' && (
                    <span className="flex items-center gap-1 rounded-full bg-brand-500/10 px-2 py-0.5 text-xs font-medium text-brand-600 dark:text-brand-400">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />En cours
                    </span>
                  )}
                </div>
                {phase.description && <p className="mt-1 text-sm text-muted-foreground">{phase.description}</p>}
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {phase.startDate && <span>Début : {formatDate(phase.startDate)}</span>}
                  {phase.endDate && <span>Fin : {formatDate(phase.endDate)}</span>}
                </div>
              </div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
