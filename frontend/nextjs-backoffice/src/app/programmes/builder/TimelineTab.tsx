'use client'
/**
 * TimelineTab — the "🗺️ Parcours" tab of the visual editor (clean rebuild).
 *
 * Model:
 *   • A Session has a KIND: "range" (date span) or "day" (single day).
 *   • A "day" session may NEST inside a "range" session (parentSessionId).
 *   • The hour-by-hour agenda (activities) is editable ONLY on day sessions.
 *   • Presets are data-driven (sessionPresetsApi) — global or per-programme,
 *     editable, and creatable from the library strip.
 *
 * Layout (top → bottom):
 *   HEADER · LIBRARY STRIP (preset pills + ＋Préset + ＋Voie) · BOARD (swimlanes)
 *   · BOTTOM DRAWER (EditorPanel | kind-aware right pane), height-capped, no overlap.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, X, Trash2, Calendar, MapPin, Users, Loader2,
  AlertTriangle, Info, GripVertical, Layers, Clock, Palette, FileText,
  Pencil, UserPlus, CalendarDays, CalendarRange, ChevronRight, Sparkles, Copy,
  Eye, EyeOff, ArrowLeft, Send, Mail, ClipboardList, ZoomIn, ZoomOut,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { sessionsApi, sessionPresetsApi, notificationsApi, contactsApi, contactGroupsApi, programmesApi, parcoursTemplatesApi } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { CandidaturePhasePanel, PreselectionPhasePanel } from './PhasePanels'
import { SessionNotifyButton } from '@/app/programmes/[id]/SessionNotify'
import { confirmDialog } from '@/lib/confirmDialog'
import { performDelete } from '@/lib/deleteChoice'

// ── Color palette ───────────────────────────────────────────────────────────
// Sessions / presets / activities are type-free — color is their only marker.

const DEFAULT_COLOR = '#10B981'

/** Curated swatches offered in the color pickers (sessions + activities). */
const SWATCHES = [
  '#0EA5E9', '#6366F1', '#A855F7', '#EC4899',
  '#EF4444', '#F97316', '#F59E0B', '#10B981',
  '#14B8A6', '#64748B',
]

// ── Domain types ────────────────────────────────────────────────────────────

type DurationKind = 'day' | 'range'

interface Activity {
  id?: number
  activityOrder?: number
  title: string
  description?: string
  /** Free-form color of the block (defaults to the session color). */
  color?: string
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
  durationKind?: DurationKind | string
  location?: string
  /** Hex color of the session bar (first-class — sessions are type-free). */
  color?: string
  /** Legacy discriminator — ignored by the UI, kept only for read compat. */
  sessionType?: string
  status?: 'UPCOMING' | 'ACTIVE' | 'COMPLETED'
  lane?: string
  phaseOrder?: number
  parentSessionId?: number | null
  responsibles?: string[]
  guests?: string[]
  focusCriteriaIds?: number[]
  /** JSON map {criterionId: weight 0..1} — per-session criterion weights. */
  criterionWeightsJson?: string
  /** Évaluation sessions: saved candidature-selection the jury evaluates. */
  evaluationSelectionId?: number | null
  /** Visibility — VISIBLE | HIDDEN | PRIVATE (default VISIBLE). */
  visibility?: 'VISIBLE' | 'HIDDEN' | 'PRIVATE'
  /** Whether this session may carry an activity agenda. */
  allowActivities?: boolean
  /** Whether this session may overlap others in its lane. */
  allowOverlap?: boolean
  days?: SessionDay[]
}

