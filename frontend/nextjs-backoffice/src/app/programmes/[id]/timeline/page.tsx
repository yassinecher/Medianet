'use client'
/**
 * /programmes/[id]/timeline — dedicated full-width Timeline editor.
 *
 * Inspired by video-editing timelines: one horizontal "river" of colored
 * session blocks placed by date, with annotation cards floating above and
 * below the track. Drag a block to reschedule (changes startDate, keeps
 * duration). Drag the right edge to resize — but only when durationKind
 * allows it (day-locked sessions cannot be resized).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Loader2, ZoomIn, ZoomOut, Calendar, MapPin, Users, Plus,
  Layers, Save, Sparkles, ChevronLeft, ChevronRight,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { programmesApi, sessionsApi, SESSION_TYPES } from '@/lib/api'
import type { SessionType } from '@/lib/api'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// ── Domain types ───────────────────────────────────────────────────────────

interface Session {
  id: number
  title: string
  description?: string
  startDate?: string
  endDate?: string
  durationKind?: 'day' | 'week' | 'custom'
  location?: string
  responsibles?: string[]
  guests?: string[]
  sessionType?: SessionType | string
  status?: 'UPCOMING' | 'ACTIVE' | 'COMPLETED'
  days?: any[]
  phaseOrder?: number
}

// ── Style atlas (matches the rest of the app) ─────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  CANDIDATURE_SUBMISSION: 'Candidature', PRESELECTION: 'Présélection',
  PITCH_DAY: 'Pitch Day', ONBOARDING: 'Onboarding', INCUBATION: 'Incubation',
  DEMO_DAY: 'Demo Day', TRAINING_DAY: 'Formation',
}

/** Foreground / track colors per session type — chosen to feel like the reference image. */
const TYPE_PALETTE: Record<string, { bar: string; light: string; ring: string; text: string }> = {
  CANDIDATURE_SUBMISSION: { bar: '#0EA5E9', light: '#BAE6FD', ring: 'ring-sky-500/40',     text: 'text-sky-50'     }, // sky
  PRESELECTION:           { bar: '#F59E0B', light: '#FDE68A', ring: 'ring-amber-500/40',   text: 'text-amber-950'  }, // amber
  PITCH_DAY:              { bar: '#EF4444', light: '#FECACA', ring: 'ring-rose-500/40',    text: 'text-rose-50'    }, // rose
  ONBOARDING:             { bar: '#10B981', light: '#A7F3D0', ring: 'ring-emerald-500/40', text: 'text-emerald-50' }, // emerald
  INCUBATION:             { bar: '#A855F7', light: '#E9D5FF', ring: 'ring-purple-500/40',  text: 'text-purple-50'  }, // purple
  DEMO_DAY:               { bar: '#F97316', light: '#FED7AA', ring: 'ring-orange-500/40',  text: 'text-orange-50'  }, // orange
  TRAINING_DAY:           { bar: '#6366F1', light: '#C7D2FE', ring: 'ring-indigo-500/40',  text: 'text-indigo-50'  }, // indigo
  _DEFAULT:               { bar: '#64748B', light: '#CBD5E1', ring: 'ring-slate-500/40',   text: 'text-slate-50'   },
}
function paletteFor(t?: string) { return TYPE_PALETTE[t ?? '_DEFAULT'] ?? TYPE_PALETTE._DEFAULT }

// ── Date helpers ───────────────────────────────────────────────────────────

const DAY_MS = 86_400_000

function parseDate(s?: string): Date | null {
  if (!s) return null
  const d = new Date(s + 'T12:00:00')
  return isNaN(d.getTime()) ? null : d
}
function fmtISO(d: Date): string { return d.toISOString().slice(0, 10) }
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r }
function diffDays(a: Date, b: Date): number { return Math.round((b.getTime() - a.getTime()) / DAY_MS) }
function fmtShort(d: Date) { return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) }
function fmtMonth(d: Date) { return d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }) }
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1) }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0) }

/**
 * Range of the track = the programme's own start/end dates whenever they are
 * defined. If a session sticks out before/after the programme bounds, the
 * track is extended just enough to include it so the user still sees it (and
 * notices the overflow). When the programme has no dates yet, we fall back to
 * the union of session dates, then to the current month.
 */
