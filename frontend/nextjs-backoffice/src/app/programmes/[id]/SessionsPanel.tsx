'use client'
/**
 * SessionsPanel — the unified Session editor used on a programme detail page.
 *
 * A "Session" is the single object the whole programme workflow revolves
 * around. Its {@link SessionType} tells you what kind of session it is
 * (candidature submission, preselection, pitch day, onboarding, incubation,
 * demo day, training day). Each session may span 1..N days; each day holds
 * an ordered list of activities (or training steps) with timing,
 * responsibles, invited guests.
 *
 * Status of the session feeds back into the parent programme — handled
 * server-side by ProgrammeLifecycle.
 */
import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Trash2, Edit2, Save, ChevronDown, ChevronRight, Calendar, Clock,
  Users, Sparkles, Layers, Loader2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { sessionsApi, SESSION_TYPES, ACTIVITY_TYPES } from '@/lib/api'
import type { SessionType, ActivityType } from '@/lib/api'
import { MagicCard } from '@/components/magicui/magic-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// ── Types (mirror backend DTOs) ────────────────────────────────────────────

interface Activity {
  id?: number
  activityOrder?: number
  title: string
  description?: string
  type?: ActivityType | string
  startTime?: string         // "09:30:00"
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
  date?: string             // YYYY-MM-DD
  location?: string
  activities?: Activity[]
}

interface Session {
  id?: number
  title: string
  description?: string
  phaseOrder?: number
  startDate?: string
  endDate?: string
  status?: 'UPCOMING' | 'ACTIVE' | 'COMPLETED'
  sessionType?: SessionType | string
  location?: string
  durationKind?: string
  responsibles?: string[]
  guests?: string[]
  startupIds?: number[]
  focusCriteriaIds?: number[]
  days?: SessionDay[]
}

// ── Display helpers ─────────────────────────────────────────────────────────

const SESSION_TYPE_LABEL: Record<string, string> = {
  CANDIDATURE_SUBMISSION: 'Candidature',
  PRESELECTION:           'Présélection',
  PITCH_DAY:              'Pitch Day',
  ONBOARDING:             'Onboarding',
  INCUBATION:             'Incubation',
  DEMO_DAY:               'Demo Day',
  TRAINING_DAY:           'Formation',
}

const SESSION_TYPE_TONE: Record<string, string> = {
  CANDIDATURE_SUBMISSION: 'bg-sky-500/15 text-sky-700 border-sky-300/40 dark:text-sky-300',
  PRESELECTION:           'bg-amber-500/15 text-amber-700 border-amber-300/40 dark:text-amber-300',
  PITCH_DAY:              'bg-rose-500/15 text-rose-700 border-rose-300/40 dark:text-rose-300',
  ONBOARDING:             'bg-emerald-500/15 text-emerald-700 border-emerald-300/40 dark:text-emerald-300',
  INCUBATION:             'bg-purple-500/15 text-purple-700 border-purple-300/40 dark:text-purple-300',
  DEMO_DAY:               'bg-orange-500/15 text-orange-700 border-orange-300/40 dark:text-orange-300',
  TRAINING_DAY:           'bg-indigo-500/15 text-indigo-700 border-indigo-300/40 dark:text-indigo-300',
}

const STATUS_LABEL: Record<string, string> = {
  UPCOMING: 'À venir', ACTIVE: 'En cours', COMPLETED: 'Terminée',
}

const STATUS_TONE: Record<string, string> = {
  UPCOMING:  'bg-muted text-muted-foreground border-border',
  ACTIVE:    'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300/40',
  COMPLETED: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-300/40',
}

const ACTIVITY_TYPE_LABEL: Record<string, string> = {
  ACTIVITY: 'Activité', TRAINING_STEP: 'Étape de formation', KEYNOTE: 'Keynote',
  WORKSHOP: 'Atelier', PANEL: 'Panel', PITCH: 'Pitch',
  BREAK: 'Pause', NETWORKING: 'Networking', OTHER: 'Autre',
}

