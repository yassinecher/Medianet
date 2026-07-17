'use client'
import { useState } from 'react'
import { Brain, Check, Loader2, AlertTriangle, X, ChevronDown, ChevronUp } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Stage } from './types'

/**
 * Live view of what the AI is genuinely doing — each line is a real pipeline
 * stage reported by the backend (transcription, élocution, vision, criteria,
 * LLM), with its real result. No fake progress.
 */
export function AIThinkingPanel({ stages, running, onClose }: {
  stages: Stage[]
  running: boolean
  onClose?: () => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  if (!stages.length && !running) return null
  const doneCount = stages.filter((s) => s.status !== 'running').length
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
        className="fixed bottom-4 right-4 z-50 w-[22rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-border
                   bg-card/85 p-3 shadow-2xl backdrop-blur-xl">
        <div className="mb-2 flex items-center gap-2">
          <span className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-purple-600">
            <Brain className="h-3.5 w-3.5 text-white" />
            {running && <span className="absolute inset-0 animate-ping rounded-lg bg-brand-500/40" />}
          </span>
          <div className="flex-1">
            <p className="text-xs font-bold text-foreground">Medi analyse votre pitch</p>
            <p className="text-[10px] text-muted-foreground">
              {running ? `en cours… (${doneCount}/${stages.length} étapes)` : 'terminé'}
            </p>
          </div>
          {/* Always collapsible/closable — a stuck stage must never trap the panel. */}
          <button onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? 'Déplier' : 'Replier'}
            aria-expanded={!collapsed} className="rounded p-1 text-muted-foreground hover:bg-accent">
            {collapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {onClose && (
            <button onClick={onClose} aria-label="Fermer" className="rounded p-1 text-muted-foreground hover:bg-accent">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <ol className={`space-y-1.5 ${collapsed ? 'hidden' : ''}`}>
          {stages.map((s, i) => (
            <motion.li key={`${s.step}-${i}`} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
              className="flex items-start gap-2">
              <span className="mt-0.5">
                {s.status === 'running' ? <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-500" />
                  : s.status === 'done' ? <Check className="h-3.5 w-3.5 text-emerald-500" />
                  : s.status === 'warn' ? <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  : <X className="h-3.5 w-3.5 text-red-500" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-[11px] ${s.status === 'running' ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                  {s.label}
                </span>
                {s.detail && <span className="block truncate text-[10px] text-muted-foreground/70">{s.detail}</span>}
                {/* Live countdown — ETA is learned from real past runs. */}
                {s.status === 'running' && s.etaSec != null && (
                  <span className="mt-1 block">
                    <span className="flex items-center justify-between text-[9px] text-muted-foreground">
                      <span>{s.remainingSec != null && s.remainingSec > 0
                        ? `≈ ${Math.ceil(s.remainingSec)}s restantes`
                        : 'presque terminé…'}</span>
                      <span className="tabular-nums">{s.elapsedSec != null ? `${Math.round(s.elapsedSec)}s / ~${Math.round(s.etaSec)}s` : `~${Math.round(s.etaSec)}s`}</span>
                    </span>
                    <span className="mt-0.5 block h-1 w-full overflow-hidden rounded-full bg-muted">
                      <span className="block h-full rounded-full bg-brand-500 transition-[width] duration-1000"
                        style={{ width: `${Math.min(99, s.percent ?? 0)}%` }} />
                    </span>
                  </span>
                )}
              </span>
            </motion.li>
          ))}
        </ol>
      </motion.div>
    </AnimatePresence>
  )
}
