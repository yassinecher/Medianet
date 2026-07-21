'use client'
import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  CalendarClock, MapPin, Plus, Trash2, Users, Layers, Wand2, Loader2,
  ChevronDown, CalendarDays, CalendarRange, X, Pencil, Check,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { sessionsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { performDelete } from '@/lib/deleteChoice'

interface Activity { id?: number; title: string; startTime?: string; endTime?: string; location?: string }
interface SessionDay { id?: number; title?: string; date?: string; activities?: Activity[] }
interface Session {
  id: number; title: string; description?: string
  startDate?: string; endDate?: string; durationKind?: string
  location?: string; color?: string
  sessionType?: string; visibility?: string; status?: string
  responsibles?: string[]; days?: SessionDay[]
}

const FONCTION_LABEL: Record<string, string> = {
  CANDIDATURE_SUBMISSION: 'Candidature', PRESELECTION: 'Présélection',
}
const VIS: Record<string, { label: string; variant: 'warning' | 'destructive' }> = {
  HIDDEN:  { label: 'Interne', variant: 'warning' },
  PRIVATE: { label: 'Privé',   variant: 'destructive' },
}
const SWATCHES = ['#0EA5E9', '#6366F1', '#A855F7', '#EC4899', '#EF4444', '#F97316', '#F59E0B', '#10B981', '#14B8A6', '#64748B']
const TYPE_OPTIONS: [string, string][] = [
  ['CANDIDATURE_SUBMISSION', 'Candidature — accepter les candidatures'],
  ['PRESELECTION', 'Présélection — jury'],
  ['PITCH_DAY', 'Pitch Day'],
  ['ONBOARDING', 'Onboarding'],
  ['INCUBATION', 'Incubation / Standard'],
  ['TRAINING_DAY', 'Formation'],
  ['DEMO_DAY', 'Demo Day'],
]
const VIS_SEG: [string, string, string][] = [
  ['VISIBLE', 'Visible', 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'],
  ['HIDDEN', 'Interne', 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300'],
  ['PRIVATE', 'Privé', 'border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300'],
]

// ── date helpers (dates come as 'YYYY-MM-DD' or ISO; normalise to local noon) ──
const at = (s: string) => new Date(s.substring(0, 10) + 'T12:00:00')
const day = (s: string) => at(s).getDate()
const mon = (s: string) => at(s).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')
const wday = (s: string) => at(s).toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '')
const monthKey = (s?: string) => (s ? `${at(s).getFullYear()}-${String(at(s).getMonth()).padStart(2, '0')}` : 'zzzz')
const monthLabel = (s: string) => {
  const l = at(s).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  return l.charAt(0).toUpperCase() + l.slice(1)
}

export function SessionsCalendar({ programmeId, sessions, onChanged }: {
  programmeId: number; sessions: Session[]; onChanged: () => void
}) {
  const [expanded, setExpanded] = useState<number | null>(null)
  // Editor: null = closed · 'new' = create · Session = edit.
  const [editor, setEditor] = useState<Session | 'new' | null>(null)

  // Sort by start date; undated sessions sink to the bottom. Then group by month.
  const groups = useMemo(() => {
    const sorted = [...sessions].sort((a, b) => {
      if (!a.startDate) return 1
      if (!b.startDate) return -1
      return a.startDate.localeCompare(b.startDate)
    })
    const map = new Map<string, Session[]>()
    for (const s of sorted) {
      const k = monthKey(s.startDate)
      ;(map.get(k) ?? map.set(k, []).get(k)!).push(s)
    }
    return Array.from(map.entries())
  }, [sessions])

  const del = async (s: Session) => {
    const outcome = await performDelete('session', s.id, () => sessionsApi.delete(programmeId, s.id), {
      label: `la session « ${s.title} »`,
    })
    if (!outcome) return
    toast.success(outcome === 'purge' ? 'Session supprimée définitivement' : 'Session mise à la corbeille')
    onChanged()
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="h-4 w-4 text-brand-500" />
          <span className="font-medium text-foreground">{sessions.length}</span> session(s) au calendrier
        </div>
        <div className="flex gap-2">
          <Link href={`/programmes/${programmeId}/timeline`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Wand2 className="h-3.5 w-3.5 text-brand-500" />Vue visuelle
            </Button>
          </Link>
          <Button variant="brand" size="sm" className="gap-1.5" onClick={() => setEditor('new')}>
            <Plus className="h-3.5 w-3.5" />Ajouter une session
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {sessions.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-14 text-center">
          <CalendarClock className="h-10 w-10 text-muted-foreground opacity-30" />
          <p className="text-sm font-medium text-foreground">Aucune session planifiée</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Ajoutez les sessions du programme (candidature, ateliers, pitch day…). Elles apparaîtront ici, classées par mois.
          </p>
          <Button variant="brand" size="sm" className="mt-1 gap-1.5" onClick={() => setEditor('new')}>
            <Plus className="h-3.5 w-3.5" />Ajouter une session
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(([key, list]) => (
            <div key={key} className="space-y-2">
              {/* Month header */}
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-foreground">
                  {key === 'zzzz' ? 'Sans date' : monthLabel(list[0].startDate!)}
                </h3>
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">{list.length}</span>
              </div>

              {/* Session rows */}
              <div className="space-y-2">
                {list.map((s) => {
                  const acts = (s.days ?? []).reduce((n, d) => n + (d.activities?.length ?? 0), 0)
                  const color = s.color || '#6366F1'
                  const range = s.startDate && s.endDate && s.endDate.substring(0, 10) !== s.startDate.substring(0, 10)
                  const fonction = FONCTION_LABEL[s.sessionType ?? '']
                  const vis = VIS[s.visibility ?? 'VISIBLE']
                  const open = expanded === s.id
                  return (
                    <div key={s.id} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
                      <div className="flex items-stretch gap-3 p-3">
                        {/* Date chip */}
                        <button onClick={() => setEditor(s)} title="Modifier"
                          className="flex flex-col items-center justify-center rounded-lg px-3 py-2 text-center transition-transform hover:scale-[1.03]"
                          style={{ background: `${color}14`, borderLeft: `3px solid ${color}` }}>
                          {s.startDate ? (
                            <>
                              <span className="text-[10px] font-medium uppercase text-muted-foreground">{wday(s.startDate)}</span>
                              <span className="text-xl font-extrabold leading-none text-foreground tabular-nums">{day(s.startDate)}</span>
                              <span className="text-[10px] font-semibold uppercase text-muted-foreground">{mon(s.startDate)}</span>
                              {range && (
                                <span className="mt-0.5 whitespace-nowrap text-[10px] font-medium text-muted-foreground">→ {day(s.endDate!)} {mon(s.endDate!)}</span>
                              )}
                            </>
                          ) : (
                            <span className="text-[11px] font-medium text-muted-foreground">—</span>
                          )}
                        </button>

                        {/* Body — click to edit */}
                        <button onClick={() => setEditor(s)} className="min-w-0 flex-1 text-left">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h4 className="truncate text-sm font-semibold text-foreground">{s.title}</h4>
                            {fonction && <Badge variant="default">{fonction}</Badge>}
                            {vis && <Badge variant={vis.variant}>{vis.label}</Badge>}
                          </div>
                          {s.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{s.description}</p>}
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            {s.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{s.location}</span>}
                            {(s.responsibles?.length ?? 0) > 0 && <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{s.responsibles!.length} responsable(s)</span>}
                          </div>
                        </button>

                        {/* Actions */}
                        <div className="flex shrink-0 items-start gap-1">
                          {acts > 0 && (
                            <button onClick={() => setExpanded(open ? null : s.id)} title={`${acts} activité(s)`}
                              className="flex items-center gap-1 rounded-md px-1.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground">
                              <Layers className="h-4 w-4" /><span className="tabular-nums">{acts}</span>
                              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
                            </button>
                          )}
                          <button onClick={() => setEditor(s)} title="Modifier"
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => del(s)} title="Supprimer"
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Expanded agenda (read-only) */}
                      {open && acts > 0 && (
                        <div className="border-t border-border bg-muted/20 px-4 py-3">
                          <div className="space-y-3">
                            {(s.days ?? []).filter((d) => (d.activities?.length ?? 0) > 0).map((d, di) => (
                              <div key={d.id ?? di}>
                                {(d.title || d.date) && (
                                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    {d.title || (d.date ? at(d.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : '')}
                                  </p>
                                )}
                                <ul className="space-y-1">
                                  {(d.activities ?? []).map((a, ai) => (
                                    <li key={a.id ?? ai} className="flex items-center gap-2 text-xs">
                                      {(a.startTime || a.endTime) && (
                                        <span className="w-24 shrink-0 font-medium text-muted-foreground tabular-nums">
                                          {a.startTime}{a.endTime ? `–${a.endTime}` : ''}
                                        </span>
                                      )}
                                      <span className="font-medium text-foreground">{a.title}</span>
                                      {a.location && <span className="text-muted-foreground">· {a.location}</span>}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {editor && (
        <SessionEditModal programmeId={programmeId}
          session={editor === 'new' ? null : editor}
          onClose={() => setEditor(null)}
          onSaved={() => { setEditor(null); onChanged() }} />
      )}
    </div>
  )
}

// ── Field helper ─────────────────────────────────────────────────────────────
function Field({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}{required && <span className="text-rose-500"> *</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  )
}

// ── Session editor modal (create + edit) ─────────────────────────────────────
function SessionEditModal({ programmeId, session, onClose, onSaved }: {
  programmeId: number; session: Session | null; onClose: () => void; onSaved: () => void
}) {
  const isEdit = !!session
  const [f, setF] = useState({
    title: session?.title ?? '',
    sessionType: session?.sessionType || 'INCUBATION',
    durationKind: session?.durationKind === 'day' ? 'day'
      : (session?.endDate && session.endDate.substring(0, 10) !== session.startDate?.substring(0, 10)) ? 'range'
      : (session?.durationKind ?? 'day'),
    startDate: session?.startDate?.substring(0, 10) ?? '',
    endDate: session?.endDate?.substring(0, 10) ?? '',
    location: session?.location ?? '',
    color: session?.color || '#6366F1',
    status: session?.status || 'UPCOMING',
    visibility: session?.visibility || 'VISIBLE',
    description: session?.description ?? '',
  })
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))
  const isDay = f.durationKind === 'day'

  const save = async () => {
    if (!f.title.trim()) { toast.error('Donnez un titre à la session.'); return }
    if (!f.startDate) { toast.error('Choisissez une date de début.'); return }
    const payload = {
      title: f.title.trim(),
      sessionType: f.sessionType,
      durationKind: f.durationKind,
      startDate: f.startDate,
      endDate: isDay ? f.startDate : (f.endDate || f.startDate),
      location: f.location.trim() || undefined,
      color: f.color,
      status: f.status,
      visibility: f.visibility,
      description: f.description.trim() || undefined,
    }
    setBusy(true)
    try {
      if (isEdit && session) await sessionsApi.update(programmeId, session.id, payload)
      else await sessionsApi.create(programmeId, { ...payload, lane: 'Principal', phaseOrder: 0 })
      toast.success(isEdit ? 'Session mise à jour' : 'Session ajoutée')
      onSaved()
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Enregistrement impossible')
    } finally { setBusy(false) }
  }

  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h3 className="text-base font-bold text-foreground">{isEdit ? 'Modifier la session' : 'Nouvelle session'}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <Field label="Titre" required>
            <Input value={f.title} onChange={(e) => set('title', e.target.value)}
              placeholder="Ex. Atelier Business Model" className="h-10 text-sm font-semibold" autoFocus />
          </Field>

          <Field label="Type de session"
            hint="Détermine le comportement (candidatures / jury) et le badge affiché aux participants.">
            <Select value={f.sessionType} onChange={(e) => set('sessionType', e.target.value)}>
              {TYPE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>

          {/* Calendrier */}
          <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Calendrier</p>
            <div className="grid grid-cols-2 gap-2">
              {([['day', 'Journée', CalendarDays], ['range', 'Plage', CalendarRange]] as const).map(([k, lbl, Icon]) => (
                <button key={k} type="button"
                  onClick={() => { set('durationKind', k); if (k === 'day') set('endDate', f.startDate) }}
                  className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border text-sm font-semibold transition-colors ${
                    f.durationKind === k ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      : 'border-border text-muted-foreground hover:border-emerald-400'}`}>
                  <Icon className="h-4 w-4" />{lbl}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">Début</label>
                <Input type="date" value={f.startDate}
                  onChange={(e) => { set('startDate', e.target.value); if (isDay) set('endDate', e.target.value) }} />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">Fin {isDay && '(= début)'}</label>
                <Input type="date" value={f.endDate} min={f.startDate || undefined} disabled={isDay}
                  onChange={(e) => set('endDate', e.target.value)} className={isDay ? 'opacity-60' : ''} />
              </div>
            </div>
          </div>

          <Field label="Lieu">
            <Input value={f.location} placeholder='Ex. "Salle A · Medianet HQ" ou "En ligne"'
              onChange={(e) => set('location', e.target.value)} />
          </Field>

          {/* Couleur + Statut */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Couleur</label>
              <div className="flex flex-wrap gap-1.5">
                {SWATCHES.map((hex) => (
                  <button key={hex} type="button" onClick={() => set('color', hex)} title={hex}
                    className={`h-7 w-7 rounded-full border-2 transition-transform ${f.color === hex ? 'scale-110 border-foreground' : 'border-transparent hover:scale-105'}`}
                    style={{ background: hex }} />
                ))}
              </div>
            </div>
            <Field label="Statut">
              <Select value={f.status} onChange={(e) => set('status', e.target.value)}>
                <option value="UPCOMING">À venir</option>
                <option value="ACTIVE">En cours</option>
                <option value="COMPLETED">Terminée</option>
              </Select>
            </Field>
          </div>

          {/* Visibilité */}
          <Field label="Visibilité"
            hint={f.visibility === 'VISIBLE' ? 'Affichée dans le parcours public aux invités.'
              : f.visibility === 'HIDDEN' ? 'Interne — visible des admins uniquement.'
              : 'Privée — réservée aux utilisateurs explicitement invités.'}>
            <div className="grid grid-cols-3 gap-2">
              {VIS_SEG.map(([v, lbl, cls]) => (
                <button key={v} type="button" onClick={() => set('visibility', v)}
                  className={`h-9 rounded-lg border text-xs font-semibold transition-colors ${
                    f.visibility === v ? cls : 'border-border text-muted-foreground hover:border-emerald-400'}`}>
                  {lbl}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Description">
            <Textarea rows={4} value={f.description} onChange={(e) => set('description', e.target.value)}
              placeholder="Objectifs, déroulé, informations utiles…" />
          </Field>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3.5">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Annuler</Button>
          <Button variant="brand" onClick={save} disabled={busy} className="gap-1.5">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {isEdit ? 'Enregistrer' : 'Créer la session'}
          </Button>
        </div>
      </motion.div>
    </div>,
    document.body,
  )
}
