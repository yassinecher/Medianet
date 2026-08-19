'use client'
/**
 * Shared calendar — one agenda for all front-office roles, built from the data
 * each role already has:
 *   • porteur → sessions of the programmes they were accepted into + their tasks
 *   • mentor  → sessions of the programmes where they accompany a startup
 *   • jury    → sessions of the programmes they evaluate
 * Events = programme sessions (phases) + task deadlines + coaching meetings +
 * workshops. Three views (mois / semaine / agenda), per-kind filters and a
 * click-to-inspect day panel. No new backend — it reuses candidatures /
 * participants / jury-assignments / tasks / meetings / workshops.
 */
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  CalendarDays, CalendarClock, ChevronLeft, ChevronRight, MapPin, CheckSquare, FolderKanban,
  ArrowRight, Clock, GraduationCap, LayoutGrid, Columns3, List, X,
} from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { MagicCard } from '@/components/magicui/magic-card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  candidaturesApi, participantsApi, juryApi, tasksApi, programmesApi, meetingsApi, workshopsApi,
} from '@/lib/api'
import { useUser, frontofficeRolesOf } from '@/store/auth.store'

type Kind = 'session' | 'task' | 'meeting' | 'workshop'
type Ev = {
  date: string; end?: string; title: string; kind: Kind
  programmeId?: number; programmeName?: string; location?: string; href: string
  overdue?: boolean; time?: string
}

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const WD = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const parse = (s?: string) => (s ? s.slice(0, 10) : undefined)

