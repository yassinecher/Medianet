'use client'
/**
 * CandidaturesPanel — the « Candidatures » tab of a programme. It lays every
 * candidature out UNDER the candidature session (CANDIDATURE_SUBMISSION) it was
 * submitted to, so an admin processes intake session by session. From here you can:
 *   • assign / change a jury on a candidature (opens the review modal's jury tools);
 *   • accept or reject a candidature (the final admin decision) inline.
 * Per-session counters, a status filter and search sit on top. The heavy lifting
 * (jury e-mails, AI scoring, per-jury detail) is delegated to CandidatureReview.
 * All endpoints already exist (byProgramme / assign-jury / accept / reject) — this
 * is purely a new view over them.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Inbox, Users, CheckCircle2, XCircle, Search, Loader2, Star, Trophy,
  CalendarClock, ChevronDown, ChevronRight, Clock,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { candidaturesApi, programmesApi } from '@/lib/api'
import { CandidatureReview } from './CandidatureReview'
import { SectionHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { EmptyState } from '@/components/ui/states'
import { Input } from '@/components/ui/input'
import { statusColor, scoreColor, formatDate } from '@/lib/utils'
import { useCan } from '@/hooks/useCan'

const CAND_SESSION_TYPE = 'CANDIDATURE_SUBMISSION'
const OTHER = '__other__'

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'En attente', UNDER_EVALUATION: 'En évaluation', UNDER_REVIEW: 'En revue',
  ACCEPTED: 'Acceptée', REJECTED: 'Refusée',
}
const STATUS_OPTIONS = ['PENDING', 'UNDER_EVALUATION', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED']
/** Statuses that still await an admin decision. */
const OPEN_STATUSES = new Set(['PENDING', 'UNDER_EVALUATION', 'UNDER_REVIEW'])

interface Phase { id?: number; title?: string; sessionType?: string; startDate?: string; endDate?: string }
interface Criterion { id: number; name: string; weight?: number; active?: boolean; criterionOrder?: number }
interface Cand {
  id: number; phaseId?: number | null
  projectName?: string; companyName?: string; porteurName?: string; porteurEmail?: string
  sector?: string; status?: string; totalScore?: number
  evaluations?: any[]; juryAssignments?: any[]
}

const candLabel = (c: Cand) => c.projectName || c.companyName || `Candidature #${c.id}`

/** #assigned + #submitted jurys for a candidature. */
function juryInfo(c: Cand) {
  const assigns = c.juryAssignments ?? []
  const evals = c.evaluations ?? []
  const submitted = assigns.filter((a) => a.status === 'SUBMITTED'
    || evals.some((e) => (e.juryEmail || '').toLowerCase() === (a.juryEmail || '').toLowerCase())).length
  return { total: assigns.length, submitted }
}

