'use client'
/**
 * SessionNotifier — « Sessions à venir » panel on the programme hub.
 *
 * Lists upcoming top-level sessions with a recipient breakdown and, per session,
 * the reusable {@link SessionNotifyButton} (review-before-send modal + Google
 * Agenda). Candidatures + org members are loaded once here and shared with every
 * modal so opening one is instant.
 */
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarRange, Loader2, Users, Gavel, Rocket, Building2, UserPlus, MapPin, ExternalLink, BellRing } from 'lucide-react'
import { candidaturesApi, organizationsApi } from '@/lib/api'
import { MagicCard } from '@/components/magicui/magic-card'
import { formatDate } from '@/lib/utils'
import {
  SessionNotifyButton, gatherRecipients, SESSION_TYPE_LABEL,
  type Cand, type Member, type SessionLike,
} from './SessionNotify'

const toDate = (s?: string) => (s ? new Date(s + (s.length === 10 ? 'T00:00:00' : '')) : null)

export function SessionNotifier({ programmeId, programmeName, phases }: {
  programmeId: number
  programmeName: string
  phases: SessionLike[]
}) {
  const [cands, setCands] = useState<Cand[]>([])
  const [orgMembers, setOrgMembers] = useState<Record<number, Member[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    candidaturesApi.byProgramme(programmeId)
      .then(async (r) => {
        if (cancelled) return
        const list: Cand[] = r.data ?? []
        setCands(list)
        const orgIds = Array.from(new Set(list.map((c) => c.organizationId).filter((x): x is number => !!x)))
        const results = await Promise.allSettled(orgIds.map((id) => organizationsApi.get(id)))
        if (cancelled) return
        const map: Record<number, Member[]> = {}
        results.forEach((res, i) => { if (res.status === 'fulfilled') map[orgIds[i]] = res.value.data?.members ?? [] })
        setOrgMembers(map)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [programmeId])

  // Invitations are for concrete events → DAY sessions (journées) only.
  // Days ending today or later (à venir / en cours), earliest first; fall back
  // to all days when none are upcoming.
  const sessions = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const days = (phases ?? []).filter((p) => p.id && p.durationKind === 'day')
    const dated = days.slice().sort((a, b) => (toDate(a.startDate)?.getTime() ?? Infinity) - (toDate(b.startDate)?.getTime() ?? Infinity))
    const upcoming = dated.filter((p) => { const e = toDate(p.endDate ?? p.startDate); return !e || e >= today })
    return upcoming.length > 0 ? upcoming : dated
  }, [phases])

  if (loading) {
    return (
      <MagicCard className="p-5">
        <div className="flex items-center justify-center py-8 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      </MagicCard>
    )
  }

  return (
    <MagicCard className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold text-foreground">
          <BellRing className="h-4 w-4 text-brand-500" />Journées à venir — notifier les participants
        </h3>
        <Link href={`/programmes/${programmeId}/timeline`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400">
          <ExternalLink className="h-3.5 w-3.5" />Parcours
        </Link>
      </div>

      {sessions.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
          <CalendarRange className="h-8 w-8 text-muted-foreground opacity-30" />
          <p className="text-sm text-muted-foreground">Aucune session planifiée.</p>
          <Link href={`/programmes/${programmeId}/timeline`}
            className="rounded-md border border-brand-500/40 px-3 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-500/10">
            Créer des sessions dans le Parcours →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((p) => {
            const r = gatherRecipients(p, cands, orgMembers)
            const counts = {
              jurys: r.filter((x) => x.type === 'jury').length,
              porteurs: r.filter((x) => x.type === 'porteur').length,
              membres: r.filter((x) => x.type === 'member').length,
              organisateurs: r.filter((x) => x.type === 'organisateur').length,
              invites: r.filter((x) => x.type === 'invite').length,
            }
            return (
              <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">{p.title}</p>
                    <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-semibold text-brand-600 dark:text-brand-400">
                      {SESSION_TYPE_LABEL[p.sessionType ?? ''] ?? 'Session'}
                    </span>
                  </div>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                    {p.startDate && (
                      <span className="inline-flex items-center gap-1"><CalendarRange className="h-3 w-3" />
                        {formatDate(p.startDate)}{p.endDate && p.endDate !== p.startDate ? ` → ${formatDate(p.endDate)}` : ''}
                      </span>
                    )}
                    {p.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{p.location}</span>}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px]">
                    <Chip icon={Gavel} n={counts.jurys} label="jurys" tone="amber" />
                    <Chip icon={Rocket} n={counts.porteurs} label="porteurs" tone="sky" />
                    <Chip icon={Building2} n={counts.membres} label="membres" tone="emerald" />
                    <Chip icon={Users} n={counts.organisateurs} label="organisateurs" tone="violet" />
                    <Chip icon={UserPlus} n={counts.invites} label="invités" tone="rose" />
                  </div>
                </div>
                <SessionNotifyButton
                  programmeId={programmeId} programmeName={programmeName} session={p}
                  cands={cands} orgMembers={orgMembers} />
              </div>
            )
          })}
        </div>
      )}
    </MagicCard>
  )
}

const TONES: Record<string, string> = {
  violet: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
  amber: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  sky: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  emerald: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  rose: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
}
function Chip({ icon: Icon, n, label, tone }: { icon: any; n: number; label: string; tone: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${n > 0 ? TONES[tone] : 'bg-muted/40 text-muted-foreground'}`}>
      <Icon className="h-3 w-3" />{n} {label}
    </span>
  )
}