// Single source of truth for each event kind's look + label.
const KINDS: Record<Kind, { label: string; chip: string; dot: string; iconBg: string; Icon: typeof CalendarDays }> = {
  session:  { label: 'Session',        chip: 'bg-brand-500/15 text-brand-700 dark:text-brand-300 border-brand-500/30',   dot: 'bg-brand-500',   iconBg: 'bg-brand-500/10 text-brand-600 dark:text-brand-400',     Icon: CalendarDays },
  task:     { label: 'Échéance',       chip: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',   dot: 'bg-amber-500',   iconBg: 'bg-amber-500/10 text-amber-600',                        Icon: CheckSquare },
  meeting:  { label: 'Rendez-vous',    chip: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30', dot: 'bg-purple-500', iconBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400', Icon: CalendarClock },
  workshop: { label: 'Atelier',        chip: 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30',       dot: 'bg-teal-500',    iconBg: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',       Icon: GraduationCap },
}
const ALL_KINDS = Object.keys(KINDS) as Kind[]

export default function CalendarPage() {
  const user = useUser()
  const [events, setEvents] = useState<Ev[]>([])
  const [loading, setLoading] = useState(true)
  const today = new Date()
  const todayStr = iso(today)
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() })
  const [view, setView] = useState<'month' | 'week' | 'agenda'>('month')
  const [enabled, setEnabled] = useState<Set<Kind>>(new Set(ALL_KINDS))
  const [selected, setSelected] = useState<string | null>(null)
  // Anchor day for the week view (defaults to today, moves with the < > nav).
  const [weekAnchor, setWeekAnchor] = useState<string>(todayStr)

  useEffect(() => {
    if (!user) return
    const roles = frontofficeRolesOf(user)
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const progs = new Map<number, string>()
      const add = (id?: number, name?: string) => { if (id) progs.set(id, name || progs.get(id) || `Programme #${id}`) }
      const jobs: Promise<any>[] = []
      if (roles.includes('PORTEUR')) jobs.push(candidaturesApi.myList().then((r) => {
        for (const c of (r.data?.content ?? r.data ?? [])) if (c.status === 'ACCEPTED') add(c.programmeId, c.programmeName)
      }).catch(() => {}))
      if (roles.includes('MENTOR')) jobs.push(participantsApi.mine().then((r) => {
        for (const p of (r.data ?? [])) add(p.programmeId, p.programmeName)
      }).catch(() => {}))
      if (roles.includes('JURY')) jobs.push(juryApi.myAssignments().then((r) => {
        for (const c of (r.data ?? [])) add(c.programmeId, c.programmeName)
      }).catch(() => {}))
      const tasksJob = tasksApi.myTasks().then((r) => (r.data?.content ?? r.data ?? [])).catch(() => [])
      await Promise.all(jobs)

      const ids = Array.from(progs.keys())
      const phaseLists = await Promise.all(ids.map((id) =>
        programmesApi.phases(id).then((r) => ({ id, phases: r.data ?? [] })).catch(() => ({ id, phases: [] as any[] }))))

      const evs: Ev[] = []
      for (const { id, phases } of phaseLists) {
        const name = progs.get(id)
        for (const ph of phases) {
          const start = parse(ph.startDate)
          if (!start) continue
          evs.push({
            date: start, end: parse(ph.endDate), title: ph.title ?? ph.name ?? 'Session',
            programmeId: id, programmeName: name, location: ph.location, kind: 'session',
            href: `/programmes/${id}`,
          })
        }
      }
      const tasks = await tasksJob
      for (const t of tasks) {
        const d = parse(t.dueDate)
        if (!d) continue
        evs.push({
          date: d, title: t.title ?? 'Tâche', kind: 'task', href: '/tasks',
          overdue: d < todayStr && t.status !== 'COMPLETED',
        })
      }
      const meets = await meetingsApi.mine().then((r) => r.data ?? []).catch(() => [])
      for (const mt of meets) {
        const d = parse(mt.proposedDate)
        if (!d || mt.status === 'CANCELLED' || mt.status === 'DECLINED') continue
        evs.push({
          date: d, time: mt.proposedTime, title: `RDV · ${mt.organizationName || 'coaching'}`,
          kind: 'meeting', programmeId: mt.programmeId, programmeName: mt.programmeName, location: mt.location,
          href: mt.participantId ? `/coaching/${mt.participantId}` : '/coaching',
        })
      }
      const shops = await workshopsApi.mine().then((r) => r.data ?? []).catch(() => [])
      for (const w of shops) {
        const d = parse(w.workshopDate)
        if (!d || w.status === 'CANCELLED') continue
        evs.push({
          date: d, time: w.startTime, title: `Atelier · ${w.title}`,
          kind: 'workshop', programmeId: w.programmeId, programmeName: w.programmeName, location: w.location,
          href: w.programmeId ? `/programmes/${w.programmeId}` : '/dashboard',
        })
      }
      if (!cancelled) { setEvents(evs); setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [user, todayStr])

  const shown = useMemo(() => events.filter((e) => enabled.has(e.kind)), [events, enabled])

  // Expand multi-day sessions across every day in [start, end].
  const byDate = useMemo(() => {
    const m = new Map<string, Ev[]>()
    const push = (key: string, e: Ev) => { const a = m.get(key) ?? []; a.push(e); m.set(key, a) }
    for (const e of shown) {
      push(e.date, e)
      if (e.end && e.end > e.date) {
        const d = new Date(`${e.date}T00:00:00`)
        const end = new Date(`${e.end}T00:00:00`)
        for (let i = 0; i < 120; i++) {
          d.setDate(d.getDate() + 1)
          if (d > end) break
          push(iso(d), e)
        }
      }
    }
    return m
  }, [shown])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const e of events) c[e.kind] = (c[e.kind] ?? 0) + 1
    return c
  }, [events])

  const upcoming = useMemo(() => {
    return [...shown].filter((e) => e.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? '')).slice(0, 40)
  }, [shown, todayStr])

  const cells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1)
    const offset = (first.getDay() + 6) % 7
    const days = new Date(cursor.y, cursor.m + 1, 0).getDate()
    const arr: (string | null)[] = Array(offset).fill(null)
    for (let d = 1; d <= days; d++) arr.push(iso(new Date(cursor.y, cursor.m, d)))
    while (arr.length % 7 !== 0) arr.push(null)
    return arr
  }, [cursor])

  const weekDays = useMemo(() => {
    const base = new Date(`${weekAnchor}T00:00:00`)
    const monday = new Date(base)
    monday.setDate(base.getDate() - ((base.getDay() + 6) % 7))
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return iso(d) })
  }, [weekAnchor])

  const toggleKind = (k: Kind) => setEnabled((prev) => {
    const n = new Set(prev)
    n.has(k) ? n.delete(k) : n.add(k)
    return n.size === 0 ? new Set(ALL_KINDS) : n
  })

  const move = (delta: number) => {
    if (view === 'week') {
      const d = new Date(`${weekAnchor}T00:00:00`); d.setDate(d.getDate() + delta * 7); setWeekAnchor(iso(d))
    } else {
      setCursor(({ y, m }) => { const nm = m + delta; return { y: y + Math.floor(nm / 12), m: ((nm % 12) + 12) % 12 } })
    }
  }
  const goToday = () => { setCursor({ y: today.getFullYear(), m: today.getMonth() }); setWeekAnchor(todayStr); setSelected(null) }

  const periodLabel = view === 'week'
    ? (() => { const s = weekDays[0], e = weekDays[6]; return `${fmt(s)} — ${fmt(e)}` })()
    : `${MONTHS[cursor.m]} ${cursor.y}`

  const selectedEvents = selected ? (byDate.get(selected) ?? []).slice().sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '')) : []

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-5">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground"><CalendarDays className="h-6 w-6 text-brand-500" />Calendrier</h1>
            <p className="text-sm text-muted-foreground">Sessions, échéances, rendez-vous et ateliers — au même endroit.</p>
          </div>
          <div className="flex items-center gap-2">
            {/* View switch */}
            <div className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5">
              {([['month', 'Mois', LayoutGrid], ['week', 'Semaine', Columns3], ['agenda', 'Agenda', List]] as const).map(([v, label, Icon]) => (
                <button key={v} onClick={() => setView(v)} title={label}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${view === v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                  <Icon className="h-3.5 w-3.5" /><span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
            {view !== 'agenda' && (
              <div className="flex items-center gap-2">
                <button onClick={() => move(-1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-accent"><ChevronLeft className="h-4 w-4" /></button>
                <span className="min-w-[10.5rem] text-center text-sm font-bold text-foreground">{periodLabel}</span>
                <button onClick={() => move(1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-accent"><ChevronRight className="h-4 w-4" /></button>
              </div>
            )}
            <button onClick={goToday} className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-accent">Aujourd’hui</button>
          </div>
        </motion.div>

        {/* Filter chips */}
        <div className="flex flex-wrap items-center gap-2">
          {ALL_KINDS.map((k) => {
            const on = enabled.has(k)
            return (
              <button key={k} onClick={() => toggleKind(k)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${on ? KINDS[k].chip : 'border-border text-muted-foreground opacity-60 hover:opacity-100'}`}>
                <span className={`h-2 w-2 rounded-full ${KINDS[k].dot} ${on ? '' : 'opacity-40'}`} />
                {KINDS[k].label}
                <span className="opacity-70">{counts[k] ?? 0}</span>
              </button>
            )
          })}
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* ── Main view ── */}
          <MagicCard className="p-3 sm:p-4">
            {loading ? <Skeleton className="h-[26rem]" /> : view === 'agenda' ? (
              <AgendaView events={upcoming} />
            ) : view === 'week' ? (
              <WeekGrid days={weekDays} byDate={byDate} today={todayStr} selected={selected} onSelect={setSelected} />
            ) : (
              <MonthGrid cells={cells} byDate={byDate} today={todayStr} selected={selected} onSelect={setSelected} />
            )}
          </MagicCard>

          {/* ── Side panel: selected day OR upcoming ── */}
          <MagicCard className="p-4">
            {selected ? (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-sm font-bold text-foreground"><CalendarDays className="h-4 w-4 text-brand-500" />{fmtLong(selected)}</h2>
                  <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground" title="Fermer"><X className="h-4 w-4" /></button>
                </div>
                {selectedEvents.length === 0 ? (
                  <p className="py-8 text-center text-xs text-muted-foreground">Aucun événement ce jour.</p>
                ) : <EventList events={selectedEvents} />}
              </>
            ) : (
              <>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground"><Clock className="h-4 w-4 text-brand-500" />À venir</h2>
                {upcoming.length === 0 ? (
                  <p className="py-8 text-center text-xs text-muted-foreground">Aucun événement à venir.</p>
                ) : <EventList events={upcoming.slice(0, 14)} showDate />}
              </>
            )}
          </MagicCard>
        </div>
      </div>
    </AppShell>
  )
}

// ── Month grid ──────────────────────────────────────────────────────────────
function MonthGrid({ cells, byDate, today, selected, onSelect }: {
  cells: (string | null)[]; byDate: Map<string, Ev[]>; today: string; selected: string | null; onSelect: (d: string | null) => void
}) {
  return (
    <>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted-foreground">
        {WD.map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={i} className="min-h-[4.5rem] rounded-lg" />
          const evs = byDate.get(day) ?? []
          const isToday = day === today
          const isSel = day === selected
          return (
            <button key={i} onClick={() => onSelect(isSel ? null : day)}
              className={`min-h-[4.5rem] rounded-lg border p-1 text-left transition-colors ${isSel ? 'border-brand-500 ring-1 ring-brand-500/40 bg-brand-500/5' : isToday ? 'border-brand-400 bg-brand-500/5' : 'border-border bg-background/40 hover:border-brand-300'}`}>
              <div className={`mb-0.5 text-right text-[11px] font-semibold ${isToday ? 'text-brand-600 dark:text-brand-400' : 'text-muted-foreground'}`}>{Number(day.slice(8, 10))}</div>
              <div className="space-y-0.5">
                {evs.slice(0, 3).map((e, j) => (
                  <span key={j} title={e.title}
                    className={`block truncate rounded border px-1 py-0.5 text-[10px] font-medium ${e.kind === 'task' && e.overdue ? 'border-rose-500/30 bg-rose-500/15 text-rose-700 dark:text-rose-300' : KINDS[e.kind].chip}`}>
                    {e.title}
                  </span>
                ))}
                {evs.length > 3 && <p className="px-1 text-[9px] text-muted-foreground">+{evs.length - 3}</p>}
              </div>
            </button>
          )
        })}
      </div>
    </>
  )
}

// ── Week grid (7 day columns) ───────────────────────────────────────────────
function WeekGrid({ days, byDate, today, selected, onSelect }: {
  days: string[]; byDate: Map<string, Ev[]>; today: string; selected: string | null; onSelect: (d: string | null) => void
}) {
  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((day) => {
        const evs = (byDate.get(day) ?? []).slice().sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
        const isToday = day === today
        const isSel = day === selected
        const d = new Date(`${day}T00:00:00`)
        return (
          <button key={day} onClick={() => onSelect(isSel ? null : day)}
            className={`flex min-h-[16rem] flex-col rounded-lg border p-1.5 text-left transition-colors ${isSel ? 'border-brand-500 ring-1 ring-brand-500/40 bg-brand-500/5' : isToday ? 'border-brand-400 bg-brand-500/5' : 'border-border bg-background/40 hover:border-brand-300'}`}>
            <div className={`mb-1 text-center text-[11px] font-semibold ${isToday ? 'text-brand-600 dark:text-brand-400' : 'text-muted-foreground'}`}>
              {WD[(d.getDay() + 6) % 7]} {d.getDate()}
            </div>
            <div className="space-y-1">
              {evs.map((e, j) => (
                <span key={j} title={e.title}
                  className={`block truncate rounded border px-1 py-0.5 text-[10px] font-medium ${e.kind === 'task' && e.overdue ? 'border-rose-500/30 bg-rose-500/15 text-rose-700 dark:text-rose-300' : KINDS[e.kind].chip}`}>
                  {e.time ? `${e.time} · ` : ''}{e.title}
                </span>
              ))}
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ── Agenda (grouped upcoming list) ──────────────────────────────────────────
function AgendaView({ events }: { events: Ev[] }) {
  const groups = useMemo(() => {
    const m = new Map<string, Ev[]>()
    for (const e of events) { const a = m.get(e.date) ?? []; a.push(e); m.set(e.date, a) }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [events])
  if (groups.length === 0) return <p className="py-16 text-center text-sm text-muted-foreground">Aucun événement à venir.</p>
  return (
    <div className="space-y-4">
      {groups.map(([date, evs]) => (
        <div key={date}>
          <p className="mb-1.5 border-b border-border pb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{fmtLong(date)}</p>
          <EventList events={evs.slice().sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))} />
        </div>
      ))}
    </div>
  )
}

// ── Shared event list ───────────────────────────────────────────────────────
function EventList({ events, showDate }: { events: Ev[]; showDate?: boolean }) {
  return (
    <ol className="space-y-2">
      {events.map((e, i) => {
        const K = KINDS[e.kind]
        return (
          <li key={i}>
            <Link href={e.href} className="flex items-start gap-2.5 rounded-lg border border-border bg-background/50 p-2.5 transition-colors hover:border-brand-300">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${e.overdue ? 'bg-rose-500/10 text-rose-600' : K.iconBg}`}>
                <K.Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{e.title}</p>
                <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                  {showDate && <span>{fmt(e.date)}{e.end && e.end !== e.date ? ` → ${fmt(e.end)}` : ''}</span>}
                  {e.time && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{e.time}</span>}
                  {e.programmeName && <span className="inline-flex items-center gap-1"><FolderKanban className="h-3 w-3" />{e.programmeName}</span>}
                  {e.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{e.location}</span>}
                </div>
              </div>
              <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        )
      })}
    </ol>
  )
}

function fmt(d: string) {
  const [y, m, day] = d.split('-')
  return `${day} ${MONTHS[Number(m) - 1]?.slice(0, 4) ?? m} ${y}`
}
function fmtLong(d: string) {
  const dt = new Date(`${d}T00:00:00`)
  return `${WD[(dt.getDay() + 6) % 7]} ${dt.getDate()} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`
}
