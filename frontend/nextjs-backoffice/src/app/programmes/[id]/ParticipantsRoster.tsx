'use client'
/**
 * « Startups incubées & référents » — the programme's participation roster.
 * Each accepted startup (synced from accepted candidatures) shows its porteur
 * and its assigned mentor (« vis-à-vis ») FOR THIS PROGRAMME. The admin assigns
 * a mentor per startup, with a best-fit ranking. This is the programme-scoped
 * replacement for the old org-global mentor.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Rocket, Handshake, Crown, Award, Search, X, Loader2, Repeat, Trash2, Mail, UserRound,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { participantsApi, usersApi } from '@/lib/api'
import { MagicCard } from '@/components/magicui/magic-card'
import { Button } from '@/components/ui/button'
import { getInitials } from '@/lib/utils'

type Any = Record<string, any>
const fullName = (u?: Any) => (u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email : '')
const STOP = new Set('les des une aux pour dans avec sur startup entreprise societe projet de la le du en au et un une par'.split(' '))
const toks = (s?: string) => (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w))

const STATUS: Record<string, { label: string; cls: string }> = {
  ACTIVE:    { label: 'Actif',    cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  ALUMNI:    { label: 'Alumni',   cls: 'bg-brand-500/15 text-brand-700 dark:text-brand-300' },
  WITHDRAWN: { label: 'Retiré',   cls: 'bg-rose-500/15 text-rose-700 dark:text-rose-300' },
}

export function ParticipantsRoster({ programmeId }: { programmeId: number }) {
  const [rows, setRows] = useState<Any[]>([])
  const [mentors, setMentors] = useState<Any[]>([])
  const [loading, setLoading] = useState(true)
  const [picking, setPicking] = useState<Any | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.allSettled([participantsApi.list(programmeId), usersApi.byRole('MENTOR')])
      .then(([p, m]) => {
        if (p.status === 'fulfilled') setRows(p.value.data ?? [])
        if (m.status === 'fulfilled') setMentors((m.value.data ?? []).filter((u: Any) => u.active !== false))
      })
      .finally(() => setLoading(false))
  }, [programmeId])
  useEffect(() => { load() }, [load])

  const mentorById = useMemo(() => {
    const map = new Map<number, Any>()
    mentors.forEach((m) => map.set(m.id, m))
    return map
  }, [mentors])

  const assign = async (participantId: number, mentorUserId: number | null) => {
    try {
      await participantsApi.assignMentor(participantId, mentorUserId)
      setRows((arr) => arr.map((r) => (r.id === participantId ? { ...r, mentorUserId } : r)))
      setPicking(null)
      toast.success(mentorUserId ? 'Référent assigné' : 'Référent retiré')
    } catch (e: any) { toast.error(e.response?.data?.message ?? 'Échec') }
  }
  const changeStatus = async (participantId: number, status: string) => {
    try {
      await participantsApi.setStatus(participantId, status)
      setRows((arr) => arr.map((r) => (r.id === participantId ? { ...r, status } : r)))
    } catch (e: any) { toast.error(e.response?.data?.message ?? 'Échec') }
  }

  return (
    <MagicCard className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Rocket className="h-4 w-4 text-brand-500" />Startups incubées &amp; référents
          {rows.length > 0 && <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-bold text-brand-700 dark:text-brand-300">{rows.length}</span>}
        </h2>
      </div>

      {loading ? (
        <div className="flex h-24 items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">
          Aucune startup incubée pour le moment. Le roster se remplit dès qu’une candidature est <b>acceptée</b>.
        </p>
      ) : (
        <div className="space-y-2.5">
          {rows.map((r) => {
            const mentor = r.mentorUserId ? mentorById.get(r.mentorUserId) : null
            const st = STATUS[r.status ?? 'ACTIVE'] ?? STATUS.ACTIVE
            return (
              <div key={r.id} className="rounded-xl border border-border bg-background/50 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  {/* Startup + porteur */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">{r.organizationName || `Organisation #${r.organizationId}`}</span>
                      <select value={r.status ?? 'ACTIVE'} onChange={(e) => changeStatus(r.id, e.target.value)}
                        className={`rounded-full border-0 px-2 py-0.5 text-[10px] font-semibold outline-none ${st.cls}`}>
                        {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </div>
                    {(r.porteurName || r.porteurEmail) && (
                      <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <UserRound className="h-3 w-3" />{r.porteurName || r.porteurEmail}
                        {r.porteurEmail && r.porteurName && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{r.porteurEmail}</span>}
                      </p>
                    )}
                  </div>

                  {/* Mentor / vis-à-vis */}
                  <div className="flex items-center gap-2">
                    {mentor ? (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-purple-500/10 px-2.5 py-1 text-xs font-semibold text-purple-700 dark:text-purple-300">
                        <Handshake className="h-3.5 w-3.5" />{fullName(mentor)}
                      </span>
                    ) : (
                      <span className="text-[11px] italic text-muted-foreground">Aucun référent</span>
                    )}
                    {mentor && (
                      <button onClick={() => assign(r.id, null)} className="text-muted-foreground hover:text-rose-500" title="Retirer"><Trash2 className="h-3.5 w-3.5" /></button>
                    )}
                    <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => setPicking(r)}>
                      <Repeat className="h-3 w-3" />{mentor ? 'Changer' : 'Assigner'}
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {picking && (
        <MentorPicker
          org={picking}
          mentors={mentors}
          currentId={picking.mentorUserId ?? null}
          onClose={() => setPicking(null)}
          onPick={(mentorId) => assign(picking.id, mentorId)}
        />
      )}
    </MagicCard>
  )
}