const VISIBILITY_META: Record<string, { label: string; badge: string; cls: string }> = {
  VISIBLE: { label: 'Visible',  badge: '',         cls: 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
  HIDDEN:  { label: 'Interne',  badge: 'Interne',  cls: 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300' },
  PRIVATE: { label: 'Privé',    badge: 'Privé',    cls: 'border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300' },
}
const visibilityOf = (s: { visibility?: string }) => (s.visibility ?? 'VISIBLE')

const SESSION_TYPE_DISPLAY: Record<string, string> = {
  CANDIDATURE_SUBMISSION: 'Candidature', PRESELECTION: 'Présélection', PITCH_DAY: 'Pitch Day',
  ONBOARDING: 'Onboarding', INCUBATION: 'Incubation', DEMO_DAY: 'Demo Day', TRAINING_DAY: 'Formation',
}
const SESSION_STATUS_DISPLAY: Record<string, string> = { UPCOMING: 'À venir', ACTIVE: 'En cours', COMPLETED: 'Terminée' }

/** Before→after rows for the « aperçu avant modification » dialog. Returns [] for
 *  purely cosmetic edits (title/color/…) so those apply without interruption. */
function previewLines(session: Session, patch: Partial<Session>): { label: string; from?: string; to?: string }[] {
  const out: { label: string; from?: string; to?: string }[] = []
  const yn  = (b?: boolean) => (b ? 'Oui' : 'Non')
  const vis = (v?: string) => VISIBILITY_META[v ?? 'VISIBLE']?.label ?? (v ?? 'Visible')
  const dur = (d?: string) => (d === 'day' ? 'Journée' : 'Plage')
  if ('startDate' in patch && patch.startDate !== session.startDate)
    out.push({ label: 'Début', from: session.startDate || '—', to: patch.startDate || '—' })
  if ('endDate' in patch && patch.endDate !== session.endDate)
    out.push({ label: 'Fin', from: session.endDate || '—', to: patch.endDate || '—' })
  if ('visibility' in patch && patch.visibility !== visibilityOf(session))
    out.push({ label: 'Visibilité', from: vis(visibilityOf(session)), to: vis(patch.visibility) })
  if ('allowOverlap' in patch && !!patch.allowOverlap !== !!session.allowOverlap)
    out.push({ label: 'Chevauchement', from: yn(session.allowOverlap), to: yn(patch.allowOverlap) })
  if ('allowActivities' in patch && (patch.allowActivities !== false) !== (session.allowActivities !== false))
    out.push({ label: 'Activités', from: yn(session.allowActivities !== false), to: yn(patch.allowActivities !== false) })
  if ('durationKind' in patch && patch.durationKind !== session.durationKind)
    out.push({ label: 'Type de durée', from: dur(session.durationKind), to: dur(patch.durationKind) })
  if ('sessionType' in patch && patch.sessionType !== session.sessionType)
    out.push({ label: 'Fonction', from: session.sessionType || 'INCUBATION', to: patch.sessionType || 'INCUBATION' })
  if ('parentSessionId' in patch && (patch.parentSessionId ?? null) !== (session.parentSessionId ?? null))
    out.push({ label: 'Rattachement', from: session.parentSessionId ? `#${session.parentSessionId}` : 'Aucun', to: patch.parentSessionId ? `#${patch.parentSessionId}` : 'Aucun' })
  return out
}

/** A programme evaluation criterion (subset selectable per session). */
interface Criterion { id: number; name: string; weight?: number; description?: string }
interface Preset {
  id: number
  programmeId?: number | null
  title: string
  color?: string
  durationKind: DurationKind | string
  builtIn?: boolean
  sortOrder?: number
}

const kindOf = (s: { durationKind?: string }): DurationKind =>
  (s.durationKind === 'day' ? 'day' : 'range')
const colorOf = (s: { color?: string }, fallback = DEFAULT_COLOR) =>
  s.color || fallback

// ── Session « Fonction » — exactly three types ──────────────────────────────
//   STANDARD (défaut) · CANDIDATURE_SUBMISSION (accepter les candidatures)
//   · PRESELECTION (évaluation par jury)
type SessionFunction = 'STANDARD' | 'CANDIDATURE_SUBMISSION' | 'PRESELECTION'
const fonctionOf = (s: { sessionType?: string }): SessionFunction =>
  s.sessionType === 'CANDIDATURE_SUBMISSION' || s.sessionType === 'PRESELECTION'
    ? s.sessionType : 'STANDARD'
const FONCTION_META: Record<SessionFunction, { label: string; hint: string }> = {
  STANDARD:               { label: 'Standard',    hint: 'Session classique : ateliers, mentoring, incubation…' },
  CANDIDATURE_SUBMISSION: { label: 'Candidature', hint: 'Accepte les candidatures — le formulaire est ouvert pendant cette session et la clôture suit sa date de fin.' },
  PRESELECTION:           { label: 'Évaluation',  hint: 'Évaluation des candidatures par le jury (notes par critère).' },
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
const clampDate = (d: Date, lo?: Date | null, hi?: Date | null) => {
  let t = d.getTime()
  if (lo) t = Math.max(t, lo.getTime())
  if (hi) t = Math.min(t, hi.getTime())
  return new Date(t)
}

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
  if (!s.title?.trim()) critical.push('titre')
  if (!s.startDate) critical.push('date de début')
  if (kindOf(s) === 'range' && !s.endDate) critical.push('date de fin')
  if (!s.location?.trim())    warnings.push('lieu')
  if (!s.description?.trim()) warnings.push('description')
  return { critical, warnings }
}

// ── Reusable color picker (swatches + custom) ────────────────────────────────

function ColorPicker({ value, onChange, label = 'Couleur', compact = false }: {
  value?: string
  onChange: (hex: string) => void
  label?: string
  compact?: boolean
}) {
  const cur = (value || '').toLowerCase()
  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        <Palette className="h-3 w-3" />{label}
      </label>
      <div className="mt-0.5 flex items-center gap-1 flex-wrap">
        {SWATCHES.map(s => (
          <button key={s} type="button" onClick={() => onChange(s)} title={s}
            className={`rounded-full transition-transform hover:scale-110 ${compact ? 'h-4 w-4' : 'h-5 w-5'} ${
              cur === s.toLowerCase() ? 'ring-2 ring-offset-1 ring-offset-card ring-foreground/50' : 'border border-black/10'}`}
            style={{ background: s }} />
        ))}
        <input type="color" value={value || DEFAULT_COLOR} onChange={(e) => onChange(e.target.value)}
          title="Couleur personnalisée"
          className={`rounded-md border border-input cursor-pointer p-0 bg-transparent ${compact ? 'h-5 w-6' : 'h-6 w-7'}`} />
      </div>
    </div>
  )
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
            Ce programme n&apos;est pas encore enregistré. Créez-le dans le
            <strong> Constructeur</strong>, puis revenez ici pour planifier les sessions.
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
  const [presets, setPresets]   = useState<Preset[]>([])
  const [loading,  setLoading]  = useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [presetModal, setPresetModal] = useState<{ mode: 'create' | 'edit'; preset?: Preset } | null>(null)
  /** Édition (editable board) vs Aperçu (read-only preview). */
  const [view, setView] = useState<'edit' | 'preview'>('edit')

  const reload = useCallback(async () => {
    try {
      const r = await sessionsApi.list(programmeId)
      setSessions(r.data ?? [])
    } finally { setLoading(false) }
  }, [programmeId])

  const reloadPresets = useCallback(async () => {
    try {
      const r = await sessionPresetsApi.list(programmeId)
      setPresets(r.data ?? [])
    } catch { /* presets are non-critical */ }
  }, [programmeId])

  useEffect(() => { reload(); reloadPresets() }, [reload, reloadPresets])

  const win = useMemo(() => computeWindow(programme, sessions), [programme, sessions])
  const days = useMemo(() => {
    const out: Date[] = []
    const cur = new Date(win.start)
    while (cur <= win.end) { out.push(new Date(cur)); cur.setDate(cur.getDate() + 1) }
    return out
  }, [win])
  const totalMs = win.end.getTime() - win.start.getTime()

  // Top-level sessions only render as bars; nested day-sessions render inside their parent.
  const topLevel = useMemo(() => sessions.filter(s => s.parentSessionId == null), [sessions])
  const childrenOf = useCallback(
    (parentId: number) => sessions.filter(s => s.parentSessionId === parentId),
    [sessions])

  // ── Single band: ALL top-level sessions (plages + journées autonomes). ──
  // A journée may live standalone on the board, or nest inside a plage when
  // dropped on its dates / added from the plage overlay.
  const ranges  = useMemo(() => topLevel.filter(s => kindOf(s) === 'range'), [topLevel])
  const dayCount = useMemo(() => sessions.filter(s => kindOf(s) === 'day').length, [sessions])
  /** Existing lane values — kept only to power the Voie datalist in the editor. */
  const laneOptions = useMemo(
    () => Array.from(new Set(['Principal', ...topLevel.map(s => s.lane?.trim() || 'Principal')])),
    [topLevel])

  // ── CRUD ─────────────────────────────────────────────────────────────

  /** Create a session from a preset, optionally at a date / lane / parent.
   *  openAfter=false (drag & drop) places the bar without opening the editor. */
  const addFromPreset = async (preset: Preset, atDate?: Date, lane?: string, parent?: Session, openAfter = true) => {
    const kind = kindOf(preset)
    let start = atDate ?? (() => {
      const last = topLevel.map(s => parseDate(s.endDate ?? s.startDate)).filter(Boolean)
        .sort((a, b) => a!.getTime() - b!.getTime()).pop() as Date | undefined
      return last ? addDays(last, 1) : new Date()
    })()
    // Nesting: a day inside a range must fall within the parent window.
    if (parent) {
      const ps = parseDate(parent.startDate); const pe = parseDate(parent.endDate ?? parent.startDate)
      start = clampDate(start, ps, pe)
    }
    const end = kind === 'day' ? start : addDays(start, 13)
    // Confirm before adding (click-based creation). Drag-drop placement
    // (openAfter=false) is its own deliberate gesture and stays immediate.
    if (openAfter && !(await confirmDialog({
      title: 'Ajouter une session',
      message: `Créer « ${preset.title} » ?`,
      lines: [
        { label: 'Type', value: kind === 'day' ? 'Journée' : 'Plage' },
        { label: 'Début', value: fmtISO(start) },
        ...(kind === 'day' ? [] : [{ label: 'Fin', value: fmtISO(end) }]),
        ...(parent ? [{ label: 'Dans', value: parent.title || 'Plage parente' }] : []),
      ],
      confirmLabel: 'Créer',
    }))) return
    try {
      const r = await sessionsApi.create(programmeId, {
        title: preset.title, color: preset.color || DEFAULT_COLOR, durationKind: kind,
        startDate: fmtISO(start), endDate: fmtISO(end),
        phaseOrder: sessions.length,
        lane: parent ? (parent.lane || 'Principal') : (lane?.trim() || 'Principal'),
        parentSessionId: parent?.id ?? null,
      })
      toast.success(`${preset.title} ajoutée`)
      await reload()
      if (openAfter && r?.data?.id) setSelectedId(r.data.id)
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Erreur') }
  }

  /** Create an empty day-session (no preset) — optionally nested in a range. */
  const addBlankDay = async (atDate?: Date, lane?: string, parent?: Session) => {
    let start = atDate ?? (() => {
      const last = topLevel.map(s => parseDate(s.endDate ?? s.startDate)).filter(Boolean)
        .sort((a, b) => a!.getTime() - b!.getTime()).pop() as Date | undefined
      return last ? addDays(last, 1) : new Date()
    })()
    if (parent) {
      const ps = parseDate(parent.startDate); const pe = parseDate(parent.endDate ?? parent.startDate)
      start = clampDate(start, ps, pe)
    }
    if (!(await confirmDialog({
      title: 'Ajouter une journée',
      message: 'Créer une nouvelle journée vierge ?',
      lines: [{ label: 'Date', value: fmtISO(start) }, ...(parent ? [{ label: 'Dans', value: parent.title || 'Plage parente' }] : [])],
      confirmLabel: 'Créer',
    }))) return
    try {
      const r = await sessionsApi.create(programmeId, {
        title: 'Journée', color: DEFAULT_COLOR, durationKind: 'day',
        startDate: fmtISO(start), endDate: fmtISO(start),
        phaseOrder: sessions.length,
        lane: parent ? (parent.lane || 'Principal') : (lane?.trim() || 'Principal'),
        parentSessionId: parent?.id ?? null,
      })
      toast.success('Journée vierge ajoutée')
      await reload()
      if (r?.data?.id) setSelectedId(r.data.id)
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Erreur') }
  }

  /** Deep-duplicate a session: fields + journées + activités ("(copie)"). */
  const duplicateSession = async (s: Session) => {
    try {
      const r = await sessionsApi.create(programmeId, {
        title: `${s.title || 'Session'} (copie)`,
        durationKind: kindOf(s), startDate: s.startDate, endDate: s.endDate,
        color: colorOf(s), lane: s.lane || 'Principal',
        sessionType: s.sessionType, parentSessionId: s.parentSessionId ?? null,
        focusCriteriaIds: s.focusCriteriaIds, criterionWeightsJson: s.criterionWeightsJson,
        location: s.location, description: s.description,
        phaseOrder: sessions.length,
        days: (s.days ?? []).map(d => ({
          dayOrder: d.dayOrder, title: d.title, description: d.description,
          date: d.date, location: d.location,
          activities: (d.activities ?? []).map(a => ({
            activityOrder: a.activityOrder, title: a.title, description: a.description,
            color: a.color, startTime: a.startTime, endTime: a.endTime,
            location: a.location, responsibles: a.responsibles, guests: a.guests,
          })),
        })),
      })
      toast.success('Session dupliquée (journées + activités)')
      await reload()
      if (r?.data?.id) setSelectedId(r.data.id)
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Erreur') }
  }

  // ── Keyboard: Suppr = delete selected · Ctrl+Z = undo ──
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      if (view !== 'edit') return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return }
      if (e.key === 'Delete' && selectedId != null) { e.preventDefault(); remove(selectedId) }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  /** Save a session's look (title + color + kind) as a reusable preset. */
  const saveAsPreset = async (session: Session) => {
    const title = (session.title ?? '').trim() || 'Préset'
    if (!confirm(`Enregistrer « ${title} » comme préset réutilisable (couleur + durée) ?`)) return
    try {
      await sessionPresetsApi.create({
        programmeId,
        title,
        color: colorOf(session),
        durationKind: kindOf(session),
      })
      toast.success(`Préset « ${title} » enregistré`)
      reloadPresets()
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Erreur') }
  }

  // ── Undo (Ctrl+Z): inverse patches of session updates (moves, edits…) ──
  const undoRef = useRef<{ id: number; inverse: Partial<Session> }[]>([])
  const recordUndo = (id: number, patch: Partial<Session>) => {
    const cur = sessions.find(s => s.id === id)
    if (!cur) return
    const inverse: any = {}
    for (const k of Object.keys(patch)) inverse[k] = (cur as any)[k] ?? null
    undoRef.current.push({ id, inverse })
    if (undoRef.current.length > 30) undoRef.current.shift()
  }
  const undo = async () => {
    const last = undoRef.current.pop()
    if (!last) { toast('Rien à annuler', { icon: '↩️' }); return }
    const apiPatch: any = { ...last.inverse }
    if ('parentSessionId' in apiPatch && apiPatch.parentSessionId == null) apiPatch.parentSessionId = -1
    if ('evaluationSelectionId' in apiPatch && apiPatch.evaluationSelectionId == null) apiPatch.evaluationSelectionId = -1
    setSessions(arr => arr.map(s => s.id === last.id ? { ...s, ...last.inverse } : s))
    try { await sessionsApi.update(programmeId, last.id, apiPatch); toast('Annulé', { icon: '↩️' }) }
    catch { toast.error('Erreur'); reload() }
  }

  /**
   * Client-side mirror of the backend date rules — fails a bad drag/edit
   * instantly (toast) instead of optimistically applying then reverting on a
   * server 400. Returns an error message, or null when the dates are valid.
   */
  const dateError = (id: number, patch: Partial<Session>): string | null => {
    const cur = sessions.find(s => s.id === id)
    if (!cur) return null
    const touchesDates = 'startDate' in patch || 'endDate' in patch || 'durationKind' in patch
    if (!touchesDates) return null
    const kind: DurationKind = patch.durationKind
      ? (patch.durationKind === 'day' ? 'day' : 'range')
      : kindOf(cur)
    const start = parseDate(patch.startDate ?? cur.startDate)
    if (!start) return null
    let end = kind === 'day' ? start : parseDate(patch.endDate ?? cur.endDate ?? cur.startDate)
    if (kind === 'range' && end && start.getTime() > end.getTime())
      return 'La date de début doit précéder la date de fin de la plage.'
    // Nested journée → must stay within its parent range window.
    if (cur.parentSessionId != null) {
      const parent = sessions.find(s => s.id === cur.parentSessionId)
      const ps = parent ? parseDate(parent.startDate) : null
      const pe = parent ? parseDate(parent.endDate ?? parent.startDate) : null
      if (ps && pe && (start < ps || start > pe || (end != null && (end < ps || end > pe))))
        return `La journée doit rester dans la plage « ${parent!.title || 'parente'} » (${parent!.startDate} → ${parent!.endDate}).`
    }
    // NB: a range whose nested journées would fall outside is NOT a hard error —
    // update() carries the journées along (shift/clamp) after confirmation.
    return null
  }

  /** Nested journées that would leave the new window of a range — with the
   *  adjusted dates to keep them inside (shift on move, clamp on resize). */
  const childrenToCarry = (id: number, patch: Partial<Session>) => {
    const cur = sessions.find(s => s.id === id)
    if (!cur || kindOf(cur) !== 'range') return { isMove: false, patches: [] as { id: number; title?: string; startDate: string; endDate: string }[] }
    if (!('startDate' in patch || 'endDate' in patch)) return { isMove: false, patches: [] }
    const ns = parseDate(patch.startDate ?? cur.startDate)
    const ne = parseDate(patch.endDate ?? cur.endDate ?? cur.startDate)
    if (!ns || !ne) return { isMove: false, patches: [] }
    const os = parseDate(cur.startDate); const oe = parseDate(cur.endDate ?? cur.startDate)
    const day = 86400000
    const dStart = os ? Math.round((ns.getTime() - os.getTime()) / day) : 0
    const dEnd   = oe ? Math.round((ne.getTime() - oe.getTime()) / day) : 0
    const isMove = dStart === dEnd
    const patches: { id: number; title?: string; startDate: string; endDate: string }[] = []
    for (const ch of childrenOf(id)) {
      const cs = parseDate(ch.startDate); if (!cs) continue
      const ce = parseDate(ch.endDate ?? ch.startDate) ?? cs
      if (cs >= ns && cs <= ne && ce >= ns && ce <= ne) continue   // still inside
      const ncs = isMove ? addDays(cs, dStart) : clampDate(cs, ns, ne)
      const nce = kindOf(ch) === 'day' ? ncs : (isMove ? addDays(ce, dStart) : clampDate(ce, ns, ne))
      patches.push({ id: ch.id, title: ch.title, startDate: fmtISO(ncs), endDate: fmtISO(nce) })
    }
    return { isMove, patches }
  }

  const update = async (id: number, patch: Partial<Session>) => {
    const err = dateError(id, patch)
    if (err) { toast.error(err); return }   // reject without touching state — bar stays put

    // Moving/resizing a plage that contains nested journées: carry them along
    // (shift on move, clamp on resize) instead of blocking the change.
    const { isMove, patches: childPatches } = childrenToCarry(id, patch)
    if (childPatches.length > 0) {
      const names = childPatches.map(c => `« ${c.title || 'Journée'} »`).join(', ')
      const ok = await confirmDialog({
        title: 'Déplacer les journées imbriquées ?',
        message: isMove
          ? `${childPatches.length} journée(s) (${names}) seront déplacées avec la plage pour conserver leur position.`
          : `${childPatches.length} journée(s) (${names}) seront ajustées pour rester dans la plage.`,
        confirmLabel: 'Déplacer', cancelLabel: 'Annuler',
      })
      if (!ok) { reload(); return }   // revert the optimistic drag/resize on the board
    }

    recordUndo(id, patch)
    // -1 is the API "clear" sentinel — locally it must become null, otherwise
    // e.g. a freshly detached journée fails the parentSessionId == null filter
    // and vanishes from the board until the next reload.
    const local: Partial<Session> = { ...patch }
    if ((local.parentSessionId as any) === -1) local.parentSessionId = null
    if ((local.evaluationSelectionId as any) === -1) local.evaluationSelectionId = null
    setSessions(arr => arr.map(s => {
      if (s.id === id) return { ...s, ...local }
      const cp = childPatches.find(c => c.id === s.id)
      return cp ? { ...s, startDate: cp.startDate, endDate: cp.endDate } : s
    }))
    try {
      await sessionsApi.update(programmeId, id, patch)
      for (const cp of childPatches) await sessionsApi.update(programmeId, cp.id, { startDate: cp.startDate, endDate: cp.endDate })
    }
    catch (e: any) { toast.error(e?.response?.data?.message ?? 'Erreur'); reload() }
  }

  const remove = async (id: number) => {
    const s = sessions.find(x => x.id === id)
    const kids = childrenOf(id).length
    const outcome = await performDelete('session', id, () => sessionsApi.delete(programmeId, id), {
      label: `la session « ${s?.title ?? '?'} »`,
      detail: kids > 0 ? `${kids} journée(s) imbriquée(s) partiront avec elle (et reviennent à la restauration).` : undefined,
    })
    if (!outcome) return
    if (selectedId === id) setSelectedId(null)
    await reload()
    toast.success(outcome === 'purge' ? 'Supprimée définitivement' : 'Mise à la corbeille')
  }

  // ── Drag-from-library ────────────────────────────────────────────────
  const trackRef = useRef<HTMLDivElement>(null)
  const [dropPreview, setDropPreview] = useState<{ x: number; date: Date; hint?: string } | null>(null)

  // ── Zoom: px per day. null = « Ajuster » (whole begin→end window visible). ──
  const ZOOM_MIN = 2; const ZOOM_MAX = 360
  const boardRef = useRef<HTMLDivElement>(null)
  const [boardW, setBoardW] = useState(0)
  const [zoom, setZoom] = useState<number | null>(null)
  useEffect(() => {
    const el = boardRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setBoardW(el.clientWidth))
    ro.observe(el)
    setBoardW(el.clientWidth)
    return () => ro.disconnect()
    // `loading` matters: the board only exists once loading is done, so the
    // effect must re-run then (boardRef is null during the spinner render).
  }, [view, loading])
  /** Fit = the whole window (start → end) fills the visible board width. */
  const fitPx = boardW > 0 && days.length > 0 ? Math.max(ZOOM_MIN, (boardW - 26) / days.length) : 28
  const pxPerDay = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom ?? fitPx))
  const trackW = Math.max(days.length * pxPerDay, 300)
  /** Deep zoom → the timeline "becomes days": weekday axis + labeled day blocks. */
  const dayMode = pxPerDay >= 26
  /** Extreme zoom → the board becomes a VERTICAL calendar (days = columns,
   *  hours flow downward, activities = agenda blocks). */
  const hourMode = pxPerDay >= 120
  const axisH   = dayMode ? 'h-12'  : 'h-9'
  const axisTop = dayMode ? 'top-12' : 'top-9'
  // Ctrl + molette = zoom, anchored at the cursor (native listener:
  // React wheel handlers are passive, so preventDefault needs addEventListener).
  const pxRef = useRef(pxPerDay)
  pxRef.current = pxPerDay
  const anchorRef = useRef<{ frac: number; vx: number } | null>(null)
  useEffect(() => {
    const el = boardRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const vx = e.clientX - rect.left
      // One anchor per frame: rapid wheel events between renders must not
      // recompute the fraction from a scrollLeft that hasn't been adjusted yet,
      // or the anchored date drifts. (12 = p-3 left padding)
      if (!anchorRef.current) {
        anchorRef.current = { frac: (el.scrollLeft + vx - 12) / (days.length * pxRef.current), vx }
      }
      // Smooth, proportional zoom: small trackpad deltas = gentle steps,
      // full wheel notches = bigger ones. Compound on pxRef so successive
      // events within the same frame stay accurate.
      const factor = Math.min(1.6, Math.max(0.625, Math.exp(-e.deltaY * 0.0022)))
      const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, pxRef.current * factor))
      pxRef.current = next
      setZoom(next)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [view, loading, days.length])
  // After a zoom change, restore the anchor BEFORE paint (no visible jump):
  // the date under the cursor (wheel) or at the viewport center (buttons)
  // stays exactly in place.
  useLayoutEffect(() => {
    const el = boardRef.current; const a = anchorRef.current
    if (!el || !a) return
    anchorRef.current = null
    el.scrollLeft = Math.max(0, a.frac * days.length * pxPerDay + 12 - a.vx)
  }, [pxPerDay, days.length])

  /** Button zoom — anchored at the viewport center (same math as the wheel). */
  const zoomTo = (next: number) => {
    const el = boardRef.current
    if (el) {
      const vx = el.clientWidth / 2
      anchorRef.current = { frac: (el.scrollLeft + vx - 12) / (days.length * pxPerDay), vx }
    }
    setZoom(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next)))
  }

  /** Smooth-scroll the board so today's column is centered. */
  const scrollToToday = () => {
    const el = boardRef.current
    if (!el) return
    const t = Date.now()
    if (t < win.start.getTime() || t > win.end.getTime()) {
      toast('Aujourd’hui est en dehors de la fenêtre du parcours.', { icon: '📅' })
      return
    }
    const x = ((t - win.start.getTime()) / totalMs) * (days.length * pxPerDay) + 12
    el.scrollTo({ left: Math.max(0, x - el.clientWidth / 2), behavior: 'smooth' })
  }

  // ── Drag a bar to move / resize ─────────────────────────────────────
  const dragRef = useRef<{
    id: number; mode: 'move' | 'resize-left' | 'resize-right'
    origX: number; origStart: Date; origEnd: Date; pxPerDay: number
  } | null>(null)
  const [drag, setDrag] = useState<{ id: number; deltaDays: number; mode: string } | null>(null)

  const startDrag = (s: Session, e: React.PointerEvent, mode: 'move' | 'resize-left' | 'resize-right') => {
    e.stopPropagation()
    if ((mode === 'resize-left' || mode === 'resize-right') && kindOf(s) === 'day') return
    const sd = parseDate(s.startDate); const ed = parseDate(s.endDate ?? s.startDate)
    if (!sd || !ed) return
    const track = trackRef.current
    if (!track) return
    const pxPerDay = track.getBoundingClientRect().width / days.length
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    dragRef.current = { id: s.id, mode, origX: e.clientX, origStart: sd, origEnd: ed, pxPerDay }
  }

  const onBoardPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.origX
    const delta = Math.round(dx / dragRef.current.pxPerDay)
    setDrag({ id: dragRef.current.id, deltaDays: delta, mode: dragRef.current.mode })
  }

  /** Set right after a real bar drag so the click that follows pointerup does
   *  NOT open the session panel (drag = placement, click = open). */
  const suppressClickRef = useRef(false)

  const onBoardPointerUp = () => {
    if (!dragRef.current) { setDrag(null); return }
    const { id, mode, origStart, origEnd } = dragRef.current
    const dd = drag?.deltaDays ?? 0
    dragRef.current = null
    setDrag(null)
    if (dd === 0) return
    suppressClickRef.current = true
    setTimeout(() => { suppressClickRef.current = false }, 250)
    const patch: Partial<Session> = {}
    if (mode === 'move') {
      patch.startDate = fmtISO(new Date(origStart.getTime() + dd * DAY_MS))
      patch.endDate   = fmtISO(new Date(origEnd.getTime()   + dd * DAY_MS))
    } else if (mode === 'resize-right') {
      patch.endDate = fmtISO(new Date(Math.max(origStart.getTime(), origEnd.getTime() + dd * DAY_MS)))
    } else if (mode === 'resize-left') {
      patch.startDate = fmtISO(new Date(Math.min(origEnd.getTime(), origStart.getTime() + dd * DAY_MS)))
    }
    update(id, patch)
  }

  /** Calendar view: click an empty slot of a journée column → 1h activity
   *  at that time (the day row is lazily created when missing). */
  const quickAddActivity = async (s: Session, rawMin: number) => {
    const start = Math.max(HOUR_START * 60, Math.min(HOUR_END * 60 - 30, snap(rawMin)))
    const end = Math.min(HOUR_END * 60, start + 60)
    try {
      let day = (s.days ?? []).find(d => d.id)
      if (!day?.id) {
        const r = await sessionsApi.addDay(programmeId, s.id, { dayOrder: 1, date: s.startDate ?? null } as any)
        day = r.data
      }
      if (!day?.id) return
      await sessionsApi.addActivity(programmeId, s.id, day.id, {
        title: 'Nouvelle activité', color: colorOf(s),
        startTime: minToTime(start), endTime: minToTime(end),
      })
      toast.success(`Activité ajoutée à ${minToTime(start).slice(0, 5)}`)
      await reload()
      setSelectedId(s.id)
    } catch { toast.error('Erreur activité') }
  }

  // ── Parcours templates: save / apply the WHOLE session structure ──────────
  const [tplMenuOpen, setTplMenuOpen] = useState(false)
  const [parcoursTpls, setParcoursTpls] = useState<{ id: number; name: string; structureJson: string; sessionCount?: number }[]>([])
  const reloadParcoursTpls = useCallback(() => {
    parcoursTemplatesApi.list().then(r => setParcoursTpls(r.data ?? [])).catch(() => {})
  }, [])
  useEffect(() => { reloadParcoursTpls() }, [reloadParcoursTpls])

  const saveParcoursTemplate = async () => {
    if (!topLevel.length) { toast.error('Aucune session à enregistrer.'); return }
    const name = prompt('Nom du modèle de parcours :')?.trim()
    if (!name) return
    const starts = topLevel.map(s => parseDate(s.startDate)).filter(Boolean) as Date[]
    const origin = starts.length ? new Date(Math.min(...starts.map(d => d.getTime()))) : new Date()
    const off = (d?: string) => { const p = parseDate(d); return p ? Math.round((p.getTime() - origin.getTime()) / DAY_MS) : 0 }
    const ser = (s: Session) => ({
      title: s.title, color: colorOf(s), durationKind: kindOf(s), sessionType: s.sessionType,
      location: s.location, description: s.description, lane: s.lane,
      offsetDays: off(s.startDate),
      durationDays: Math.max(0, off(s.endDate ?? s.startDate) - off(s.startDate)),
      days: (s.days ?? []).map(d => ({
        title: d.title, description: d.description, location: d.location,
        offsetDays: d.date ? off(d.date) : off(s.startDate),
        activities: (d.activities ?? []).map(a => ({
          title: a.title, description: a.description, color: a.color,
          startTime: a.startTime, endTime: a.endTime, location: a.location,
          responsibles: a.responsibles, guests: a.guests,
        })),
      })),
    })
    const structure = topLevel.map(s => ({ ...ser(s), children: childrenOf(s.id).map(ser) }))
    try {
      await parcoursTemplatesApi.create({ name, structureJson: JSON.stringify(structure), sessionCount: topLevel.length })
      toast.success(`Modèle de parcours « ${name} » enregistré`)
      reloadParcoursTpls()
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Erreur') }
  }

  const applyParcoursTemplate = async (tpl: { name: string; structureJson: string }) => {
    let structure: any[] = []
    try { structure = JSON.parse(tpl.structureJson || '[]') } catch { toast.error('Modèle illisible'); return }
    if (!structure.length) { toast.error('Modèle vide'); return }
    const startStr = prompt(`Appliquer « ${tpl.name} » à partir de quelle date ? (AAAA-MM-JJ)`, fmtISO(new Date()))
    if (!startStr) return
    const origin = parseDate(startStr)
    if (!origin) { toast.error('Date invalide'); return }
    const at = (offset?: number) => fmtISO(addDays(origin, offset || 0))
    const tid = toast.loading(`Application de « ${tpl.name} »…`)
    const payload = (x: any, parentId: number | null) => ({
      title: x.title || 'Session',
      durationKind: x.durationKind === 'day' ? 'day' : 'range',
      startDate: at(x.offsetDays),
      endDate: at((x.offsetDays || 0) + (x.durationKind === 'day' ? 0 : (x.durationDays || 0))),
      color: x.color, sessionType: x.sessionType, lane: x.lane || 'Principal',
      location: x.location, description: x.description,
      parentSessionId: parentId, phaseOrder: sessions.length,
      days: (x.days ?? []).map((d: any) => ({
        title: d.title, description: d.description, location: d.location,
        date: at(d.offsetDays), activities: d.activities ?? [],
      })),
    })
    try {
      for (const s of structure) {
        const r = await sessionsApi.create(programmeId, payload(s, null))
        const newId = r?.data?.id ?? null
        for (const ch of (s.children ?? [])) await sessionsApi.create(programmeId, payload(ch, newId))
      }
      toast.success(`Parcours « ${tpl.name} » appliqué`, { id: tid })
      setTplMenuOpen(false)
      await reload()
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Erreur', { id: tid }) }
  }

  /** Shared preset-drop behavior (band + calendar): a journée nests in the
   *  plage covering the drop date, else stays standalone; ranges = top-level. */
  const handleDropPreset = (presetId: number, atDate: Date, parent?: Session) => {
    const preset = presets.find(p => p.id === presetId)
    if (!preset) return
    if (kindOf(preset) === 'day') { addFromPreset(preset, atDate, undefined, parent, false); return }
    addFromPreset(preset, atDate, undefined, undefined, false)
  }

  const selectedSession = sessions.find(s => s.id === selectedId) ?? null
  const drawerOpen = !!selectedSession

  // ── Render ──────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin mr-2" />Chargement…
    </div>
  )

  return (
    <div className="flex flex-col h-full"
      onPointerMove={onBoardPointerMove} onPointerUp={onBoardPointerUp}>
      {/* HEADER */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-gradient-to-r from-amber-500/5 via-card to-rose-500/5 shrink-0">
        <a href={`/programmes/${programmeId}`} title="Retour au programme"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-accent shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </a>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-rose-500 text-white shadow-sm">
          <Calendar className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground truncate">
            🗺️ Parcours · {programme?.title ?? `Programme #${programmeId}`}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {ranges.length} plage{ranges.length > 1 ? 's' : ''} · {dayCount} journée{dayCount > 1 ? 's' : ''} ·
            {' '}{fmtMonthShort(win.start)} → {fmtMonthShort(win.end)} · autosauvegarde en direct
          </p>
        </div>
        {/* Zoom controls (edit view) — Ajuster = whole parcours visible */}
        {view === 'edit' && (
          <div className="inline-flex items-center rounded-lg border border-border bg-muted/40 p-0.5 shrink-0" title="Zoom · Ctrl + molette">
            <button type="button" onClick={() => zoomTo(pxPerDay / 1.4)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-card transition-colors" title="Zoom arrière">
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => setZoom(null)}
              className={`px-2 py-1 rounded-md text-[10px] font-bold transition-colors ${
                zoom == null ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              title="Ajuster : tout le parcours visible (début → fin)">
              Ajuster
            </button>
            <button type="button" onClick={() => zoomTo(pxPerDay * 1.4)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-card transition-colors" title="Zoom avant">
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <span className="px-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground select-none border-l border-border ml-0.5"
              title="Granularité actuelle de la timeline">
              {hourMode ? 'Heures' : dayMode ? 'Jours' : 'Mois'}
            </span>
          </div>
        )}
        {view === 'edit' && (
          <button type="button" onClick={scrollToToday}
            title="Centrer la timeline sur aujourd’hui"
            className="inline-flex items-center gap-1 rounded-lg border border-rose-300/50 bg-rose-500/5 px-2 py-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/15 transition-colors shrink-0">
            <Calendar className="h-3 w-3" />Aujourd&apos;hui
          </button>
        )}
        {/* Parcours templates: save / apply the whole structure */}
        {view === 'edit' && (
          <div className="relative shrink-0">
            <button type="button" onClick={() => setTplMenuOpen(v => !v)}
              title="Modèles de parcours : enregistrer ou appliquer une structure complète"
              className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors ${
                tplMenuOpen ? 'border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-300' : 'border-border text-muted-foreground hover:text-foreground'}`}>
              <Layers className="h-3 w-3" />Modèles
            </button>
            {tplMenuOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 w-72 rounded-xl border border-border bg-card shadow-xl p-2 space-y-1">
                <button type="button" onClick={() => { setTplMenuOpen(false); saveParcoursTemplate() }}
                  className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-foreground hover:bg-accent text-left">
                  <Plus className="h-3.5 w-3.5 text-brand-500" />
                  Enregistrer le parcours actuel comme modèle
                </button>
                {parcoursTpls.length > 0 && <div className="border-t border-border my-1" />}
                {parcoursTpls.map(t => (
                  <div key={t.id} className="flex items-center gap-1 rounded-lg hover:bg-accent/60 px-1">
                    <button type="button" onClick={() => applyParcoursTemplate(t)}
                      title="Appliquer ce modèle (choix de la date de départ)"
                      className="flex-1 min-w-0 flex items-center gap-2 px-1.5 py-2 text-xs text-left">
                      <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      <span className="truncate font-semibold text-foreground">{t.name}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{t.sessionCount ?? '?'} session{(t.sessionCount ?? 0) > 1 ? 's' : ''}</span>
                    </button>
                    <button type="button" title="Supprimer ce modèle"
                      onClick={async () => {
                        if (!confirm(`Supprimer le modèle « ${t.name} » ?`)) return
                        try { await parcoursTemplatesApi.delete(t.id); reloadParcoursTpls() } catch { toast.error('Erreur') }
                      }}
                      className="p-1 rounded text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 shrink-0">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {parcoursTpls.length === 0 && (
                  <p className="px-2.5 py-1 text-[10px] text-muted-foreground italic">Aucun modèle enregistré pour l&apos;instant.</p>
                )}
              </div>
            )}
          </div>
        )}
        {/* Édition ⇄ Aperçu toggle */}
        <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5 text-[11px] font-semibold shrink-0">
          {([['edit', 'Édition', Pencil], ['preview', 'Aperçu', Eye]] as const).map(([k, lbl, Icon]) => (
            <button key={k} type="button" onClick={() => setView(k)}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 transition-colors ${
                view === k ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              <Icon className="h-3 w-3" />{lbl}
            </button>
          ))}
        </div>
        <a href={`/programmes/${programmeId}/builder`}
          title="Ouvrir le constructeur visuel (canvas)"
          className="text-[11px] text-muted-foreground hover:text-brand-500 inline-flex items-center gap-1 shrink-0">
          <Sparkles className="h-3 w-3" />Constructeur
        </a>
      </div>

      {view === 'preview' ? (
        <TimelinePreview sessions={sessions} topLevel={topLevel} childrenOf={childrenOf} />
      ) : (
      <>

      {/* LIBRARY STRIP — one tidy scroll-row of calm, uniform pills (colour = dot
          only, not the whole pill), so adding a session reads at a glance. */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-border bg-muted/20 px-4 py-2.5 shrink-0">
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Ajouter
        </span>
        {presets.map(p => {
          const c = p.color || DEFAULT_COLOR
          const kind = kindOf(p)
          return (
            <span key={p.id} className="group relative inline-flex shrink-0 items-center">
              <button type="button" draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/timeline-preset', String(p.id))
                  // Kind marker as a TYPE — readable during dragover (data is not),
                  // so the drop preview can say where the journée will land.
                  e.dataTransfer.setData(kind === 'day' ? 'application/timeline-day' : 'application/timeline-range', '1')
                  e.dataTransfer.effectAllowed = 'copy'
                }}
                onClick={() => addFromPreset(p)}
                title="Clic = ajouter · Glisser = déposer sur un jour précis (sur une plage = imbriquée)"
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm transition-colors hover:bg-accent cursor-grab active:cursor-grabbing">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c }} />
                {p.title}
                {kind === 'day'
                  ? <CalendarDays className="h-3 w-3 text-muted-foreground" />
                  : <CalendarRange className="h-3 w-3 text-muted-foreground" />}
              </button>
              <button type="button" title="Modifier ce préset"
                onClick={() => setPresetModal({ mode: 'edit', preset: p })}
                className="absolute -top-1.5 -right-1.5 hidden group-hover:flex h-4 w-4 items-center justify-center rounded-full bg-card border border-border text-muted-foreground hover:text-foreground shadow">
                <Pencil className="h-2.5 w-2.5" />
              </button>
            </span>
          )
        })}
        <button type="button" onClick={() => setPresetModal({ mode: 'create' })}
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-dashed border-brand-500/50 bg-brand-500/5 px-3 py-1.5 text-xs font-semibold text-brand-700 dark:text-brand-300 transition-colors hover:bg-brand-500/15">
          <Plus className="h-3 w-3" />Nouveau préset
        </button>
      </div>

      {/* TIMELINE BOARD — opens fitted (begin → end visible); zoom = h-scroll */}
      <div ref={boardRef} className="flex-1 overflow-auto p-3"
        onClick={() => setSelectedId(null)}>
        <div ref={trackRef} className="relative" style={{ width: trackW }}>
          {/* Date axis — months zoomed out, days zoomed in, hours at extreme zoom */}
          <div className={`sticky top-0 z-20 bg-card border-b-2 border-border flex ${axisH}`}>
            {days.map((d, i) => {
              const isMonthStart = d.getDate() === 1 || i === 0
              const isToday = d.toDateString() === new Date().toDateString()
              const isWeekend = d.getDay() === 0 || d.getDay() === 6
              // Zoomed out → declutter: keep numbers only on Mondays / month starts / today.
              const showNum = pxPerDay >= 14 || isMonthStart || isToday || (pxPerDay >= 5 && d.getDay() === 1)
              return (
                <div key={i}
                  className={`relative flex-1 flex flex-col items-center justify-center text-[11px] overflow-hidden ${isWeekend ? 'bg-muted/30' : ''} ${isMonthStart ? 'border-l-2 border-foreground/30' : pxPerDay >= 7 ? 'border-l border-border/20' : ''} ${isToday && dayMode ? 'bg-rose-500/10' : ''}`}>
                  {dayMode && (
                    <span className={`text-[8px] uppercase ${isToday ? 'text-rose-500 font-bold' : 'text-muted-foreground'}`}>
                      {d.toLocaleDateString('fr-FR', { weekday: 'short' })}
                    </span>
                  )}
                  {showNum && (
                    <span className={`font-semibold ${isToday ? 'text-rose-600' : 'text-foreground'}`}>{d.getDate()}</span>
                  )}
                  {isMonthStart && (
                    <span className="text-[8px] font-bold uppercase text-muted-foreground tracking-wider -mt-0.5 whitespace-nowrap">
                      {fmtMonthShort(d)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Today vertical line */}
          {(() => {
            const today = Date.now()
            if (today < win.start.getTime() || today > win.end.getTime()) return null
            const left = ((today - win.start.getTime()) / totalMs) * 100
            return (
              <div className={`absolute ${axisTop} bottom-0 w-px bg-rose-500/60 z-10 pointer-events-none`} style={{ left: `${left}%` }}>
                <span className="absolute -top-1 -translate-x-1/2 rounded-sm bg-rose-500 px-1.5 py-0.5 text-[9px] font-bold text-white whitespace-nowrap">
                  aujourd&apos;hui
                </span>
              </div>
            )
          })()}

          {/* Weekend stripes */}
          {days.map((d, i) => {
            if (d.getDay() !== 0 && d.getDay() !== 6) return null
            const left = ((d.getTime() - win.start.getTime()) / totalMs) * 100
            const w = (DAY_MS / totalMs) * 100
            return <div key={i} className={`absolute ${axisTop} bottom-0 bg-muted/20 pointer-events-none`} style={{ left: `${left}%`, width: `${w}%` }} />
          })}


          {/* Drop preview */}
          {dropPreview && (
            <div className={`absolute ${axisTop} bottom-0 w-1 bg-emerald-500/80 z-30 pointer-events-none rounded-full`} style={{ left: dropPreview.x - 2 }}>
              <span className="absolute -top-1 -translate-x-1/2 rounded-md bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold text-white whitespace-nowrap shadow-lg">
                {fmtShort(dropPreview.date)}{dropPreview.hint ? ` · ${dropPreview.hint}` : ''}
              </span>
            </div>
          )}

          {/* Board content: horizontal band (Mois/Jours) — or a VERTICAL
              calendar (days = columns, hours downward) at hour zoom. */}
          {hourMode ? (
            <CalendarGrid
              sessions={sessions} win={win} days={days} totalMs={totalMs} trackRef={trackRef}
              onSelect={(id) => setSelectedId(id)}
              onAddDayAt={(d) => {
                const host = ranges.find(s => {
                  const ps = parseDate(s.startDate); const pe = parseDate(s.endDate ?? s.startDate)
                  return !!ps && !!pe && d.getTime() >= ps.getTime() && d.getTime() <= pe.getTime()
                })
                addBlankDay(d, undefined, host)
              }}
              onQuickAddActivity={quickAddActivity}
              onMoveActivity={async (s, dayId, aid, patch) => {
                try {
                  await sessionsApi.updateActivity(programmeId, s.id, dayId, aid, patch)
                  await reload()
                } catch { toast.error('Erreur — déplacement non enregistré') }
              }}
              onMoveDay={(s, deltaDays) => {
                const sd0 = parseDate(s.startDate)
                if (!sd0) return
                const ns = fmtISO(addDays(sd0, deltaDays))
                update(s.id, { startDate: ns, endDate: ns })
              }}
              onDropPreset={handleDropPreset}
              onDropPreviewMove={(x, d, hint) => setDropPreview({ x, date: d, hint })}
              onDropPreviewLeave={() => setDropPreview(null)}
            />
          ) : (
          <div className="pt-2 space-y-2">
            <Band
              label="Sessions" kind="range"
              sessions={topLevel} childrenOf={childrenOf}
              win={win} days={days} trackRef={trackRef}
              pxPerDay={pxPerDay}
              onDropPreset={handleDropPreset}
              onAddDay={(s, d) => addBlankDay(d, undefined, s)}
              onDropPreviewMove={(x, d, hint) => setDropPreview({ x, date: d, hint })}
              onDropPreviewLeave={() => setDropPreview(null)}
              selectedId={selectedId} drag={drag}
              onSelect={(id) => { if (suppressClickRef.current) return; setSelectedId(id) }}
              onStartDrag={startDrag}
            />
          </div>
          )}
        </div>

        {topLevel.length === 0 && <EmptyHint />}
      </div>

      {/* CENTERED SESSION OVERLAY */}
      {drawerOpen && (
        <SessionOverlay
          programmeId={programmeId}
          programmeName={programme?.title}
          session={selectedSession!}
          allLanes={laneOptions}
          parents={topLevel.filter(s => kindOf(s) === 'range' && s.id !== selectedSession!.id)}
          children={childrenOf(selectedSession!.id)}
          onUpdate={(patch) => update(selectedSession!.id, patch)}
          onRemove={() => remove(selectedSession!.id)}
          onDuplicate={() => duplicateSession(selectedSession!)}
          onClose={() => setSelectedId(null)}
          onOpenSession={(id) => setSelectedId(id)}
          onAddChild={(preset) => {
            const p = presets.find(x => x.id === preset)
            if (p) addFromPreset(p, undefined, undefined, selectedSession!)
          }}
          onAddBlankChild={() => addBlankDay(undefined, undefined, selectedSession!)}
          onSaveAsPreset={() => saveAsPreset(selectedSession!)}
          dayPresets={presets.filter(p => kindOf(p) === 'day')}
          onDaysChanged={reload}
        />
      )}

      {/* PRESET EDITOR MODAL */}
      <AnimatePresence>
        {presetModal && (
          <PresetEditorModal
            programmeId={programmeId}
            mode={presetModal.mode}
            preset={presetModal.preset}
            onClose={() => setPresetModal(null)}
            onSaved={() => { setPresetModal(null); reloadPresets() }}
          />
        )}
      </AnimatePresence>
      </>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
//                       READ-ONLY APERÇU (PREVIEW)
// ──────────────────────────────────────────────────────────────────────────

/** All activities of a session (across its days), sorted chronologically. */
function activitiesOf(session: Session): Activity[] {
  const acts = (session.days ?? []).flatMap(d => d.activities ?? [])
  return [...acts].sort((a, b) => timeToMin(a.startTime) - timeToMin(b.startTime))
}

/** Human-readable date / range for a session. */
function dateText(s: Session): string {
  const sd = parseDate(s.startDate); const ed = parseDate(s.endDate ?? s.startDate)
  if (!sd) return 'Date à définir'
  if (kindOf(s) === 'day' || !ed || sd.getTime() === ed.getTime()) return fmtShort(sd)
  return `${fmtShort(sd)} → ${fmtShort(ed)}`
}

/** Total activities of a session, counting nested days for ranges. */
function totalActivities(s: Session, childrenOf: (id: number) => Session[]): number {
  return kindOf(s) === 'day'
    ? activitiesOf(s).length
    : activitiesOf(s).length + childrenOf(s.id).reduce((n, k) => n + activitiesOf(k).length, 0)
}

function TimelinePreview({ sessions, topLevel, childrenOf }: {
  sessions: Session[]
  topLevel: Session[]
  childrenOf: (id: number) => Session[]
}) {
  const [openId, setOpenId] = useState<number | null>(null)
  const [openDayId, setOpenDayId] = useState<number | null>(null)

  const open    = openId    != null ? sessions.find(s => s.id === openId)    ?? null : null
  const openDay = openDayId != null ? sessions.find(s => s.id === openDayId) ?? null : null

  if (topLevel.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-center p-8">
        <div className="max-w-xs space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-600">
            <Sparkles className="h-6 w-6" />
          </div>
          <p className="text-sm font-bold text-foreground">Aperçu du parcours</p>
          <p className="text-xs text-muted-foreground">
            Aucune session pour l&apos;instant. Passez en « Édition » pour construire le parcours,
            puis revenez ici pour le visualiser.
          </p>
        </div>
      </div>
    )
  }

  const byDate = (a: Session, b: Session) =>
    (parseDate(a.startDate)?.getTime() ?? 0) - (parseDate(b.startDate)?.getTime() ?? 0)
  const ordered = [...topLevel].sort(byDate)
  const toggle = (id: number) => { setOpenId(p => (p === id ? null : id)); setOpenDayId(null) }
  const openKids = open ? childrenOf(open.id) : []

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-6">
      <SnakeRoadmap sessions={ordered} childrenOf={childrenOf} openId={openId} onToggle={toggle} />

      {/* Expanded detail of the selected station */}
      <AnimatePresence initial={false} mode="wait">
        {open && (
          <motion.div key={open.id}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}>
            <div className="rounded-2xl border-2 bg-card/60 p-4" style={{ borderColor: colorOf(open) + '55' }}>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="h-3 w-3 rounded-full shrink-0" style={{ background: colorOf(open) }} />
                <h3 className="text-sm font-bold text-foreground truncate">{open.title || 'Sans titre'}</h3>
                <span className="text-[11px] text-muted-foreground">{dateText(open)}</span>
                {open.location && (
                  <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{open.location}</span>
                )}
                <button onClick={() => { setOpenId(null); setOpenDayId(null) }}
                  className="ml-auto p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground" title="Fermer">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {kindOf(open) === 'day' ? (
                <AgendaList session={open} />
              ) : openDay ? (
                <>
                  <PreviewBackBar color={colorOf(openDay)} title={openDay.title} subtitle={dateText(openDay)}
                    onBack={() => setOpenDayId(null)} />
                  <AgendaList session={openDay} />
                </>
              ) : (
                <>
                  <RangeSummary session={open} />
                  {openKids.length > 0 ? (
                    <DaysRiver days={openKids} onOpen={(id) => setOpenDayId(id)} />
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Aucune journée dans cette session.</p>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Snake roadmap — one continuous winding path through ALL sessions ────────

const SNAKE_COLS = 3

function SnakeRoadmap({ sessions, childrenOf, openId, onToggle }: {
  sessions: Session[]
  childrenOf: (id: number) => Session[]
  openId: number | null
  onToggle: (id: number) => void
}) {
  // CSS-grid serpentine: every station is placed at an explicit (row, col) in
  // boustrophedon order, and each connector is ANCHORED to its card (absolutely
  // positioned at the card's edge, spanning exactly the grid gap) — so segments
  // can never float detached like the old flex layout.
  return (
    <div className="grid grid-cols-3 gap-8">
      {sessions.map((s, i) => {
        const row = Math.floor(i / SNAKE_COLS)
        const col = row % 2 === 0 ? i % SNAKE_COLS : SNAKE_COLS - 1 - (i % SNAKE_COLS)
        const isLast = i === sessions.length - 1
        const nextSameRow = !isLast && Math.floor((i + 1) / SNAKE_COLS) === row
        const c = colorOf(s)
        return (
          <div key={s.id} className="relative min-w-0"
            style={{ gridRowStart: row + 1, gridColumnStart: col + 1 }}>
            <Station session={s} index={i} childCount={childrenOf(s.id).length}
              actCount={totalActivities(s, childrenOf)} active={openId === s.id}
              onClick={() => onToggle(s.id)} />
            {/* → next station in the same row (gap-8 = w-8, hugs the card edge) */}
            {nextSameRow && (
              <div aria-hidden
                className={`absolute top-1/2 -translate-y-1/2 h-1 w-8 rounded-full ${row % 2 === 0 ? 'left-full' : 'right-full'}`}
                style={{ background: c + '66' }} />
            )}
            {/* ↓ turn to the next row (directly under the corner card) */}
            {!isLast && !nextSameRow && (
              <div aria-hidden
                className="absolute left-1/2 -translate-x-1/2 top-full h-8 w-1 rounded-full"
                style={{ background: c + '66' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function Station({ session, index, childCount, actCount, active, onClick }: {
  session: Session; index: number; childCount: number; actCount: number; active: boolean; onClick: () => void
}) {
  const c = colorOf(session)
  const kind = kindOf(session)
  return (
    <motion.button type="button" onClick={onClick}
      initial={{ opacity: 0, scale: 0.92, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.4), type: 'spring', stiffness: 320, damping: 26 }}
      whileHover={{ y: -3 }}
      className="group relative h-full w-full min-w-0 rounded-2xl border-2 bg-card p-3 text-left shadow-sm hover:shadow-xl transition-shadow"
      style={{ borderColor: active ? c : c + '44', boxShadow: active ? `0 0 0 3px ${c}33` : undefined }}>
      <div className="flex items-center gap-2">
        <span className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-extrabold text-white shrink-0 shadow"
          style={{ background: c }}>{index + 1}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground truncate">{session.title || 'Sans titre'}</p>
          <p className="text-[10px] text-muted-foreground truncate">{dateText(session)}</p>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
        <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold" style={{ background: c + '1A', color: c }}>
          {kind === 'day' ? <CalendarDays className="h-2.5 w-2.5" /> : <CalendarRange className="h-2.5 w-2.5" />}
          {kind === 'day' ? 'Journée' : 'Plage'}
        </span>
        {fonctionOf(session) !== 'STANDARD' && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground" title={FONCTION_META[fonctionOf(session)].hint}>
            {fonctionOf(session) === 'CANDIDATURE_SUBMISSION' ? <Mail className="h-2.5 w-2.5" /> : <ClipboardList className="h-2.5 w-2.5" />}
            {FONCTION_META[fonctionOf(session)].label}
          </span>
        )}
        {childCount > 0 && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
            <CalendarDays className="h-2.5 w-2.5" />{childCount}
          </span>
        )}
        {actCount > 0 && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
            <Clock className="h-2.5 w-2.5" />{actCount}
          </span>
        )}
        <ChevronRight className={`ml-auto h-4 w-4 shrink-0 transition-transform ${active ? 'rotate-90 text-foreground' : 'text-muted-foreground'}`} />
      </div>
    </motion.button>
  )
}

function PreviewBackBar({ color, title, subtitle, lane, onBack }: {
  color: string; title?: string; subtitle?: string; lane?: string; onBack: () => void
}) {
  return (
    <div className="flex items-center gap-2 mb-4 flex-wrap">
      <button onClick={onBack}
        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent">
        <ArrowLeft className="h-3.5 w-3.5" />Retour
      </button>
      <span className="h-3 w-3 rounded-full shrink-0" style={{ background: color }} />
      <h3 className="text-sm font-bold text-foreground truncate">{title || 'Sans titre'}</h3>
      {subtitle && <span className="text-[11px] text-muted-foreground">{subtitle}</span>}
      {lane && <span className="text-[10px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{lane}</span>}
    </div>
  )
}

function RangeSummary({ session }: { session: Session }) {
  const hasResp = (session.responsibles?.length ?? 0) > 0
  if (!session.description && !session.location && !hasResp) return null
  return (
    <div className="rounded-xl border border-border bg-muted/10 p-3 mb-3 space-y-1.5 text-sm">
      {session.location && (
        <p className="flex items-center gap-1.5 text-muted-foreground"><MapPin className="h-3.5 w-3.5 shrink-0" />{session.location}</p>
      )}
      {hasResp && (
        <p className="flex items-center gap-1.5 text-muted-foreground"><Users className="h-3.5 w-3.5 shrink-0" />{session.responsibles!.join(', ')}</p>
      )}
      {session.description && <p className="text-muted-foreground whitespace-pre-wrap">{session.description}</p>}
    </div>
  )
}

function DaysRiver({ days, onOpen }: { days: Session[]; onOpen: (id: number) => void }) {
  const sorted = [...days].sort((a, b) =>
    (parseDate(a.startDate)?.getTime() ?? 0) - (parseDate(b.startDate)?.getTime() ?? 0))
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
        <CalendarDays className="h-3 w-3" />Journées
      </p>
      <div className="relative pl-5">
        <div className="absolute left-[7px] top-3 bottom-3 w-px bg-border" />
        <div className="space-y-2">
          {sorted.map(d => {
            const c = colorOf(d)
            const n = activitiesOf(d).length
            return (
              <button key={d.id} onClick={() => onOpen(d.id)}
                className="group relative w-full text-left flex items-center gap-3 rounded-xl border border-border bg-card hover:border-brand-400 hover:shadow-sm p-3 transition-all">
                <span className="absolute -left-[17px] top-1/2 -translate-y-1/2 h-3 w-3 rounded-full ring-2 ring-card" style={{ background: c }} />
                <span className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: c + '1A', color: c }}>
                  <CalendarDays className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground truncate">{d.title || 'Journée'}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {dateText(d)}{n > 0 ? ` · ${n} activité${n > 1 ? 's' : ''}` : ''}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-brand-500 shrink-0" />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function AgendaList({ session }: { session: Session }) {
  const acts = activitiesOf(session)
  const base = colorOf(session)
  if (acts.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-border bg-muted/10 p-6 text-center">
        <Clock className="h-6 w-6 mx-auto text-muted-foreground/50 mb-2" />
        <p className="text-xs text-muted-foreground">Aucune activité planifiée pour cette journée.</p>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {acts.map((a, i) => {
        const c = a.color || base
        const resp = a.responsibles ?? []
        const guests = a.guests ?? []
        return (
          <div key={a.id ?? i} className="flex gap-3 rounded-xl border border-border bg-card p-3">
            <div className="w-14 shrink-0 text-right pt-0.5">
              <p className="text-xs font-bold tabular-nums text-foreground">{fmtHM(a.startTime) || '—'}</p>
              {a.endTime && <p className="text-[10px] text-muted-foreground tabular-nums">{fmtHM(a.endTime)}</p>}
            </div>
            <div className="w-1 rounded-full shrink-0" style={{ background: c }} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-foreground">{a.title || 'Sans titre'}</p>
              {(a.location || resp.length > 0 || guests.length > 0) && (
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                  {a.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{a.location}</span>}
                  {resp.length > 0 && <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{resp.join(', ')}</span>}
                  {guests.length > 0 && <span className="inline-flex items-center gap-1"><UserPlus className="h-3 w-3" />{guests.join(', ')}</span>}
                </div>
              )}
              {a.description && <p className="mt-1 text-[11px] text-muted-foreground whitespace-pre-wrap">{a.description}</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
//              VERTICAL CALENDAR — hour view at extreme zoom
//   Days are COLUMNS, hours flow DOWNWARD (like a week calendar): plages as
//   slim all-day bands on top, journées as column headers, activities as
//   time-positioned agenda blocks.
// ──────────────────────────────────────────────────────────────────────────

const CAL_HOUR_PX = 44   // px per hour (vertical)
const CAL_BAND_H  = 24   // height of one plage band in the all-day strip

function CalendarGrid({
  sessions, win, days, totalMs, trackRef,
  onSelect, onAddDayAt, onQuickAddActivity, onMoveActivity, onMoveDay,
  onDropPreset, onDropPreviewMove, onDropPreviewLeave,
}: {
  sessions: Session[]
  win: Window
  days: Date[]
  totalMs: number
  trackRef: React.RefObject<HTMLDivElement>
  onSelect: (id: number) => void
  onAddDayAt: (d: Date) => void
  onQuickAddActivity: (s: Session, startMin: number) => void
  onMoveActivity: (s: Session, dayId: number, aid: number, patch: { startTime: string; endTime: string }) => void
  onMoveDay: (s: Session, deltaDays: number) => void
  onDropPreset: (presetId: number, atDate: Date, parent?: Session) => void
  onDropPreviewMove: (x: number, d: Date, hint?: string) => void
  onDropPreviewLeave: () => void
}) {
  const ranges      = useMemo(() => sessions.filter(s => s.parentSessionId == null && kindOf(s) === 'range'), [sessions])
  const daySessions = useMemo(() => sessions.filter(s => kindOf(s) === 'day' && s.startDate), [sessions])
  const { rowOf, rowCount } = useMemo(() => stackRows(ranges), [ranges])

  // ── Mouse interactions: drag activities (move / resize) + drag journée chips ──
  const [actDrag, setActDrag] = useState<{
    sid: number; dayId: number; aid: number; mode: 'move' | 'resize'
    origStart: number; origEnd: number; startY: number; deltaMin: number
  } | null>(null)
  const [chipDrag, setChipDrag] = useState<{ sid: number; startX: number; deltaDays: number } | null>(null)
  const dragMovedRef = useRef(false)
  const dayIdOf = (s: Session, aid: number): number | undefined =>
    (s.days ?? []).find(d => (d.activities ?? []).some(x => x.id === aid))?.id
  const colPx = () => (trackRef.current?.getBoundingClientRect().width ?? 0) / Math.max(1, days.length)

  const onGridPointerMove = (e: React.PointerEvent) => {
    if (actDrag) {
      const dy = e.clientY - actDrag.startY
      if (Math.abs(dy) > 3) dragMovedRef.current = true
      const dm = snap((dy / CAL_HOUR_PX) * 60)
      setActDrag(d => (d ? { ...d, deltaMin: dm } : d))
    }
    if (chipDrag) {
      const dx = e.clientX - chipDrag.startX
      if (Math.abs(dx) > 4) dragMovedRef.current = true
      const dd = Math.round(dx / Math.max(1, colPx()))
      setChipDrag(d => (d ? { ...d, deltaDays: dd } : d))
    }
  }
  const onGridPointerUp = () => {
    if (actDrag) {
      const { sid, dayId, aid, mode, origStart, origEnd, deltaMin } = actDrag
      setActDrag(null)
      if (deltaMin !== 0) {
        const lo = HOUR_START * 60, hi = HOUR_END * 60
        let ns = origStart, ne = origEnd
        if (mode === 'move') {
          const span = Math.max(SNAP_MIN, origEnd - origStart)
          ns = Math.max(lo, Math.min(hi - span, origStart + deltaMin)); ne = ns + span
        } else {
          ne = Math.min(hi, Math.max(origStart + SNAP_MIN, origEnd + deltaMin))
        }
        const sess = daySessions.find(x => x.id === sid)
        if (sess) onMoveActivity(sess, dayId, aid, { startTime: minToTime(ns), endTime: minToTime(ne) })
      }
    }
    if (chipDrag) {
      const { sid, deltaDays } = chipDrag
      setChipDrag(null)
      if (deltaDays !== 0) {
        const sess = daySessions.find(x => x.id === sid)
        if (sess) onMoveDay(sess, deltaDays)
      }
    }
    if (dragMovedRef.current) setTimeout(() => { dragMovedRef.current = false }, 200)
  }
  const stripH = 6 + Math.max(1, rowCount) * CAL_BAND_H
  const hours  = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i)
  const gridH  = (HOUR_END - HOUR_START) * CAL_HOUR_PX

  const dateAtClientX = (clientX: number): Date | null => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || !days.length) return null
    const idx = Math.floor(((clientX - rect.left) / rect.width) * days.length)
    return days[Math.max(0, Math.min(days.length - 1, idx))]
  }
  const hostFor = (d: Date) => ranges.find(s => {
    const ps = parseDate(s.startDate); const pe = parseDate(s.endDate ?? s.startDate)
    return !!ps && !!pe && d.getTime() >= ps.getTime() && d.getTime() <= pe.getTime()
  })
  const colLeft = (d: Date) => ((d.getTime() - win.start.getTime()) / totalMs) * 100
  const colW = (DAY_MS / totalMs) * 100

  return (
    <div
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('application/timeline-preset')) return
        e.preventDefault(); e.dataTransfer.dropEffect = 'copy'
        const rect = trackRef.current?.getBoundingClientRect()
        const d = dateAtClientX(e.clientX)
        if (!rect || !d) return
        let hint: string | undefined
        if (e.dataTransfer.types.includes('application/timeline-day')) {
          const host = hostFor(d)
          hint = host ? `↳ dans « ${host.title || 'plage'} »` : 'journée autonome'
        }
        onDropPreviewMove(e.clientX - rect.left, d, hint)
      }}
      onDragLeave={onDropPreviewLeave}
      onDrop={(e) => {
        e.preventDefault()
        const raw = e.dataTransfer.getData('application/timeline-preset')
        onDropPreviewLeave()
        const presetId = Number(raw); const d = dateAtClientX(e.clientX)
        if (!presetId || !d) return
        onDropPreset(presetId, d, hostFor(d))
      }}
      onPointerMove={onGridPointerMove}
      onPointerUp={onGridPointerUp}
      className="relative mt-2 rounded-xl border border-border bg-card/30"
      style={{ height: stripH + gridH + 6 }}>

      {/* All-day strip: plages as slim bands */}
      {ranges.map(s => {
        const sd = parseDate(s.startDate); const ed = parseDate(s.endDate ?? s.startDate)
        if (!sd || !ed) return null
        const width = (Math.max(ed.getTime() - sd.getTime() + DAY_MS, DAY_MS) / totalMs) * 100
        const row = rowOf.get(s.id) ?? 0
        const c = colorOf(s)
        return (
          <button key={s.id} type="button" onClick={() => onSelect(s.id)}
            title={`${s.title} · ${s.startDate} → ${s.endDate}`}
            className="absolute z-10 rounded-md text-[10px] font-bold text-white px-2 truncate text-left shadow-sm hover:shadow inline-flex items-center gap-1"
            style={{ left: `${colLeft(sd)}%`, width: `${width}%`, top: 4 + row * CAL_BAND_H, height: CAL_BAND_H - 5, background: c }}>
            {fonctionOf(s) !== 'STANDARD' && (
              fonctionOf(s) === 'CANDIDATURE_SUBMISSION'
                ? <Mail className="h-2.5 w-2.5 shrink-0 opacity-90" />
                : <ClipboardList className="h-2.5 w-2.5 shrink-0 opacity-90" />
            )}
            <span className="truncate">{s.title || 'Plage'}</span>
          </button>
        )
      })}

      {/* Hour lines + hour labels (sticky to the left edge while scrolling) */}
      {hours.map(h => (
        <div key={h} className={`absolute left-0 right-0 ${h === HOUR_START ? 'border-t-2 border-border' : 'border-t border-border/40'}`}
          style={{ top: stripH + (h - HOUR_START) * CAL_HOUR_PX }}>
          <span className="sticky left-1.5 inline-block -translate-y-1/2 rounded bg-card/95 border border-border/60 px-1 text-[9px] font-semibold tabular-nums text-muted-foreground z-20">
            {h}h
          </span>
        </div>
      ))}

      {/* Day columns: separators, weekend tint, « + journée » on empty days */}
      {days.map((d, i) => {
        const isWeekend = d.getDay() === 0 || d.getDay() === 6
        const has = daySessions.some(s => parseDate(s.startDate)?.toDateString() === d.toDateString())
        return (
          <div key={i} className="absolute" style={{ left: `${colLeft(d)}%`, width: `${colW}%`, top: stripH, bottom: 0 }}>
            <div className="absolute left-0 top-0 bottom-0 w-px bg-border/40" />
            {isWeekend && <div className="absolute inset-0 bg-muted/20 pointer-events-none" />}
            {!has && (
              <button type="button" onClick={() => onAddDayAt(d)}
                title={`Ajouter une journée le ${fmtShort(d)}`}
                className="absolute inset-x-1 top-1 h-5 z-10 rounded-md text-[10px] font-semibold text-transparent hover:text-muted-foreground hover:bg-accent/70 transition-colors">
                + journée
              </button>
            )}
          </div>
        )
      })}

      {/* Journées + their activities as a vertical agenda */}
      {daySessions.map(s => {
        const cd = parseDate(s.startDate)
        if (!cd) return null
        const c = colorOf(s)
        const acts = activitiesOf(s)
        // Side-by-side columns when activities overlap (same algorithm as the
        // day agenda) — no more blocks hidden behind each other.
        const lay = layoutActivities(acts)
        const chipOffsetPx = chipDrag?.sid === s.id ? chipDrag.deltaDays * colPx() : 0
        return (
          <div key={s.id}
            className="absolute cursor-copy"
            title="Cliquer sur un créneau libre = ajouter une activité à cette heure"
            onClick={(e) => {
              if (dragMovedRef.current) return
              const y = e.clientY - e.currentTarget.getBoundingClientRect().top
              onQuickAddActivity(s, HOUR_START * 60 + (y / CAL_HOUR_PX) * 60)
            }}
            style={{ left: `${colLeft(cd)}%`, width: `${colW}%`, top: stripH, bottom: 6 }}>
            <button type="button"
              onClick={(e) => { e.stopPropagation(); if (dragMovedRef.current) return; onSelect(s.id) }}
              onPointerDown={(e) => {
                e.stopPropagation()
                ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
                dragMovedRef.current = false
                setChipDrag({ sid: s.id, startX: e.clientX, deltaDays: 0 })
              }}
              title={`${s.title || 'Journée'} · ${s.startDate}${s.parentSessionId != null ? ' (imbriquée)' : ''} — glisser pour changer de jour`}
              className="absolute inset-x-1 top-1 z-20 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white truncate text-left shadow cursor-grab active:cursor-grabbing"
              style={{ background: c, transform: chipOffsetPx ? `translateX(${chipOffsetPx}px)` : undefined }}>
              {s.parentSessionId != null ? '↳ ' : ''}{s.title || 'Journée'}
              {chipDrag?.sid === s.id && chipDrag.deltaDays !== 0 && (
                <span className="ml-1 rounded bg-black/30 px-1">{fmtShort(addDays(cd, chipDrag.deltaDays))}</span>
              )}
            </button>
            {acts.map((a, j) => {
              const isDragged = actDrag?.sid === s.id && actDrag.aid === a.id
              const dMove = isDragged && actDrag!.mode === 'move' ? actDrag!.deltaMin : 0
              const dResize = isDragged && actDrag!.mode === 'resize' ? actDrag!.deltaMin : 0
              const rawStart = timeToMin(a.startTime) + dMove
              const rawEnd0 = (a.endTime ? timeToMin(a.endTime) : timeToMin(a.startTime) + 60) + dMove + dResize
              const s0 = Math.max(rawStart, HOUR_START * 60)
              const e0 = Math.min(Math.max(rawEnd0, s0 + 30), HOUR_END * 60)
              if (s0 >= HOUR_END * 60) return null
              const ac = a.color || c
              const pos = a.id != null ? lay.get(a.id) : undefined
              const cols = pos?.cols ?? 1
              const col = pos?.col ?? 0
              return (
                <button key={a.id ?? j} type="button"
                  onClick={(e) => { e.stopPropagation(); if (dragMovedRef.current) return; onSelect(s.id) }}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    if (a.id == null) return
                    const dayId = dayIdOf(s, a.id)
                    if (dayId == null) return
                    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
                    dragMovedRef.current = false
                    setActDrag({
                      sid: s.id, dayId, aid: a.id, mode: 'move',
                      origStart: timeToMin(a.startTime),
                      origEnd: a.endTime ? timeToMin(a.endTime) : timeToMin(a.startTime) + 60,
                      startY: e.clientY, deltaMin: 0,
                    })
                  }}
                  title={`${a.title}${a.startTime ? ` · ${fmtHM(a.startTime)}–${fmtHM(a.endTime)}` : ''} — glisser pour déplacer, bord bas pour redimensionner`}
                  className={`absolute z-10 rounded-md border text-left px-1 py-0.5 overflow-hidden hover:brightness-110 transition-[filter] ${isDragged ? 'cursor-grabbing ring-2 ring-foreground/30' : 'cursor-grab'}`}
                  style={{
                    top: ((s0 - HOUR_START * 60) / 60) * CAL_HOUR_PX,
                    height: Math.max(((e0 - s0) / 60) * CAL_HOUR_PX - 2, 14),
                    left: `calc(${(col / cols) * 100}% + 3px)`,
                    width: `calc(${100 / cols}% - 6px)`,
                    background: ac + '26', borderColor: ac + '77',
                  }}>
                  <p className="text-[9px] font-bold truncate" style={{ color: ac }}>
                    {isDragged ? `${minToTime(s0).slice(0, 5)}–${minToTime(e0).slice(0, 5)} ` : `${fmtHM(a.startTime)} `}
                    {a.title || 'Activité'}
                  </p>
                  {/* Bottom resize handle */}
                  <span
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      if (a.id == null) return
                      const dayId = dayIdOf(s, a.id)
                      if (dayId == null) return
                      ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
                      dragMovedRef.current = false
                      setActDrag({
                        sid: s.id, dayId, aid: a.id, mode: 'resize',
                        origStart: timeToMin(a.startTime),
                        origEnd: a.endTime ? timeToMin(a.endTime) : timeToMin(a.startTime) + 60,
                        startY: e.clientY, deltaMin: 0,
                      })
                    }}
                    className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize hover:bg-black/15" />
                </button>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
//                          BAND (a type-row: ranges OR days)
// ──────────────────────────────────────────────────────────────────────────

/** Greedy interval-partition: assign each session a sub-row so none overlap. */
function stackRows(sessions: Session[]): { rowOf: Map<number, number>; rowCount: number } {
  const sorted = [...sessions].sort(
    (a, b) => (parseDate(a.startDate)?.getTime() ?? 0) - (parseDate(b.startDate)?.getTime() ?? 0))
  const rowEnd: number[] = []
  const rowOf = new Map<number, number>()
  for (const s of sorted) {
    const sd = parseDate(s.startDate); const ed = parseDate(s.endDate ?? s.startDate)
    if (!sd) continue
    const startMs = sd.getTime()
    const endMs = Math.max(ed?.getTime() ?? startMs, startMs) + DAY_MS
    let r = rowEnd.findIndex(e => e <= startMs)
    if (r === -1) { r = rowEnd.length; rowEnd.push(0) }
    rowEnd[r] = endMs
    rowOf.set(s.id, r)
  }
  return { rowOf, rowCount: Math.max(1, rowEnd.length) }
}

function Band({
  label, kind, sessions, childrenOf, win, days, trackRef, pxPerDay,
  onDropPreset, onAddDay, onDropPreviewMove, onDropPreviewLeave,
  selectedId, drag, onSelect, onStartDrag,
}: {
  label: string
  kind: DurationKind
  sessions: Session[]
  childrenOf: (id: number) => Session[]
  win: Window
  days: Date[]
  trackRef: React.RefObject<HTMLDivElement>
  pxPerDay: number
  onDropPreset: (presetId: number, atDate: Date, parent?: Session) => void
  onAddDay: (s: Session, d: Date) => void
  onDropPreviewMove: (x: number, d: Date, hint?: string) => void
  onDropPreviewLeave: () => void
  selectedId: number | null
  drag: { id: number; deltaDays: number; mode: string } | null
  onSelect: (id: number) => void
  onStartDrag: (s: Session, e: React.PointerEvent, mode: 'move' | 'resize-left' | 'resize-right') => void
}) {
  const totalMs = win.end.getTime() - win.start.getTime()
  const dayMode = pxPerDay >= 26
  const LABEL_H = 6
  // Day mode = calendar template: taller bars so day cells/labels are readable.
  const ROW_H = dayMode ? 76 : 50
  const { rowOf, rowCount } = useMemo(() => stackRows(sessions), [sessions])
  const height = LABEL_H + rowCount * ROW_H + 6

  const dateAtClientX = (clientX: number): Date | null => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || !days.length) return null
    const idx = Math.floor(((clientX - rect.left) / rect.width) * days.length)
    return days[Math.max(0, Math.min(days.length - 1, idx))]
  }

  return (
    <div
      data-band={kind}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('application/timeline-preset')) return
        e.preventDefault(); e.dataTransfer.dropEffect = 'copy'
        const rect = trackRef.current?.getBoundingClientRect()
        const d = dateAtClientX(e.clientX)
        if (!rect || !d) return
        // Tell the user where a journée will land: inside the plage covering
        // the hovered date, or as a standalone session.
        let hint: string | undefined
        if (e.dataTransfer.types.includes('application/timeline-day')) {
          const host = sessions.find(s => {
            if (kindOf(s) !== 'range') return false
            const ps = parseDate(s.startDate); const pe = parseDate(s.endDate ?? s.startDate)
            return !!ps && !!pe && d.getTime() >= ps.getTime() && d.getTime() <= pe.getTime()
          })
          hint = host ? `↳ dans « ${host.title || 'plage'} »` : 'journée autonome'
        }
        onDropPreviewMove(e.clientX - rect.left, d, hint)
      }}
      onDragLeave={onDropPreviewLeave}
      onDrop={(e) => {
        e.preventDefault()
        const raw = e.dataTransfer.getData('application/timeline-preset')
        onDropPreviewLeave()
        const presetId = Number(raw)
        const d = dateAtClientX(e.clientX)
        if (!presetId || !d) return
        // Target phase: the bar actually under the cursor (event target), else
        // the plage whose date window contains the drop date — forgiving, so a
        // journée dropped anywhere in a phase's period nests there.
        const barEl = (e.target as HTMLElement | null)?.closest?.('[data-session-id]') as HTMLElement | null
        const hitId = barEl ? Number(barEl.dataset.sessionId) : null
        let parent = hitId ? sessions.find(s => s.id === hitId && kindOf(s) === 'range') : undefined
        if (!parent) {
          parent = sessions.find(s => {
            if (kindOf(s) !== 'range') return false
            const ps = parseDate(s.startDate); const pe = parseDate(s.endDate ?? s.startDate)
            return !!ps && !!pe && d.getTime() >= ps.getTime() && d.getTime() <= pe.getTime()
          })
        }
        onDropPreset(presetId, d, parent)
      }}
      className="relative"
      style={{ height }}>
      {sessions.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-[11px] text-muted-foreground italic">
            glissez un préset ici
          </span>
        </div>
      )}

      {/* Row guides — zebra + separators so the board reads as a Gantt grid. */}
      {Array.from({ length: rowCount }).map((_, r) => (
        <div key={`row-${r}`}
          className={`pointer-events-none absolute inset-x-0 border-t border-border/30 ${r % 2 === 1 ? 'bg-muted/[0.06]' : ''}`}
          style={{ top: LABEL_H + r * ROW_H, height: ROW_H }} />
      ))}

      {sessions.map((s) => {
        const sd = parseDate(s.startDate); const ed = parseDate(s.endDate ?? s.startDate)
        if (!sd || !ed) return null
        const left = ((sd.getTime() - win.start.getTime()) / totalMs) * 100
        const widthMs = Math.max(ed.getTime() - sd.getTime() + DAY_MS, DAY_MS)
        const width = (widthMs / totalMs) * 100
        const myDrag = drag?.id === s.id ? drag : null
        const offsetPx = myDrag?.mode === 'move'         ? myDrag.deltaDays * pxPerDay : 0
        const rightDx  = myDrag?.mode === 'resize-right' ? myDrag.deltaDays * pxPerDay : 0
        const leftDx   = myDrag?.mode === 'resize-left'  ? myDrag.deltaDays * pxPerDay : 0
        const row = rowOf.get(s.id) ?? 0
        // A bar narrower than ~84px can't show its title inside → label it beside the bar.
        const barColor = colorOf(s)
        const barDays = Math.max(1, Math.round((ed.getTime() - sd.getTime()) / DAY_MS) + 1)
        const showExtLabel = barDays * pxPerDay < 84 && !!s.title
        // Live feedback while dragging: the dates the bar will get on release.
        const dragDates = (() => {
          if (!myDrag || myDrag.deltaDays === 0) return null
          const dd = myDrag.deltaDays
          const ns = myDrag.mode === 'resize-right' ? sd : new Date(sd.getTime() + dd * DAY_MS)
          const ne = myDrag.mode === 'resize-left'  ? ed : new Date(Math.max(
            (myDrag.mode === 'resize-right' ? sd : ns).getTime(),
            ed.getTime() + dd * DAY_MS))
          return kindOf(s) === 'day' ? fmtShort(ns) : `${fmtShort(ns)} → ${fmtShort(ne)}`
        })()
        return (
          <div key={s.id} className="contents">
            <SessionBar
              session={s}
              childDays={childrenOf(s.id)}
              pxPerDay={pxPerDay}
              win={win}
              left={`calc(${left}% + ${offsetPx + leftDx}px)`}
              width={`calc(${width}% + ${rightDx - leftDx}px)`}
              top={LABEL_H + row * ROW_H + 5}
              isSelected={selectedId === s.id}
              onSelect={(e) => { e.stopPropagation(); onSelect(s.id) }}
              onSelectChild={(id) => onSelect(id)}
              onAddDay={(d) => onAddDay(s, d)}
              onPointerDown={(e) => onStartDrag(s, e, 'move')}
              onResizeLeft={(e) => onStartDrag(s, e, 'resize-left')}
              onResizeRight={(e) => onStartDrag(s, e, 'resize-right')}
            />
            {dragDates && (
              <div className="absolute z-40 rounded-md bg-foreground text-background px-1.5 py-0.5 text-[10px] font-bold pointer-events-none whitespace-nowrap shadow-lg"
                style={{ left: `calc(${left}% + ${offsetPx + leftDx}px)`, top: LABEL_H + row * ROW_H - 16 }}>
                {dragDates}
              </div>
            )}
            {showExtLabel && (
              <div className="pointer-events-none absolute z-30 whitespace-nowrap rounded border border-border/50 px-1.5 py-0.5 text-[11px] font-semibold shadow-sm"
                style={{ left: `calc(${left + width}% + ${offsetPx + rightDx}px + 5px)`, top: LABEL_H + row * ROW_H + 14, color: barColor, background: 'hsl(var(--card))' }}>
                {s.title}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
//                                SESSION BAR
// ──────────────────────────────────────────────────────────────────────────

function SessionBar({
  session, childDays, win, left, width, top = 10, isSelected,
  onSelect, onSelectChild, onAddDay, onPointerDown, onResizeLeft, onResizeRight,
  pxPerDay = 0,
}: {
  session: Session
  childDays: Session[]
  win: Window
  left: string; width: string; top?: number
  pxPerDay?: number
  isSelected: boolean
  onSelect: (e: React.MouseEvent) => void
  onSelectChild: (id: number) => void
  onAddDay?: (d: Date) => void
  onPointerDown: (e: React.PointerEvent) => void
  onResizeLeft: (e: React.PointerEvent) => void
  onResizeRight: (e: React.PointerEvent) => void
}) {
  const c = colorOf(session)
  const kind = kindOf(session)
  const fn = fonctionOf(session)
  /** Deep zoom: the bar becomes a calendar day-template (cells, numbers, +).
   *  (At hour zoom the whole board switches to the vertical CalendarGrid.) */
  const dayModeBar = kind === 'range' && pxPerDay >= 26
  const locked = kind === 'day'
  const { critical } = detectMissing(session)
  const sd = parseDate(session.startDate); const ed = parseDate(session.endDate ?? session.startDate)
  const dayCount = sd && ed ? Math.max(1, Math.round((ed.getTime() - sd.getTime()) / DAY_MS) + 1) : 1

  // Child day markers positioned along the bar by their date offset within the range.
  const spanMs = sd && ed ? Math.max(ed.getTime() - sd.getTime() + DAY_MS, DAY_MS) : DAY_MS

  return (
    <div
      data-session-id={session.id}
      onClick={onSelect}
      onPointerDown={onPointerDown}
      title={`${session.title}  ${session.startDate ?? '?'}${kind === 'range' ? ' → ' + (session.endDate ?? '?') : ''}\n${session.lane ?? 'Principal'}`}
      className={`absolute rounded-lg flex ${dayModeBar ? 'items-start' : 'items-center'} text-[11px] font-bold text-white cursor-grab active:cursor-grabbing select-none transition-shadow shadow-sm hover:shadow-md overflow-hidden ${isSelected ? 'ring-2 ring-offset-2 ring-foreground/40' : ''}`}
      style={{ left, width, height: dayModeBar ? 66 : 40, top, background: c }}>
      {/* Left resize handle */}
      <div onPointerDown={(e) => { e.stopPropagation(); onResizeLeft(e) }}
        title={locked ? 'Journée (verrouillé)' : 'Glisser pour avancer le début'}
        className={`shrink-0 self-stretch w-2 z-10 ${locked ? 'cursor-default opacity-0' : 'cursor-ew-resize hover:bg-white/30'}`} />

      {/* Body */}
      <div className={`flex-1 min-w-0 px-2 truncate flex items-center gap-1.5 ${dayModeBar ? 'pt-1' : ''}`}>
        {kind === 'day' ? <CalendarDays className="h-3 w-3 shrink-0 opacity-90" /> : <CalendarRange className="h-3 w-3 shrink-0 opacity-90" />}
        {visibilityOf(session) !== 'VISIBLE' && (
          <span title={visibilityOf(session) === 'HIDDEN' ? 'Interne' : 'Privé'}
            className="shrink-0 inline-flex items-center rounded-full bg-black/25 px-1 py-0.5 text-[9px] font-bold">
            <EyeOff className="h-2.5 w-2.5" />
          </span>
        )}
        <span className="truncate">{session.title || '·'}</span>
        {fn !== 'STANDARD' && (
          <span title={FONCTION_META[fn].hint}
            className="text-[9px] rounded-full bg-white/25 px-1 py-0.5 shrink-0 inline-flex items-center gap-0.5">
            {fn === 'CANDIDATURE_SUBMISSION' ? <Mail className="h-2.5 w-2.5" /> : <ClipboardList className="h-2.5 w-2.5" />}
          </span>
        )}
        {childDays.length > 0 && (
          <span className="text-[9px] opacity-90 rounded-full bg-black/20 px-1 py-0.5 shrink-0 inline-flex items-center gap-0.5">
            <CalendarDays className="h-2.5 w-2.5" />{childDays.length}
          </span>
        )}
      </div>

      {/* Calendar day-template (deep zoom): per-day cells with separators,
          day numbers and a hover « + » to add a journée on that exact date. */}
      {dayModeBar && sd && dayCount <= 92 && Array.from({ length: dayCount }).map((_, di) => {
        const date = new Date(sd.getTime() + di * DAY_MS)
        const leftPct = (di * DAY_MS / spanMs) * 100
        const wPct = (DAY_MS / spanMs) * 100
        const taken = childDays.some(ch => parseDate(ch.startDate)?.toDateString() === date.toDateString())
        return (
          <div key={`cell-${di}`} className="absolute top-0 bottom-0 pointer-events-none"
            style={{ left: `${leftPct}%`, width: `${wPct}%` }}>
            {di > 0 && <div className="absolute left-0 top-0 bottom-0 w-px bg-white/20" />}
            <span className="absolute top-0.5 right-1 text-[8px] font-bold text-white/50">{date.getDate()}</span>
            {!taken && onAddDay && (
              <button type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onAddDay(date) }}
                title={`Ajouter une journée le ${fmtShort(date)}`}
                className="pointer-events-auto absolute inset-x-0.5 bottom-0.5 h-5 rounded-md flex items-center justify-center text-[12px] font-bold text-white/0 hover:text-white hover:bg-white/25 transition-colors">
                +
              </button>
            )}
          </div>
        )
      })}

      {/* Nested day markers (children) — deep zoom turns them into labeled
          one-day blocks ("the timeline becomes days"); zoomed out = slim pins. */}
      {kind === 'range' && sd && childDays.map(ch => {
        const cd = parseDate(ch.startDate)
        if (!cd) return null
        if (dayModeBar) {
          const startPct = ((cd.getTime() - sd.getTime()) / spanMs) * 100
          const wPct = (DAY_MS / spanMs) * 100
          return (
            <button key={ch.id} type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onSelectChild(ch.id) }}
              title={`${ch.title || 'Journée'} · ${ch.startDate}`}
              className="absolute top-6 bottom-1 rounded-md bg-white/90 hover:bg-white shadow ring-1 ring-black/10 px-1 text-[9px] font-bold truncate text-left flex items-center"
              style={{ left: `calc(${Math.max(0, Math.min(100, startPct))}% + 1px)`, width: `calc(${wPct}% - 2px)`, color: c }}>
              <span className="truncate">{ch.title || 'Journée'}</span>
            </button>
          )
        }
        const pct = ((cd.getTime() - sd.getTime() + DAY_MS / 2) / spanMs) * 100
        return (
          <button key={ch.id} type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onSelectChild(ch.id) }}
            title={`${ch.title} · ${ch.startDate}`}
            className="absolute top-1 bottom-1 w-3 -translate-x-1/2 rounded-sm bg-white/85 hover:bg-white shadow ring-1 ring-black/10"
            style={{ left: `${Math.max(1, Math.min(99, pct))}%` }} />
        )
      })}

      {/* Only CRITICAL issues surface on the board — soft warnings live in the
          session panel, keeping the timeline calm. */}
      {critical.length > 0 && (
        <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-rose-500 ring-2 ring-card flex items-center justify-center"
          title={`Critique : ${critical.join(', ')}`}>
          <AlertTriangle className="h-2 w-2 text-white" />
        </div>
      )}

      {/* Right resize handle */}
      <div onPointerDown={(e) => { e.stopPropagation(); onResizeRight(e) }}
        title={locked ? 'Journée (verrouillé)' : 'Glisser pour rallonger'}
        className={`shrink-0 self-stretch w-2 ${locked ? 'cursor-default opacity-0' : 'cursor-ew-resize hover:bg-white/30'}`} />
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
        ↑ Glissez un préset de la bibliothèque pour démarrer le parcours —
        une journée déposée sur les dates d&apos;une plage s&apos;y imbrique, ailleurs elle reste autonome
      </p>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
//                          SIDE PANEL (right-side editor)
// ──────────────────────────────────────────────────────────────────────────

function SessionOverlay({
  programmeId, programmeName, session, allLanes, parents, children, dayPresets,
  onUpdate, onRemove, onDuplicate, onClose, onOpenSession, onAddChild, onAddBlankChild, onSaveAsPreset, onDaysChanged,
}: {
  programmeId: number
  programmeName?: string
  session: Session
  allLanes: string[]
  parents: Session[]
  children: Session[]
  dayPresets: Preset[]
  onUpdate: (p: Partial<Session>) => void
  onRemove: () => void
  onDuplicate: () => void
  onClose: () => void
  onOpenSession: (id: number) => void
  onAddChild: (presetId: number) => void
  onAddBlankChild: () => void
  onSaveAsPreset: () => void
  onDaysChanged: () => void
}) {
  const c = colorOf(session)
  const kind = kindOf(session)
  const { critical, warnings } = detectMissing(session)

  // Preview-before-update: edits to CONSEQUENTIAL fields (dates, visibility,
  // type, scheduling flags, parent) show a before→after preview the admin must
  // confirm. Cosmetic edits (title, color, description, …) apply immediately so
  // the editor stays fluid. Drag/resize bypass this (they call update() directly).
  const onUpdatePreviewed = async (patch: Partial<Session>) => {
    const lines = previewLines(session, patch)
    if (lines.length === 0) { onUpdate(patch); return }
    if (await confirmDialog({
      title: 'Aperçu de la modification',
      message: `Session « ${session.title || 'Sans titre'} »`,
      lines, confirmLabel: 'Appliquer',
    })) onUpdate(patch)
  }

  // A session's « Fonction » (reused sessionType) wires it to a programme feature.
  const fonction = fonctionOf(session)
  const isFunctionPhase = fonction !== 'STANDARD'

  // Unified, readability-first layout: the session info comes FIRST (Détails tab),
  // its feature panel (candidatures / jury) and activities/days live in their own
  // tabs so they're never mixed with the general information.
  type OverlayTab = 'details' | 'feature' | 'activities' | 'days'
  const overlayTabs = useMemo(() => {
    const t: { key: OverlayTab; label: string; icon: any }[] = [{ key: 'details', label: 'Détails', icon: Info }]
    if (isFunctionPhase) t.push({ key: 'feature', label: fonction === 'CANDIDATURE_SUBMISSION' ? 'Candidatures' : 'Jury', icon: fonction === 'CANDIDATURE_SUBMISSION' ? Mail : ClipboardList })
    if (kind === 'day') t.push({ key: 'activities', label: 'Activités', icon: Clock })
    if (kind === 'range') t.push({ key: 'days', label: 'Journées', icon: CalendarDays })
    return t
  }, [isFunctionPhase, fonction, kind])
  const [tab, setTab] = useState<OverlayTab>('details')
  useEffect(() => { setTab('details') }, [session.id])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  // Programme criteria — used by the per-session criteria picker (EditorPanel).
  const [criteria, setCriteria] = useState<Criterion[]>([])
  useEffect(() => {
    programmesApi.criteria(programmeId).then(r => setCriteria(r.data ?? [])).catch(() => {})
  }, [programmeId])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div onClick={onClose}
      className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div onClick={(e) => e.stopPropagation()}
        className={`w-full ${kind === 'day' || isFunctionPhase ? 'max-w-5xl' : 'max-w-3xl'} h-[88vh] flex flex-col rounded-2xl bg-card border-2 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150`}
        style={{ borderColor: c + '66' }}>
        {/* Header */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-border shrink-0" style={{ background: c + '10' }}>
          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: c }} />
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground shrink-0">
            {kind === 'day' ? <><CalendarDays className="h-3 w-3" />Journée</> : <><CalendarRange className="h-3 w-3" />Plage</>}
          </span>
          <span className="text-base font-bold text-foreground truncate">{session.title || 'Sans titre'}</span>
          {visibilityOf(session) !== 'VISIBLE' && (
            <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-bold shrink-0 ${VISIBILITY_META[visibilityOf(session)].cls}`}
              title={visibilityOf(session) === 'HIDDEN' ? 'Session interne — masquée du parcours public' : 'Session privée — invités uniquement'}>
              <EyeOff className="h-3 w-3" />{VISIBILITY_META[visibilityOf(session)].badge}
            </span>
          )}
          <span className="text-[11px] text-muted-foreground shrink-0 hidden sm:inline">{dateText(session)}</span>
          {critical.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-300/40 px-1.5 py-0.5 text-[10px] font-bold shrink-0" title={`Critique : ${critical.join(', ')}`}>
              <AlertTriangle className="h-3 w-3" />{critical.length}
            </span>
          )}
          {warnings.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-300/40 px-1.5 py-0.5 text-[10px] font-bold shrink-0" title={`Attention : ${warnings.join(', ')}`}>
              <Info className="h-3 w-3" />{warnings.length}
            </span>
          )}
          <div className="ml-auto" />
          {session.id && kind === 'day' && (
            <SessionNotifyButton
              programmeId={programmeId} programmeName={programmeName ?? 'Programme'} session={session as any} compact
              onSessionPatched={(patch) => onUpdate(patch as any)}
              className="p-1 rounded hover:bg-brand-500/10 text-muted-foreground hover:text-brand-600 shrink-0" />
          )}
          <button onClick={onDuplicate} title="Dupliquer la session (avec journées + activités)"
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground shrink-0">
            <Copy className="h-4 w-4" />
          </button>
          <button onClick={onRemove} title="Supprimer la session (touche Suppr)"
            className="p-1 rounded hover:bg-rose-500/10 text-muted-foreground hover:text-rose-600 shrink-0">
            <Trash2 className="h-4 w-4" />
          </button>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground shrink-0" title="Fermer (Échap)">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab bar — Détails first, feature & activities/days clearly separated. */}
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border bg-muted/20 shrink-0">
          {overlayTabs.map((t) => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-bold transition-colors ${
                tab === t.key ? 'bg-card text-foreground shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground'}`}>
              <t.icon className="h-3.5 w-3.5" />{t.label}
            </button>
          ))}
        </div>

        {/* Body — one section at a time, never mixed. */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {tab === 'details' && (
            <div className="h-full overflow-y-auto">
              <div className="mx-auto max-w-2xl">
                <EditorPanel session={session} allLanes={allLanes} parents={parents}
                  onUpdate={onUpdatePreviewed} onSaveAsPreset={onSaveAsPreset} criteria={criteria} />
              </div>
            </div>
          )}

          {tab === 'feature' && (
            <div className="h-full overflow-y-auto">
              {fonction === 'CANDIDATURE_SUBMISSION'
                ? <CandidaturePhasePanel programmeId={programmeId} />
                : <PreselectionPhasePanel programmeId={programmeId}
                    session={{ id: session.id, title: session.title, focusCriteriaIds: session.focusCriteriaIds,
                      criterionWeightsJson: session.criterionWeightsJson, evaluationSelectionId: session.evaluationSelectionId }}
                    onUpdateSession={(patch) => onUpdate(patch as Partial<Session>)} />}
            </div>
          )}

          {tab === 'activities' && (
            <div className="h-full">
              <DayCanvas programmeId={programmeId} programmeName={programmeName} session={session} onChanged={onDaysChanged} />
            </div>
          )}

          {tab === 'days' && (
            <div className="h-full overflow-y-auto">
              <ChildDaysPane session={session} children={children} dayPresets={dayPresets}
                onOpenSession={onOpenSession} onAddChild={onAddChild} onAddBlankChild={onAddBlankChild} />
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ──────────────────────────────────────────────────────────────────────────
//             SESSION INFO SUMMARY (read-first header of the Détails tab)
// ──────────────────────────────────────────────────────────────────────────

/** Clear, structured at-a-glance read of the session before its editable fields. */
function SessionInfoSummary({ session }: { session: Session }) {
  const c = colorOf(session)
  const kind = kindOf(session)
  const vis = visibilityOf(session)
  const acts = (session.days ?? []).reduce((n, d) => n + (d.activities?.length ?? 0), 0)
  const typeLabel = SESSION_TYPE_DISPLAY[session.sessionType || 'INCUBATION'] ?? (session.sessionType || 'Session')
  const status = session.status ?? 'UPCOMING'

  const Info = ({ icon: Icon, label, value }: { icon: any; label: string; value: React.ReactNode }) => (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground break-words">{value}</p>
      </div>
    </div>
  )
  const Stat = ({ icon: Icon, n, label }: { icon: any; n: number; label: string }) => (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
      <Icon className="h-3 w-3" />{n} {label}
    </span>
  )

  return (
    <div className="p-4 space-y-4">
      {/* Title + badges */}
      <div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: c }} />
          <h2 className="text-lg font-bold text-foreground truncate">{session.title || 'Sans titre'}</h2>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: c + '22', color: c }}>{typeLabel}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
            {kind === 'day' ? <CalendarDays className="h-3 w-3" /> : <CalendarRange className="h-3 w-3" />}{kind === 'day' ? 'Journée' : 'Plage'}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : status === 'COMPLETED' ? 'bg-muted text-muted-foreground' : 'bg-sky-500/10 text-sky-700 dark:text-sky-300'}`}>
            {SESSION_STATUS_DISPLAY[status] ?? status}
          </span>
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${VISIBILITY_META[vis].cls}`}>
            {vis === 'VISIBLE' ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}{vis === 'VISIBLE' ? 'Visible' : VISIBILITY_META[vis].badge}
          </span>
        </div>
      </div>

      {/* Key info grid */}
      <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-muted/10 p-3">
        <Info icon={Calendar} label="Dates" value={dateText(session)} />
        <Info icon={MapPin} label="Lieu" value={session.location || '—'} />
      </div>

      {/* Description */}
      {session.description ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Description</p>
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{session.description}</p>
        </div>
      ) : (
        <p className="text-xs italic text-muted-foreground">Aucune description — ajoutez-en une dans « Modifier » ci-dessous.</p>
      )}

      {/* Related counts */}
      <div className="flex flex-wrap gap-1.5">
        <Stat icon={Users} n={(session.responsibles ?? []).length} label="responsables" />
        <Stat icon={UserPlus} n={(session.guests ?? []).length} label="invités" />
        {kind === 'day' ? <Stat icon={Clock} n={acts} label="activités" />
          : <Stat icon={CalendarDays} n={(session.days ?? []).length} label="journées" />}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
//                       PER-SESSION CRITERIA PICKER
// ──────────────────────────────────────────────────────────────────────────

/** Lets a session pick which programme criteria apply (empty = all) and set a
 *  per-criterion weight. Persists focusCriteriaIds + criterionWeightsJson via
 *  onUpdate (both accepted by updatePhase / the eval grid uses them). */
function SessionCriteriaPicker({ session, criteria, onUpdate }: {
  session: Session
  criteria: Criterion[]
  onUpdate: (p: Partial<Session>) => void
}) {
  const allIds = criteria.map(c => c.id)
  const focus = session.focusCriteriaIds ?? []
  const isSelected = (id: number) => focus.length === 0 || focus.includes(id)

  let weights: Record<string, number> = {}
  try { if (session.criterionWeightsJson) weights = JSON.parse(session.criterionWeightsJson) } catch { /* ignore */ }

  const toggle = (id: number) => {
    const set = new Set<number>(focus.length ? focus : allIds)
    if (set.has(id)) set.delete(id); else set.add(id)
    const next = allIds.filter(x => set.has(x))
    onUpdate({ focusCriteriaIds: next.length === allIds.length ? [] : next })
  }
  const setWeight = (id: number, val: number) =>
    onUpdate({ criterionWeightsJson: JSON.stringify({ ...weights, [id]: val }) })

  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        <ClipboardList className="h-3 w-3" />Critères de cette session
      </label>
      {criteria.length === 0 ? (
        <p className="mt-1 text-[10px] text-muted-foreground italic">
          Aucun critère programme — ajoutez-en dans l’onglet « Critères ».
        </p>
      ) : (
        <>
          <p className="mt-0.5 mb-1 text-[11px] text-muted-foreground">Rien de coché = tous les critères s’appliquent.</p>
          <div className="space-y-1">
            {criteria.map(c => {
              const sel = isSelected(c.id)
              const w = weights[c.id] ?? c.weight ?? 0
              return (
                <div key={c.id} className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1">
                  <input type="checkbox" checked={sel} onChange={() => toggle(c.id)} className="accent-brand-500 h-3.5 w-3.5 shrink-0" />
                  <span className={`flex-1 text-[11px] truncate ${sel ? 'text-foreground' : 'text-muted-foreground line-through'}`} title={c.name}>{c.name}</span>
                  {sel && (
                    <input type="number" min={0} max={1} step={0.05} value={Number(w)}
                      onChange={(e) => setWeight(c.id, Math.max(0, Math.min(1, Number(e.target.value) || 0)))}
                      className="w-14 h-6 text-[10px] rounded border border-input bg-background px-1 shrink-0" title="Poids (0–1)" />
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
//                              EDITOR PANEL (left)
// ──────────────────────────────────────────────────────────────────────────

function EditorPanel({ session, allLanes, parents, onUpdate, onSaveAsPreset, criteria = [] }: {
  session: Session
  allLanes: string[]
  parents: Session[]
  onUpdate: (p: Partial<Session>) => void
  onSaveAsPreset: () => void
  criteria?: Criterion[]
}) {
  const [title, setTitle] = useState(session.title ?? '')
  const [location, setLocation] = useState(session.location ?? '')
  const [description, setDescription] = useState(session.description ?? '')
  const [lane, setLane] = useState(session.lane ?? 'Principal')
  useEffect(() => { setTitle(session.title ?? '') }, [session.title])
  useEffect(() => { setLocation(session.location ?? '') }, [session.location])
  useEffect(() => { setDescription(session.description ?? '') }, [session.description])
  useEffect(() => { setLane(session.lane ?? 'Principal') }, [session.lane])

  const kind = kindOf(session)
  const isChild = session.parentSessionId != null
  /** Rarely-used settings live behind « Avancé » to keep the panel calm. */
  const [showAdvanced, setShowAdvanced] = useState(false)

  // A session may nest inside a range whose window contains its own dates.
  const childStart = parseDate(session.startDate)
  const childEnd = parseDate(session.endDate ?? session.startDate)
  const eligibleParents = parents.filter(p => {
    const ps = parseDate(p.startDate); const pe = parseDate(p.endDate ?? p.startDate)
    if (!ps || !pe || !childStart) return false
    const startsIn = childStart >= ps && childStart <= pe
    const endsIn = !childEnd || (childEnd >= ps && childEnd <= pe)
    return startsIn && endsIn
  })

  return (
    <div className="p-5 space-y-4">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Titre *</label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)}
          onBlur={() => { if (title !== session.title) onUpdate({ title }) }}
          placeholder="Titre de la session" className="h-10 text-sm font-semibold mt-1" />
      </div>

      {/* Color + Status */}
      <div className="grid grid-cols-2 gap-2 items-start">
        <ColorPicker value={colorOf(session)} onChange={(hex) => onUpdate({ color: hex })} />
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Statut</label>
          <select value={session.status ?? 'UPCOMING'} onChange={(e) => onUpdate({ status: e.target.value as any })}
            className="mt-1 w-full h-9 text-sm rounded-lg border border-input bg-background px-2.5">
            <option value="UPCOMING">À venir</option>
            <option value="ACTIVE">En cours</option>
            <option value="COMPLETED">Terminée</option>
          </select>
        </div>
      </div>

      {/* Kind toggle */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Type de durée</label>
        <div className="flex gap-2 mt-1">
          {([['day', 'Journée', CalendarDays], ['range', 'Plage', CalendarRange]] as const).map(([k, lbl, Icon]) => (
            <button key={k} type="button"
              onClick={() => {
                const patch: Partial<Session> = { durationKind: k }
                if (k === 'day' && session.startDate) patch.endDate = session.startDate
                if (k === 'range' && session.startDate && !session.endDate) {
                  patch.endDate = fmtISO(addDays(parseDate(session.startDate)!, 13))
                }
                onUpdate(patch)
              }}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2.5 text-sm font-semibold transition-colors ${
                kind === k ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                           : 'border-border text-muted-foreground hover:border-emerald-400'}`}>
              <Icon className="h-4 w-4" />{lbl}
            </button>
          ))}
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Début</label>
          <Input type="date" value={session.startDate ?? ''}
            onChange={(e) => {
              const sd = e.target.value
              const patch: Partial<Session> = { startDate: sd }
              if (kind === 'day') patch.endDate = sd
              onUpdate(patch)
            }}
            className="h-9 text-sm mt-1" />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Fin {kind === 'day' && '(= Début)'}
          </label>
          <Input type="date" value={session.endDate ?? ''} disabled={kind === 'day'}
            onChange={(e) => onUpdate({ endDate: e.target.value })}
            className={`h-9 text-sm mt-1 ${kind === 'day' ? 'opacity-60 cursor-not-allowed' : ''}`} />
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />Lieu</label>
        <Input value={location} placeholder='"Salle A" ou "Online"' onChange={(e) => setLocation(e.target.value)}
          onBlur={() => { if (location !== (session.location ?? '')) onUpdate({ location }) }} className="h-9 text-sm mt-1" />
      </div>

      {/* Visibility — who can see this session */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
          {visibilityOf(session) === 'VISIBLE' ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}Visibilité
        </label>
        <div className="flex gap-2 mt-1">
          {(['VISIBLE', 'HIDDEN', 'PRIVATE'] as const).map((v) => {
            const m = VISIBILITY_META[v]
            const active = visibilityOf(session) === v
            return (
              <button key={v} type="button" onClick={() => onUpdate({ visibility: v })}
                className={`flex-1 rounded-lg border px-2 py-2 text-xs font-semibold transition-colors ${
                  active ? m.cls : 'border-border text-muted-foreground hover:border-emerald-400'}`}>
                {m.label}
              </button>
            )
          })}
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground leading-tight">
          {visibilityOf(session) === 'VISIBLE' ? 'Affichée dans le parcours public aux invités.'
            : visibilityOf(session) === 'HIDDEN' ? 'Interne — visible des admins uniquement, masquée du parcours public.'
            : 'Privée — accessible aux seuls utilisateurs explicitement invités.'}
        </p>
      </div>

      {/* Capability flags */}
      <div className="grid grid-cols-1 gap-1.5">
        <label className={`flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm ${session.sessionType === 'CANDIDATURE_SUBMISSION' ? 'opacity-50' : 'cursor-pointer hover:bg-accent/40'}`}>
          <input type="checkbox" className="h-4 w-4 accent-emerald-500"
            checked={session.allowActivities !== false}
            disabled={session.sessionType === 'CANDIDATURE_SUBMISSION'}
            onChange={(e) => onUpdate({ allowActivities: e.target.checked })} />
          <span className="flex-1 text-foreground">Autoriser les activités (agenda)</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm hover:bg-accent/40">
          <input type="checkbox" className="h-4 w-4 accent-emerald-500"
            checked={!!session.allowOverlap}
            onChange={(e) => onUpdate({ allowOverlap: e.target.checked })} />
          <span className="flex-1 text-foreground">Autoriser le chevauchement (sessions parallèles)</span>
        </label>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1"><FileText className="h-3 w-3" />Description</label>
        <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)}
          onBlur={() => { if (description !== (session.description ?? '')) onUpdate({ description }) }}
          placeholder="Objectifs, déroulé, informations utiles…" className="mt-1" />
      </div>

      {/* Type de session — drives behaviour (Candidature / Présélection) AND the
          badge shown to participants in the front-office. */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
          <Sparkles className="h-3 w-3" />Type de session
        </label>
        <select
          value={session.sessionType || 'INCUBATION'}
          onChange={(e) => onUpdate({ sessionType: e.target.value })}
          className="mt-1 w-full h-9 text-sm rounded-lg border border-input bg-background px-2.5">
          <option value="CANDIDATURE_SUBMISSION">Candidature — accepter les candidatures</option>
          <option value="PRESELECTION">Présélection — jury</option>
          <option value="PITCH_DAY">Pitch Day</option>
          <option value="ONBOARDING">Onboarding</option>
          <option value="INCUBATION">Incubation / Standard</option>
          <option value="TRAINING_DAY">Formation</option>
          <option value="DEMO_DAY">Demo Day</option>
        </select>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {fonctionOf(session) === 'STANDARD'
            ? 'Type affiché aux participants dans le parcours public.'
            : FONCTION_META[fonctionOf(session)].hint}
        </p>
      </div>

      {/* ── Avancé (replié) : critères · imbrication · voie · préset ── */}
      <div className="pt-2 border-t border-border">
        <button type="button" onClick={() => setShowAdvanced(v => !v)}
          className="w-full flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
          <ChevronRight className={`h-3 w-3 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} />
          Avancé
          <span className="font-normal normal-case tracking-normal opacity-60">critères · imbrication · voie · préset</span>
        </button>
        {showAdvanced && (
          <div className="mt-3 space-y-3">
            {/* Per-session criteria — which programme criteria apply + their weights. */}
            <SessionCriteriaPicker session={session} criteria={criteria} onUpdate={onUpdate} />

            {/* Parent picker — nest inside a range whose dates contain this session */}
            {(eligibleParents.length > 0 || session.parentSessionId != null) && (
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1"><Layers className="h-3 w-3" />Imbriquée dans</label>
                <select value={session.parentSessionId ?? ''} onChange={(e) => onUpdate({ parentSessionId: e.target.value ? Number(e.target.value) : -1 as any })}
                  className="mt-1 w-full h-9 text-sm rounded-lg border border-input bg-background px-2.5">
                  <option value="">— Aucune (autonome) —</option>
                  {eligibleParents.map(p => <option key={p.id} value={p.id}>{p.title} ({p.startDate} → {p.endDate})</option>)}
                </select>
                {session.parentSessionId != null && (
                  <p className="mt-1 text-[11px] text-muted-foreground">Doit rester dans la plage parente (selon les dates).</p>
                )}
              </div>
            )}

            {/* Lane — hidden for children (they inherit the parent's lane) */}
            {!isChild && (
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1"><Layers className="h-3 w-3" />Voie</label>
                <input list="lane-list" value={lane} onChange={(e) => setLane(e.target.value)}
                  onBlur={() => { if (lane.trim() && lane !== session.lane) onUpdate({ lane: lane.trim() }) }}
                  placeholder="Principal, Cohorte A…"
                  className="mt-1 w-full h-9 text-sm rounded-lg border border-input bg-background px-2.5 focus:outline-none focus:ring-2 focus:ring-ring" />
                <datalist id="lane-list">{allLanes.map(l => <option key={l} value={l} />)}</datalist>
              </div>
            )}

            <button onClick={onSaveAsPreset}
              className="w-full inline-flex items-center justify-center gap-1 text-[11px] font-semibold text-brand-700 dark:text-brand-300 hover:bg-brand-500/10 px-2 py-1.5 rounded-md border border-brand-500/40">
              <Sparkles className="h-3 w-3" />Enregistrer comme préset
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
//                       CHILD DAYS PANE (range sessions)
// ──────────────────────────────────────────────────────────────────────────

function ChildDaysPane({ session, children, dayPresets, onOpenSession, onAddChild, onAddBlankChild }: {
  session: Session
  children: Session[]
  dayPresets: Preset[]
  onOpenSession: (id: number) => void
  onAddChild: (presetId: number) => void
  onAddBlankChild: () => void
}) {
  const [adding, setAdding] = useState(false)
  const sorted = [...children].sort((a, b) =>
    (parseDate(a.startDate)?.getTime() ?? 0) - (parseDate(b.startDate)?.getTime() ?? 0))

  return (
    <div className="overflow-y-auto p-4 bg-muted/5">
      <div className="flex items-center gap-2 mb-3">
        <CalendarDays className="h-4 w-4 text-brand-500" />
        <h3 className="text-sm font-bold text-foreground">Journées de cette session</h3>
        <span className="text-[10px] text-muted-foreground">{children.length} journée{children.length > 1 ? 's' : ''}</span>
        <div className="ml-auto relative">
          <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => setAdding(v => !v)}>
            <Plus className="h-3.5 w-3.5" />Ajouter une journée
          </Button>
          {adding && (
            <div className="absolute right-0 top-9 z-20 w-56 rounded-lg border-2 border-border bg-card shadow-xl p-1.5 space-y-0.5">
              {/* Blank day — always first, no preset needed */}
              <button onClick={() => { setAdding(false); onAddBlankChild() }}
                className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-bold hover:bg-accent transition-colors text-left">
                <span className="h-5 w-5 rounded-md border-2 border-dashed border-muted-foreground/50 flex items-center justify-center shrink-0">
                  <Plus className="h-3 w-3 text-muted-foreground" />
                </span>
                Journée vierge
              </button>
              {dayPresets.length > 0 && (
                <p className="px-1.5 pt-1.5 pb-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground border-t border-border/60">
                  Ou depuis un préset
                </p>
              )}
              {dayPresets.map(p => {
                const c = p.color || DEFAULT_COLOR
                return (
                  <button key={p.id} onClick={() => { setAdding(false); onAddChild(p.id) }}
                    className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-semibold hover:bg-accent transition-colors text-left">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: c }} />
                    {p.title}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground mb-3 flex items-center gap-1">
        <Info className="h-3 w-3" />Le planning horaire (activités) se fait dans chaque journée. Cliquez une journée pour l&apos;ouvrir.
      </p>

      {sorted.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border bg-muted/10 p-6 text-center">
          <CalendarDays className="h-7 w-7 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-xs text-muted-foreground">
            Aucune journée pour l&apos;instant. Ajoutez-en une (ou glissez un préset « Journée »
            sur la barre dans la timeline) — elle sera imbriquée dans cette session.
          </p>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {sorted.map(ch => {
            const c = colorOf(ch)
            const m = detectMissing(ch)
            const nbAct = (ch.days ?? []).reduce((n, d) => n + (d.activities?.length ?? 0), 0)
            return (
              <button key={ch.id} onClick={() => onOpenSession(ch.id)}
                className="group flex items-center gap-3 rounded-xl border border-border bg-card hover:border-brand-400 hover:shadow-sm p-3 text-left transition-all">
                <span className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: c + '1A', color: c }}>
                  <CalendarDays className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground truncate">{ch.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {ch.startDate ? fmtShort(parseDate(ch.startDate)!) : 'date ?'}
                    {nbAct > 0 && ` · ${nbAct} activité${nbAct > 1 ? 's' : ''}`}
                    {ch.location && ` · ${ch.location}`}
                  </p>
                </div>
                {m.critical.length > 0 && <AlertTriangle className="h-3.5 w-3.5 text-rose-500 shrink-0" />}
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-brand-500 shrink-0" />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
//                           ACTIVITY TIME HELPERS
// ──────────────────────────────────────────────────────────────────────────

const HOUR_START = 8
const HOUR_END   = 20
const HOUR_PX    = 52
const SNAP_MIN   = 15

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

// ──────────────────────────────────────────────────────────────────────────
//                              DAY CANVAS (day sessions only)
// ──────────────────────────────────────────────────────────────────────────

function DayCanvas({ programmeId, programmeName, session, onChanged }: {
  programmeId: number
  programmeName?: string
  session: Session
  onChanged: () => void
}) {
  const [days, setDays] = useState<SessionDay[]>(session.days ?? [])
  const [loading, setLoading] = useState(false)
  const [selectedActivityId, setSelectedActivityId] = useState<number | null>(null)
  useEffect(() => { setDays(session.days ?? []) }, [session.days, session.id])
  useEffect(() => { setSelectedActivityId(null) }, [session.id])

  const sd = parseDate(session.startDate)

  // A day session has exactly one day (its own date). Lazy-create on first activity.
  const theDay = useMemo<SessionDay>(() => {
    const real = days.find(d => d.dayOrder === 1) ?? days[0]
    return real ?? { dayOrder: 1, date: session.startDate, activities: [] }
  }, [days, session.startDate])

  const ensureDay = async (): Promise<SessionDay | null> => {
    const existing = days.find(d => d.id)
    if (existing?.id) return existing
    setLoading(true)
    try {
      const r = await sessionsApi.addDay(programmeId, session.id, {
        dayOrder: 1, date: session.startDate ?? null, title: null, location: null,
      } as any)
      const created: SessionDay = r.data
      setDays([created])
      return created
    } catch { toast.error('Erreur jour'); return null } finally { setLoading(false) }
  }

  const addActivity = async (startMin?: number) => {
    const start = startMin != null ? snap(startMin) : 9 * 60
    const end   = Math.min(HOUR_END * 60, start + 60)
    if (!(await confirmDialog({
      title: 'Ajouter une activité',
      message: 'Créer une nouvelle activité dans cette journée ?',
      lines: [{ label: 'Horaire', value: `${fmtHM(minToTime(start))} – ${fmtHM(minToTime(end))}` }],
      confirmLabel: 'Créer',
    }))) return
    const d = await ensureDay()
    if (!d?.id) return
    try {
      const r = await sessionsApi.addActivity(programmeId, session.id, d.id, {
        title: 'Nouvelle activité', color: colorOf(session), startTime: minToTime(start), endTime: minToTime(end),
      })
      const created: Activity = r.data
      setDays(arr => arr.map(x => x.id === d.id ? { ...x, activities: [...(x.activities ?? []), created] } : x))
      setSelectedActivityId(created.id ?? null)
      onChanged()
    } catch { toast.error('Erreur activité') }
  }

  const updateActivity = async (dayId: number, aid: number, patch: Partial<Activity>) => {
    setDays(arr => arr.map(x => x.id === dayId
      ? { ...x, activities: (x.activities ?? []).map(a => a.id === aid ? { ...a, ...patch } : a) } : x))
    try {
      await sessionsApi.updateActivity(programmeId, session.id, dayId, aid, patch)
      // Propagate to the board's sessions state — otherwise reopening the
      // overlay (or the calendar view) shows the pre-edit values.
      onChanged()
    } catch { toast.error('Erreur — modification non enregistrée'); }
  }

  const removeActivity = async (dayId: number, aid: number) => {
    if (!confirm('Supprimer cette activité ?')) return
    try {
      await sessionsApi.deleteActivity(programmeId, session.id, dayId, aid)
      setDays(arr => arr.map(x => x.id === dayId ? { ...x, activities: (x.activities ?? []).filter(a => a.id !== aid) } : x))
      onChanged()
    } catch { toast.error('Erreur') }
  }

  /** Clone an activity, nudged +1h, so a busy agenda is fast to fill. */
  const duplicateActivity = async (dayId: number, src: Activity) => {
    const shift = (t?: string) => {
      const m = Math.min(HOUR_END * 60, timeToMin(t) + 60)
      return minToTime(m)
    }
    try {
      const r = await sessionsApi.addActivity(programmeId, session.id, dayId, {
        title: src.title, description: src.description, color: src.color ?? colorOf(session),
        startTime: shift(src.startTime), endTime: shift(src.endTime),
        location: src.location, responsibles: src.responsibles, guests: src.guests,
      })
      const created: Activity = r.data
      setDays(arr => arr.map(x => x.id === dayId ? { ...x, activities: [...(x.activities ?? []), created] } : x))
      onChanged()
    } catch { toast.error('Erreur') }
  }

  if (!sd) {
    return (
      <div className="flex items-center justify-center text-muted-foreground text-xs italic p-6 text-center">
        Renseignez d&apos;abord la date à gauche pour activer le planning horaire.
      </div>
    )
  }

  const selectedActivity = (theDay.activities ?? []).find(a => a.id === selectedActivityId) ?? null

  return (
    <div className="flex h-full min-h-0">
      {/* Agenda — hour grid (left) */}
      <div className="flex-1 min-w-0 overflow-auto bg-muted/5 relative">
        <div className="flex" style={{ minWidth: 360 }}>
          {/* Hours column */}
          <div className="sticky left-0 z-20 bg-card border-r border-border w-12 shrink-0">
            <div className="h-9 border-b-2 border-border" />
            <div className="relative" style={{ height: (HOUR_END - HOUR_START) * HOUR_PX }}>
              {Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i).map((h, i) => (
                <div key={h} className="absolute right-1 -translate-y-1/2 text-[10px] font-bold uppercase text-muted-foreground tabular-nums" style={{ top: i * HOUR_PX }}>
                  {h}h
                </div>
              ))}
            </div>
          </div>

          {/* Single day column */}
          <DayColumn
            day={theDay}
            sessionColor={colorOf(session)}
            selectedActivityId={selectedActivityId}
            onSelectActivity={(aid) => setSelectedActivityId(aid)}
            onAddActivity={(startMin) => addActivity(startMin)}
            onUpdateActivity={(aid, patch) => theDay.id && updateActivity(theDay.id, aid, patch)}
            onRemoveActivity={(aid) => theDay.id && removeActivity(theDay.id, aid)}
            onDuplicateActivity={(a) => theDay.id && duplicateActivity(theDay.id, a)}
          />
        </div>
        {loading && (
          <div className="absolute top-2 right-2 text-xs text-muted-foreground inline-flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />Sauvegarde…
          </div>
        )}
      </div>

      {/* Activity editor (right panel) */}
      <div className="w-80 shrink-0 border-l border-border bg-card">
        {selectedActivity ? (
          <ActivityForm
            activity={selectedActivity}
            color={colorOf(session)}
            ctx={selectedActivity.id != null ? {
              programmeId, programmeName: programmeName ?? '',
              phaseId: session.id, phaseName: session.title ?? '',
              activityId: selectedActivity.id, activityName: selectedActivity.title ?? '',
            } : undefined}
            onUpdate={(patch) => theDay.id && selectedActivity.id != null && updateActivity(theDay.id, selectedActivity.id, patch)}
            onRemove={() => {
              if (theDay.id && selectedActivity.id != null) removeActivity(theDay.id, selectedActivity.id)
              setSelectedActivityId(null)
            }}
            onDuplicate={() => theDay.id && duplicateActivity(theDay.id, selectedActivity)}
            onClose={() => setSelectedActivityId(null)}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground">
            <Clock className="h-7 w-7 opacity-40" />
            <p className="text-xs">Sélectionnez une activité pour l&apos;éditer, ou ajoutez-en une.</p>
            <button onClick={() => addActivity()}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 px-3 py-1.5 text-xs font-bold">
              <Plus className="h-3.5 w-3.5" />Nouvelle activité
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/** Greedy interval-partitioning: side-by-side columns for overlapping activities. */
function layoutActivities(acts: Activity[]): Map<number, { col: number; cols: number }> {
  const res = new Map<number, { col: number; cols: number }>()
  const items = acts.filter(a => a.id != null).sort(
    (a, b) => (timeToMin(a.startTime) - timeToMin(b.startTime)) || (timeToMin(a.endTime) - timeToMin(b.endTime)))
  let cluster: Activity[] = []
  let clusterEnd = -1
  const flush = () => {
    if (!cluster.length) return
    const colEnds: number[] = []
    const colOf = new Map<number, number>()
    for (const a of cluster) {
      const s = timeToMin(a.startTime)
      let placed = colEnds.findIndex(end => end <= s)
      if (placed === -1) { placed = colEnds.length; colEnds.push(0) }
      colEnds[placed] = Math.max(s + SNAP_MIN, timeToMin(a.endTime))
      colOf.set(a.id!, placed)
    }
    const cols = colEnds.length
    for (const a of cluster) res.set(a.id!, { col: colOf.get(a.id!) ?? 0, cols })
    cluster = []; clusterEnd = -1
  }
  for (const a of items) {
    const s = timeToMin(a.startTime), e = Math.max(s + SNAP_MIN, timeToMin(a.endTime))
    if (cluster.length && s >= clusterEnd) flush()
    cluster.push(a); clusterEnd = Math.max(clusterEnd, e)
  }
  flush()
  return res
}

function DayColumn({ day, sessionColor, selectedActivityId, onSelectActivity, onAddActivity, onUpdateActivity, onRemoveActivity, onDuplicateActivity }: {
  day: SessionDay
  sessionColor: string
  selectedActivityId: number | null
  onSelectActivity: (aid: number) => void
  onAddActivity: (startMin?: number) => void
  onUpdateActivity: (aid: number, patch: Partial<Activity>) => void
  onRemoveActivity: (aid: number) => void
  onDuplicateActivity: (a: Activity) => void
}) {
  const HOURS = HOUR_END - HOUR_START
  const COLUMN_HEIGHT = HOURS * HOUR_PX
  const gridRef = useRef<HTMLDivElement>(null)
  const acts = day.activities ?? []
  const lay = useMemo(() => layoutActivities(acts), [acts])

  const dt = day.date ? new Date(day.date + 'T12:00:00') : null
  const dateLabel = dt ? dt.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : 'date ?'
  const isToday = dt ? dt.toDateString() === new Date().toDateString() : false

  const yToMin = (clientY: number): number => {
    const el = gridRef.current
    if (!el) return HOUR_START * 60
    const y = clientY - el.getBoundingClientRect().top
    return HOUR_START * 60 + (y / HOUR_PX) * 60
  }

  const now = new Date()
  const nowTop = isToday ? ((now.getHours() + now.getMinutes() / 60) - HOUR_START) * HOUR_PX : -1

  return (
    <div className="flex-1 min-w-[300px] flex flex-col">
      {/* Day header */}
      <div className="sticky top-0 z-20 bg-card border-b-2 border-border h-9 flex items-center gap-1.5 px-3 shadow-sm">
        <span className="text-[11px] font-bold text-foreground capitalize truncate flex-1">{dateLabel}</span>
        <span className="text-[11px] text-muted-foreground tabular-nums">{acts.length} act.</span>
        <button onClick={() => onAddActivity()} title="Ajouter une activité"
          className="inline-flex items-center gap-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold">
          <Plus className="h-3 w-3" />Activité
        </button>
      </div>

      {/* Hour grid */}
      <div ref={gridRef}
        onClick={(e) => { if (e.target === e.currentTarget) onAddActivity(snap(yToMin(e.clientY))) }}
        title="Cliquez sur une plage libre pour ajouter une activité à cette heure"
        className="relative cursor-copy" style={{ height: COLUMN_HEIGHT }}>
        {Array.from({ length: HOURS }, (_, i) => (
          <div key={i}>
            <div className="absolute left-0 right-0 border-t border-border/40 pointer-events-none" style={{ top: i * HOUR_PX }} />
            <div className="absolute left-0 right-0 border-t border-dashed border-border/15 pointer-events-none" style={{ top: i * HOUR_PX + HOUR_PX / 2 }} />
          </div>
        ))}
        <div className="absolute left-0 right-0 border-t border-border/40 pointer-events-none" style={{ top: COLUMN_HEIGHT }} />

        {nowTop >= 0 && nowTop <= COLUMN_HEIGHT && (
          <div className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top: nowTop }}>
            <div className="border-t border-rose-500/70" />
            <div className="absolute left-0 -top-[3px] h-1.5 w-1.5 rounded-full bg-rose-500" />
          </div>
        )}

        {acts.map(a => (
          <ActivityBlock key={a.id}
            activity={a}
            sessionColor={sessionColor}
            place={a.id != null ? lay.get(a.id) : undefined}
            selected={a.id != null && a.id === selectedActivityId}
            onSelect={() => a.id != null && onSelectActivity(a.id)}
            onUpdate={(patch) => a.id && onUpdateActivity(a.id, patch)}
            onRemove={() => a.id && onRemoveActivity(a.id)}
            onDuplicate={() => onDuplicateActivity(a)}
          />
        ))}

        {acts.length === 0 && (
          <button onClick={() => onAddActivity()}
            className="absolute inset-x-3 top-3 h-20 rounded-lg border-2 border-dashed border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/60 transition-colors flex flex-col items-center justify-center text-[11px] font-bold text-emerald-700 dark:text-emerald-300 gap-0.5">
            <Plus className="h-4 w-4" />Ajouter une activité
            <span className="text-[9px] font-normal text-muted-foreground">ou cliquez sur une heure</span>
          </button>
        )}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
//                             ACTIVITY BLOCK
// ──────────────────────────────────────────────────────────────────────────

function ActivityBlock({ activity, sessionColor, place, selected, onSelect, onUpdate, onRemove, onDuplicate }: {
  activity: Activity
  sessionColor: string
  place?: { col: number; cols: number }
  selected: boolean
  onSelect: () => void
  onUpdate: (patch: Partial<Activity>) => void
  onRemove: () => void
  onDuplicate: () => void
}) {
  const c = activity.color || sessionColor || DEFAULT_COLOR
  const [preview, setPreview] = useState<{ start: number; end: number } | null>(null)
  const dragRef = useRef<{ mode: 'move' | 'resize'; startY: number; origStart: number; origEnd: number; moved: boolean } | null>(null)

  const baseStart = timeToMin(activity.startTime)
  const baseEnd   = Math.max(baseStart + SNAP_MIN, timeToMin(activity.endTime))
  const startMin  = preview?.start ?? baseStart
  const endMin    = preview?.end ?? baseEnd

  const top    = ((startMin - HOUR_START * 60) / 60) * HOUR_PX
  const height = Math.max(24, ((endMin - startMin) / 60) * HOUR_PX)

  const cols = place?.cols ?? 1
  const col  = place?.col ?? 0
  const leftPct  = (col / cols) * 100
  const widthPct = 100 / cols

  const begin = (e: React.PointerEvent, mode: 'move' | 'resize') => {
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    dragRef.current = { mode, startY: e.clientY, origStart: baseStart, origEnd: baseEnd, moved: false }
  }
  const move = (e: React.PointerEvent) => {
    const dr = dragRef.current
    if (!dr) return
    if (Math.abs(e.clientY - dr.startY) > 3) dr.moved = true
    const dMin = ((e.clientY - dr.startY) / HOUR_PX) * 60
    if (dr.mode === 'move') {
      const dur = dr.origEnd - dr.origStart
      const ns = Math.max(HOUR_START * 60, Math.min(HOUR_END * 60 - dur, snap(dr.origStart + dMin)))
      setPreview({ start: ns, end: ns + dur })
    } else {
      const ne = Math.max(dr.origStart + SNAP_MIN, Math.min(HOUR_END * 60, snap(dr.origEnd + dMin)))
      setPreview({ start: dr.origStart, end: ne })
    }
  }
  const end = () => {
    const dr = dragRef.current
    dragRef.current = null
    if (!dr) return
    const p = preview
    setPreview(null)
    if (!dr.moved) { onSelect(); return }
    if (p) {
      if (dr.mode === 'move') onUpdate({ startTime: minToTime(p.start), endTime: minToTime(p.end) })
      else onUpdate({ endTime: minToTime(p.end) })
    }
  }

  const resp = activity.responsibles ?? []
  const compact = height < 52

  return (
      <div
        onPointerDown={(e) => begin(e, 'move')} onPointerMove={move} onPointerUp={end}
        style={{
          top, height,
          left:  `calc(${leftPct}% + ${col === 0 ? 4 : 2}px)`,
          width: `calc(${widthPct}% - ${cols > 1 ? 4 : 8}px)`,
          background: `linear-gradient(135deg, ${c}, ${c}E6)`,
          boxShadow: preview ? `0 10px 22px -6px ${c}` : undefined,
        }}
        className={`absolute rounded-lg text-white shadow-md cursor-grab active:cursor-grabbing select-none overflow-hidden transition-[box-shadow] ${selected ? 'z-30 ring-2 ring-white ring-offset-1 ring-offset-card' : 'ring-1 ring-black/10 hover:ring-2 hover:ring-white/70'} ${preview ? 'z-30 opacity-95' : 'z-20'}`}>
        <div className="flex items-center gap-1 px-1.5 pt-1">
          {durLabel(activity) && <span className="text-[8px] font-bold opacity-90 tabular-nums">{durLabel(activity)}</span>}
          <span className="ml-auto inline-flex items-center gap-1">
            <button onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onSelect() }}
              className="text-white/80 hover:text-white" title="Modifier"><Pencil className="h-2.5 w-2.5" /></button>
            <button onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onDuplicate() }}
              className="text-white/80 hover:text-white" title="Dupliquer (+1h)"><Copy className="h-2.5 w-2.5" /></button>
            <button onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onRemove() }}
              className="text-white/80 hover:text-white" title="Supprimer"><Trash2 className="h-2.5 w-2.5" /></button>
          </span>
        </div>
        <div className="px-1.5 mt-0.5">
          <div className="text-[11px] font-bold leading-tight line-clamp-2">{activity.title || 'Sans titre'}</div>
          {!compact && <div className="text-[9px] opacity-90 tabular-nums mt-0.5">{fmtHM(minToTime(startMin))}–{fmtHM(minToTime(endMin))}</div>}
          {!compact && (activity.location || resp.length > 0) && (
            <div className="mt-0.5 flex flex-col gap-px text-[8.5px] opacity-90">
              {activity.location && <span className="inline-flex items-center gap-0.5 truncate"><MapPin className="h-2.5 w-2.5 shrink-0" />{activity.location}</span>}
              {resp.length > 0 && <span className="inline-flex items-center gap-0.5 truncate"><Users className="h-2.5 w-2.5 shrink-0" />{resp.slice(0, 2).join(', ')}{resp.length > 2 ? ` +${resp.length - 2}` : ''}</span>}
            </div>
          )}
        </div>
        <div onPointerDown={(e) => begin(e, 'resize')}
          className="absolute bottom-0 left-0 right-0 h-2.5 cursor-ns-resize flex items-end justify-center pb-0.5 group/rz" title="Glisser pour changer la durée">
          <div className="h-0.5 w-6 rounded-full bg-white/50 group-hover/rz:bg-white" />
        </div>
      </div>
  )
}

// ── Activity participants (managed contacts → RSVP invitations) ─────────────

interface InviteCtx {
  programmeId?: number; programmeName: string
  phaseId: number; phaseName: string
  activityId: number; activityName: string
}

const INVITE_STATUS: Record<string, { label: string; cls: string }> = {
  ACCEPTED: { label: 'Inscrit',    cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300/40' },
  DECLINED: { label: 'Décliné',    cls: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-300/40' },
  SENT:     { label: 'En attente', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300/40' },
  PENDING:  { label: 'En attente', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300/40' },
  FAILED:   { label: 'Échec',      cls: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-300/40' },
}

function ActivityParticipants({ ctx }: { ctx: InviteCtx }) {
  const [contacts, setContacts] = useState<any[]>([])
  const [groups, setGroups]     = useState<any[]>([])
  const [invites, setInvites]   = useState<any[]>([])
  const [picking, setPicking]   = useState(false)
  const [freeEmail, setFreeEmail] = useState('')
  const [busy, setBusy]         = useState(false)

  const loadInvites = useCallback(async () => {
    try { const r = await notificationsApi.byActivity(ctx.activityId); setInvites(r.data ?? []) } catch { /* */ }
  }, [ctx.activityId])

  useEffect(() => {
    contactsApi.list().then(r => setContacts(r.data ?? [])).catch(() => {})
    contactGroupsApi.list().then(r => setGroups(r.data ?? [])).catch(() => {})
    loadInvites()
  }, [loadInvites])

  const invitedEmails = new Set(invites.map(i => (i.recipientEmail ?? '').toLowerCase()))
  const accepted = invites.filter(i => i.status === 'ACCEPTED').length

  const sendInvites = async (recipients: { email: string; name?: string }[]) => {
    const fresh = recipients.filter(r => r.email && !invitedEmails.has(r.email.toLowerCase()))
    if (!fresh.length) { toast.error('Déjà invité(s) ou email manquant'); return }
    setBusy(true)
    try {
      await notificationsApi.bulk({
        type: 'GUEST', requiresRsvp: true,
        programmeId: ctx.programmeId, programmeName: ctx.programmeName,
        phaseId: ctx.phaseId, phaseName: ctx.phaseName,
        activityId: ctx.activityId, activityName: ctx.activityName,
        subject: `Invitation : ${ctx.activityName || ctx.phaseName}`,
        message: `Vous êtes invité(e) à « ${ctx.activityName || ctx.phaseName} ». Merci de confirmer votre présence.`,
        recipients: fresh,
      })
      toast.success(`${fresh.length} invitation(s) envoyée(s)`)
      setFreeEmail(''); setPicking(false)
      loadInvites()
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Erreur') }
    finally { setBusy(false) }
  }

  const inviteGroup = (g: any) =>
    sendInvites(contacts.filter(c => (g.contactIds ?? []).includes(c.id)).map(c => ({ email: c.email, name: c.name })))

  const resend = async (id: number) => { try { await notificationsApi.resend(id); loadInvites() } catch { /* */ } }
  const cancel = async (id: number) => { if (!confirm('Retirer cet invité ?')) return; try { await notificationsApi.cancel(id); loadInvites() } catch { /* */ } }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" />Participants</span>
        {invites.length > 0 && <span className="text-[10px] text-muted-foreground">{accepted}/{invites.length} inscrits</span>}
        <button onClick={() => setPicking(v => !v)}
          className="ml-auto inline-flex items-center gap-1 rounded-md border border-brand-500/40 text-brand-700 dark:text-brand-300 px-2 py-0.5 text-[10px] font-semibold hover:bg-brand-500/10">
          <Plus className="h-3 w-3" />Inviter
        </button>
      </div>

      {picking && (
        <div className="rounded-lg border border-border bg-muted/20 p-2 space-y-1.5 max-h-52 overflow-y-auto">
          {groups.length > 0 && <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Groupes</p>}
          {groups.map(g => (
            <button key={g.id} disabled={busy} onClick={() => inviteGroup(g)}
              className="w-full flex items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-accent text-left disabled:opacity-50">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ background: g.color || DEFAULT_COLOR }} />
              <span className="truncate flex-1">{g.name}</span>
              <span className="text-[11px] text-muted-foreground">{(g.contactIds ?? []).length}</span>
            </button>
          ))}
          {contacts.length > 0 && <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground pt-1">Contacts</p>}
          {contacts.map(c => {
            const done = invitedEmails.has((c.email ?? '').toLowerCase())
            return (
              <button key={c.id} disabled={busy || done} onClick={() => sendInvites([{ email: c.email, name: c.name }])}
                className="w-full flex items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-accent text-left disabled:opacity-50">
                <span className="truncate">{c.name}</span>
                <span className="text-[11px] text-muted-foreground truncate">{c.email}</span>
                {done && <span className="ml-auto text-[9px] text-emerald-600">✓</span>}
              </button>
            )
          })}
          {contacts.length === 0 && groups.length === 0 && (
            <p className="text-[10px] text-muted-foreground italic px-1">Aucun contact. Ajoutez-en dans l&apos;onglet « Invitations » du programme.</p>
          )}
          <div className="flex gap-1 pt-1 border-t border-border/60">
            <input value={freeEmail} onChange={(e) => setFreeEmail(e.target.value)} type="email" placeholder="email@exemple.com"
              className="flex-1 h-7 px-2 text-[11px] rounded-md border border-input bg-background" />
            <button disabled={busy || !freeEmail.trim()} onClick={() => sendInvites([{ email: freeEmail.trim() }])}
              className="inline-flex items-center gap-1 rounded-md bg-brand-500/10 text-brand-700 dark:text-brand-300 px-2 text-[11px] font-semibold disabled:opacity-50">
              <Mail className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      <div className="space-y-1">
        {invites.length === 0 && !picking && <p className="text-[10px] text-muted-foreground italic">Aucun participant invité.</p>}
        {invites.map(i => {
          const m = INVITE_STATUS[i.status] ?? INVITE_STATUS.PENDING
          return (
            <div key={i.id} className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-[11px]">
              <span className="truncate flex-1" title={i.recipientEmail}>{i.recipientName || i.recipientEmail}</span>
              <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold shrink-0 ${m.cls}`}>{m.label}</span>
              {i.status !== 'ACCEPTED' && i.status !== 'DECLINED' && (
                <button onClick={() => resend(i.id)} title="Renvoyer" className="text-muted-foreground hover:text-foreground shrink-0"><Send className="h-3 w-3" /></button>
              )}
              <button onClick={() => cancel(i.id)} title="Retirer" className="text-muted-foreground hover:text-destructive shrink-0"><X className="h-3 w-3" /></button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Inline activity editor — used as the right panel inside a day overlay. */
function ActivityForm({ activity, color, ctx, onUpdate, onRemove, onDuplicate, onClose }: {
  activity: Activity
  color: string
  ctx?: InviteCtx
  onUpdate: (patch: Partial<Activity>) => void
  onRemove: () => void
  onDuplicate: () => void
  onClose: () => void
}) {
  const [title, setTitle]   = useState(activity.title ?? '')
  const [desc, setDesc]     = useState(activity.description ?? '')
  const [loc, setLoc]       = useState(activity.location ?? '')
  const [resp, setResp]     = useState((activity.responsibles ?? []).join(', '))
  const [guests, setGuests] = useState((activity.guests ?? []).join(', '))
  // Re-sync drafts when a different activity becomes selected.
  useEffect(() => { setTitle(activity.title ?? '') }, [activity.id, activity.title])
  useEffect(() => { setDesc(activity.description ?? '') }, [activity.id])
  useEffect(() => { setLoc(activity.location ?? '') }, [activity.id])
  useEffect(() => { setResp((activity.responsibles ?? []).join(', ')) }, [activity.id])
  useEffect(() => { setGuests((activity.guests ?? []).join(', ')) }, [activity.id])
  const toList = (v: string) => v.split(',').map(s => s.trim()).filter(Boolean)
  const dur = durLabel(activity)
  const c = activity.color || color

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0" style={{ background: c + '12' }}>
        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: c }} />
        <span className="text-[11px] font-extrabold uppercase tracking-wider shrink-0" style={{ color: c }}>Activité</span>
        {dur && <span className="text-[10px] font-bold text-muted-foreground tabular-nums truncate">{fmtHM(activity.startTime)}–{fmtHM(activity.endTime)} · {dur}</span>}
        <button onClick={onClose} className="ml-auto p-1 rounded-md hover:bg-accent text-muted-foreground shrink-0" title="Désélectionner"><X className="h-4 w-4" /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Titre *</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus
            onBlur={() => { if (title !== activity.title) onUpdate({ title }) }}
            placeholder="Titre de l'activité" className="mt-1 w-full h-9 px-3 text-sm font-bold rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />Début</span>
            <input type="time" step={900} value={fmtHM(activity.startTime)} onChange={(e) => onUpdate({ startTime: e.target.value + ':00' })}
              className="mt-1 w-full h-9 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Fin</span>
            <input type="time" step={900} value={fmtHM(activity.endTime)} onChange={(e) => onUpdate({ endTime: e.target.value + ':00' })}
              className="mt-1 w-full h-9 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </label>
        </div>

        <ColorPicker value={activity.color || color} onChange={(hex) => onUpdate({ color: hex })} compact />

        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />Lieu</span>
          <input value={loc} onChange={(e) => setLoc(e.target.value)} onBlur={() => { if (loc !== (activity.location ?? '')) onUpdate({ location: loc }) }}
            placeholder="Salle, lien visio…" className="mt-1 w-full h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
        </label>

        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" />Responsables</span>
          <input value={resp} onChange={(e) => setResp(e.target.value)} onBlur={() => onUpdate({ responsibles: toList(resp) })}
            placeholder="Noms, séparés par des virgules" className="mt-1 w-full h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
        </label>

        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><UserPlus className="h-3 w-3" />Invités</span>
          <input value={guests} onChange={(e) => setGuests(e.target.value)} onBlur={() => onUpdate({ guests: toList(guests) })}
            placeholder="Intervenants externes…" className="mt-1 w-full h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
        </label>

        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><FileText className="h-3 w-3" />Description</span>
          <textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} onBlur={() => { if (desc !== (activity.description ?? '')) onUpdate({ description: desc }) }}
            placeholder="Détails, objectifs…" className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-input bg-background resize-y focus:outline-none focus:ring-2 focus:ring-ring" />
        </label>

        {ctx && (
          <div className="pt-2 border-t border-border">
            <ActivityParticipants ctx={ctx} />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 px-3 py-2 border-t border-border bg-muted/20 shrink-0">
        <button onClick={onRemove}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-destructive hover:bg-destructive/10 px-2.5 py-1.5 rounded-lg border border-destructive/30">
          <Trash2 className="h-3.5 w-3.5" />Supprimer
        </button>
        <button onClick={onDuplicate}
          className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent px-2.5 py-1.5 rounded-lg border border-border">
          <Copy className="h-3.5 w-3.5" />Dupliquer
        </button>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
//                          PRESET EDITOR MODAL
// ──────────────────────────────────────────────────────────────────────────

function PresetEditorModal({ programmeId, mode, preset, onClose, onSaved }: {
  programmeId: number
  mode: 'create' | 'edit'
  preset?: Preset
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState(preset?.title ?? '')
  const [color, setColor] = useState(preset?.color || '#6366F1')
  const [durationKind, setDurationKind] = useState<DurationKind>(kindOf(preset ?? { durationKind: 'day' }))
  const [scope, setScope] = useState<'global' | 'local'>(preset?.programmeId != null ? 'local' : 'global')
  const [saving, setSaving] = useState(false)
  const builtIn = !!preset?.builtIn

  const save = async () => {
    if (!title.trim()) { toast.error('Titre requis'); return }
    setSaving(true)
    try {
      if (mode === 'edit' && preset) {
        await sessionPresetsApi.update(preset.id, { title: title.trim(), color, durationKind })
        toast.success('Préset mis à jour')
      } else {
        await sessionPresetsApi.create({
          programmeId: scope === 'local' ? programmeId : null,
          title: title.trim(), color, durationKind,
        })
        toast.success('Préset créé')
      }
      onSaved()
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Erreur') }
    finally { setSaving(false) }
  }

  const del = async () => {
    if (!preset || builtIn) return
    if (!confirm(`Supprimer le préset "${preset.title}" ?`)) return
    setSaving(true)
    try { await sessionPresetsApi.delete(preset.id); toast.success('Préset supprimé'); onSaved() }
    catch (e: any) { toast.error(e?.response?.data?.message ?? 'Erreur') }
    finally { setSaving(false) }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border-2 border-border bg-card shadow-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand-500" />
          <h3 className="text-sm font-bold text-foreground">
            {mode === 'edit' ? 'Modifier le préset' : 'Nouveau préset'}
          </h3>
          <button onClick={onClose} className="ml-auto p-1 rounded hover:bg-accent text-muted-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Nom</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ex. Bootcamp" className="mt-1 h-9" autoFocus />
        </div>

        <div>
          <ColorPicker value={color} onChange={setColor} />
          <Input value={color} onChange={(e) => setColor(e.target.value)} className="mt-1.5 h-8 font-mono text-xs" />
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Durée</label>
          <div className="mt-1 flex gap-1.5">
            {([['day', 'Journée', CalendarDays], ['range', 'Plage', CalendarRange]] as const).map(([k, lbl, Icon]) => (
              <button key={k} type="button" onClick={() => setDurationKind(k)}
                className={`flex-1 inline-flex items-center justify-center gap-1 rounded-md border px-2 py-2 text-xs font-semibold transition-colors ${
                  durationKind === k ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-border text-muted-foreground hover:border-emerald-400'}`}>
                <Icon className="h-3.5 w-3.5" />{lbl}
              </button>
            ))}
          </div>
        </div>

        {mode === 'create' && (
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Portée</label>
            <div className="mt-1 flex gap-1.5">
              {([['global', 'Global (tous les programmes)'], ['local', 'Ce programme uniquement']] as const).map(([k, lbl]) => (
                <button key={k} type="button" onClick={() => setScope(k)}
                  className={`flex-1 rounded-md border px-2 py-2 text-[11px] font-semibold transition-colors ${
                    scope === k ? 'border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-300' : 'border-border text-muted-foreground hover:border-brand-400'}`}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>
        )}

        {builtIn && (
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Info className="h-3 w-3" />Préset par défaut — modifiable mais non supprimable.
          </p>
        )}

        <div className="flex items-center gap-2 pt-1">
          {mode === 'edit' && !builtIn && (
            <button onClick={del} disabled={saving}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-destructive hover:bg-destructive/10 px-2 py-2 rounded-md border border-destructive/30">
              <Trash2 className="h-3.5 w-3.5" />Supprimer
            </button>
          )}
          <Button onClick={save} disabled={saving} className="ml-auto gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {mode === 'edit' ? 'Enregistrer' : 'Créer le préset'}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}