// ── Props ───────────────────────────────────────────────────────────────────

interface SessionsPanelProps {
  programmeId: number
  criteria?: Array<{ id?: number; name: string }>
  /** Called after every load — useful to keep the tab badge counter in sync. */
  onCountChange?: (n: number) => void
}

export function SessionsPanel({ programmeId, criteria = [], onCountChange }: SessionsPanelProps) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)

  // New-session form
  const [newSession, setNewSession] = useState<Session>({
    title: '', sessionType: 'INCUBATION', startDate: '', endDate: '', description: '',
  })
  const [adding, setAdding] = useState(false)

  // Edit form
  const [editForm, setEditForm] = useState<Session>({ title: '' })

  // ── Load ─────────────────────────────────────────────────────────────────

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const r = await sessionsApi.list(programmeId)
      const list = r.data ?? []
      setSessions(list)
      onCountChange?.(list.length)
    } finally { setLoading(false) }
  }, [programmeId, onCountChange])

  useEffect(() => { reload() }, [reload])

  // ── Session CRUD ─────────────────────────────────────────────────────────

  const onAdd = async () => {
    if (!newSession.title.trim()) { toast.error('Titre requis'); return }
    setAdding(true)
    try {
      await sessionsApi.create(programmeId, {
        title: newSession.title,
        description: newSession.description,
        sessionType: newSession.sessionType ?? 'INCUBATION',
        startDate: newSession.startDate || undefined,
        endDate: newSession.endDate || undefined,
        location: newSession.location || undefined,
        focusCriteriaIds: newSession.focusCriteriaIds ?? [],
      })
      setNewSession({ title: '', sessionType: 'INCUBATION', startDate: '', endDate: '', description: '' })
      await reload()
      toast.success('Session ajoutée')
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erreur')
    } finally { setAdding(false) }
  }

  const onDelete = async (id: number) => {
    if (!confirm('Supprimer cette session ?')) return
    try {
      await sessionsApi.delete(programmeId, id)
      setSessions(s => s.filter(x => x.id !== id))
      toast.success('Session supprimée')
    } catch { toast.error('Erreur') }
  }

  const startEdit = (s: Session) => {
    setEditingId(s.id!)
    setEditForm({ ...s })
  }

  const saveEdit = async () => {
    if (!editingId || !editForm.title.trim()) { toast.error('Titre requis'); return }
    try {
      const r = await sessionsApi.update(programmeId, editingId, {
        title: editForm.title,
        description: editForm.description ?? null,
        sessionType: editForm.sessionType,
        startDate: editForm.startDate || null,
        endDate: editForm.endDate || null,
        location: editForm.location ?? null,
        status: editForm.status,
        focusCriteriaIds: editForm.focusCriteriaIds ?? [],
      })
      setSessions(s => s.map(x => x.id === editingId ? r.data : x))
      setEditingId(null)
      toast.success('Session mise à jour')
    } catch { toast.error('Erreur') }
  }

  const cycleStatus = async (s: Session) => {
    const next: Record<string, 'UPCOMING' | 'ACTIVE' | 'COMPLETED'> = {
      UPCOMING: 'ACTIVE', ACTIVE: 'COMPLETED', COMPLETED: 'UPCOMING',
    }
    const newStatus = next[s.status ?? 'UPCOMING']
    try {
      const r = await sessionsApi.update(programmeId, s.id!, { status: newStatus })
      setSessions(arr => arr.map(x => x.id === s.id ? r.data : x))
    } catch { toast.error('Erreur de statut') }
  }

  // ── Days ─────────────────────────────────────────────────────────────────

  const addDay = async (sessionId: number) => {
    try {
      await sessionsApi.addDay(programmeId, sessionId, {
        title: '', date: null, location: null,
      })
      await reload()
      toast.success('Jour ajouté')
    } catch { toast.error('Erreur') }
  }

  const updateDay = async (sessionId: number, dayId: number, patch: Partial<SessionDay>) => {
    try {
      await sessionsApi.updateDay(programmeId, sessionId, dayId, patch)
      await reload()
    } catch { toast.error('Erreur') }
  }

  const deleteDay = async (sessionId: number, dayId: number) => {
    if (!confirm('Supprimer ce jour et ses activités ?')) return
    try {
      await sessionsApi.deleteDay(programmeId, sessionId, dayId)
      await reload()
      toast.success('Jour supprimé')
    } catch { toast.error('Erreur') }
  }

  // ── Activities ───────────────────────────────────────────────────────────

  const addActivity = async (sessionId: number, dayId: number) => {
    try {
      await sessionsApi.addActivity(programmeId, sessionId, dayId, {
        title: 'Nouvelle activité',
        type: 'ACTIVITY',
      })
      await reload()
    } catch { toast.error('Erreur') }
  }

  const updateActivity = async (sessionId: number, dayId: number, aid: number, patch: Partial<Activity>) => {
    try {
      await sessionsApi.updateActivity(programmeId, sessionId, dayId, aid, patch)
      await reload()
    } catch { toast.error('Erreur') }
  }

  const deleteActivity = async (sessionId: number, dayId: number, aid: number) => {
    try {
      await sessionsApi.deleteActivity(programmeId, sessionId, dayId, aid)
      await reload()
    } catch { toast.error('Erreur') }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/* Add session */}
      <MagicCard className="p-5">
        <h2 className="mb-4 font-semibold text-foreground flex items-center gap-2">
          <Plus className="h-4 w-4 text-brand-500" />Ajouter une session
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Type de session *</label>
            <div className="flex flex-wrap gap-2">
              {SESSION_TYPES.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setNewSession(s => ({ ...s, sessionType: t }))}
                  className={`rounded-full px-3 py-1 text-xs font-semibold border transition-all ${
                    newSession.sessionType === t
                      ? SESSION_TYPE_TONE[t] + ' ring-2 ring-offset-1 ring-offset-card ring-current'
                      : 'border-border text-muted-foreground hover:border-brand-400'
                  }`}>
                  {SESSION_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Titre *</label>
            <Input placeholder='Ex. "Kickoff & Onboarding cohorte 2026"' value={newSession.title}
              onChange={(e) => setNewSession(s => ({ ...s, title: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Date de début</label>
            <Input type="date" value={newSession.startDate ?? ''}
              onChange={(e) => setNewSession(s => ({ ...s, startDate: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Date de fin</label>
            <Input type="date" value={newSession.endDate ?? ''}
              onChange={(e) => setNewSession(s => ({ ...s, endDate: e.target.value }))} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <Input placeholder="Description optionnelle" value={newSession.description ?? ''}
              onChange={(e) => setNewSession(s => ({ ...s, description: e.target.value }))} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Lieu</label>
            <Input placeholder='Ex. "Salle A · Medianet Tunis" ou "Online"'
              value={newSession.location ?? ''}
              onChange={(e) => setNewSession(s => ({ ...s, location: e.target.value }))} />
          </div>
          {criteria.length > 0 && (
            <div className="space-y-2 sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">
                Critères associés <span className="opacity-60">(évalués pendant cette session)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {criteria.map(c => {
                  const checked = (newSession.focusCriteriaIds ?? []).includes(c.id!)
                  return (
                    <button key={c.id} type="button"
                      onClick={() => setNewSession(s => ({
                        ...s,
                        focusCriteriaIds: checked
                          ? (s.focusCriteriaIds ?? []).filter(x => x !== c.id)
                          : [...(s.focusCriteriaIds ?? []), c.id!],
                      }))}
                      className={`rounded-full px-3 py-1 text-xs font-medium border transition-all ${
                        checked ? 'border-brand-500 bg-brand-500/15 text-brand-700 dark:text-brand-300'
                                : 'border-border hover:border-brand-400'}`}>
                      {c.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
        <Button variant="brand" className="mt-3" onClick={onAdd} disabled={adding}>
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {adding ? 'Ajout...' : 'Ajouter la session'}
        </Button>
      </MagicCard>

      {/* List */}
      {loading ? (
        <div className="py-12 text-center text-muted-foreground">
          <Loader2 className="mx-auto h-5 w-5 animate-spin" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">Aucune session définie</div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s, i) => {
            const isExpanded = expandedId === s.id
            const isEditing  = editingId === s.id
            const tType = s.sessionType ?? 'INCUBATION'
            return (
              <motion.div key={s.id ?? i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}>
                <MagicCard className="p-4">
                  {/* ── Header row ───────────────────────────────────── */}
                  {!isEditing ? (
                    <div className="flex items-start gap-3">
                      <button onClick={() => setExpandedId(isExpanded ? null : s.id!)}
                        className="mt-1 rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-accent">
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold border ${SESSION_TYPE_TONE[tType]}`}>
                            {SESSION_TYPE_LABEL[tType] ?? tType}
                          </span>
                          <button onClick={() => cycleStatus(s)}
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold border transition ${STATUS_TONE[s.status ?? 'UPCOMING']} hover:opacity-80`}
                            title="Cliquer pour changer le statut">
                            {STATUS_LABEL[s.status ?? 'UPCOMING']}
                          </button>
                          <h3 className="font-semibold text-foreground truncate">{s.title}</h3>
                        </div>
                        {(s.startDate || s.endDate || s.location) && (
                          <p className="text-xs text-muted-foreground flex flex-wrap gap-3">
                            {s.startDate && (<span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{s.startDate}{s.endDate && ` → ${s.endDate}`}</span>)}
                            {s.location && (<span>📍 {s.location}</span>)}
                            <span className="inline-flex items-center gap-1"><Layers className="h-3 w-3" />{(s.days ?? []).length} jour{(s.days ?? []).length > 1 ? 's' : ''}</span>
                          </p>
                        )}
                        {s.description && !isExpanded && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{s.description}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => startEdit(s)} title="Modifier">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => onDelete(s.id!)} title="Supprimer">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* ── Edit form ───────────────────────────────────── */
                    <div className="space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-xs font-medium text-muted-foreground">Type</label>
                          <div className="flex flex-wrap gap-2">
                            {SESSION_TYPES.map(t => (
                              <button key={t} type="button"
                                onClick={() => setEditForm(f => ({ ...f, sessionType: t }))}
                                className={`rounded-full px-3 py-1 text-xs font-semibold border transition-all ${
                                  editForm.sessionType === t
                                    ? SESSION_TYPE_TONE[t] + ' ring-2 ring-offset-1 ring-offset-card ring-current'
                                    : 'border-border text-muted-foreground hover:border-brand-400'}`}>
                                {SESSION_TYPE_LABEL[t]}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-xs font-medium text-muted-foreground">Titre *</label>
                          <Input value={editForm.title} onChange={(e) => setEditForm(f => ({ ...f, title: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground">Début</label>
                          <Input type="date" value={editForm.startDate ?? ''}
                            onChange={(e) => setEditForm(f => ({ ...f, startDate: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground">Fin</label>
                          <Input type="date" value={editForm.endDate ?? ''}
                            onChange={(e) => setEditForm(f => ({ ...f, endDate: e.target.value }))} />
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-xs font-medium text-muted-foreground">Description</label>
                          <Input value={editForm.description ?? ''}
                            onChange={(e) => setEditForm(f => ({ ...f, description: e.target.value }))} />
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-xs font-medium text-muted-foreground">Lieu</label>
                          <Input value={editForm.location ?? ''}
                            onChange={(e) => setEditForm(f => ({ ...f, location: e.target.value }))} />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="brand" size="sm" onClick={saveEdit}>
                          <Save className="h-3.5 w-3.5" />Sauvegarder
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>Annuler</Button>
                      </div>
                    </div>
                  )}

                  {/* ── Expanded: Days & Activities ─────────────────────── */}
                  <AnimatePresence initial={false}>
                    {isExpanded && !isEditing && (
                      <motion.div
                        key="days"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden">
                        <div className="mt-4 pt-4 border-t border-border space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                              <Layers className="h-4 w-4 text-brand-500" />Jours de la session
                            </h4>
                            <Button variant="outline" size="sm" onClick={() => addDay(s.id!)}>
                              <Plus className="h-3.5 w-3.5" />Ajouter un jour
                            </Button>
                          </div>
                          {(s.days ?? []).length === 0 ? (
                            <div className="rounded-lg border border-dashed border-border bg-muted/30 py-6 text-center text-xs text-muted-foreground">
                              Aucun jour planifié — ajoutez-en pour détailler le programme.
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {(s.days ?? []).map(d => (
                                <DayCard
                                  key={d.id}
                                  sessionId={s.id!}
                                  day={d}
                                  onUpdate={(patch) => updateDay(s.id!, d.id!, patch)}
                                  onDelete={() => deleteDay(s.id!, d.id!)}
                                  onAddActivity={() => addActivity(s.id!, d.id!)}
                                  onUpdateActivity={(aid, patch) => updateActivity(s.id!, d.id!, aid, patch)}
                                  onDeleteActivity={(aid) => deleteActivity(s.id!, d.id!, aid)}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </MagicCard>
              </motion.div>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// DayCard — one day inside a session
// ──────────────────────────────────────────────────────────────────────────

function DayCard({
  sessionId, day, onUpdate, onDelete, onAddActivity, onUpdateActivity, onDeleteActivity,
}: {
  sessionId: number
  day: SessionDay
  onUpdate: (patch: Partial<SessionDay>) => void
  onDelete: () => void
  onAddActivity: () => void
  onUpdateActivity: (aid: number, patch: Partial<Activity>) => void
  onDeleteActivity: (aid: number) => void
}) {
  const [title, setTitle] = useState(day.title ?? '')
  const [date, setDate]   = useState(day.date ?? '')
  const [location, setLocation] = useState(day.location ?? '')

  const persist = () => {
    if (title !== (day.title ?? '') || date !== (day.date ?? '') || location !== (day.location ?? '')) {
      onUpdate({ title, date: date || null as any, location })
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card/60 p-3">
      <div className="flex items-center gap-2 mb-3">
        <span className="rounded-md bg-brand-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-brand-700 dark:text-brand-300">
          Jour {day.dayOrder ?? '?'}
        </span>
        <Input
          className="h-7 text-sm flex-1"
          placeholder="Titre du jour (Kickoff, Hackathon, …)"
          value={title} onChange={(e) => setTitle(e.target.value)} onBlur={persist}
        />
        <Input className="h-7 text-xs w-36" type="date"
          value={date} onChange={(e) => setDate(e.target.value)} onBlur={persist} />
        <Button variant="ghost" size="icon" onClick={onDelete} title="Supprimer le jour">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      <Input className="h-7 text-xs mb-3" placeholder="Lieu spécifique (sinon hérite de la session)"
        value={location} onChange={(e) => setLocation(e.target.value)} onBlur={persist} />

      <div className="space-y-2">
        {(day.activities ?? []).length === 0 && (
          <div className="rounded-md border border-dashed border-border bg-muted/20 py-3 text-center text-[11px] text-muted-foreground">
            Aucune activité — ajoutez-en pour bâtir l'agenda du jour.
          </div>
        )}
        {(day.activities ?? []).map(a => (
          <ActivityRow key={a.id}
            activity={a}
            onUpdate={(patch) => onUpdateActivity(a.id!, patch)}
            onDelete={() => onDeleteActivity(a.id!)}
          />
        ))}
        <Button variant="ghost" size="sm" onClick={onAddActivity} className="w-full justify-center text-xs">
          <Plus className="h-3 w-3" />Ajouter une activité
        </Button>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// ActivityRow — one agenda item with timing + responsibles + guests
// ──────────────────────────────────────────────────────────────────────────

function ActivityRow({
  activity, onUpdate, onDelete,
}: {
  activity: Activity
  onUpdate: (patch: Partial<Activity>) => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(activity.title)
  const [startTime, setStartTime] = useState(activity.startTime?.slice(0, 5) ?? '')
  const [endTime, setEndTime]     = useState(activity.endTime?.slice(0, 5) ?? '')
  const [description, setDescription] = useState(activity.description ?? '')
  const [type, setType] = useState<string>(activity.type ?? 'ACTIVITY')
  const [resp, setResp] = useState((activity.responsibles ?? []).join(', '))
  const [guests, setGuests] = useState((activity.guests ?? []).join(', '))
  const [location, setLocation] = useState(activity.location ?? '')

  const split = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean)

  const persist = () => {
    onUpdate({
      title, description,
      type: type as ActivityType,
      startTime: startTime ? `${startTime}:00` : null as any,
      endTime: endTime ? `${endTime}:00` : null as any,
      location, responsibles: split(resp), guests: split(guests),
    })
  }

  return (
    <div className="rounded-md border border-border bg-background/50">
      <div className="flex items-center gap-2 p-2">
        <button onClick={() => setOpen(o => !o)} className="text-muted-foreground hover:text-foreground">
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        <Input className="h-7 text-sm flex-1" value={title}
          onChange={(e) => setTitle(e.target.value)} onBlur={persist} />
        <Input className="h-7 text-xs w-20" type="time" placeholder="Début"
          value={startTime} onChange={(e) => setStartTime(e.target.value)} onBlur={persist} />
        <span className="text-muted-foreground text-xs">→</span>
        <Input className="h-7 text-xs w-20" type="time" placeholder="Fin"
          value={endTime} onChange={(e) => setEndTime(e.target.value)} onBlur={persist} />
        <Button variant="ghost" size="icon" onClick={onDelete} title="Supprimer">
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>

      {open && (
        <div className="grid gap-2 border-t border-border p-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <label className="text-[10px] font-medium uppercase text-muted-foreground">Type</label>
            <div className="flex flex-wrap gap-1.5">
              {ACTIVITY_TYPES.map(t => (
                <button key={t} type="button"
                  onClick={() => { setType(t); onUpdate({ type: t }) }}
                  className={`rounded-md px-2 py-0.5 text-[10px] font-medium border transition-all ${
                    type === t ? 'border-brand-500 bg-brand-500/15 text-brand-700 dark:text-brand-300'
                               : 'border-border text-muted-foreground hover:border-brand-400'}`}>
                  {ACTIVITY_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-[10px] font-medium uppercase text-muted-foreground">Description</label>
            <Input className="h-7 text-xs" value={description}
              onChange={(e) => setDescription(e.target.value)} onBlur={persist}
              placeholder="Détails — ce qui se passe pendant cette activité…" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-medium uppercase text-muted-foreground">Lieu</label>
            <Input className="h-7 text-xs" value={location}
              onChange={(e) => setLocation(e.target.value)} onBlur={persist}
              placeholder='Ex. "Salle B" ou "Zoom"' />
          </div>
          <div />
          <div className="space-y-1">
            <label className="text-[10px] font-medium uppercase text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" />Responsables (séparés par virgule)
            </label>
            <Input className="h-7 text-xs" value={resp}
              onChange={(e) => setResp(e.target.value)} onBlur={persist}
              placeholder='Ex. "Mentor X, Sara Ben Ali"' />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-medium uppercase text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3" />Invités (séparés par virgule)
            </label>
            <Input className="h-7 text-xs" value={guests}
              onChange={(e) => setGuests(e.target.value)} onBlur={persist}
              placeholder='Ex. "CEO Acme, VC Partner Inc."' />
          </div>
        </div>
      )}
    </div>
  )
}
