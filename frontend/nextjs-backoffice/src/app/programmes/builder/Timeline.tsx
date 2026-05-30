'use client'
/**
 * Gantt-style Timeline node + expandable modal.
 *
 * On the canvas:
 *   ┌──────────────────────────────────────────────┐
 *   │ TIMELINE                          [⤢] [⛶] 5│
 *   │ ─Apr────May────Jun────Jul────Aug────Sep────│
 *   │       ▰▰▰▰▰▰      ▰▰▰▰▰▰▰▰▰▰▰              │
 *   │            ▰▰▰▰▰▰▰         ▰▰▰▰▰▰          │
 *   └──────────────────────────────────────────────┘
 *
 * Expanded (modal):
 *   - Top condensed month overview
 *   - Bottom zoomed daily/weekly view
 *   - Click a session bar → preview card slides up
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Handle, Position, useReactFlow, type Node } from '@xyflow/react'
import { Calendar, Maximize2, Minimize2, X, MapPin, Users, CheckSquare, Clock, Plus, Trash2, Layers, Save } from 'lucide-react'

interface SessionData extends Record<string, unknown> {
  kind: 'session'
  title: string
  description: string
  startDate?: string
  endDate?: string
  durationKind: 'day' | 'week' | 'custom'
  location: string
  responsibles: string[]
  guests: string[]
  startupIds: number[]
  tasks: Array<{ title: string; assignee?: string; done: boolean }>
  criterionWeights: Record<string, number>
  /** Predefined session type — drives the swatch on the timeline. */
  sessionType?: 'CANDIDATURE_SUBMISSION' | 'PRESELECTION' | 'PITCH_DAY' | 'ONBOARDING' | 'INCUBATION' | 'DEMO_DAY' | 'TRAINING_DAY'
  status?: 'UPCOMING' | 'ACTIVE' | 'COMPLETED'
  days?: any[]
}
type SessionNode = Node<SessionData, 'session'>

// ── Session presets shown in the modal's library ─────────────────────────────

const SESSION_PRESETS: ReadonlyArray<{
  type: NonNullable<SessionData['sessionType']>
  title: string
  durationKind: 'day' | 'week' | 'custom'
  color: { bar: string; text: string }
}> = [
  { type: 'CANDIDATURE_SUBMISSION', title: 'Candidature',  durationKind: 'custom', color: { bar: '#0EA5E9', text: 'text-white'    } },
  { type: 'PRESELECTION',           title: 'Présélection', durationKind: 'week',   color: { bar: '#F59E0B', text: 'text-white'    } },
  { type: 'PITCH_DAY',              title: 'Pitch Day',    durationKind: 'day',    color: { bar: '#EF4444', text: 'text-white'    } },
  { type: 'ONBOARDING',             title: 'Onboarding',   durationKind: 'day',    color: { bar: '#10B981', text: 'text-white'    } },
  { type: 'INCUBATION',             title: 'Incubation',   durationKind: 'custom', color: { bar: '#A855F7', text: 'text-white'    } },
  { type: 'DEMO_DAY',               title: 'Demo Day',     durationKind: 'day',    color: { bar: '#F97316', text: 'text-white'    } },
  { type: 'TRAINING_DAY',           title: 'Formation',    durationKind: 'day',    color: { bar: '#6366F1', text: 'text-white'    } },
]

const SESSION_TYPE_LABEL: Record<string, string> = {
  CANDIDATURE_SUBMISSION: 'Candidature', PRESELECTION: 'Présélection',
  PITCH_DAY: 'Pitch Day', ONBOARDING: 'Onboarding', INCUBATION: 'Incubation',
  DEMO_DAY: 'Demo Day', TRAINING_DAY: 'Formation',
}

// ── Date helpers ────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000

function parseDate(s?: string): Date | null {
  if (!s) return null
  const d = new Date(s + 'T12:00:00') // local noon avoids TZ rollover
  return isNaN(d.getTime()) ? null : d
}

function fmtMonthShort(d: Date) {
  return d.toLocaleDateString('fr-FR', { month: 'short' })
}

