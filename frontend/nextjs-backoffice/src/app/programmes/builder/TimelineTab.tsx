'use client'
/**
 * TimelineTab — the "🗺️ Parcours" tab of the visual editor.
 *
 * Three vertical zones (top → bottom):
 *
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ HEADER          title · dates · count · plein écran      │
 *   ├──────────────────────────────────────────────────────────┤
 *   │ LIBRARY STRIP   7 colored preset pills (click / drag)    │
 *   ├──────────────────────────────────────────────────────────┤
 *   │ TIMELINE BOARD                                           │
 *   │  Month strip · Today marker                              │
 *   │  Swimlanes (one row per `lane`) with session bars        │
 *   │  Each bar: solid pill with day-tick marks · warnings     │
 *   │  Drag bar to move · left/right edges to resize           │
 *   │  Drag onto a different lane row to switch swimlane       │
 *   ├──────────────────────────────────────────────────────────┤
 *   │ BOTTOM DRAWER   (slides up when a session is picked)     │
 *   │  ┌──────────────┬───────────────────────────────────────┐│
 *   │  │ EDITOR (290) │ DAY CANVAS — agenda per day with      ││
 *   │  │              │ activities placed on an hour grid     ││
 *   │  └──────────────┴───────────────────────────────────────┘│
 *   └──────────────────────────────────────────────────────────┘
 *
 * All CRUD goes through {@link sessionsApi} directly. The Atelier canvas
 * doesn't touch sessions at all.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, X, Trash2, Calendar, MapPin, Users, ChevronDown, ChevronUp,
  Loader2, ArrowUpRight, Sparkles, AlertTriangle, Info, GripVertical,
  Layers, Clock, Tag, FileText,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { sessionsApi, SESSION_TYPES, ACTIVITY_TYPES, type SessionType, type ActivityType } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

// ── Display palette ─────────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  CANDIDATURE_SUBMISSION: 'Candidature', PRESELECTION: 'Présélection',
  PITCH_DAY: 'Pitch Day', ONBOARDING: 'Onboarding', INCUBATION: 'Incubation',
  DEMO_DAY: 'Demo Day', TRAINING_DAY: 'Formation',
}
const TYPE_COLOR: Record<string, string> = {
  CANDIDATURE_SUBMISSION: '#0EA5E9',  PRESELECTION: '#F59E0B',
  PITCH_DAY: '#EF4444',               ONBOARDING:   '#10B981',
  INCUBATION: '#A855F7',              DEMO_DAY:     '#F97316',
  TRAINING_DAY: '#6366F1',
}
const PRESET_DURATIONS: Record<SessionType, 'day' | 'week' | 'custom'> = {
  CANDIDATURE_SUBMISSION: 'custom', PRESELECTION: 'week',
  PITCH_DAY: 'day', ONBOARDING: 'day', INCUBATION: 'custom',
  DEMO_DAY: 'day', TRAINING_DAY: 'day',
}
const ACTIVITY_TYPE_LABEL: Record<string, string> = {
  ACTIVITY: 'Activité', TRAINING_STEP: 'Formation', KEYNOTE: 'Keynote',
  WORKSHOP: 'Atelier', PANEL: 'Panel', PITCH: 'Pitch',
  BREAK: 'Pause', NETWORKING: 'Networking', OTHER: 'Autre',
}
const ACTIVITY_TYPE_COLOR: Record<string, string> = {
  ACTIVITY: '#10B981', TRAINING_STEP: '#6366F1', KEYNOTE: '#A855F7',
  WORKSHOP: '#F59E0B', PANEL: '#0EA5E9', PITCH: '#EF4444',
  BREAK: '#94A3B8', NETWORKING: '#F97316', OTHER: '#64748B',
}

// ── Domain types ────────────────────────────────────────────────────────────

interface Activity {
  id?: number
  activityOrder?: number
  title: string
  description?: string
  type?: ActivityType | string
  startTime?: string
  endTime?: string
  location?: string
  responsibles?: string[]
  guests?: string[]
}
interface SessionDay {
  id?: number
  dayOrder?: number
  title?: string
  description?: string
  date?: string
  location?: string
  activities?: Activity[]
}
interface Session {
  id: number
  title: string
  description?: string
  startDate?: string
  endDate?: string
  durationKind?: 'day' | 'week' | 'custom'
  location?: string
  sessionType?: SessionType | string
  status?: 'UPCOMING' | 'ACTIVE' | 'COMPLETED'
  lane?: string
  phaseOrder?: number
  days?: SessionDay[]
}

// ── Date helpers ────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000
const parseDate = (s?: string | null) => {
  if (!s) return null
  const d = new Date(s + 'T12:00:00')
  return isNaN(d.getTime()) ? null : d
}
const fmtISO   = (d: Date) => d.toISOString().slice(0, 10)
const addDays  = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r }
const fmtShort = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
const fmtMonthShort = (d: Date) => d.toLocaleDateString('fr-FR', { month: 'short' })

interface Window { start: Date; end: Date }

function computeWindow(
  programme: { startDate?: string | null; endDate?: string | null } | null,
  sessions: Session[],
): Window {
  let lo = parseDate(programme?.startDate ?? undefined)
  let hi = parseDate(programme?.endDate   ?? undefined)
  for (const s of sessions) {
    const sd = parseDate(s.startDate)
    const ed = parseDate(s.endDate ?? s.startDate)
    if (sd && (!lo || sd < lo)) lo = sd
    if (ed && (!hi || ed > hi)) hi = ed
  }
  if (!lo) lo = new Date()
  if (!hi) hi = addDays(lo, 60)
  return { start: addDays(lo, -3), end: addDays(hi, 3) }
}

// ── Missing-info detection ─────────────────────────────────────────────────

function detectMissing(s: Session): { critical: string[]; warnings: string[] } {
  const critical: string[] = []
  const warnings:  string[] = []
  if (!s.title?.trim() || s.title.trim() === (TYPE_LABEL[s.sessionType ?? ''] ?? '')) {
    // Title is missing or still the default preset name → critical
    if (!s.title?.trim()) critical.push('titre')
  }
  if (!s.startDate) critical.push('date de début')
  if (!s.endDate)   critical.push('date de fin')
  if (!s.location?.trim())    warnings.push('lieu')
  if (!s.description?.trim()) warnings.push('description')
  // Multi-day session without any days set up
  const sd = parseDate(s.startDate); const ed = parseDate(s.endDate ?? s.startDate)
  const isMultiDay = sd && ed && (ed.getTime() - sd.getTime()) >= DAY_MS
  if (isMultiDay && (!s.days || s.days.length === 0)) warnings.push('jours non détaillés')
  return { critical, warnings }
}

// ──────────────────────────────────────────────────────────────────────────
//                          PUBLIC ENTRYPOINT
// ──────────────────────────────────────────────────────────────────────────

export function TimelineTab({ programmeId, programme }: {
  programmeId?: number
  programme?: { title?: string; startDate?: string | null; endDate?: string | null } | null
}) {
  if (!programmeId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="max-w-md text-center space-y-3 p-8 rounded-2xl border-2 border-dashed border-amber-500/40 bg-amber-500/5">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300">
            <Calendar className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-foreground">Le Parcours est verrouillé</h3>
          <p className="text-sm text-muted-foreground">
            Construisez d&apos;abord la structure dans l&apos;onglet <strong>🛠️ Atelier</strong>,
            puis revenez ici pour planifier les sessions.
          </p>
        </div>
      </div>
    )
  }
  return <TimelineBoard programmeId={programmeId} programme={programme ?? null} />
}

// ──────────────────────────────────────────────────────────────────────────
//                              TIMELINE BOARD
// ──────────────────────────────────────────────────────────────────────────

function TimelineBoard({ programmeId, programme }: {
  programmeId: number
  programme: { title?: string; startDate?: string | null; endDate?: string | null } | null
}) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading,  setLoading]  = useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const r = await sessionsApi.list(programmeId)
      setSessions(r.data ?? [])
    } finally { setLoading(false) }
  }, [programmeId])
  useEffect(() => { reload() }, [reload])

  const win = useMemo(() => computeWindow(programme, sessions), [programme, sessions])
  const days = useMemo(() => {
    const out: Date[] = []
    const cur = new Date(win.start)
    while (cur <= win.end) { out.push(new Date(cur)); cur.setDate(cur.getDate() + 1) }
    return out
  }, [win])
  const totalMs = win.end.getTime() - win.start.getTime()

  // ── Lanes ────────────────────────────────────────────────────────────
  const lanes = useMemo(() => {
    const set = new Set<string>(['Principal'])
    for (const s of sessions) set.add(s.lane?.trim() || 'Principal')
    return Array.from(set)
  }, [sessions])

  const sessionsByLane = useMemo(() => {
    const m: Record<string, Session[]> = {}
    for (const lane of lanes) m[lane] = []
    for (const s of sessions) m[(s.lane?.trim() || 'Principal')]?.push(s)
    return m
  }, [sessions, lanes])

  const addLane = () => {
    const name = prompt('Nom de la nouvelle voie (ex. "Cohorte A") :')
    if (!name?.trim()) return
    const lane = name.trim()
    if (lanes.includes(lane)) { toast.error('Cette voie existe déjà'); return }
    // Lanes are derived from sessions — create an empty session in this lane
    // to make it appear. Use a "Présélection" by default (custom duration).
    // Simpler UX: just show the empty lane visually until a session is added.
    setSessions(arr => [...arr]) // no-op to trigger re-render
    toast.success(`Voie "${lane}" prête — glissez un préset dedans pour la peupler`)
    // Track the new lane locally
    setExtraLanes(prev => prev.includes(lane) ? prev : [...prev, lane])
  }
  const [extraLanes, setExtraLanes] = useState<string[]>([])
  const allLanes = useMemo(() => {
    const set = new Set([...lanes, ...extraLanes])
    return Array.from(set)
  }, [lanes, extraLanes])

  // ── CRUD ─────────────────────────────────────────────────────────────

  const addPreset = async (type: SessionType, atDate?: Date, lane?: string) => {
    const durationKind = PRESET_DURATIONS[type] ?? 'custom'
    const last = sessions.map(s => parseDate(s.endDate ?? s.startDate)).filter(Boolean)
                         .sort((a, b) => (a!.getTime() - b!.getTime())).pop() as Date | undefined
    const start = atDate ?? (last ? addDays(last, 1) : new Date())
    const end = durationKind === 'day' ? start
              : durationKind === 'week' ? addDays(start, 6)
              : addDays(start, 13)
    try {
      const r = await sessionsApi.create(programmeId, {
        title: TYPE_LABEL[type] ?? type,
        sessionType: type, durationKind,
        startDate: fmtISO(start), endDate: fmtISO(end),
        phaseOrder: sessions.length,
        lane: lane?.trim() || 'Principal',
      })
      toast.success(`${TYPE_LABEL[type]} ajoutée`)
      await reload()
      if (r?.data?.id) setSelectedId(r.data.id)
    } catch { toast.error('Erreur') }
  }

  const update = async (id: number, patch: Partial<Session>) => {
    setSessions(arr => arr.map(s => s.id === id ? { ...s, ...patch } : s))
    try { await sessionsApi.update(programmeId, id, patch) }
    catch { toast.error('Erreur'); reload() }
  }

  const remove = async (id: number) => {
    const s = sessions.find(x => x.id === id)
    if (!confirm(`Supprimer "${s?.title ?? '?'}" ?`)) return
    try {
      await sessionsApi.delete(programmeId, id)
      setSessions(arr => arr.filter(x => x.id !== id))
      if (selectedId === id) setSelectedId(null)
      toast.success('Supprimée')
    } catch { toast.error('Erreur') }
  }

  // ── Drag-from-library to a precise day in a specific lane ────────────
  const trackRef = useRef<HTMLDivElement>(null)
  const [dropPreview, setDropPreview] = useState<{ x: number; date: Date; lane: string } | null>(null)

  const xToDate = (clientX: number): Date | null => {
    const el = trackRef.current
    if (!el || days.length === 0) return null
    const rect = el.getBoundingClientRect()
    const x = clientX - rect.left
    if (rect.width <= 0) return null
    const idx = Math.floor((x / rect.width) * days.length)
    return new Date(days[Math.max(0, Math.min(days.length - 1, idx))])
  }

  // ── Drag a bar to move / resize ─────────────────────────────────────
  const dragRef = useRef<{
    id: number; mode: 'move' | 'resize-left' | 'resize-right' | 'lane'
    origX: number; origY: number; origStart: Date; origEnd: Date
    pxPerDay: number; origLane: string
  } | null>(null)
  const [drag, setDrag] = useState<{ id: number; deltaDays: number; mode: string } | null>(null)
  const [hoveredLane, setHoveredLane] = useState<string | null>(null)

  const startDrag = (s: Session, e: React.PointerEvent, mode: 'move' | 'resize-left' | 'resize-right') => {
    e.stopPropagation()
    if ((mode === 'resize-left' || mode === 'resize-right') && s.durationKind === 'day') return
    const sd = parseDate(s.startDate); const ed = parseDate(s.endDate ?? s.startDate)
    if (!sd || !ed) return
    const track = trackRef.current
    if (!track) return
    const pxPerDay = track.getBoundingClientRect().width / days.length
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    dragRef.current = {
      id: s.id, mode, origX: e.clientX, origY: e.clientY,
      origStart: sd, origEnd: ed, pxPerDay,
      origLane: s.lane?.trim() || 'Principal',
    }
  }

  const onBoardPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.origX
    const delta = Math.round(dx / dragRef.current.pxPerDay)
    setDrag({ id: dragRef.current.id, deltaDays: delta, mode: dragRef.current.mode })
    // Vertical lane-switching: detect which lane row is under the pointer
    if (dragRef.current.mode === 'move') {
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const laneEl = el?.closest('[data-lane]') as HTMLElement | null
      setHoveredLane(laneEl?.dataset.lane ?? null)
    }
  }

  const onBoardPointerUp = () => {
    if (!dragRef.current) { setDrag(null); setHoveredLane(null); return }
    const { id, mode, origStart, origEnd, origLane } = dragRef.current
    const dd = drag?.deltaDays ?? 0
    const newLane = hoveredLane && hoveredLane !== origLane ? hoveredLane : null
    dragRef.current = null
    setDrag(null); setHoveredLane(null)
    if (dd === 0 && !newLane) return
    const patch: Partial<Session> = {}
    if (mode === 'move') {
      patch.startDate = fmtISO(new Date(origStart.getTime() + dd * DAY_MS))
      patch.endDate   = fmtISO(new Date(origEnd.getTime()   + dd * DAY_MS))
      if (newLane) patch.lane = newLane
    } else if (mode === 'resize-right') {
      patch.endDate = fmtISO(new Date(Math.max(origStart.getTime(), origEnd.getTime() + dd * DAY_MS)))
    } else if (mode === 'resize-left') {
      patch.startDate = fmtISO(new Date(Math.min(origEnd.getTime(), origStart.getTime() + dd * DAY_MS)))
    }
    update(id, patch)
  }

  const selectedSession = sessions.find(s => s.id === selectedId) ?? null

  // ── Render ──────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin mr-2" />Chargement…
    </div>
  )

  const minWidth = Math.max(days.length * 32, 800)
  const drawerOpen = !!selectedSession

  return (
    <div className="flex flex-col h-full"
      onPointerMove={onBoardPointerMove} onPointerUp={onBoardPointerUp}>
      {/* HEADER */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-gradient-to-r from-amber-500/5 via-card to-rose-500/5 shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-rose-500 text-white shadow-sm">
          <Calendar className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground truncate">
            🗺️ Parcours · {programme?.title ?? `Programme #${programmeId}`}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {sessions.length} session{sessions.length > 1 ? 's' : ''} · {allLanes.length} voie{allLanes.length > 1 ? 's' : ''} ·
            {' '}{fmtMonthShort(win.start)} → {fmtMonthShort(win.end)} · autosauvegarde en direct
          </p>
        </div>
        <a href={`/programmes/${programmeId}/timeline`} target="_blank" rel="noreferrer"
          className="text-[11px] text-muted-foreground hover:text-brand-500 inline-flex items-center gap-1">
          Plein écran <ArrowUpRight className="h-3 w-3" />
        </a>
      </div>

      {/* LIBRARY STRIP */}
      <div className="px-4 py-2 border-b border-border bg-muted/20 flex flex-wrap items-center gap-1.5 shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-1">
          Bibliothèque
        </span>
        {SESSION_TYPES.map(t => {
          const c = TYPE_COLOR[t]
          const dur = PRESET_DURATIONS[t]
          return (
            <button key={t} type="button" draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/timeline-preset', t)
                e.dataTransfer.effectAllowed = 'copy'
              }}
              onClick={() => addPreset(t)}
              title="Clic = ajouter · Glisser = déposer sur un jour précis"
              className="group inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-grab active:cursor-grabbing shadow-sm hover:shadow"
              style={{ borderColor: c, color: c, background: c + '0D' }}>
              <span className="h-2 w-2 rounded-full" style={{ background: c }} />
              {TYPE_LABEL[t]}
              <span className="text-[9px] opacity-70">
                {dur === 'day' ? '1j' : dur === 'week' ? '7j' : '…'}
              </span>
              <Plus className="h-3 w-3 opacity-60 group-hover:opacity-100" />
            </button>
          )
        })}
        <button type="button" onClick={addLane}
          className="ml-2 inline-flex items-center gap-1 rounded-full border border-dashed border-emerald-500/50 bg-emerald-500/5 hover:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 text-[11px] font-semibold transition-all">
          <Plus className="h-3 w-3" />Nouvelle voie
        </button>
      </div>

      {/* TIMELINE BOARD — top portion (shrinks when drawer is open) */}
      <div className={`overflow-auto p-3 transition-all ${drawerOpen ? 'flex-1 max-h-[55%]' : 'flex-1'}`}
        onClick={() => setSelectedId(null)}>
        <div ref={trackRef} className="relative" style={{ minWidth }}>
          {/* Month axis */}
          <div className="sticky top-0 z-20 bg-card border-b-2 border-border h-9 flex">
            {days.map((d, i) => {
              const isMonthStart = d.getDate() === 1 || i === 0
              const isToday = d.toDateString() === new Date().toDateString()
              const isWeekend = d.getDay() === 0 || d.getDay() === 6
              return (
                <div key={i}
                  className={`flex-1 min-w-[28px] flex flex-col items-center justify-center text-[10px] ${isWeekend ? 'bg-muted/30' : ''} ${isMonthStart ? 'border-l-2 border-foreground/30' : 'border-l border-border/20'}`}>
                  <span className={`font-semibold ${isToday ? 'text-rose-600' : 'text-foreground/70'}`}>
                    {d.getDate()}
                  </span>
                  {isMonthStart && (
                    <span className="text-[8px] font-bold uppercase text-muted-foreground tracking-wider -mt-0.5">
                      {fmtMonthShort(d)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Today vertical line spans all lanes */}
          {(() => {
            const today = Date.now()
            if (today < win.start.getTime() || today > win.end.getTime()) return null
            const left = ((today - win.start.getTime()) / totalMs) * 100
            return (
              <div className="absolute top-9 bottom-0 w-px bg-rose-500/60 z-10 pointer-events-none"
                style={{ left: `${left}%` }}>
                <span className="absolute -top-1 -translate-x-1/2 rounded-sm bg-rose-500 px-1.5 py-0.5 text-[9px] font-bold text-white whitespace-nowrap">
                  aujourd&apos;hui
                </span>
              </div>
            )
          })()}

          {/* Weekend stripes spanning lanes */}
          {days.map((d, i) => {
            if (d.getDay() !== 0 && d.getDay() !== 6) return null
            const left = ((d.getTime() - win.start.getTime()) / totalMs) * 100
            const w = (DAY_MS / totalMs) * 100
            return (
              <div key={i} className="absolute top-9 bottom-0 bg-muted/20 pointer-events-none"
                style={{ left: `${left}%`, width: `${w}%` }} />
            )
          })}

          {/* Drop preview line + label */}
          {dropPreview && (
            <div className="absolute top-9 bottom-0 w-1 bg-emerald-500/80 z-30 pointer-events-none rounded-full"
              style={{ left: dropPreview.x - 2 }}>
              <span className="absolute -top-1 -translate-x-1/2 rounded-md bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold text-white whitespace-nowrap shadow-lg">
                {fmtShort(dropPreview.date)} · {dropPreview.lane}
              </span>
            </div>
          )}

          {/* Lanes */}
          <div className="pt-2 space-y-1">
            {allLanes.map(lane => (
              <LaneRow
                key={lane}
                lane={lane}
                sessions={sessionsByLane[lane] ?? []}
                win={win}
                days={days}
                trackRef={trackRef}
                isDropTarget={hoveredLane === lane}
                onDropPreset={(type, atDate) => addPreset(type, atDate, lane)}
                onDropPreviewMove={(x, d) => setDropPreview({ x, date: d, lane })}
                onDropPreviewLeave={() => setDropPreview(null)}
                selectedId={selectedId}
                drag={drag}
                onSelect={(id) => setSelectedId(id)}
                onStartDrag={startDrag}
              />
            ))}
          </div>
        </div>

        {sessions.length === 0 && (
          <EmptyHint />
        )}
      </div>

      {/* BOTTOM DRAWER */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            key="drawer"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 border-t-2 border-border bg-card shadow-[0_-8px_20px_-8px_rgba(0,0,0,0.15)]"
            style={{ height: '45%', minHeight: 260 }}>
            <BottomDrawer
              programmeId={programmeId}
              session={selectedSession!}
              allLanes={allLanes}
              onUpdate={(patch) => update(selectedSession!.id, patch)}
              onRemove={() => remove(selectedSession!.id)}
              onClose={() => setSelectedId(null)}
              onDaysChanged={reload}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
//                                  LANE ROW
// ──────────────────────────────────────────────────────────────────────────

function LaneRow({
  lane, sessions, win, days, trackRef, isDropTarget,
  onDropPreset, onDropPreviewMove, onDropPreviewLeave,
  selectedId, drag, onSelect, onStartDrag,
}: {
  lane: string
  sessions: Session[]
  win: Window
  days: Date[]
  trackRef: React.RefObject<HTMLDivElement>
  isDropTarget: boolean
  onDropPreset: (type: SessionType, atDate: Date) => void
  onDropPreviewMove: (x: number, d: Date) => void
  onDropPreviewLeave: () => void
  selectedId: number | null
  drag: { id: number; deltaDays: number; mode: string } | null
  onSelect: (id: number) => void
  onStartDrag: (s: Session, e: React.PointerEvent, mode: 'move' | 'resize-left' | 'resize-right') => void
}) {
  const totalMs = win.end.getTime() - win.start.getTime()
  const ROW_HEIGHT = 56

  return (
    <div
      data-lane={lane}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('application/timeline-preset')) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
        const rect = trackRef.current?.getBoundingClientRect()
        if (rect && days.length) {
          const x = e.clientX - rect.left
          const idx = Math.floor((x / rect.width) * days.length)
          onDropPreviewMove(x, days[Math.max(0, Math.min(days.length - 1, idx))])
        }
      }}
      onDragLeave={onDropPreviewLeave}
      onDrop={(e) => {
        e.preventDefault()
        const t = e.dataTransfer.getData('application/timeline-preset') as SessionType
        onDropPreviewLeave()
        if (!t) return
        const rect = trackRef.current?.getBoundingClientRect()
        if (!rect || !days.length) return
        const idx = Math.floor(((e.clientX - rect.left) / rect.width) * days.length)
        onDropPreset(t, days[Math.max(0, Math.min(days.length - 1, idx))])
      }}
      className={`relative rounded-xl border-2 transition-colors ${
        isDropTarget
          ? 'border-emerald-500/70 bg-emerald-500/10'
          : 'border-transparent hover:border-border bg-muted/10'
      }`}
      style={{ height: ROW_HEIGHT }}>
      {/* Lane label — sticky on the left */}
      <div className="absolute left-1 top-1.5 z-10 flex items-center gap-1 rounded-md bg-card/95 backdrop-blur border border-border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground shadow-sm pointer-events-none">
        <GripVertical className="h-2.5 w-2.5 opacity-40" />
        {lane}
      </div>

      {/* Empty lane hint */}
      {sessions.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-[11px] text-muted-foreground italic">
            voie vide — glissez un préset ici
          </span>
        </div>
      )}

      {/* Session bars in this lane */}
      {sessions.map((s) => {
        const sd = parseDate(s.startDate); const ed = parseDate(s.endDate ?? s.startDate)
        if (!sd || !ed) return null
        const left = ((sd.getTime() - win.start.getTime()) / totalMs) * 100
        const widthMs = Math.max(ed.getTime() - sd.getTime() + DAY_MS, DAY_MS)
        const width = (widthMs / totalMs) * 100
        const myDrag = drag?.id === s.id ? drag : null
        const pxPerDay = (trackRef.current?.getBoundingClientRect().width ?? 0) / days.length
        const offsetPx = myDrag?.mode === 'move'         ? myDrag.deltaDays * pxPerDay : 0
        const rightDx  = myDrag?.mode === 'resize-right' ? myDrag.deltaDays * pxPerDay : 0
        const leftDx   = myDrag?.mode === 'resize-left'  ? myDrag.deltaDays * pxPerDay : 0
        return (
          <SessionBar key={s.id}
            session={s}
            left={`calc(${left}% + ${offsetPx + leftDx}px)`}
            width={`calc(${width}% + ${rightDx - leftDx}px)`}
            isSelected={selectedId === s.id}
            onSelect={(e) => { e.stopPropagation(); onSelect(s.id) }}
            onPointerDown={(e) => onStartDrag(s, e, 'move')}
            onResizeLeft={(e) => onStartDrag(s, e, 'resize-left')}
            onResizeRight={(e) => onStartDrag(s, e, 'resize-right')}
          />
        )
      })}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
//                                SESSION BAR
// ──────────────────────────────────────────────────────────────────────────

function SessionBar({
  session, left, width, isSelected, onSelect, onPointerDown, onResizeLeft, onResizeRight,
}: {
  session: Session
  left: string; width: string
  isSelected: boolean
  onSelect: (e: React.MouseEvent) => void
  onPointerDown: (e: React.PointerEvent) => void
  onResizeLeft: (e: React.PointerEvent) => void
  onResizeRight: (e: React.PointerEvent) => void
}) {
  const c = TYPE_COLOR[session.sessionType as string] ?? '#10B981'
  const locked = session.durationKind === 'day'
  const { critical, warnings } = detectMissing(session)

  // Day-tick marks inside the bar (subtle vertical dividers per day)
  const sd = parseDate(session.startDate); const ed = parseDate(session.endDate ?? session.startDate)
  const dayCount = sd && ed ? Math.max(1, Math.round((ed.getTime() - sd.getTime()) / DAY_MS) + 1) : 1
  const ticks = Array.from({ length: Math.max(0, dayCount - 1) }, (_, i) => (i + 1) / dayCount)

  return (
    <div
      onClick={onSelect}
      onPointerDown={onPointerDown}
      title={`${session.title}  ${session.startDate ?? '?'} → ${session.endDate ?? '?'}\n${session.lane ?? 'Principal'}`}
      className={`absolute rounded-xl flex items-center text-[11px] font-bold text-white cursor-grab active:cursor-grabbing select-none transition-shadow shadow-md hover:shadow-lg overflow-hidden ${isSelected ? 'ring-2 ring-offset-2 ring-foreground/40' : ''}`}
      style={{
        left, width,
        height: 36, top: 10,
        background: `linear-gradient(135deg, ${c}, ${c}DD)`,
      }}>
      {/* Left resize handle */}
      <div
        onPointerDown={(e) => { e.stopPropagation(); onResizeLeft(e) }}
        title={locked ? 'Verrouillé (Journée)' : 'Glisser pour avancer la date de début'}
        className={`shrink-0 self-stretch w-2 ${
          locked ? 'cursor-not-allowed opacity-20' : 'cursor-ew-resize hover:bg-white/30'
        }`} />

      {/* Day-tick marks — thin vertical lines on each day boundary inside the bar */}
      {ticks.map((pct, i) => (
        <div key={i} className="absolute top-1 bottom-1 w-px bg-white/30 pointer-events-none"
          style={{ left: `${pct * 100}%` }} />
      ))}

      {/* Body */}
      <div className="flex-1 min-w-0 px-2.5 truncate flex items-center gap-1.5">
        <span className="truncate">{session.title || '·'}</span>
        {dayCount > 1 && (
          <span className="text-[9px] opacity-75 rounded-full bg-white/20 px-1 py-0.5 shrink-0">
            {dayCount}j
          </span>
        )}
      </div>

      {/* Status / type pip on the right */}
      <span className="shrink-0 text-[9px] opacity-90 rounded-full bg-white/20 px-1.5 py-0.5 mr-1 uppercase tracking-wider">
        {(TYPE_LABEL[session.sessionType ?? '']?.slice(0, 3) ?? '·')}
      </span>

      {/* Warnings (top-right) */}
      {(critical.length > 0 || warnings.length > 0) && (
        <div className="absolute -top-1 -right-1 flex gap-0.5">
          {critical.length > 0 && (
            <div className="h-3 w-3 rounded-full bg-rose-500 ring-2 ring-card flex items-center justify-center"
              title={`Critique : ${critical.join(', ')}`}>
              <AlertTriangle className="h-2 w-2 text-white" />
            </div>
          )}
          {warnings.length > 0 && (
            <div className="h-3 w-3 rounded-full bg-amber-400 ring-2 ring-card flex items-center justify-center"
              title={`Attention : ${warnings.join(', ')}`}>
              <Info className="h-2 w-2 text-white" />
            </div>
          )}
        </div>
      )}

      {/* Right resize handle */}
      <div
        onPointerDown={(e) => { e.stopPropagation(); onResizeRight(e) }}
        title={locked ? 'Verrouillé (Journée)' : 'Glisser pour rallonger'}
        className={`shrink-0 self-stretch w-2 ${
          locked ? 'cursor-not-allowed opacity-20' : 'cursor-ew-resize hover:bg-white/30'
        }`} />
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
//                              EMPTY HINT
// ──────────────────────────────────────────────────────────────────────────

function EmptyHint() {
  return (
    <div className="mt-4 rounded-xl border border-dashed border-emerald-500/40 bg-emerald-500/5 p-4 text-center">
      <p className="text-xs text-emerald-700 dark:text-emerald-300 font-bold">
        ↑ Glissez un préset de la bibliothèque vers la voie « Principal » pour démarrer
      </p>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
//                              BOTTOM DRAWER
// ──────────────────────────────────────────────────────────────────────────

function BottomDrawer({
  programmeId, session, allLanes, onUpdate, onRemove, onClose, onDaysChanged,
}: {
  programmeId: number
  session: Session
  allLanes: string[]
  onUpdate: (p: Partial<Session>) => void
  onRemove: () => void
  onClose: () => void
  onDaysChanged: () => void
}) {
  const c = TYPE_COLOR[session.sessionType as string] ?? '#10B981'
  const { critical, warnings } = detectMissing(session)

  return (
    <div className="h-full flex flex-col">
      {/* Drawer header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border"
        style={{ borderTopWidth: 3, borderTopColor: c }}>
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: c }}>
          {TYPE_LABEL[session.sessionType ?? ''] ?? 'Session'}
        </span>
        <span className="text-sm font-bold text-foreground truncate">{session.title}</span>
        {critical.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-300/40 px-2 py-0.5 text-[10px] font-bold">
            <AlertTriangle className="h-3 w-3" />Critique : {critical.join(', ')}
          </span>
        )}
        {warnings.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-300/40 px-2 py-0.5 text-[10px] font-bold">
            <Info className="h-3 w-3" />{warnings.join(', ')}
          </span>
        )}
        <button onClick={onClose} className="ml-auto p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
          title="Fermer">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body — two panels */}
      <div className="flex-1 grid grid-cols-[290px_1fr] min-h-0">
        <EditorPanel session={session} allLanes={allLanes} onUpdate={onUpdate} onRemove={onRemove} />
        <DayCanvas
          programmeId={programmeId}
          session={session}
          onChanged={onDaysChanged}
        />
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
//                              EDITOR PANEL (left of drawer)
// ──────────────────────────────────────────────────────────────────────────

function EditorPanel({ session, allLanes, onUpdate, onRemove }: {
  session: Session
  allLanes: string[]
  onUpdate: (p: Partial<Session>) => void
  onRemove: () => void
}) {
  const [title, setTitle] = useState(session.title ?? '')
  const [location, setLocation] = useState(session.location ?? '')
  const [description, setDescription] = useState(session.description ?? '')
  const [lane, setLane] = useState(session.lane ?? 'Principal')
  useEffect(() => { setTitle(session.title ?? '') }, [session.title])
  useEffect(() => { setLocation(session.location ?? '') }, [session.location])
  useEffect(() => { setDescription(session.description ?? '') }, [session.description])
  useEffect(() => { setLane(session.lane ?? 'Principal') }, [session.lane])

  return (
    <div className="border-r border-border bg-muted/10 overflow-y-auto p-3 space-y-3">
      {/* Type + Status */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1">
            <Tag className="h-3 w-3" />Type
          </label>
          <select value={session.sessionType ?? 'INCUBATION'}
            onChange={(e) => onUpdate({ sessionType: e.target.value as any })}
            className="mt-0.5 w-full h-8 text-xs rounded-md border border-input bg-background px-2">
            {SESSION_TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground">Statut</label>
          <select value={session.status ?? 'UPCOMING'}
            onChange={(e) => onUpdate({ status: e.target.value as any })}
            className="mt-0.5 w-full h-8 text-xs rounded-md border border-input bg-background px-2">
            <option value="UPCOMING">À venir</option>
            <option value="ACTIVE">En cours</option>
            <option value="COMPLETED">Terminée</option>
          </select>
        </div>
      </div>

      <div>
        <label className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground">Titre *</label>
        <Input value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => { if (title !== session.title) onUpdate({ title }) }}
          placeholder="Titre de la session"
          className="h-8 text-sm font-bold mt-0.5" />
      </div>

      {/* Lane */}
      <div>
        <label className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1">
          <Layers className="h-3 w-3" />Voie
        </label>
        <input list="lane-list" value={lane}
          onChange={(e) => setLane(e.target.value)}
          onBlur={() => { if (lane.trim() && lane !== session.lane) onUpdate({ lane: lane.trim() }) }}
          placeholder="Principal, Cohorte A…"
          className="mt-0.5 w-full h-8 text-xs rounded-md border border-input bg-background px-2 focus:outline-none focus:ring-2 focus:ring-ring" />
        <datalist id="lane-list">
          {allLanes.map(l => <option key={l} value={l} />)}
        </datalist>
      </div>

      {/* Duration */}
      <div>
        <label className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground">Durée</label>
        <div className="flex gap-1 mt-0.5">
          {(['day', 'week', 'custom'] as const).map(k => (
            <button key={k} type="button"
              onClick={() => {
                const patch: Partial<Session> = { durationKind: k }
                if (session.startDate) {
                  if (k === 'day') patch.endDate = session.startDate
                  else if (k === 'week') {
                    const sd = parseDate(session.startDate)!
                    patch.endDate = fmtISO(addDays(sd, 6))
                  }
                }
                onUpdate(patch)
              }}
              className={`flex-1 rounded-md border px-1.5 py-1 text-[11px] font-semibold transition-colors ${
                session.durationKind === k
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'border-border text-muted-foreground hover:border-emerald-400'}`}>
              {k === 'day' ? 'Journée' : k === 'week' ? 'Semaine' : 'Custom'}
            </button>
          ))}
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground">Début</label>
          <Input type="date" value={session.startDate ?? ''}
            onChange={(e) => {
              const sd = e.target.value
              const patch: Partial<Session> = { startDate: sd }
              if (session.durationKind === 'day') patch.endDate = sd
              else if (session.durationKind === 'week' && sd) {
                patch.endDate = fmtISO(addDays(parseDate(sd)!, 6))
              }
              onUpdate(patch)
            }}
            className="h-7 text-[11px] mt-0.5" />
        </div>
        <div>
          <label className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground">
            Fin {session.durationKind === 'day' && '(=Début)'}
          </label>
          <Input type="date" value={session.endDate ?? ''}
            disabled={session.durationKind === 'day'}
            onChange={(e) => onUpdate({ endDate: e.target.value })}
            className={`h-7 text-[11px] mt-0.5 ${session.durationKind === 'day' ? 'opacity-60 cursor-not-allowed' : ''}`} />
        </div>
      </div>

      <div>
        <label className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1">
          <MapPin className="h-3 w-3" />Lieu
        </label>
        <Input value={location} placeholder='"Salle A" ou "Online"'
          onChange={(e) => setLocation(e.target.value)}
          onBlur={() => { if (location !== (session.location ?? '')) onUpdate({ location }) }}
          className="h-7 text-[11px] mt-0.5" />
      </div>

      <div>
        <label className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1">
          <FileText className="h-3 w-3" />Description
        </label>
        <textarea rows={3} value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => { if (description !== (session.description ?? '')) onUpdate({ description }) }}
          className="mt-0.5 w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] resize-y focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>

      <div className="pt-2 border-t border-border">
        <button onClick={onRemove}
          className="w-full inline-flex items-center justify-center gap-1 text-[11px] font-semibold text-destructive hover:bg-destructive/10 px-2 py-1.5 rounded-md border border-destructive/30">
          <Trash2 className="h-3 w-3" />Supprimer la session
        </button>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
//                              DAY CANVAS (right of drawer)
// ──────────────────────────────────────────────────────────────────────────

const HOUR_START = 8   // 08:00
const HOUR_END   = 20  // 20:00
const HOUR_PX    = 52  // each hour row is 52px tall — roomy, legible blocks
const SNAP_MIN   = 15  // drag/resize snaps to 15-minute steps

// time ⇄ minutes-since-midnight helpers ───────────────────────────────────────
const timeToMin = (t?: string): number => {
  if (!t) return HOUR_START * 60
  const [h, m] = t.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}
const minToTime = (min: number): string => {
  const c = Math.max(0, Math.min(24 * 60 - 1, Math.round(min)))
  return `${String(Math.floor(c / 60)).padStart(2, '0')}:${String(c % 60).padStart(2, '0')}:00`
}
const snap = (min: number) => Math.round(min / SNAP_MIN) * SNAP_MIN
const fmtHM = (t?: string) => (t ?? '').slice(0, 5)
const durLabel = (a: Activity): string => {
  const d = Math.max(0, timeToMin(a.endTime) - timeToMin(a.startTime))
  if (d === 0) return ''
  const h = Math.floor(d / 60), m = d % 60
  return h > 0 ? (m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`) : `${m}min`
}

function DayCanvas({ programmeId, session, onChanged }: {
  programmeId: number
  session: Session
  onChanged: () => void
}) {
  // Days are ALWAYS rendered from session.days OR from the date range if days
  // haven't been created yet (lazy creation on first activity add).
  const [days, setDays] = useState<SessionDay[]>(session.days ?? [])
  const [loading, setLoading] = useState(false)
  useEffect(() => { setDays(session.days ?? []) }, [session.days, session.id])

  const sd = parseDate(session.startDate); const ed = parseDate(session.endDate ?? session.startDate)
  const dayCount = sd && ed ? Math.max(1, Math.round((ed.getTime() - sd.getTime()) / DAY_MS) + 1) : 1

  /** Phantom days based on the session date range (used when no DB days exist yet). */
  const phantomDays = useMemo<SessionDay[]>(() => {
    if (!sd) return []
    return Array.from({ length: dayCount }, (_, i) => ({
      dayOrder: i + 1,
      date: fmtISO(addDays(sd, i)),
      activities: [],
    }))
  }, [sd, dayCount])

  /** Effective days = real days indexed by order, padded with phantoms. */
  const visibleDays = useMemo<SessionDay[]>(() => {
    const out: SessionDay[] = []
    for (let i = 1; i <= dayCount; i++) {
      const real = days.find(d => d.dayOrder === i)
      out.push(real ?? (phantomDays[i - 1] ?? { dayOrder: i, activities: [] }))
    }
    return out
  }, [days, phantomDays, dayCount])

  /** Ensure a DB day exists for the given order — create on demand. */
  const ensureDay = async (dayOrder: number, date?: string): Promise<SessionDay | null> => {
    const existing = days.find(d => d.dayOrder === dayOrder)
    if (existing?.id) return existing
    setLoading(true)
    try {
      const r = await sessionsApi.addDay(programmeId, session.id, {
        dayOrder, date: date ?? null, title: null, location: null,
      } as any)
      const created: SessionDay = r.data
      setDays(arr => [...arr, created])
      return created
    } catch { toast.error('Erreur jour'); return null } finally { setLoading(false) }
  }

  const addActivity = async (dayOrder: number, defaultDate?: string, startMin?: number) => {
    const d = await ensureDay(dayOrder, defaultDate)
    if (!d?.id) return
    const start = startMin != null ? snap(startMin) : 9 * 60
    const end   = Math.min(HOUR_END * 60, start + 60)
    try {
      const r = await sessionsApi.addActivity(programmeId, session.id, d.id, {
        title: 'Nouvelle activité',
        type: 'ACTIVITY',
        startTime: minToTime(start),
        endTime:   minToTime(end),
      })
      const created: Activity = r.data
      setDays(arr => arr.map(x => x.id === d.id ? { ...x, activities: [...(x.activities ?? []), created] } : x))
      onChanged()
    } catch { toast.error('Erreur activité') }
  }

  const updateActivity = async (dayId: number, aid: number, patch: Partial<Activity>) => {
    setDays(arr => arr.map(x => x.id === dayId
      ? { ...x, activities: (x.activities ?? []).map(a => a.id === aid ? { ...a, ...patch } : a) }
      : x))
    try { await sessionsApi.updateActivity(programmeId, session.id, dayId, aid, patch) }
    catch { toast.error('Erreur'); }
  }

  const removeActivity = async (dayId: number, aid: number) => {
    if (!confirm('Supprimer cette activité ?')) return
    try {
      await sessionsApi.deleteActivity(programmeId, session.id, dayId, aid)
      setDays(arr => arr.map(x => x.id === dayId
        ? { ...x, activities: (x.activities ?? []).filter(a => a.id !== aid) } : x))
      onChanged()
    } catch { toast.error('Erreur') }
  }

  if (dayCount === 0 || !sd) {
    return (
      <div className="flex items-center justify-center text-muted-foreground text-xs italic">
        Renseignez d&apos;abord la date de début à gauche pour activer le planning des journées.
      </div>
    )
  }

  return (
    <div className="overflow-auto bg-muted/5">
      <div className="flex h-full" style={{ minWidth: dayCount * 260 }}>
        {/* Hours column (sticky left) */}
        <div className="sticky left-0 z-10 bg-card border-r border-border w-12 shrink-0">
          <div className="h-9 border-b border-border" />
          {Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i).map(h => (
            <div key={h} className="text-[10px] font-bold uppercase text-muted-foreground text-right pr-1 -mt-1.5"
              style={{ height: HOUR_PX }}>
              {h}h
            </div>
          ))}
        </div>

        {/* Day columns */}
        {visibleDays.map(d => (
          <DayColumn key={d.dayOrder}
            day={d}
            onAddActivity={(startMin) => addActivity(d.dayOrder ?? 1, d.date, startMin)}
            onUpdateActivity={(aid, patch) => d.id && updateActivity(d.id, aid, patch)}
            onRemoveActivity={(aid) => d.id && removeActivity(d.id, aid)}
          />
        ))}
      </div>
      {loading && (
        <div className="absolute top-2 right-2 text-xs text-muted-foreground inline-flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />Sauvegarde…
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
//                              DAY COLUMN
// ──────────────────────────────────────────────────────────────────────────

function DayColumn({ day, onAddActivity, onUpdateActivity, onRemoveActivity }: {
  day: SessionDay
  onAddActivity: () => void
  onUpdateActivity: (aid: number, patch: Partial<Activity>) => void
  onRemoveActivity: (aid: number) => void
}) {
  const COLUMN_HEIGHT = (HOUR_END - HOUR_START + 1) * HOUR_PX
  const dateLabel = day.date ? new Date(day.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) : '?'

  /** Convert HH:mm:ss → vertical Y offset in px from top of column body. */
  const timeToY = (t?: string): number => {
    if (!t) return 0
    const [h, m] = t.split(':').map(Number)
    return ((h - HOUR_START) + (m ?? 0) / 60) * HOUR_PX
  }
  const yToTime = (y: number): string => {
    const totalHours = y / HOUR_PX + HOUR_START
    const h = Math.max(HOUR_START, Math.min(HOUR_END, Math.floor(totalHours)))
    const m = Math.round((totalHours - h) * 60 / 15) * 15
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
  }

  return (
    <div className="border-r border-border min-w-[200px] flex-1 flex flex-col">
      {/* Day header */}
      <div className="sticky top-0 z-10 bg-card border-b-2 border-border h-9 flex items-center justify-between px-2 shadow-sm">
        <span className="text-[11px] font-bold text-foreground">
          Jour {day.dayOrder}
        </span>
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
          {dateLabel}
        </span>
        <button onClick={onAddActivity} title="Ajouter une activité"
          className="text-emerald-600 hover:text-emerald-700 p-0.5 rounded hover:bg-emerald-500/10">
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Hour grid */}
      <div className="relative" style={{ height: COLUMN_HEIGHT }}>
        {Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => (
          <div key={i} className={`absolute left-0 right-0 border-t ${i % 2 === 0 ? 'border-border/40' : 'border-border/20'}`}
            style={{ top: i * HOUR_PX, height: HOUR_PX }} />
        ))}

        {/* Activities */}
        {(day.activities ?? []).map(a => (
          <ActivityBlock key={a.id}
            activity={a}
            yToTime={yToTime}
            timeToY={timeToY}
            onUpdate={(patch) => a.id && onUpdateActivity(a.id, patch)}
            onRemove={() => a.id && onRemoveActivity(a.id)}
          />
        ))}

        {(day.activities ?? []).length === 0 && (
          <button onClick={onAddActivity}
            className="absolute inset-2 rounded-lg border-2 border-dashed border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/60 transition-colors flex items-center justify-center text-[10px] font-bold text-emerald-700 dark:text-emerald-300 gap-1">
            <Plus className="h-3 w-3" />Ajouter une activité
          </button>
        )}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
//                             ACTIVITY BLOCK
// ──────────────────────────────────────────────────────────────────────────

function ActivityBlock({ activity, yToTime, timeToY, onUpdate, onRemove }: {
  activity: Activity
  yToTime: (y: number) => string
  timeToY: (t?: string) => number
  onUpdate: (patch: Partial<Activity>) => void
  onRemove: () => void
}) {
  const top    = timeToY(activity.startTime)
  const bottom = timeToY(activity.endTime ?? activity.startTime)
  const height = Math.max(20, bottom - top)
  const c = ACTIVITY_TYPE_COLOR[activity.type as string] ?? '#10B981'
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(activity.title)
  useEffect(() => { setTitle(activity.title) }, [activity.title])

  return (
    <div
      onClick={() => setEditing(true)}
      style={{ top, height, left: 4, right: 4, background: c, borderLeft: `3px solid ${c}` }}
      className="absolute rounded-md text-white text-[10px] font-bold p-1 shadow-md cursor-pointer hover:shadow-lg transition-shadow overflow-hidden">
      <div className="flex items-start justify-between gap-1">
        <span className="truncate flex-1">{activity.title || 'Sans titre'}</span>
        <button onClick={(e) => { e.stopPropagation(); onRemove() }}
          className="text-white/70 hover:text-white" title="Supprimer">
          <X className="h-2.5 w-2.5" />
        </button>
      </div>
      <div className="text-[9px] opacity-90">
        {(activity.startTime ?? '').slice(0, 5)} → {(activity.endTime ?? '').slice(0, 5)}
      </div>

      {/* Inline editor popover */}
      {editing && (
        <div onClick={(e) => e.stopPropagation()}
          className="absolute z-30 top-full left-0 mt-1 w-60 rounded-md bg-card text-foreground border-2 shadow-xl p-2 space-y-1.5"
          style={{ borderColor: c }}>
          <div className="flex items-center gap-1">
            <select value={activity.type ?? 'ACTIVITY'}
              onChange={(e) => onUpdate({ type: e.target.value as any })}
              className="text-[10px] rounded border bg-background px-1 py-0.5">
              {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{ACTIVITY_TYPE_LABEL[t]}</option>)}
            </select>
            <button onClick={() => setEditing(false)} className="ml-auto p-0.5 rounded hover:bg-accent" title="Fermer">
              <X className="h-3 w-3" />
            </button>
          </div>
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            onBlur={() => { if (title !== activity.title) onUpdate({ title }) }}
            placeholder="Titre"
            className="w-full h-7 px-1.5 text-[11px] rounded border bg-background font-bold" />
          <div className="grid grid-cols-2 gap-1">
            <input type="time" value={(activity.startTime ?? '').slice(0, 5)}
              onChange={(e) => onUpdate({ startTime: e.target.value + ':00' })}
              className="w-full h-7 px-1.5 text-[10px] rounded border bg-background" />
            <input type="time" value={(activity.endTime ?? '').slice(0, 5)}
              onChange={(e) => onUpdate({ endTime: e.target.value + ':00' })}
              className="w-full h-7 px-1.5 text-[10px] rounded border bg-background" />
          </div>
          <input value={activity.location ?? ''}
            onChange={(e) => onUpdate({ location: e.target.value })}
            placeholder="Lieu"
            className="w-full h-7 px-1.5 text-[10px] rounded border bg-background" />
          <input value={(activity.responsibles ?? []).join(', ')}
            onChange={(e) => onUpdate({ responsibles: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
            placeholder="Responsables (virgule)"
            className="w-full h-7 px-1.5 text-[10px] rounded border bg-background" />
        </div>
      )}
    </div>
  )
}