function MentorPicker({ org, mentors, currentId, onClose, onPick }: {
  org: Any; mentors: Any[]; currentId: number | null
  onClose: () => void; onPick: (mentorId: number) => void
}) {
  const [q, setQ] = useState('')
  const kw = useMemo(() => new Set(toks(org.organizationName)), [org.organizationName])

  const scored = useMemo(() => {
    const list = mentors.map((u) => {
      const mp = u.mentorProfile ?? {}
      const mt = new Set<string>([...toks((mp.expertise ?? []).join(' ')), ...toks((mp.specializations ?? []).join(' ')), ...toks(mp.title)])
      let s = 0; mt.forEach((t) => { if (kw.has(t)) s++ })
      return { u, s }
    })
    list.sort((a, b) => b.s - a.s || fullName(a.u).localeCompare(fullName(b.u)))
    return list
  }, [mentors, kw])
  const bestId = scored[0]?.s > 0 ? scored[0].u.id : null
  const filtered = scored.filter(({ u }) => !q || fullName(u).toLowerCase().includes(q.toLowerCase()) || (u.email ?? '').toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-bold text-foreground">Référent pour « {org.organizationName} »</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="border-b border-border p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un mentor…"
              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-500" />
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">Classés par correspondance avec la startup.</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="p-4 text-center text-xs text-muted-foreground">Aucun mentor trouvé.</p>
          ) : filtered.map(({ u, s }) => {
            const mp = u.mentorProfile ?? {}
            const isBest = u.id === bestId
            const isCurrent = u.id === currentId
            return (
              <button key={u.id} onClick={() => onPick(u.id)}
                className={`mb-1 flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors ${isCurrent ? 'border-brand-400 bg-brand-500/5' : 'border-transparent hover:border-border hover:bg-accent/50'}`}>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-500 text-[11px] font-bold text-white">{getInitials(fullName(u))}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-foreground">{fullName(u)}</span>
                    {isBest && <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-300"><Crown className="h-2.5 w-2.5" />Meilleure correspondance</span>}
                    {isCurrent && <span className="rounded-full bg-brand-500/15 px-1.5 py-0.5 text-[9px] font-bold text-brand-700 dark:text-brand-300">Actuel</span>}
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground">{mp.title || (mp.expertise ?? []).slice(0, 3).join(' · ') || u.email}</p>
                </div>
                {s > 0 && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600"><Award className="h-3 w-3" />{s}</span>}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
