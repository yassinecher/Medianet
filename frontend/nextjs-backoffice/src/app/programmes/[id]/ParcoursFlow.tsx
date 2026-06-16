'use client'
/**
 * Programme dashboard → session-driven status pipeline (fully automatic).
 *
 * The ordered top-level sessions form a chained flow (e.g. Candidature →
 * Présélection → Pitch Day → Incubation → Demo Day). The current stage is
 * derived live from dates (today inside a session's window) — the schedule
 * advances by itself as time passes; there is no manual override.
 */
import { CalendarRange, CalendarDays, ChevronRight, Check } from 'lucide-react'

interface Phase {
  id?: number
  title?: string
  startDate?: string
  endDate?: string
  color?: string
  durationKind?: string
  parentSessionId?: number | null
}

const parseD = (s?: string) => (s ? new Date(s + 'T12:00:00') : null)
const floor = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const today0 = () => floor(new Date())
const fmtShort = (s?: string) => { const d = parseD(s); return d ? d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—' }

type StageState = 'done' | 'current' | 'upcoming'

function stageState(p: Phase): StageState {
  const sd = parseD(p.startDate)
  if (!sd) return 'upcoming'
  const ed = parseD(p.endDate ?? p.startDate) ?? sd
  const t = today0().getTime()
  if (t < floor(sd).getTime()) return 'upcoming'
  if (t > floor(ed).getTime()) return 'done'
  return 'current'
}

export function ParcoursFlow({ phases }: { phases: Phase[] }) {
  const stages = [...phases]
    .filter(p => p.parentSessionId == null && p.startDate)
    .sort((a, b) => (parseD(a.startDate)?.getTime() ?? 0) - (parseD(b.startDate)?.getTime() ?? 0))

  if (stages.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-border bg-muted/10 p-5 text-center text-sm text-muted-foreground">
        Aucune session datée. Ajoutez des sessions dans le Parcours pour activer le flux d&apos;étapes.
      </div>
    )
  }

  const currentIdx = stages.findIndex(s => stageState(s) === 'current')
  const flowLabel = currentIdx >= 0
    ? `Étape actuelle : ${stages[currentIdx].title || 'Sans titre'}`
    : today0().getTime() < (parseD(stages[0].startDate)?.getTime() ?? 0)
      ? 'Le parcours n’a pas encore démarré'
      : 'Parcours terminé'

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-bold text-foreground">Flux du parcours</span>
        <span className="text-[11px] text-muted-foreground">· {flowLabel}</span>
        <span className="ml-auto text-[10px] text-muted-foreground italic">avance automatiquement selon les dates</span>
      </div>

      <div className="flex items-stretch gap-0 overflow-x-auto pb-2">
        {stages.map((s, i) => {
          const st = stageState(s)
          const c = s.color || '#10B981'
          const isDay = (s.durationKind ?? 'range') === 'day'
          return (
            <div key={s.id ?? i} className="flex items-center">
              <div className={`relative w-52 shrink-0 rounded-xl border-2 p-3 transition-all ${
                st === 'current' ? 'shadow-lg' : st === 'done' ? 'opacity-90' : 'opacity-70'}`}
                style={{ borderColor: st === 'current' ? c : c + '55', background: st === 'current' ? c + '0D' : undefined }}>
                <div className="flex items-center gap-2">
                  <span className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-extrabold text-white shrink-0 shadow"
                    style={{ background: c }}>
                    {st === 'done' ? <Check className="h-4 w-4" /> : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground truncate">{s.title || 'Sans titre'}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {fmtShort(s.startDate)}{s.endDate && s.endDate !== s.startDate ? ` → ${fmtShort(s.endDate)}` : ''}
                    </p>
                  </div>
                  {isDay ? <CalendarDays className="h-3.5 w-3.5 shrink-0" style={{ color: c }} /> : <CalendarRange className="h-3.5 w-3.5 shrink-0" style={{ color: c }} />}
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold border ${
                    st === 'current' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300/40'
                    : st === 'done' ? 'bg-muted text-muted-foreground border-border'
                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-300/40'}`}>
                    {st === 'current' ? 'En cours' : st === 'done' ? 'Terminée' : 'À venir'}
                  </span>
                </div>
              </div>
              {i < stages.length - 1 && (
                <ChevronRight className="h-5 w-5 mx-0.5 shrink-0 text-muted-foreground/50" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