export function CandidaturesPanel({ programmeId, phases = [], criteria: criteriaProp }: {
  programmeId: number
  phases?: Phase[]
  criteria?: Criterion[]
}) {
  const { can } = useCan()
  const canDecide = can('candidatures:update')

  const [cands, setCands] = useState<Cand[]>([])
  const [criteria, setCriteria] = useState<Criterion[]>(criteriaProp ?? [])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [reviewCand, setReviewCand] = useState<Cand | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const load = useCallback(() => {
    setLoading(true)
    Promise.allSettled([
      candidaturesApi.byProgramme(programmeId),
      programmesApi.criteria(programmeId),
    ]).then(([c, cr]) => {
      if (c.status === 'fulfilled') setCands(c.value.data ?? [])
      if (cr.status === 'fulfilled') setCriteria(cr.value.data ?? [])
    }).finally(() => setLoading(false))
  }, [programmeId])

  useEffect(() => { load() }, [load])

  // Candidature-intake sessions, in their programme order.
  const candSessions = useMemo(
    () => (phases ?? []).filter((p) => (p.sessionType ?? '') === CAND_SESSION_TYPE),
    [phases])

  const activeCriteria = useMemo(
    () => (criteria ?? []).filter((c) => c.active !== false)
      .sort((a, b) => (a.criterionOrder ?? 0) - (b.criterionOrder ?? 0)),
    [criteria])

  // KPIs over ALL candidatures (unaffected by the search/status filter).
  const kpis = useMemo(() => ({
    total: cands.length,
    open: cands.filter((c) => OPEN_STATUSES.has(c.status ?? 'PENDING')).length,
    accepted: cands.filter((c) => c.status === 'ACCEPTED').length,
    rejected: cands.filter((c) => c.status === 'REJECTED').length,
    noJury: cands.filter((c) => (c.juryAssignments ?? []).length === 0).length,
  }), [cands])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return cands.filter((c) => {
      if (statusFilter && (c.status ?? 'PENDING') !== statusFilter) return false
      if (!q) return true
      return [c.projectName, c.companyName, c.porteurName, c.porteurEmail, c.sector]
        .some((v) => (v ?? '').toLowerCase().includes(q))
    })
  }, [cands, search, statusFilter])

  // Group the (filtered) candidatures by their candidature session. Every
  // intake session gets a group even when empty; candidatures without a matching
  // intake session fall into a single "hors session" bucket shown last.
  const groups = useMemo(() => {
    const byId = new Map<number, Phase>()
    for (const s of candSessions) if (s.id != null) byId.set(s.id, s)
    const gmap = new Map<string, { key: string; session?: Phase; items: Cand[] }>()
    for (const s of candSessions) gmap.set(String(s.id), { key: String(s.id), session: s, items: [] })
    for (const c of filtered) {
      const sid = c.phaseId != null && byId.has(c.phaseId) ? String(c.phaseId) : OTHER
      if (!gmap.has(sid)) gmap.set(sid, { key: sid, session: byId.get(Number(sid)), items: [] })
      gmap.get(sid)!.items.push(c)
    }
    const arr = Array.from(gmap.values())
    arr.sort((a, b) => {
      if (a.key === OTHER) return 1
      if (b.key === OTHER) return -1
      return candSessions.findIndex((s) => String(s.id) === a.key)
        - candSessions.findIndex((s) => String(s.id) === b.key)
    })
    return arr
  }, [filtered, candSessions])

  const applyUpdate = (updated: Cand) =>
    setCands((prev) => prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)))

  const doAccept = async (c: Cand) => {
    if (!window.confirm(`Accepter « ${candLabel(c)} » ? Le porteur sera admis au programme.`)) return
    setBusyId(c.id)
    try {
      const r = await candidaturesApi.accept(c.id)
      applyUpdate(r.data ?? { ...c, status: 'ACCEPTED' })
      toast.success('Candidature acceptée')
    } catch (e: any) { toast.error(e?.response?.data?.message ?? "Échec de l'acceptation") }
    finally { setBusyId(null) }
  }

  const doReject = async (c: Cand) => {
    const reason = window.prompt(`Motif du refus de « ${candLabel(c)} » (optionnel) :`, '')
    if (reason === null) return // cancelled
    setBusyId(c.id)
    try {
      const r = await candidaturesApi.reject(c.id, reason.trim() || 'Non retenue')
      applyUpdate(r.data ?? { ...c, status: 'REJECTED' })
      toast.success('Candidature refusée')
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Échec du refus') }
    finally { setBusyId(null) }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
  }

  const sessionTitleFor = (c: Cand) =>
    candSessions.find((s) => s.id === c.phaseId)?.title

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Candidatures" value={kpis.total} icon={Inbox} tone="brand" />
        <StatCard label="À traiter" value={kpis.open} icon={Clock} tone="amber" hint="en attente de décision" />
        <StatCard label="Acceptées" value={kpis.accepted} icon={CheckCircle2} tone="emerald" />
        <StatCard label="Refusées" value={kpis.rejected} icon={XCircle} tone="rose" />
        <StatCard label="Sans jury" value={kpis.noJury} icon={Users} tone="sky" hint="jury à assigner" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Rechercher un projet, un porteur…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm">
          <option value="">Tous les statuts</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </div>

      {cands.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Aucune candidature pour ce programme"
          description="Les candidatures déposées via une session « Candidature » apparaîtront ici, regroupées par session."
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="Aucune candidature ne correspond" description="Ajustez la recherche ou le filtre de statut." compact />
      ) : (
        <div className="space-y-4">
          {groups.map((g) => {
            const isOther = g.key === OTHER
            const open = !collapsed[g.key]
            const decided = g.items.filter((c) => !OPEN_STATUSES.has(c.status ?? 'PENDING')).length
            return (
              <div key={g.key} className="rounded-2xl border border-border bg-card">
                {/* Session header */}
                <button onClick={() => setCollapsed((m) => ({ ...m, [g.key]: open }))}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  {open ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
                      <CalendarClock className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-foreground">
                        {isOther ? (candSessions.length ? 'Hors session de candidature' : 'Toutes les candidatures') : (g.session?.title || `Session #${g.key}`)}
                      </p>
                      {!isOther && (g.session?.startDate || g.session?.endDate) && (
                        <p className="text-[11px] text-muted-foreground">
                          {g.session?.startDate ? formatDate(g.session.startDate) : '—'}{g.session?.endDate ? ` → ${formatDate(g.session.endDate)}` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{g.items.length} candidature(s)</span>
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-600 dark:text-emerald-400">{decided} traitée(s)</span>
                  </div>
                </button>

                {open && (
                  <div className="border-t border-border">
                    {g.items.length === 0 ? (
                      <p className="px-4 py-6 text-center text-xs italic text-muted-foreground">Aucune candidature dans cette session.</p>
                    ) : (
                      <ul className="divide-y divide-border">
                        {g.items.map((c) => {
                          const ji = juryInfo(c)
                          const st = c.status ?? 'PENDING'
                          const busy = busyId === c.id
                          return (
                            <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <button onClick={() => setReviewCand(c)} className="truncate text-sm font-semibold text-foreground hover:text-brand-600">{candLabel(c)}</button>
                                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${statusColor(st)}`}>{STATUS_LABEL[st] ?? st}</span>
                                </div>
                                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                                  {c.porteurName || c.porteurEmail || '—'}{c.sector ? ` · ${c.sector}` : ''}
                                </p>
                              </div>

                              {/* score + jury */}
                              <div className="flex shrink-0 items-center gap-3">
                                {c.totalScore != null && (
                                  <span className={`inline-flex items-center gap-1 text-xs font-bold tabular-nums ${scoreColor(Number(c.totalScore))}`}>
                                    <Trophy className="h-3.5 w-3.5" />{Number(c.totalScore).toFixed(1)}
                                  </span>
                                )}
                                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground" title="Jurys ayant évalué / assignés">
                                  <Users className="h-3 w-3" />{ji.submitted}/{ji.total}
                                </span>
                              </div>

                              {/* actions */}
                              <div className="flex shrink-0 items-center gap-1">
                                <button onClick={() => setReviewCand(c)}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-brand-500/40 px-2.5 py-1.5 text-[11px] font-semibold text-brand-700 hover:bg-brand-500/10 dark:text-brand-300">
                                  <Users className="h-3.5 w-3.5" />Revue &amp; jury
                                </button>
                                {canDecide && (
                                  <>
                                    <button onClick={() => doAccept(c)} disabled={busy || st === 'ACCEPTED'} title="Accepter la candidature"
                                      className="rounded-lg border border-emerald-500/40 p-1.5 text-emerald-600 hover:bg-emerald-500/10 disabled:opacity-40 dark:text-emerald-400">
                                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                    </button>
                                    <button onClick={() => doReject(c)} disabled={busy || st === 'REJECTED'} title="Refuser la candidature"
                                      className="rounded-lg border border-rose-500/40 p-1.5 text-rose-600 hover:bg-rose-500/10 disabled:opacity-40 dark:text-rose-400">
                                      <XCircle className="h-3.5 w-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Full review modal — details + AI + jury assignment/evaluation */}
      {reviewCand && (
        <CandidatureReview
          candidature={reviewCand}
          criteria={activeCriteria}
          phaseId={reviewCand.phaseId ?? undefined}
          phaseTitle={sessionTitleFor(reviewCand)}
          onClose={() => setReviewCand(null)}
          onChanged={load}
        />
      )}
    </div>
  )
}
