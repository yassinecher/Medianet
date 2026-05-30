'use client'
/**
 * SessionsDock — bottom-anchored editable panel listed every session of the
 * visual builder. Rendered as an absolute overlay over the canvas so it can
 * coexist with the React Flow chrome without breaking the 3-column layout.
 *
 * One row per session. Type / status dropdowns, title, duration segment,
 * dates (with day-locking), location all editable inline. Clicking the row
 * (outside the input fields) selects the session on the canvas and focuses
 * the camera on it via the parent's onSelect callback.
 */
import { useMemo } from 'react'
import { Layers, X, Trash2, Calendar, Users, UserPlus, CheckSquare } from 'lucide-react'
import type { Node } from '@xyflow/react'
import { Input } from '@/components/ui/input'
import { SESSION_TYPES, type SessionType } from '@/lib/api'

// ── Local mirror of the SessionData / BuilderDay shapes ──────────────────
// We intentionally keep this tight (only the fields rendered in the dock)
// so the dock can live in its own file without circular imports.

export interface SessionDataLite extends Record<string, unknown> {
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
  tasks: any[]
  criterionWeights: Record<string, number>
  sessionType: SessionType
  status: 'UPCOMING' | 'ACTIVE' | 'COMPLETED'
  days: any[]
}

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
  CANDIDATURE_SUBMISSION: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-300/40',
  PRESELECTION:           'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300/40',
  PITCH_DAY:              'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-300/40',
  ONBOARDING:             'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300/40',
  INCUBATION:             'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-300/40',
  DEMO_DAY:               'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-300/40',
  TRAINING_DAY:           'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-300/40',
}

interface Props {
  sessions: Node<SessionDataLite, 'session'>[]
  selectedId: string | null
  onSelect: (id: string) => void
  onUpdate: (id: string, patch: Partial<SessionDataLite>) => void
  onDelete: (id: string) => void
  onClose: () => void
}

export function SessionsDock({ sessions, selectedId, onSelect, onUpdate, onDelete, onClose }: Props) {
  // Sort by startDate so the dock reads like an agenda.
  const sorted = useMemo(
    () => [...sessions].sort((a, b) => (a.data.startDate ?? '').localeCompare(b.data.startDate ?? '')),
    [sessions],
  )

  return (
    <div className="absolute inset-x-3 bottom-3 z-40 max-h-[55vh] flex flex-col rounded-2xl border-2 border-emerald-500/40 bg-card/95 backdrop-blur shadow-2xl">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <Layers className="h-4 w-4 text-emerald-600" />
        <h3 className="text-sm font-bold text-foreground">Sessions ({sessions.length})</h3>
        <p className="text-[10px] text-muted-foreground hidden sm:block">
          Édite chaque session ici sans naviguer sur le canvas. Clique sur une ligne pour la cibler.
        </p>
        <button onClick={onClose}
          className="ml-auto text-muted-foreground hover:text-foreground p-1 rounded hover:bg-accent"
          title="Fermer">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {sorted.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            Aucune session — utilise la palette pour en ajouter.
          </div>
        ) : sorted.map((node) => (
          <SessionRow
            key={node.id}
            node={node}
            isSelected={selectedId === node.id}
            onSelect={() => onSelect(node.id)}
            onUpdate={(patch) => onUpdate(node.id, patch)}
            onDelete={() => onDelete(node.id)}
          />
        ))}
      </div>
    </div>
  )
}

