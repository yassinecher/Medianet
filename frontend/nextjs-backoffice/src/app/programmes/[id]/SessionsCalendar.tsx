'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  CalendarClock, MapPin, Plus, Trash2, Users, Layers, Wand2,
  ChevronDown, ChevronRight, CalendarDays,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { sessionsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { performDelete } from '@/lib/deleteChoice'

interface Activity { id?: number; title: string; startTime?: string; endTime?: string; location?: string }
interface SessionDay { id?: number; title?: string; date?: string; activities?: Activity[] }
interface Session {
  id: number; title: string; description?: string
  startDate?: string; endDate?: string; durationKind?: string
  location?: string; color?: string
  sessionType?: string; visibility?: string; status?: string
  parentSessionId?: number | null
  responsibles?: string[]; days?: SessionDay[]
}

const FONCTION_LABEL: Record<string, string> = {
  CANDIDATURE_SUBMISSION: 'Candidature', PRESELECTION: 'Présélection',
}
const VIS: Record<string, { label: string; variant: 'warning' | 'destructive' }> = {
  HIDDEN:  { label: 'Interne', variant: 'warning' },
  PRIVATE: { label: 'Privé',   variant: 'destructive' },
}

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

  // Sub-sessions (children) are shown inside their parent's page, not as top-level
  // cards. The calendar lists the top-level parcours structure, grouped by month.
  const topLevel = useMemo(() => sessions.filter((s) => !s.parentSessionId), [sessions])
  const childCount = useMemo(() => {
    const m = new Map<number, number>()
    for (const s of sessions) if (s.parentSessionId) m.set(s.parentSessionId, (m.get(s.parentSessionId) ?? 0) + 1)
    return m
  }, [sessions])

  const groups = useMemo(() => {
    const sorted = [...topLevel].sort((a, b) => {
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
  }, [topLevel])

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
          <span className="font-medium text-foreground">{topLevel.length}</span> session(s) au calendrier
        </div>
        <div className="flex gap-2">
          <Link href={`/programmes/${programmeId}/timeline`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Wand2 className="h-3.5 w-3.5 text-brand-500" />Vue visuelle
            </Button>
          </Link>
          <Link href={`/programmes/${programmeId}/sessions/new`}>
            <Button variant="brand" size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />Ajouter une session
            </Button>
          </Link>
        </div>
      </div>

      {/* Empty state */}
      {topLevel.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-14 text-center">
          <CalendarClock className="h-10 w-10 text-muted-foreground opacity-30" />
          <p className="text-sm font-medium text-foreground">Aucune session planifiée</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Ajoutez les sessions du programme (candidature, ateliers, pitch day…). Elles apparaîtront ici, classées par mois.
          </p>
          <Link href={`/programmes/${programmeId}/sessions/new`}>
            <Button variant="brand" size="sm" className="mt-1 gap-1.5"><Plus className="h-3.5 w-3.5" />Ajouter une session</Button>
          </Link>
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
                  const kids = childCount.get(s.id) ?? 0
                  const color = s.color || '#6366F1'
                  const range = s.startDate && s.endDate && s.endDate.substring(0, 10) !== s.startDate.substring(0, 10)
                  const fonction = FONCTION_LABEL[s.sessionType ?? '']
                  const vis = VIS[s.visibility ?? 'VISIBLE']
                  const open = expanded === s.id
                  const href = `/programmes/${programmeId}/sessions/${s.id}`
                  return (
                    <div key={s.id} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
                      <div className="flex items-stretch gap-3 p-3">
                        {/* Date chip → session page */}
                        <Link href={href} title="Ouvrir la session"
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
                        </Link>

                        {/* Body → session page */}
                        <Link href={href} className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h4 className="truncate text-sm font-semibold text-foreground">{s.title}</h4>
                            {fonction && <Badge variant="default">{fonction}</Badge>}
                            {vis && <Badge variant={vis.variant}>{vis.label}</Badge>}
                          </div>
                          {s.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{s.description}</p>}
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            {s.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{s.location}</span>}
                            {kids > 0 && <span className="flex items-center gap-1 font-medium text-brand-600 dark:text-brand-400"><Layers className="h-3.5 w-3.5" />{kids} sous-session(s)</span>}
                            {(s.responsibles?.length ?? 0) > 0 && <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{s.responsibles!.length} responsable(s)</span>}
                          </div>
                        </Link>

                        {/* Actions */}
                        <div className="flex shrink-0 items-start gap-1">
                          {acts > 0 && (
                            <button onClick={() => setExpanded(open ? null : s.id)} title={`${acts} activité(s)`}
                              className="flex items-center gap-1 rounded-md px-1.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground">
                              <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
                            </button>
                          )}
                          <Link href={href} title="Ouvrir" className="hidden rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground sm:block">
                            <ChevronRight className="h-4 w-4" />
                          </Link>
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
    </div>
  )
}