function fmtFull(d: Date) {
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

/**
 * Compute the date window we should display: union of all session ranges, or
 * a sensible default (current month + 5 months) if there are no dated sessions.
 */
function computeWindow(sessions: SessionNode[]): { start: Date; end: Date } {
  let min: number | null = null
  let max: number | null = null
  for (const s of sessions) {
    const a = parseDate(s.data.startDate)
    const b = parseDate(s.data.endDate) ?? a
    if (a) min = min == null ? a.getTime() : Math.min(min, a.getTime())
    if (b) max = max == null ? b.getTime() : Math.max(max, b.getTime())
  }
  if (min == null || max == null) {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end   = new Date(now.getFullYear(), now.getMonth() + 6, 0)
    return { start, end }
  }
  // Pad ±15 days for visual breathing room
  const padded = (ms: number, dir: number) => ms + dir * 15 * DAY_MS
  return { start: new Date(padded(min, -1)), end: new Date(padded(max, +1)) }
}

/** List of month-start markers between two dates. */
function monthMarkers(start: Date, end: Date): Date[] {
  const out: Date[] = []
  const cur = new Date(start.getFullYear(), start.getMonth(), 1)
  while (cur <= end) {
    out.push(new Date(cur))
    cur.setMonth(cur.getMonth() + 1)
  }
  return out
}

/** Returns CSS left% + width% for a session inside the date window. */
function barPosition(session: SessionNode, win: { start: Date; end: Date }): { left: string; width: string; placeholder: boolean } {
  const a = parseDate(session.data.startDate)
  const b = parseDate(session.data.endDate) ?? a
  if (!a) {
    // Placeholder bar for date-less sessions: 30px-wide stub on the left
    return { left: '0%', width: '40px', placeholder: true }
  }
  const total = win.end.getTime() - win.start.getTime()
  const left  = ((a.getTime() - win.start.getTime()) / total) * 100
  const widthMs = Math.max((b!.getTime() - a.getTime()) + DAY_MS, DAY_MS)
  const width = (widthMs / total) * 100
  return { left: `${Math.max(0, left)}%`, width: `${Math.max(width, 1.5)}%`, placeholder: false }
}

// ── Color cycling for session bars ──────────────────────────────────────────

const BAR_COLORS = [
  { bg: 'bg-emerald-500', border: 'border-emerald-600', text: 'text-emerald-700 dark:text-emerald-300' },
  { bg: 'bg-sky-500',     border: 'border-sky-600',     text: 'text-sky-700 dark:text-sky-300' },
  { bg: 'bg-rose-500',    border: 'border-rose-600',    text: 'text-rose-700 dark:text-rose-300' },
  { bg: 'bg-amber-500',   border: 'border-amber-600',   text: 'text-amber-700 dark:text-amber-300' },
  { bg: 'bg-purple-500',  border: 'border-purple-600',  text: 'text-purple-700 dark:text-purple-300' },
  { bg: 'bg-pink-500',    border: 'border-pink-600',    text: 'text-pink-700 dark:text-pink-300' },
]
function colorFor(i: number) { return BAR_COLORS[i % BAR_COLORS.length] }

// ── Session preview card (the second image's vibe) ──────────────────────────

function SessionPreviewCard({ session, color, onClose, onEdit }: {
  session: SessionNode; color: typeof BAR_COLORS[number]; onClose: () => void; onEdit: () => void
}) {
  const d = session.data
  return (
    <div className="rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
      <div className={`h-1 ${color.bg}`} />
      <div className="p-4">
        <div className="flex items-start gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <p className={`text-[10px] font-bold uppercase tracking-wider ${color.text}`}>
              Session · {d.durationKind === 'day' ? 'Journée' : d.durationKind === 'week' ? 'Semaine' : 'Personnalisée'}
            </p>
            <h3 className="text-base font-bold text-foreground truncate">{d.title || 'Sans titre'}</h3>
          </div>
          <button type="button" onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {d.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{d.description}</p>}

        <div className="grid grid-cols-2 gap-2 text-[11px]">
          {(d.startDate || d.endDate) && (
            <div className="flex items-center gap-1.5 text-foreground">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span>{d.startDate ?? '?'} → {d.endDate ?? '?'}</span>
            </div>
          )}
          {d.location && (
            <div className="flex items-center gap-1.5 text-foreground">
              <MapPin className="h-3 w-3 text-muted-foreground" />
              <span className="truncate">{d.location}</span>
            </div>
          )}
          {d.responsibles.length > 0 && (
            <div className="flex items-center gap-1.5 text-foreground">
              <Users className="h-3 w-3 text-muted-foreground" />
              <span>{d.responsibles.length} responsable{d.responsibles.length > 1 ? 's' : ''}</span>
            </div>
          )}
          {d.tasks.length > 0 && (
            <div className="flex items-center gap-1.5 text-foreground">
              <CheckSquare className="h-3 w-3 text-muted-foreground" />
              <span>{d.tasks.filter((t) => t.done).length}/{d.tasks.length} tâches</span>
            </div>
          )}
        </div>

        <button type="button" onClick={onEdit}
          className={`mt-3 w-full rounded-lg ${color.bg} text-white text-xs font-bold py-2 hover:opacity-90 transition-opacity`}>
          Éditer cette session
        </button>
      </div>
    </div>
  )
}

// ── Gantt body (used in both compact node + modal) ──────────────────────────

function GanttBody({ sessions, win, height, onPickSession, pickedId }: {
  sessions: SessionNode[]
  win: { start: Date; end: Date }
  height: number
  onPickSession: (id: string) => void
  pickedId: string | null
}) {
  const months = monthMarkers(win.start, win.end)
  const totalMs = win.end.getTime() - win.start.getTime()

  // Assign each session a row to avoid overlap
  const rows: SessionNode[][] = []
  const sortedByStart = [...sessions].sort((a, b) =>
    (parseDate(a.data.startDate)?.getTime() ?? 0) - (parseDate(b.data.startDate)?.getTime() ?? 0)
  )
  for (const s of sortedByStart) {
    const sa = parseDate(s.data.startDate)?.getTime() ?? 0
    let placed = false
    for (const row of rows) {
      const last = row[row.length - 1]
      const lb = (parseDate(last.data.endDate) ?? parseDate(last.data.startDate))?.getTime() ?? 0
      if (sa > lb + DAY_MS) { row.push(s); placed = true; break }
    }
    if (!placed) rows.push([s])
  }
  if (rows.length === 0) rows.push([])

  return (
    <div className="relative" style={{ height }}>
      {/* Vertical month grid lines */}
      {months.map((m) => {
        const left = ((m.getTime() - win.start.getTime()) / totalMs) * 100
        return (
          <div key={m.getTime()} className="absolute top-0 bottom-0 border-l border-border/40"
               style={{ left: `${left}%` }} />
        )
      })}

      {/* "Today" marker */}
      {(() => {
        const now = Date.now()
        if (now < win.start.getTime() || now > win.end.getTime()) return null
        const left = ((now - win.start.getTime()) / totalMs) * 100
        return (
          <div className="absolute top-0 bottom-0 w-px bg-red-500/60 z-10" style={{ left: `${left}%` }}>
            <span className="absolute -top-1 -translate-x-1/2 rounded-sm bg-red-500 px-1 py-0 text-[8px] font-bold text-white">aujourd&apos;hui</span>
          </div>
        )
      })()}

      {/* Session bars */}
      {rows.map((row, rowIdx) => (
        <div key={rowIdx} className="absolute left-0 right-0" style={{ top: rowIdx * 22 + 4, height: 18 }}>
          {row.map((s, i) => {
            const pos = barPosition(s, win)
            const allIndex = sessions.findIndex((x) => x.id === s.id)
            const color = colorFor(allIndex)
            const isPicked = s.id === pickedId
            return (
              <button key={s.id} type="button" onClick={() => onPickSession(s.id)}
                title={`${s.data.title}  ${s.data.startDate ?? '?'} → ${s.data.endDate ?? '?'}`}
                className={`absolute rounded-md ${color.bg} ${isPicked ? 'ring-2 ring-offset-1 ring-foreground/60' : ''} ${pos.placeholder ? 'opacity-60' : ''} hover:brightness-110 transition-all shadow-sm hover:shadow flex items-center px-1.5 text-[10px] font-bold text-white truncate`}
                style={{ left: pos.left, width: pos.width, height: 16, top: 1 }}>
                <span className="truncate">{s.data.title || '·'}</span>
              </button>
            )
          })}
        </div>
      ))}

      {/* Bottom month labels */}
      <div className="absolute left-0 right-0 bottom-0 h-4 flex">
        {months.map((m, i) => {
          const left = ((m.getTime() - win.start.getTime()) / totalMs) * 100
          return (
            <span key={i} className="absolute text-[9px] font-semibold uppercase text-muted-foreground tracking-wider"
                  style={{ left: `${left}%`, transform: 'translateX(2px)' }}>
              {fmtMonthShort(m)}
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ── Day-level (zoomed) Gantt — used in the modal ────────────────────────────

/**
 * Day-level Gantt with full mouse interactions:
 *  - Drop a preset from the library at any date (snaps to the day under cursor)
 *  - Drag a session bar's body to move it (preserves duration)
 *  - Drag the right edge handle to extend the end date (resize)
 *  - Day-locked sessions cannot be resized.
 */
function GanttDays({ sessions, win, onPickSession, pickedId, onDropPreset, onUpdateSession, onAddDefault }: {
  sessions: SessionNode[]
  win: { start: Date; end: Date }
  onPickSession: (id: string) => void
  pickedId: string | null
  onDropPreset?: (type: string, atDate: string) => void
  onUpdateSession?: (id: string, patch: Partial<SessionData>) => void
  /** Called when the user clicks the "default empty session" placeholder
   *  shown when the timeline has 0 sessions. */
  onAddDefault?: () => void
}) {
  const totalMs = win.end.getTime() - win.start.getTime()
  const days: Date[] = []
  const cur = new Date(win.start)
  while (cur <= win.end) { days.push(new Date(cur)); cur.setDate(cur.getDate() + 1) }

  const wrapperRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  /** Convert a clientX to a Date snapped to the day under the cursor. */
  const xToDate = (clientX: number): Date | null => {
    const el = trackRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const x = clientX - rect.left + (wrapperRef.current?.scrollLeft ?? 0)
    if (rect.width <= 0) return null
    const pct = Math.max(0, Math.min(0.9999, x / rect.width))
    const ms = win.start.getTime() + pct * totalMs
    return new Date(new Date(ms).getFullYear(), new Date(ms).getMonth(), new Date(ms).getDate())
  }

  // ── Drag-from-library preview state ───────────────────────────────────
  const [dropPreviewX, setDropPreviewX] = useState<number | null>(null)

  // ── Move / resize state for existing bars ─────────────────────────────
  const dragRef = useRef<{
    id: string
    mode: 'move' | 'resize-right'
    origX: number
    origStart: Date
    origEnd: Date
    pxPerDay: number
  } | null>(null)
  const [drag, setDrag] = useState<{ id: string; deltaDays: number; mode: 'move' | 'resize-right' } | null>(null)

  const startDrag = (s: SessionNode, e: React.PointerEvent, mode: 'move' | 'resize-right') => {
    e.stopPropagation()
    if (mode === 'resize-right' && s.data.durationKind === 'day') return // locked
    const sd = parseDate(s.data.startDate)
    const ed = parseDate(s.data.endDate) ?? sd
    if (!sd || !ed) return
    const track = trackRef.current
    if (!track) return
    const pxPerDay = track.getBoundingClientRect().width / days.length
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    dragRef.current = { id: s.id, mode, origX: e.clientX, origStart: sd, origEnd: ed, pxPerDay }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.origX
    const delta = Math.round(dx / dragRef.current.pxPerDay)
    setDrag({ id: dragRef.current.id, deltaDays: delta, mode: dragRef.current.mode })
  }

  const onPointerUp = () => {
    if (!dragRef.current || !drag) { dragRef.current = null; setDrag(null); return }
    const { id, mode, origStart, origEnd } = dragRef.current
    const dd = drag.deltaDays
    dragRef.current = null
    setDrag(null)
    if (dd === 0) return
    const newStart = mode === 'move'
      ? new Date(origStart.getTime() + dd * DAY_MS)
      : origStart
    const newEnd   = mode === 'move'
      ? new Date(origEnd.getTime() + dd * DAY_MS)
      : new Date(Math.max(origStart.getTime(), origEnd.getTime() + dd * DAY_MS))
    onUpdateSession?.(id, {
      startDate: newStart.toISOString().slice(0, 10),
      endDate:   newEnd.toISOString().slice(0, 10),
    })
  }

  // Stack same as compact
  const rows: SessionNode[][] = []
  const sorted = [...sessions].sort((a, b) =>
    (parseDate(a.data.startDate)?.getTime() ?? 0) - (parseDate(b.data.startDate)?.getTime() ?? 0))
  for (const s of sorted) {
    const sa = parseDate(s.data.startDate)?.getTime() ?? 0
    let placed = false
    for (const row of rows) {
      const last = row[row.length - 1]
      const lb = (parseDate(last.data.endDate) ?? parseDate(last.data.startDate))?.getTime() ?? 0
      if (sa > lb + DAY_MS) { row.push(s); placed = true; break }
    }
    if (!placed) rows.push([s])
  }
  if (rows.length === 0) rows.push([])

  return (
    <div ref={wrapperRef} className="overflow-x-auto"
      onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
      <div
        ref={trackRef}
        className="relative"
        style={{ minWidth: Math.max(days.length * 28, 600) }}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('application/timeline-preset')) {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'copy'
            const rect = (trackRef.current!).getBoundingClientRect()
            setDropPreviewX(e.clientX - rect.left)
          }
        }}
        onDragLeave={() => setDropPreviewX(null)}
        onDrop={(e) => {
          e.preventDefault()
          const t = e.dataTransfer.getData('application/timeline-preset')
          setDropPreviewX(null)
          if (!t || !onDropPreset) return
          const d = xToDate(e.clientX)
          if (d) onDropPreset(t, d.toISOString().slice(0, 10))
        }}>
        {/* Day axis */}
        <div className="flex border-b border-border h-7">
          {days.map((d, i) => {
            const isMonthStart = d.getDate() === 1
            const isToday = d.toDateString() === new Date().toDateString()
            const isWeekend = d.getDay() === 0 || d.getDay() === 6
            return (
              <div key={i} className={`flex-1 min-w-[28px] flex flex-col items-center justify-center text-[9px] ${isWeekend ? 'bg-muted/40' : ''} ${isMonthStart ? 'border-l-2 border-foreground/30' : 'border-l border-border/30'}`}>
                <span className={`font-semibold ${isToday ? 'text-red-600' : 'text-foreground/80'}`}>{d.getDate()}</span>
                {isMonthStart && <span className="text-[8px] text-muted-foreground uppercase">{fmtMonthShort(d)}</span>}
              </div>
            )
          })}
        </div>

        {/* Session rows */}
        <div className="relative" style={{ height: Math.max(rows.length * 32, 80) }}>
          {/* Weekend background stripes */}
          {days.map((d, i) => {
            if (d.getDay() !== 0 && d.getDay() !== 6) return null
            const leftPct = ((d.getTime() - win.start.getTime()) / totalMs) * 100
            const widthPct = (DAY_MS / totalMs) * 100
            return <div key={i} className="absolute top-0 bottom-0 bg-muted/30" style={{ left: `${leftPct}%`, width: `${widthPct}%` }} />
          })}

          {/* Drag-from-library drop preview line */}
          {dropPreviewX !== null && (
            <div className="absolute top-0 bottom-0 w-1 bg-emerald-500/80 z-30 pointer-events-none"
              style={{ left: dropPreviewX - 2 }}>
              <span className="absolute -top-6 -translate-x-1/2 rounded-md bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold text-white whitespace-nowrap">
                Ajouter ici
              </span>
            </div>
          )}

          {/* Default empty-session placeholder when the timeline has no sessions yet.
              Click → quick-create a default Incubation session at today (or window start).
              Drag-and-drop a preset onto this area still works because the drop handler
              is on the parent trackRef. */}
          {sessions.length === 0 && (
            <button type="button"
              onClick={() => onAddDefault?.()}
              className="absolute left-[5%] right-[5%] top-2 bottom-2 rounded-lg border-2 border-dashed border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/70 transition-colors flex flex-col items-center justify-center gap-1 text-emerald-700 dark:text-emerald-300">
              <Plus className="h-5 w-5" />
              <span className="text-xs font-bold">Session par défaut</span>
              <span className="text-[10px] opacity-80">
                Clic pour créer · ou glissez un preset depuis la bibliothèque
              </span>
            </button>
          )}

          {rows.map((row, rowIdx) => (
            <div key={rowIdx} className="absolute left-0 right-0" style={{ top: rowIdx * 32 + 6, height: 26 }}>
              {row.map((s) => {
                const pos = barPosition(s, win)
                const allIndex = sessions.findIndex((x) => x.id === s.id)
                const color = colorFor(allIndex)
                const isPicked = s.id === pickedId
                const myDrag = drag?.id === s.id ? drag : null
                // Per-bar visual offset / width while dragging
                const px = trackRef.current?.getBoundingClientRect().width ?? 0
                const pxPerDay = px / days.length
                const offsetPx = myDrag && myDrag.mode === 'move'   ? myDrag.deltaDays * pxPerDay : 0
                const widthPx  = myDrag && myDrag.mode === 'resize-right' ? myDrag.deltaDays * pxPerDay : 0
                const lockedResize = s.data.durationKind === 'day'
                return (
                  <div key={s.id}
                    onClick={(e) => { e.stopPropagation(); onPickSession(s.id) }}
                    onPointerDown={(e) => startDrag(s, e, 'move')}
                    title={`${s.data.title}\n${s.data.startDate ?? '?'} → ${s.data.endDate ?? '?'}`}
                    className={`absolute rounded-md ${color.bg} ${isPicked ? 'ring-2 ring-offset-2 ring-foreground/60' : ''} ${pos.placeholder ? 'opacity-50' : ''} hover:brightness-110 transition-shadow shadow-md hover:shadow-lg flex items-center px-2 text-[11px] font-bold text-white cursor-grab active:cursor-grabbing select-none`}
                    style={{
                      left: `calc(${pos.left} + ${offsetPx}px)`,
                      width: `calc(${pos.width} + ${widthPx}px)`,
                      height: 24, top: 1,
                    }}>
                    <span className="truncate flex-1">{s.data.title || '·'}</span>
                    {/* Resize handle on the right edge */}
                    <div
                      onPointerDown={(e) => startDrag(s, e, 'resize-right')}
                      title={lockedResize ? 'Verrouillé (Journée)' : 'Glisser pour étendre la date de fin'}
                      className={`shrink-0 self-stretch w-2 -mr-2 ml-1 rounded-r-md ${
                        lockedResize ? 'cursor-not-allowed opacity-30' : 'cursor-ew-resize hover:bg-white/30'
                      }`} />
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── The Timeline node component (on the canvas) ─────────────────────────────

export function TimelineNode({ selected }: { selected?: boolean }) {
  const { getNodes } = useReactFlow()
  const sessions = getNodes().filter((n: any): n is SessionNode => n.data?.kind === 'session') as SessionNode[]
  const win = useMemo(() => computeWindow(sessions), [sessions])
  const [expanded, setExpanded] = useState(false)
  const [pickedId, setPickedId] = useState<string | null>(null)

  const pickedSession = pickedId ? sessions.find((s) => s.id === pickedId) ?? null : null
  const pickedColor   = pickedSession ? colorFor(sessions.findIndex((s) => s.id === pickedId)) : null

  const selectSessionInBuilder = (id: string) => {
    setPickedId(null)
    setExpanded(false)
    ;(window as any).__builder_selectNode?.(id)
  }

  return (
    <div className={`rounded-2xl border-2 bg-gradient-to-r from-amber-500/10 via-card to-amber-500/10 p-3 w-[640px] shadow-lg border-amber-500/50 ${selected ? 'ring-2 ring-amber-500/30' : ''}`}>
      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !bg-amber-500 !border-2 !border-card" />

      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <Calendar className="h-4 w-4 text-amber-600" />
        <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">Timeline</span>
        <span className="ml-2 text-[10px] text-muted-foreground">
          {fmtFull(win.start)} → {fmtFull(win.end)}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-300">
            {sessions.length} session{sessions.length > 1 ? 's' : ''}
          </span>
          <button type="button" onClick={(e) => { e.stopPropagation(); setExpanded(true) }}
            title="Agrandir" className="flex h-6 w-6 items-center justify-center rounded-md bg-card border border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 transition-colors">
            <Maximize2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Compact Gantt body */}
      <div className="rounded-lg bg-card border border-border p-2">
        {sessions.length === 0 ? (
          <p className="text-center text-[11px] text-muted-foreground py-6">
            Aucune session. Ajoutez-en depuis la bibliothèque pour les voir ici.
          </p>
        ) : (
          <GanttBody sessions={sessions} win={win}
            height={Math.max(40, Math.min(sessions.length, 5) * 22 + 24)}
            onPickSession={(id) => setPickedId((cur) => cur === id ? null : id)}
            pickedId={pickedId} />
        )}
      </div>

      {/* Preview card (appears below when a session is picked) */}
      {pickedSession && pickedColor && (
        <div className="mt-2">
          <SessionPreviewCard session={pickedSession} color={pickedColor}
            onClose={() => setPickedId(null)}
            onEdit={() => selectSessionInBuilder(pickedSession.id)} />
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!h-3 !w-3 !bg-amber-500 !border-2 !border-card" />

      {/* Expanded modal — rendered via portal so it escapes ReactFlow */}
      {expanded && typeof window !== 'undefined' && createPortal(
        <TimelineModal
          sessions={sessions}
          win={win}
          pickedId={pickedId}
          setPickedId={setPickedId}
          onClose={() => setExpanded(false)}
          onEdit={selectSessionInBuilder}
        />,
        document.body
      )}
    </div>
  )
}

// ── Full-screen expanded view ───────────────────────────────────────────────

function TimelineModal({ sessions, win, pickedId, setPickedId, onClose, onEdit }: {
  sessions: SessionNode[]
  win: { start: Date; end: Date }
  pickedId: string | null
  setPickedId: (id: string | null) => void
  onClose: () => void
  onEdit: (id: string) => void
}) {
  const pickedSession = pickedId ? sessions.find((s) => s.id === pickedId) ?? null : null

  // ── Live editing via builder-exposed window callbacks ────────────────────
  const addPreset = (type: NonNullable<SessionData['sessionType']>, atDate?: string) => {
    const newId: string | undefined = (window as any).__builder_addSessionPreset?.(type, atDate)
    if (newId) setPickedId(newId)
  }
  const updateSession = (id: string, patch: Partial<SessionData>) => {
    (window as any).__builder_updateSession?.(id, patch)
  }
  const removeSession = (id: string) => {
    if (!confirm('Supprimer cette session ?')) return
    ;(window as any).__builder_removeSession?.(id)
    if (pickedId === id) setPickedId(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}>
      <div className="w-full max-w-7xl max-h-[92vh] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border px-6 py-4 bg-gradient-to-r from-amber-500/10 via-card to-amber-500/10">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-white">
            <Calendar className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-foreground">Timeline du programme</h2>
            <p className="text-xs text-muted-foreground">
              {fmtFull(win.start)} → {fmtFull(win.end)} · {sessions.length} session{sessions.length > 1 ? 's' : ''}
            </p>
          </div>
          <button type="button" onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <Minimize2 className="h-4 w-4" />
          </button>
        </div>

        {/* Library strip — full-width row at the top of the board */}
        <div className="border-b border-border bg-muted/20 px-4 py-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1">
            Bibliothèque
          </span>
          {SESSION_PRESETS.map((p) => (
            <button key={p.type} type="button"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/timeline-preset', p.type)
                e.dataTransfer.effectAllowed = 'copy'
              }}
              onClick={() => addPreset(p.type)}
              title={`Clic → ajouter à la fin · Glisser → poser sur un jour précis`}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all hover:scale-[1.03] active:scale-[0.98] cursor-grab active:cursor-grabbing"
              style={{ borderColor: p.color.bar, color: p.color.bar }}>
              <span className="h-2 w-2 rounded-full" style={{ background: p.color.bar }} />
              {p.title}
              <span className="text-[9px] opacity-70">
                {p.durationKind === 'day' ? '1j' : p.durationKind === 'week' ? '7j' : '…'}
              </span>
              <Plus className="h-3 w-3" />
            </button>
          ))}
          <span className="ml-auto text-[10px] text-muted-foreground italic">
            Glissez un preset sur la rivière · Cliquez un bloc pour l&apos;éditer
          </span>
        </div>

        {/* SINGLE BOARD — every interaction (add / move / resize / edit) lives here. */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 relative"
          onClick={(e) => {
            // Click on empty board area = close any open editor
            if (e.target === e.currentTarget) setPickedId(null)
          }}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes('application/timeline-preset')) {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'copy'
            }
          }}
          onDrop={(e) => {
            if (e.defaultPrevented) return  // inner Gantt handled it
            const t = e.dataTransfer.getData('application/timeline-preset')
            if (!t) return
            e.preventDefault()
            addPreset(t as any, win.end.toISOString().slice(0, 10))
          }}>
          {/* Month overview — visual context only (clickable) */}
          {sessions.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Vue d&apos;ensemble — mois
              </p>
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <GanttBody sessions={sessions} win={win}
                  height={Math.max(60, sessions.length * 22 + 30)}
                  onPickSession={(id) => setPickedId(id === pickedId ? null : id)}
                  pickedId={pickedId} />
              </div>
            </div>
          )}

          {/* Day-by-day board — ALWAYS rendered so drops always work,
              even when the timeline is empty (placeholder bar inside). */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Vue détaillée — jours · {sessions.length === 0 ? 'Glissez un preset depuis la bibliothèque' : 'Glissez / étirez les blocs'}
            </p>
            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <GanttDays sessions={sessions} win={win}
                onPickSession={(id) => setPickedId(id === pickedId ? null : id)}
                pickedId={pickedId}
                onDropPreset={(type, atDate) => addPreset(type as any, atDate)}
                onUpdateSession={(id, patch) => updateSession(id, patch)}
                onAddDefault={() => addPreset('INCUBATION')}
              />
            </div>
          </div>

          {/* Floating editor card — anchored to the bottom of the board,
              appears only when a session is picked. Everything that used to
              live in the right rail now floats here, on the board itself. */}
          {pickedSession && (
            <div className="sticky bottom-0 -mx-5 -mb-5 px-5 pb-5 pt-3 bg-gradient-to-t from-card via-card to-transparent">
              <SessionInlineEditor
                session={pickedSession}
                onUpdate={(patch) => updateSession(pickedSession.id, patch)}
                onRemove={() => removeSession(pickedSession.id)}
                onOpenFullEditor={() => onEdit(pickedSession.id)}
                onClose={() => setPickedId(null)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Inline editor — full configuration of one session, in-place ─────────────

function SessionInlineEditor({ session, onUpdate, onRemove, onOpenFullEditor, onClose }: {
  session: SessionNode
  onUpdate: (patch: Partial<SessionData>) => void
  onRemove: () => void
  onOpenFullEditor: () => void
  onClose?: () => void
}) {
  const d = session.data
  const preset = SESSION_PRESETS.find((p) => p.type === d.sessionType)
  const palBar = preset?.color.bar ?? '#10B981'

  // Local drafts so we don't fire updates on every keystroke
  const [title, setTitle] = useState(d.title ?? '')
  const [description, setDescription] = useState(d.description ?? '')
  const [location, setLocation] = useState(d.location ?? '')
  useEffect(() => { setTitle(d.title ?? '') }, [d.title])
  useEffect(() => { setDescription(d.description ?? '') }, [d.description])
  useEffect(() => { setLocation(d.location ?? '') }, [d.location])

  return (
    <div className="rounded-2xl border-2 bg-card shadow-2xl p-4 space-y-4 animate-in slide-in-from-bottom-2 fade-in duration-200"
      style={{ borderColor: palBar }}>
      {/* Floating-card header with close */}
      <div className="flex items-center gap-2">
        <span className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
          style={{ background: palBar }}>
          Édition session
        </span>
        <span className="text-[11px] text-muted-foreground truncate">
          {d.startDate ?? '?'} → {d.endDate ?? '?'} {d.location ? `· ${d.location}` : ''}
        </span>
        {onClose && (
          <button type="button" onClick={onClose}
            className="ml-auto flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="Fermer">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Colored header strip with type + status */}
      <div className="rounded-xl p-3" style={{ background: palBar + '15', borderLeft: `4px solid ${palBar}` }}>
        <div className="flex items-center gap-1.5 mb-1.5">
          <select
            value={d.sessionType ?? 'INCUBATION'}
            onChange={(e) => onUpdate({ sessionType: e.target.value as any })}
            className="rounded-full border-2 px-2 py-0.5 text-[10px] font-bold bg-background"
            style={{ borderColor: palBar, color: palBar }}>
            {SESSION_PRESETS.map((p) => (
              <option key={p.type} value={p.type}>{p.title}</option>
            ))}
          </select>
          <select
            value={d.status ?? 'UPCOMING'}
            onChange={(e) => onUpdate({ status: e.target.value as any })}
            className="ml-auto rounded-full border px-2 py-0.5 text-[10px] font-semibold bg-background">
            <option value="UPCOMING">À venir</option>
            <option value="ACTIVE">En cours</option>
            <option value="COMPLETED">Terminée</option>
          </select>
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => { if (title !== d.title) onUpdate({ title }) }}
          placeholder="Titre de la session"
          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>

      {/* Duration */}
      <div>
        <label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Durée</label>
        <div className="flex gap-1 mt-1">
          {(['day', 'week', 'custom'] as const).map((k) => (
            <button key={k} type="button"
              onClick={() => {
                const patch: any = { durationKind: k }
                if (d.startDate) {
                  if (k === 'day') patch.endDate = d.startDate
                  else if (k === 'week') {
                    const sd = new Date(d.startDate + 'T12:00:00')
                    sd.setDate(sd.getDate() + 6)
                    patch.endDate = sd.toISOString().slice(0, 10)
                  }
                }
                onUpdate(patch)
              }}
              className={`flex-1 rounded-md border-2 px-1.5 py-1 text-[11px] font-semibold transition-colors ${
                d.durationKind === k
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'border-border text-muted-foreground hover:border-emerald-400'}`}>
              {k === 'day' ? 'Journée' : k === 'week' ? 'Semaine' : 'Personnalisé'}
            </button>
          ))}
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Début</label>
          <input type="date" value={d.startDate ?? ''}
            onChange={(e) => {
              const sd = e.target.value
              const patch: any = { startDate: sd }
              if (d.durationKind === 'day') patch.endDate = sd
              else if (d.durationKind === 'week' && sd) {
                const dt = new Date(sd + 'T12:00:00'); dt.setDate(dt.getDate() + 6)
                patch.endDate = dt.toISOString().slice(0, 10)
              }
              onUpdate(patch)
            }}
            className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div>
          <label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
            Fin {d.durationKind === 'day' && '(=Début)'}
          </label>
          <input type="date" value={d.endDate ?? ''}
            disabled={d.durationKind === 'day'}
            onChange={(e) => onUpdate({ endDate: e.target.value })}
            className={`mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring ${
              d.durationKind === 'day' ? 'opacity-60 cursor-not-allowed' : ''}`} />
        </div>
      </div>

      {/* Location */}
      <div>
        <label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Lieu</label>
        <input value={location}
          onChange={(e) => setLocation(e.target.value)}
          onBlur={() => { if (location !== (d.location ?? '')) onUpdate({ location }) }}
          placeholder='"Salle A" ou "Online"'
          className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>

      {/* Description */}
      <div>
        <label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Description</label>
        <textarea rows={3} value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => { if (description !== (d.description ?? '')) onUpdate({ description }) }}
          className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs resize-y focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>

      {/* Footer meta + actions */}
      <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
        {(d.responsibles ?? []).length > 0 && (
          <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{(d.responsibles ?? []).length}</span>
        )}
        {(d.tasks ?? []).length > 0 && (
          <span className="inline-flex items-center gap-1"><CheckSquare className="h-3 w-3" />{(d.tasks ?? []).length}</span>
        )}
        {(d.days ?? []).length > 0 && (
          <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{(d.days ?? []).length} jour{(d.days ?? []).length > 1 ? 's' : ''}</span>
        )}
      </div>

      <div className="flex gap-2 pt-2 border-t border-border">
        <button type="button" onClick={onOpenFullEditor}
          className="flex-1 rounded-md text-white text-xs font-bold py-2 transition-opacity hover:opacity-90"
          style={{ background: palBar }}>
          Édition avancée (jours, équipe…)
        </button>
        <button type="button" onClick={onRemove}
          title="Supprimer la session"
          className="flex h-9 w-9 items-center justify-center rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