function computeRange(
  programme: { startDate?: string | null; endDate?: string | null } | null,
  sessions: Session[],
): { start: Date; end: Date; programmeStart: Date | null; programmeEnd: Date | null } {
  const pStart = parseDate(programme?.startDate ?? undefined)
  const pEnd   = parseDate(programme?.endDate   ?? undefined)
  const sessionStarts = sessions.map(s => parseDate(s.startDate)).filter(Boolean) as Date[]
  const sessionEnds   = sessions.map(s => parseDate(s.endDate ?? s.startDate)).filter(Boolean) as Date[]

  // Primary range: programme bounds (preferred) or session union or today.
  let lo: Date, hi: Date
  if (pStart && pEnd) {
    lo = pStart; hi = pEnd
  } else if (pStart) {
    lo = pStart
    hi = sessionEnds.length ? new Date(Math.max(...sessionEnds.map(d => d.getTime()))) : addDays(pStart, 90)
  } else if (pEnd) {
    lo = sessionStarts.length ? new Date(Math.min(...sessionStarts.map(d => d.getTime()))) : addDays(pEnd, -90)
    hi = pEnd
  } else if (sessionStarts.length || sessionEnds.length) {
    lo = sessionStarts.length ? new Date(Math.min(...sessionStarts.map(d => d.getTime()))) : new Date()
    hi = sessionEnds.length   ? new Date(Math.max(...sessionEnds.map(d => d.getTime())))   : addDays(lo, 30)
  } else {
    lo = new Date(); hi = addDays(lo, 90)
  }

  // Extend to include any out-of-bounds session (with a small visual cushion).
  if (sessionStarts.length) {
    const minS = new Date(Math.min(...sessionStarts.map(d => d.getTime())))
    if (minS < lo) lo = addDays(minS, -3)
  }
  if (sessionEnds.length) {
    const maxS = new Date(Math.max(...sessionEnds.map(d => d.getTime())))
    if (maxS > hi) hi = addDays(maxS, 3)
  }

  // Snap to whole months for nicer gridlines.
  lo = startOfMonth(lo)
  hi = endOfMonth(hi)
  return { start: lo, end: hi, programmeStart: pStart, programmeEnd: pEnd }
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function TimelinePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const pid = Number(id)
  const [loading, setLoading] = useState(true)
  const [programme, setProgramme] = useState<any>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [pxPerDay, setPxPerDay] = useState(8) // zoom level
  const [selectedId, setSelectedId] = useState<number | null>(null)

  // ── Load ────────────────────────────────────────────────────────────────

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [p, s] = await Promise.all([
        programmesApi.get(pid),
        sessionsApi.list(pid),
      ])
      setProgramme(p.data)
      setSessions(s.data ?? [])
    } catch (e: any) {
      toast.error('Programme introuvable')
    } finally { setLoading(false) }
  }, [pid])

  useEffect(() => { reload() }, [reload])

  // ── Range / layout ──────────────────────────────────────────────────────

  const range = useMemo(() => computeRange(programme, sessions), [programme, sessions])
  const totalDays = useMemo(() => diffDays(range.start, range.end) + 1, [range])
  const trackWidth = totalDays * pxPerDay

  /** Month ticks across the track */
  const monthTicks = useMemo(() => {
    const ticks: { date: Date; xPx: number; label: string }[] = []
    let d = startOfMonth(range.start)
    while (d.getTime() <= range.end.getTime()) {
      const x = diffDays(range.start, d) * pxPerDay
      ticks.push({ date: new Date(d), xPx: x, label: fmtMonth(d) })
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    }
    return ticks
  }, [range, pxPerDay])

  /** Convert a session date range to {leftPx, widthPx}. */
  const blockGeometry = (s: Session): { left: number; width: number } => {
    const sd = parseDate(s.startDate) ?? range.start
    const ed = parseDate(s.endDate ?? s.startDate) ?? sd
    const left = diffDays(range.start, sd) * pxPerDay
    const width = Math.max(pxPerDay, (diffDays(sd, ed) + 1) * pxPerDay)
    return { left, width }
  }

  // ── Drag handlers (one local state + onMouseUp commit) ───────────────────

  const trackRef = useRef<HTMLDivElement>(null)
  const dragState = useRef<{
    sessionId: number
    mode: 'move' | 'resize-right'
    origX: number
    origStart?: Date
    origEnd?: Date
    durationDays: number
  } | null>(null)
  const [drag, setDrag] = useState<{ id: number; deltaDays: number } | null>(null)

  const onPointerDown = (s: Session, e: React.PointerEvent, mode: 'move' | 'resize-right') => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    const sd = parseDate(s.startDate) ?? range.start
    const ed = parseDate(s.endDate ?? s.startDate) ?? sd
    dragState.current = {
      sessionId: s.id, mode,
      origX: e.clientX,
      origStart: sd, origEnd: ed,
      durationDays: diffDays(sd, ed),
    }
    setSelectedId(s.id)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragState.current) return
    const dx = e.clientX - dragState.current.origX
    const deltaDays = Math.round(dx / pxPerDay)
    setDrag({ id: dragState.current.sessionId, deltaDays })
  }

  const onPointerUp = async () => {
    if (!dragState.current || !drag) { dragState.current = null; setDrag(null); return }
    const { sessionId, mode, origStart, origEnd, durationDays } = dragState.current
    const session = sessions.find(s => s.id === sessionId)
    dragState.current = null
    setDrag(null)
    if (!session || !origStart) return
    if (drag.deltaDays === 0) return

    let newStart = origStart
    let newEnd   = origEnd ?? origStart
    if (mode === 'move') {
      newStart = addDays(origStart, drag.deltaDays)
      newEnd   = addDays((origEnd ?? origStart), drag.deltaDays)
    } else if (mode === 'resize-right') {
      if (session.durationKind === 'day') {
        toast.error('Session "Journée" — durée verrouillée. Passez en "Personnalisé" pour redimensionner.')
        return
      }
      newEnd = addDays(origStart, Math.max(0, durationDays + drag.deltaDays))
    }

    // Optimistic local update
    setSessions(arr => arr.map(x => x.id === sessionId ? {
      ...x, startDate: fmtISO(newStart), endDate: fmtISO(newEnd),
    } : x))

    try {
      await sessionsApi.update(pid, sessionId, {
        startDate: fmtISO(newStart),
        endDate: fmtISO(newEnd),
      })
    } catch {
      toast.error('Échec de la sauvegarde — rechargement')
      reload()
    }
  }

  // ── Zoom controls ────────────────────────────────────────────────────────

  const zoomIn  = () => setPxPerDay(z => Math.min(40, Math.round(z * 1.5)))
  const zoomOut = () => setPxPerDay(z => Math.max(3,  Math.round(z / 1.5)))

  // ── Add session (quick presets from the toolbar OR drop on the river) ───

  /** Map session type → sensible default durationKind. */
  const PRESET_DURATIONS: Record<SessionType, 'day' | 'week' | 'custom'> = {
    CANDIDATURE_SUBMISSION: 'custom',
    PRESELECTION:           'week',
    PITCH_DAY:              'day',
    ONBOARDING:             'day',
    INCUBATION:             'custom',
    DEMO_DAY:               'day',
    TRAINING_DAY:           'day',
  }

  /** Add a session at a specific start date (drops on the river) or at end-of-timeline (clicks). */
  const addPresetSession = async (type: SessionType, atDate?: Date) => {
    const durationKind = PRESET_DURATIONS[type] ?? 'custom'
    const last = sessions.map(s => parseDate(s.endDate ?? s.startDate))
                         .filter(Boolean).sort((a, b) => (a!.getTime() - b!.getTime())).pop() as Date | undefined
    const start = atDate ?? (last ? addDays(last, 1) : new Date())
    const end = durationKind === 'day' ? start
              : durationKind === 'week' ? addDays(start, 6)
              : addDays(start, 13)
    const title = TYPE_LABEL[type] ?? type
    try {
      const r = await sessionsApi.create(pid, {
        title, sessionType: type, durationKind,
        startDate: fmtISO(start), endDate: fmtISO(end),
        phaseOrder: sessions.length,
      })
      toast.success(`${title} ajoutée`)
      reload()
      // Auto-select the new session if the server returned its id
      if (r?.data?.id) setSelectedId(r.data.id)
    } catch { toast.error('Erreur') }
  }

  // ── Drag-from-library onto the river ─────────────────────────────────────

  const [dragPreviewType, setDragPreviewType] = useState<SessionType | null>(null)
  const [dragPreviewX, setDragPreviewX] = useState<number | null>(null)

  /** Convert a pointer X (relative to the track) to a Date. */
  const xToDate = (clientX: number): Date | null => {
    const el = trackRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const relX = Math.max(0, clientX - rect.left + el.scrollLeft)
    const dayIndex = Math.floor(relX / pxPerDay)
    return addDays(range.start, dayIndex)
  }

  const onRiverDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/timeline-preset')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      const el = trackRef.current
      if (el) {
        const rect = el.getBoundingClientRect()
        setDragPreviewX(Math.max(0, e.clientX - rect.left + el.scrollLeft))
      }
    }
  }
  const onRiverDragLeave = () => setDragPreviewX(null)
  const onRiverDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const type = e.dataTransfer.getData('application/timeline-preset') as SessionType
    setDragPreviewType(null); setDragPreviewX(null)
    if (!type) return
    const date = xToDate(e.clientX)
    if (date) addPresetSession(type, date)
  }

  // ── Selected session (for the inspector at the bottom) ──────────────────


  // ── Render ──────────────────────────────────────────────────────────────

  if (loading) return (
    <AdminLayout>
      <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />Chargement de la timeline…
      </div>
    </AdminLayout>
  )

  // Shared callbacks used by both lanes
  const onCardChange = async (id: number, patch: any) => {
    setSessions(arr => arr.map(x => x.id === id ? { ...x, ...patch } : x))
    try { await sessionsApi.update(pid, id, patch) }
    catch { toast.error('Erreur'); reload() }
  }
  const onCardDelete = async (id: number) => {
    const s = sessions.find(x => x.id === id)
    if (!confirm(`Supprimer la session "${s?.title ?? '?'}" ?`)) return
    try {
      await sessionsApi.delete(pid, id)
      setSessions(arr => arr.filter(x => x.id !== id))
      if (selectedId === id) setSelectedId(null)
      toast.success('Supprimée')
    } catch { toast.error('Erreur') }
  }

  const programmeStartLabel = range.programmeStart ? fmtShort(range.programmeStart) : '?'
  const programmeEndLabel   = range.programmeEnd   ? fmtShort(range.programmeEnd)   : '?'

  return (
    <AdminLayout>
      <div className="space-y-3" onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-gradient-to-r from-amber-500/5 via-rose-500/5 to-purple-500/5 px-4 py-3">
          <Link href={`/programmes/${pid}`}>
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 text-white shadow-md">
            <Layers className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-foreground truncate">
              Timeline · {programme?.title ?? `Programme #${pid}`}
            </h1>
            <p className="text-xs text-muted-foreground flex flex-wrap gap-3 mt-0.5">
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />{programmeStartLabel} → {programmeEndLabel}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-700 dark:text-emerald-300 font-semibold">
                {sessions.length} session{sessions.length > 1 ? 's' : ''}
              </span>
            </p>
          </div>
          <Link href={`/programmes/${pid}/builder`}>
            <Button variant="outline" size="sm" className="gap-1.5 border-brand-500/40">
              <Sparkles className="h-3.5 w-3.5 text-brand-500" />Mode visuel (canvas)
            </Button>
          </Link>
        </motion.div>

        {/* ── 2-column layout: library | canvas ────────────────────────────── */}
        <div className="grid gap-3 lg:grid-cols-[220px_1fr]">
          {/* LIBRARY — left side, sticky on tall screens */}
          <aside className="rounded-2xl border border-border bg-card p-3 lg:sticky lg:top-3 self-start">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600">
                <Plus className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-foreground">Bibliothèque</h2>
                <p className="text-[9px] text-muted-foreground">Cliquez ou glissez sur la rivière</p>
              </div>
            </div>
            <div className="space-y-1.5">
              {SESSION_TYPES.map(t => {
                const pal = paletteFor(t)
                const dur = PRESET_DURATIONS[t]
                return (
                  <button
                    key={t}
                    type="button"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/timeline-preset', t)
                      e.dataTransfer.effectAllowed = 'copy'
                      setDragPreviewType(t)
                    }}
                    onDragEnd={() => { setDragPreviewType(null); setDragPreviewX(null) }}
                    onClick={() => addPresetSession(t)}
                    className="group w-full text-left rounded-lg border-2 bg-card p-2 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-grab active:cursor-grabbing"
                    style={{ borderColor: pal.bar + '66' }}>
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: pal.bar }} />
                      <span className="text-xs font-bold flex-1 truncate" style={{ color: pal.bar }}>
                        {TYPE_LABEL[t]}
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                        {dur === 'day' ? '1j' : dur === 'week' ? '7j' : '…'}
                      </span>
                      <Plus className="h-3 w-3 text-muted-foreground opacity-60 group-hover:opacity-100" />
                    </div>
                  </button>
                )
              })}
            </div>
            <div className="mt-3 rounded-lg border border-dashed border-border bg-muted/30 p-2 text-[10px] text-muted-foreground space-y-1">
              <p className="font-bold uppercase tracking-wider text-foreground/70">Astuces</p>
              <p>• <strong>Cliquez</strong> une carte → ajoutée à la fin</p>
              <p>• <strong>Glissez</strong> sur la rivière → ajoutée à la date du dépôt</p>
              <p>• <strong>Glissez</strong> un bloc → replanifier</p>
              <p>• <strong>Étirez</strong> le bord droit → ajuster la durée</p>
            </div>
          </aside>

          {/* CANVAS — right side */}
          <div className="space-y-3 min-w-0">
            {/* Toolbar above the river */}
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1">
                Rivière du programme
              </span>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {totalDays} j · {pxPerDay}px/j
              </span>
              <div className="ml-auto flex items-center gap-1">
                <Button variant="outline" size="icon" onClick={zoomOut} title="Dézoomer">
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="icon" onClick={zoomIn} title="Zoomer">
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* The timeline track */}
            <div
              className="rounded-2xl border border-border bg-gradient-to-b from-card to-card/60 p-4 overflow-x-auto relative"
              onDragOver={onRiverDragOver}
              onDragLeave={onRiverDragLeave}
              onDrop={onRiverDrop}>
              <div ref={trackRef} className="relative" style={{ width: trackWidth, minHeight: 360 }}>
                {/* Drop preview — semi-transparent block at the cursor */}
                {dragPreviewType && dragPreviewX !== null && (
                  <div className="absolute pointer-events-none z-50 top-1/2 -translate-y-1/2 rounded-xl h-14 flex items-center px-3 opacity-70 shadow-lg"
                    style={{
                      left: dragPreviewX,
                      width: (PRESET_DURATIONS[dragPreviewType] === 'day' ? 1
                            : PRESET_DURATIONS[dragPreviewType] === 'week' ? 7 : 14) * pxPerDay,
                      background: paletteFor(dragPreviewType).bar,
                      color: paletteFor(dragPreviewType).text === 'text-amber-950' ? '#000' : '#fff',
                    }}>
                    <span className="text-[10px] font-bold uppercase">
                      Ajouter ici — {TYPE_LABEL[dragPreviewType]}
                    </span>
                  </div>
                )}

                {/* Top annotation lane — even-indexed sessions */}
                <Lane sessions={sessions.filter((_, i) => i % 2 === 0)}
                  side="top" range={range} pxPerDay={pxPerDay} drag={drag}
                  selectedId={selectedId} setSelectedId={setSelectedId}
                  onPointerDown={onPointerDown}
                  onChange={onCardChange} onDelete={onCardDelete} />

                {/* Horizontal river */}
                <RiverTrack range={range} pxPerDay={pxPerDay} sessions={sessions}
                  drag={drag} blockGeometry={blockGeometry}
                  monthTicks={monthTicks}
                  selectedId={selectedId} setSelectedId={setSelectedId}
                  onPointerDown={onPointerDown} />

                {/* Bottom annotation lane — odd-indexed sessions */}
                <Lane sessions={sessions.filter((_, i) => i % 2 === 1)}
                  side="bottom" range={range} pxPerDay={pxPerDay} drag={drag}
                  selectedId={selectedId} setSelectedId={setSelectedId}
                  onPointerDown={onPointerDown}
                  onChange={onCardChange} onDelete={onCardDelete} />
              </div>
            </div>

            {sessions.length === 0 && (
              <div className="rounded-2xl border-2 border-dashed border-emerald-500/40 bg-emerald-500/5 py-12 text-center">
                <Calendar className="mx-auto mb-2 h-8 w-8 text-emerald-600/70" />
                <p className="text-sm font-semibold text-foreground">Aucune session</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Cliquez ou glissez une carte de la <strong>bibliothèque</strong> à gauche pour démarrer.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}

// ── River track ────────────────────────────────────────────────────────────

function RiverTrack({
  range, pxPerDay, sessions, drag, blockGeometry, monthTicks,
  selectedId, setSelectedId, onPointerDown,
}: {
  range: { start: Date; end: Date; programmeStart: Date | null; programmeEnd: Date | null }
  pxPerDay: number
  sessions: Session[]
  drag: { id: number; deltaDays: number } | null
  blockGeometry: (s: Session) => { left: number; width: number }
  monthTicks: { date: Date; xPx: number; label: string }[]
  selectedId: number | null
  setSelectedId: (id: number) => void
  onPointerDown: (s: Session, e: React.PointerEvent, mode: 'move' | 'resize-right') => void
}) {
  const RIVER_HEIGHT = 64

  /** Shaded band that marks the programme's own date range on the river. */
  const programmeBand = (() => {
    if (!range.programmeStart || !range.programmeEnd) return null
    const left = diffDays(range.start, range.programmeStart) * pxPerDay
    const width = (diffDays(range.programmeStart, range.programmeEnd) + 1) * pxPerDay
    return { left, width }
  })()

  return (
    <div className="relative my-12 select-none" style={{ height: RIVER_HEIGHT }}>
      {/* Programme range band — faint emerald wash spanning the programme dates */}
      {programmeBand && (
        <div className="absolute top-1/2 -translate-y-1/2 h-20 rounded-2xl border-2 border-dashed border-emerald-500/40 bg-emerald-500/5 pointer-events-none"
          style={{ left: programmeBand.left, width: programmeBand.width }}>
          <span className="absolute -top-5 left-2 text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Programme
          </span>
        </div>
      )}

      {/* Track shadow (the river) */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-16 rounded-2xl bg-gradient-to-r from-slate-200/40 via-slate-100/40 to-slate-200/40 dark:from-slate-700/30 dark:via-slate-800/20 dark:to-slate-700/30 shadow-inner" />

      {/* Month grid lines + labels */}
      {monthTicks.map((m, i) => (
        <div key={i} className="absolute top-0 bottom-0" style={{ left: m.xPx }}>
          <div className="absolute -top-6 left-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
            {m.label}
          </div>
          <div className="h-full w-px bg-border/60" />
        </div>
      ))}

      {/* Today marker */}
      {(() => {
        const today = new Date()
        if (today < range.start || today > range.end) return null
        const x = diffDays(range.start, today) * pxPerDay
        return (
          <div className="absolute top-0 bottom-0 z-10" style={{ left: x }}>
            <div className="h-full w-0.5 bg-rose-500/70" />
            <div className="absolute -top-7 -translate-x-1/2 rounded-md bg-rose-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
              aujourd&apos;hui
            </div>
          </div>
        )
      })()}

      {/* Session blocks */}
      {sessions.map((s) => {
        const { left, width } = blockGeometry(s)
        const offsetPx = drag?.id === s.id ? drag.deltaDays * pxPerDay : 0
        const pal = paletteFor(s.sessionType)
        const isSelected = selectedId === s.id
        return (
          <div key={s.id}
            onClick={(e) => { e.stopPropagation(); setSelectedId(s.id) }}
            onPointerDown={(e) => onPointerDown(s, e, 'move')}
            style={{
              left: left + offsetPx, width: width,
              top: '50%', transform: 'translateY(-50%)',
              background: `linear-gradient(90deg, ${pal.bar} 0%, ${pal.bar} 80%, ${pal.bar}DD 100%)`,
              boxShadow: isSelected ? `0 0 0 3px ${pal.bar}55, 0 4px 14px ${pal.bar}33`
                                    : `0 2px 8px ${pal.bar}22`,
            }}
            className={`absolute h-14 rounded-xl cursor-grab active:cursor-grabbing transition-shadow flex items-center px-3 group ${pal.text}`}>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider opacity-90 truncate">
                {TYPE_LABEL[s.sessionType ?? ''] ?? 'Session'}
              </p>
              <p className="text-sm font-bold truncate leading-tight">{s.title}</p>
            </div>
            {/* Resize handle (right) */}
            <div
              onPointerDown={(e) => { e.stopPropagation(); onPointerDown(s, e, 'resize-right') }}
              title={s.durationKind === 'day' ? 'Verrouillé (Journée)' : 'Redimensionner'}
              className={`absolute right-0 top-0 bottom-0 w-2 rounded-r-xl ${
                s.durationKind === 'day' ? 'cursor-not-allowed opacity-30' : 'cursor-ew-resize hover:bg-white/30'
              }`} />
          </div>
        )
      })}
    </div>
  )
}

// ── Annotation lanes (top / bottom) ────────────────────────────────────────

function Lane({
  sessions, side, range, pxPerDay, drag,
  selectedId, setSelectedId, onPointerDown,
  onChange, onDelete,
}: {
  sessions: Session[]
  side: 'top' | 'bottom'
  range: { start: Date; end: Date; programmeStart: Date | null; programmeEnd: Date | null }
  pxPerDay: number
  drag: { id: number; deltaDays: number } | null
  selectedId: number | null
  setSelectedId: (id: number) => void
  onPointerDown: (s: Session, e: React.PointerEvent, mode: 'move' | 'resize-right') => void
  onChange: (id: number, patch: any) => void
  onDelete: (id: number) => void
}) {
  const SELECTED_HEIGHT = 270
  return (
    <div className="relative" style={{ height: SELECTED_HEIGHT }}>
      {sessions.map(s => {
        const isSelected = selectedId === s.id
        const sd = parseDate(s.startDate) ?? range.start
        const xCenter = diffDays(range.start, sd) * pxPerDay
        const offsetPx = drag?.id === s.id ? drag.deltaDays * pxPerDay : 0
        const pal = paletteFor(s.sessionType)
        // Wider card when selected so all the inline editors fit.
        const cardWidth = isSelected ? 280 : 176
        return (
          <SessionCard key={s.id}
            session={s}
            side={side}
            isSelected={isSelected}
            x={xCenter + offsetPx - cardWidth / 2}
            width={cardWidth}
            pal={pal}
            onSelect={() => setSelectedId(s.id)}
            onPointerDown={(e) => onPointerDown(s, e, 'move')}
            onChange={(patch) => onChange(s.id, patch)}
            onDelete={() => onDelete(s.id)}
          />
        )
      })}
    </div>
  )
}

/**
 * Floating timeline annotation card.
 *  - Collapsed view: type tag, title, dates, location, connector to river.
 *  - Selected view: in-place editor (type / status / title / duration / dates /
 *    location / description / delete) — every field auto-saves on blur or
 *    change. The bottom inspector card is gone, this IS the editor.
 */
function SessionCard({
  session, side, isSelected, x, width, pal,
  onSelect, onPointerDown, onChange, onDelete,
}: {
  session: Session
  side: 'top' | 'bottom'
  isSelected: boolean
  x: number
  width: number
  pal: { bar: string; light: string; ring: string; text: string }
  onSelect: () => void
  onPointerDown: (e: React.PointerEvent) => void
  onChange: (patch: any) => void
  onDelete: () => void
}) {
  // Local draft for input fields so we don't fire a network request per keystroke.
  const [title, setTitle] = useState(session.title ?? '')
  const [location, setLocation] = useState(session.location ?? '')
  const [description, setDescription] = useState(session.description ?? '')
  useEffect(() => { setTitle(session.title ?? '') }, [session.title])
  useEffect(() => { setLocation(session.location ?? '') }, [session.location])
  useEffect(() => { setDescription(session.description ?? '') }, [session.description])

  if (!isSelected) {
    // ── Collapsed annotation card ─────────────────────────────────────────
    return (
      <div
        onClick={(e) => { e.stopPropagation(); onSelect() }}
        onPointerDown={onPointerDown}
        style={{ left: x, top: side === 'top' ? 0 : 12, width }}
        className={`absolute rounded-lg border-2 bg-card p-2 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing`}>
        <div className="flex items-center gap-1.5 mb-1">
          <span className="h-2 w-2 rounded-full" style={{ background: pal.bar }} />
          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground truncate">
            {TYPE_LABEL[session.sessionType ?? ''] ?? 'Session'}
          </span>
        </div>
        <p className="text-xs font-bold text-foreground truncate leading-tight">{session.title}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {parseDate(session.startDate) ? fmtShort(parseDate(session.startDate)!) : '—'}
          {session.endDate && session.endDate !== session.startDate && parseDate(session.endDate)
            && ` → ${fmtShort(parseDate(session.endDate)!)}`}
        </p>
        {session.location && (
          <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
            <MapPin className="h-2.5 w-2.5" />{session.location}
          </p>
        )}
        <div className={`absolute left-1/2 ${side === 'top' ? 'top-full' : 'bottom-full'} w-px h-3 -translate-x-1/2`}
          style={{ background: pal.bar }} />
      </div>
    )
  }

  // ── Selected, in-place editor ───────────────────────────────────────────
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{ left: x, top: side === 'top' ? 0 : 12, width, borderColor: pal.bar }}
      className={`absolute rounded-xl border-2 bg-card p-3 shadow-xl ring-4 ${pal.ring} z-30`}>
      {/* Type + status row */}
      <div className="flex items-center gap-1.5 mb-2">
        <select
          value={session.sessionType ?? 'INCUBATION'}
          onChange={(e) => onChange({ sessionType: e.target.value })}
          className="text-[10px] font-semibold rounded-full border px-2 py-0.5 bg-background"
          style={{ borderColor: pal.bar, color: pal.bar }}>
          {SESSION_TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
        </select>
        <select
          value={session.status ?? 'UPCOMING'}
          onChange={(e) => onChange({ status: e.target.value })}
          className="ml-auto text-[10px] font-semibold rounded-full border px-2 py-0.5 bg-background">
          <option value="UPCOMING">À venir</option>
          <option value="ACTIVE">En cours</option>
          <option value="COMPLETED">Terminée</option>
        </select>
      </div>

      {/* Drag-handle row — grabbing this moves the block on the river */}
      <div onPointerDown={onPointerDown}
        className="rounded-md border border-dashed border-border bg-muted/30 px-2 py-1 mb-2 cursor-grab active:cursor-grabbing flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: pal.bar }} />
        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
          Glisser ici pour replanifier
        </span>
      </div>

      {/* Title */}
      <Input
        value={title}
        placeholder="Titre de la session"
        className="h-8 text-sm font-bold mb-2"
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => { if (title !== session.title) onChange({ title }) }}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      />

      {/* Duration */}
      <div className="mb-2">
        <label className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground">Durée</label>
        <div className="flex gap-1 mt-0.5">
          {(['day', 'week', 'custom'] as const).map(k => (
            <button key={k} type="button"
              onClick={() => {
                const patch: any = { durationKind: k }
                if (session.startDate) {
                  if (k === 'day') patch.endDate = session.startDate
                  else if (k === 'week') {
                    const sd = parseDate(session.startDate)!
                    patch.endDate = fmtISO(addDays(sd, 6))
                  }
                }
                onChange(patch)
              }}
              className={`flex-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${
                session.durationKind === k
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'border-border text-muted-foreground hover:border-emerald-400'}`}>
              {k === 'day' ? 'Journée' : k === 'week' ? 'Semaine' : 'Personnalisé'}
            </button>
          ))}
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-1.5 mb-2">
        <div>
          <label className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground">Début</label>
          <Input type="date" className="h-7 text-[11px]"
            value={session.startDate ?? ''}
            onChange={(e) => {
              const sd = e.target.value
              const patch: any = { startDate: sd }
              if (session.durationKind === 'day') patch.endDate = sd
              else if (session.durationKind === 'week' && sd) {
                patch.endDate = fmtISO(addDays(parseDate(sd)!, 6))
              }
              onChange(patch)
            }} />
        </div>
        <div>
          <label className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground">
            Fin {session.durationKind === 'day' && '(=Début)'}
          </label>
          <Input type="date" className={`h-7 text-[11px] ${session.durationKind === 'day' ? 'opacity-60 cursor-not-allowed' : ''}`}
            disabled={session.durationKind === 'day'}
            value={session.endDate ?? ''}
            onChange={(e) => onChange({ endDate: e.target.value })} />
        </div>
      </div>

      {/* Location */}
      <div className="mb-2">
        <label className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground">Lieu</label>
        <Input className="h-7 text-[11px]" placeholder='"Salle A" ou "Online"'
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          onBlur={() => { if (location !== (session.location ?? '')) onChange({ location }) }} />
      </div>

      {/* Description (collapsible textarea) */}
      <div className="mb-2">
        <label className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground">Description</label>
        <textarea rows={2}
          className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] resize-none"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => { if (description !== (session.description ?? '')) onChange({ description }) }} />
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="sm" onClick={onDelete}
          className="text-destructive border-destructive/40 hover:bg-destructive/10 h-7 px-2 text-[10px]">
          Supprimer
        </Button>
        <Link href={`/programmes/${session.id ? '' : ''}`} className="ml-auto" />
        <span className="ml-auto text-[9px] text-muted-foreground italic">
          modifications enregistrées ✓
        </span>
      </div>

      {/* Connector to the river */}
      <div className={`absolute left-1/2 ${side === 'top' ? 'top-full' : 'bottom-full'} w-0.5 h-3 -translate-x-1/2`}
        style={{ background: pal.bar }} />
    </div>
  )
}