function SessionRow({
  node, isSelected, onSelect, onUpdate, onDelete,
}: {
  node: Node<SessionDataLite, 'session'>
  isSelected: boolean
  onSelect: () => void
  onUpdate: (patch: Partial<SessionDataLite>) => void
  onDelete: () => void
}) {
  const d = node.data
  const tone = SESSION_TYPE_TONE[d.sessionType ?? 'INCUBATION']

  return (
    <div
      onClick={onSelect}
      className={
        'rounded-xl border-2 bg-card p-3 transition-all cursor-pointer ' +
        (isSelected
          ? 'border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
          : 'border-border hover:border-emerald-400')
      }>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <select
          value={d.sessionType ?? 'INCUBATION'}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onUpdate({ sessionType: e.target.value as SessionType })}
          className={`rounded-full border-2 px-2 py-0.5 text-[10px] font-bold ${tone}`}>
          {SESSION_TYPES.map((t) => (
            <option key={t} value={t}>{SESSION_TYPE_LABEL[t]}</option>
          ))}
        </select>
        <select
          value={d.status ?? 'UPCOMING'}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onUpdate({ status: e.target.value as any })}
          className="rounded-full border px-2 py-0.5 text-[10px] font-semibold bg-background">
          <option value="UPCOMING">À venir</option>
          <option value="ACTIVE">En cours</option>
          <option value="COMPLETED">Terminée</option>
        </select>
        <Input
          value={d.title}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="Titre de la session"
          className="h-7 text-sm font-bold flex-1 min-w-[160px]" />
        <button
          onClick={(e) => { e.stopPropagation(); if (confirm('Supprimer cette session ?')) onDelete() }}
          className="text-muted-foreground hover:text-destructive p-1 rounded hover:bg-accent"
          title="Supprimer">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        <div className="sm:col-span-1">
          <label className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground">Durée</label>
          <div className="flex gap-1 mt-0.5">
            {(['day', 'week', 'custom'] as const).map((k) => (
              <button key={k} type="button"
                onClick={(e) => {
                  e.stopPropagation()
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
                className={
                  'flex-1 rounded-md border px-1 py-0.5 text-[10px] font-semibold transition-colors ' +
                  (d.durationKind === k
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : 'border-border text-muted-foreground hover:border-emerald-400')
                }>
                {k === 'day' ? 'J' : k === 'week' ? 'S' : '…'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground">Début</label>
          <Input type="date"
            value={d.startDate ?? ''}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              const sd = e.target.value
              const patch: any = { startDate: sd }
              if (d.durationKind === 'day') patch.endDate = sd
              else if (d.durationKind === 'week' && sd) {
                const dt = new Date(sd + 'T12:00:00')
                dt.setDate(dt.getDate() + 6)
                patch.endDate = dt.toISOString().slice(0, 10)
              }
              onUpdate(patch)
            }}
            className="h-7 text-[11px]" />
        </div>

        <div>
          <label className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground">
            Fin {d.durationKind === 'day' && '(=Début)'}
          </label>
          <Input type="date"
            disabled={d.durationKind === 'day'}
            value={d.endDate ?? ''}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onUpdate({ endDate: e.target.value })}
            className={'h-7 text-[11px] ' + (d.durationKind === 'day' ? 'opacity-60 cursor-not-allowed' : '')} />
        </div>

        <div>
          <label className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground">Lieu</label>
          <Input value={d.location ?? ''}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onUpdate({ location: e.target.value })}
            placeholder="Salle / Online"
            className="h-7 text-[11px]" />
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
        {(d.days ?? []).length > 0 && (
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-2.5 w-2.5" />{(d.days ?? []).length} jour{(d.days ?? []).length > 1 ? 's' : ''}
          </span>
        )}
        {(d.responsibles ?? []).length > 0 && (
          <span className="inline-flex items-center gap-1">
            <Users className="h-2.5 w-2.5" />{(d.responsibles ?? []).length} resp.
          </span>
        )}
        {(d.guests ?? []).length > 0 && (
          <span className="inline-flex items-center gap-1">
            <UserPlus className="h-2.5 w-2.5" />{(d.guests ?? []).length} invité{(d.guests ?? []).length > 1 ? 's' : ''}
          </span>
        )}
        {(d.tasks ?? []).length > 0 && (
          <span className="inline-flex items-center gap-1">
            <CheckSquare className="h-2.5 w-2.5" />{(d.tasks ?? []).length} tâche{(d.tasks ?? []).length > 1 ? 's' : ''}
          </span>
        )}
        <span className="ml-auto italic">
          Plus de détails (équipe, jours, activités) → clique pour ouvrir l&apos;inspecteur à droite
        </span>
      </div>
    </div>
  )
}
