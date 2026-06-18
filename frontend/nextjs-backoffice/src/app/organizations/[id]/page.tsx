'use client'
/**
 * Admin organisation detail — a full management page for one organisation:
 * identity + map, KPIs, programme stats (its candidatures grouped by programme),
 * an activity history timeline, and the team members with all their data.
 * Reached from the organisations list (« Ouvrir la fiche »).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Building2, ArrowLeft, Loader2, Globe2, MapPin, Mail, Phone, Users, Linkedin,
  FileText, Trophy, CalendarRange, Calendar, Briefcase, History, ClipboardList, ExternalLink,
} from 'lucide-react'
import { organizationsApi, candidaturesApi } from '@/lib/api'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { MagicCard } from '@/components/magicui/magic-card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { statusColor, scoreColor, getInitials, formatDate } from '@/lib/utils'

const TYPE_LABEL: Record<string, string> = {
  STARTUP: 'Startup', INCUBATOR: 'Incubateur', UNIVERSITY: 'Université',
  ASSOCIATION: 'Association', SPONSOR: 'Sponsor', CORPORATE: 'Corporate',
  GOVERNMENT: 'Public', OTHER: 'Autre',
}
const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Soumise', UNDER_EVALUATION: 'En évaluation', ACCEPTED: 'Acceptée', REJECTED: 'Refusée',
}
const normalizeUrl = (u?: string) => (!u ? '' : /^https?:\/\//.test(u) ? u : `https://${u}`)
const MEMBER_TYPE_LABEL: Record<string, string> = { INTERNAL: 'Équipe interne', EXTERNAL: 'Externe / Conseil' }

interface Member {
  id: number; fullName: string; email?: string; phone?: string; userId?: number | null
  role?: string; responsibilities?: string; expertise?: string[]; type?: string
  avatarUrl?: string; headline?: string; linkedInUrl?: string
}
interface Org {
  id: number; name: string; type?: string; sector?: string; city?: string; country?: string
  address?: string; website?: string; logoUrl?: string; description?: string
  contactEmail?: string; contactPhone?: string; foundedYear?: number; employeeCount?: string
  createdByUserId?: number; createdAt?: string; members?: Member[]
}

function Kpi({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string | number; tone: string }) {
  return (
    <MagicCard className="p-4">
      <div className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${tone}`}><Icon className="h-4 w-4" /></div>
      <p className="mt-2 text-2xl font-extrabold text-foreground tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </MagicCard>
  )
}

export default function AdminOrganizationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = Number(Array.isArray(params.id) ? params.id[0] : params.id)

  const [org, setOrg] = useState<Org | null>(null)
  const [cands, setCands] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [o, all] = await Promise.allSettled([
        organizationsApi.get(id),
        candidaturesApi.all(),
      ])
      if (o.status === 'fulfilled') setOrg(o.value.data)
      else setError('Organisation introuvable.')
      if (all.status === 'fulfilled') {
        const list = all.value.data?.content ?? all.value.data ?? []
        setCands(list.filter((c: any) => Number(c.organizationId) === id))
      }
    } finally { setLoading(false) }
  }, [id])

  useEffect(() => { if (!isNaN(id)) load() }, [id, load])

  const members = org?.members ?? []

  // Programme stats — candidatures of this org grouped by programme.
  const progStats = useMemo(() => {
    const m = new Map<string, { name: string; total: number; accepted: number; evaluating: number; rejected: number; bestScore: number | null }>()
    for (const c of cands) {
      const key = String(c.programmeId ?? '—')
      const name = c.programmeName || `Programme ${c.programmeId ?? '?'}`
      const g = m.get(key) ?? { name, total: 0, accepted: 0, evaluating: 0, rejected: 0, bestScore: null }
      g.total++
      if (c.status === 'ACCEPTED') g.accepted++
      else if (c.status === 'REJECTED') g.rejected++
      else g.evaluating++
      if (c.totalScore != null) g.bestScore = Math.max(g.bestScore ?? 0, Number(c.totalScore))
      m.set(key, g)
    }
    return Array.from(m.values())
  }, [cands])

  // Activity history — built from available timestamps.
  const history = useMemo(() => {
    const ev: { ts: string; icon: any; label: string; tone: string }[] = []
    if (org?.createdAt) ev.push({ ts: org.createdAt, icon: Building2, label: `Organisation créée`, tone: 'text-brand-500' })
    for (const c of cands) {
      const proj = c.projectName || c.companyName || `Candidature #${c.id}`
      if (c.submittedAt) ev.push({ ts: c.submittedAt, icon: FileText, label: `Candidature « ${proj} » soumise${c.programmeName ? ` à ${c.programmeName}` : ''}`, tone: 'text-sky-500' })
      for (const e of c.evaluations ?? []) if (e.evaluatedAt) ev.push({ ts: e.evaluatedAt, icon: Trophy, label: `Évaluation de « ${proj} » par ${e.juryName || e.juryEmail || 'un jury'}${e.weightedScore != null ? ` — ${Number(e.weightedScore).toFixed(1)}/10` : ''}`, tone: 'text-amber-500' })
      if ((c.status === 'ACCEPTED' || c.status === 'REJECTED') && c.updatedAt)
        ev.push({ ts: c.updatedAt, icon: ClipboardList, label: `« ${proj} » ${c.status === 'ACCEPTED' ? 'acceptée' : 'refusée'}`, tone: c.status === 'ACCEPTED' ? 'text-emerald-500' : 'text-rose-500' })
    }
    return ev.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
  }, [org, cands])

  if (loading) {
    return <AdminLayout><div className="space-y-4"><Skeleton className="h-40 rounded-2xl" /><Skeleton className="h-32 rounded-2xl" /></div></AdminLayout>
  }
  if (error || !org) {
    return (
      <AdminLayout>
        <div className="py-20 text-center">
          <Building2 className="mx-auto h-10 w-10 text-muted-foreground opacity-30" />
          <p className="mt-3 text-sm text-muted-foreground">{error ?? 'Organisation introuvable.'}</p>
          <Link href="/organizations" className="mt-4 inline-block"><Button variant="brand">Organisations</Button></Link>
        </div>
      </AdminLayout>
    )
  }

  const headline = [org.sector, [org.city, org.country].filter(Boolean).join(', ')].filter(Boolean).join(' · ')
  const mapQuery = org.address || [org.city, org.country].filter(Boolean).join(', ')
  const accepted = cands.filter((c) => c.status === 'ACCEPTED').length
  const evaluating = cands.filter((c) => c.status !== 'ACCEPTED' && c.status !== 'REJECTED').length

  return (
    <AdminLayout>
      <div className="space-y-5">
        <button onClick={() => router.push('/organizations')} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Organisations
        </button>

        {/* Identity */}
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="h-24 bg-gradient-to-r from-brand-500 via-brand-600 to-purple-600" />
          <div className="px-5 pb-5">
            <div className="-mt-9 flex items-end gap-4">
              {org.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={org.logoUrl} alt={org.name} className="h-[72px] w-[72px] rounded-2xl object-cover border-4 border-card bg-card shadow-md" />
              ) : (
                <div className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl border-4 border-card bg-muted shadow-md"><Building2 className="h-8 w-8 text-muted-foreground" /></div>
              )}
            </div>
            <div className="mt-3">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-foreground">{org.name}</h1>
                <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:text-brand-300">{TYPE_LABEL[org.type ?? 'OTHER'] ?? org.type}</span>
              </div>
              {headline && <p className="mt-0.5 text-sm font-medium text-muted-foreground">{headline}</p>}
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {org.website && <a href={normalizeUrl(org.website)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-brand-600"><Globe2 className="h-3 w-3" />{org.website.replace(/^https?:\/\//, '')}</a>}
                {org.contactEmail && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{org.contactEmail}</span>}
                {org.contactPhone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{org.contactPhone}</span>}
                {org.foundedYear && <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />Fondée en {org.foundedYear}</span>}
                {org.employeeCount && <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{org.employeeCount} employés</span>}
              </div>
              {org.description && <p className="mt-3 text-sm text-muted-foreground whitespace-pre-wrap">{org.description}</p>}
            </div>
          </div>
        </motion.div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi icon={FileText} label="Candidatures" value={cands.length} tone="bg-brand-500/15 text-brand-600 dark:text-brand-400" />
          <Kpi icon={CalendarRange} label="Programmes" value={progStats.length} tone="bg-sky-500/15 text-sky-600 dark:text-sky-400" />
          <Kpi icon={Trophy} label="Acceptées" value={accepted} tone="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" />
          <Kpi icon={Users} label="Membres" value={members.length} tone="bg-purple-500/15 text-purple-600 dark:text-purple-400" />
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* Programme stats */}
          <MagicCard className="p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground"><CalendarRange className="h-4 w-4 text-brand-500" />Programmes & candidatures</h2>
            {progStats.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Cette organisation n&apos;a soumis aucune candidature.</p>
            ) : (
              <div className="space-y-2">
                {progStats.map((p, i) => (
                  <div key={i} className="rounded-xl border border-border bg-background/50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-foreground truncate">{p.name}</span>
                      {p.bestScore != null && <span className={`inline-flex items-center gap-1 text-xs font-bold ${scoreColor(p.bestScore)}`}><Trophy className="h-3 w-3" />{p.bestScore.toFixed(1)}</span>}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
                      <span className="rounded-full bg-muted px-2 py-0.5 font-semibold text-muted-foreground">{p.total} candidature(s)</span>
                      {p.accepted > 0 && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-700 dark:text-emerald-300">{p.accepted} acceptée(s)</span>}
                      {p.evaluating > 0 && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-semibold text-amber-700 dark:text-amber-300">{p.evaluating} en cours</span>}
                      {p.rejected > 0 && <span className="rounded-full bg-rose-500/15 px-2 py-0.5 font-semibold text-rose-700 dark:text-rose-300">{p.rejected} refusée(s)</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {/* Candidatures list (links to detail) */}
            {cands.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Toutes les candidatures</p>
                {cands.map((c) => (
                  <Link key={c.id} href={`/candidatures/${c.id}`} className="flex items-center gap-2 rounded-lg border border-border bg-background/50 px-2.5 py-1.5 hover:border-brand-400">
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">{c.projectName || c.companyName || `#${c.id}`}</span>
                    {c.totalScore != null && <span className={`text-[11px] font-bold ${scoreColor(Number(c.totalScore))}`}>{Number(c.totalScore).toFixed(1)}</span>}
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusColor(c.status ?? 'PENDING')}`}>{STATUS_LABEL[c.status ?? ''] ?? c.status}</span>
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            )}
          </MagicCard>

          {/* History */}
          <MagicCard className="p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground"><History className="h-4 w-4 text-brand-500" />Historique</h2>
            {history.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Aucune activité enregistrée.</p>
            ) : (
              <ol className="relative space-y-3 border-l border-border pl-4">
                {history.map((h, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[21px] top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-card ring-2 ring-border">
                      <h.icon className={`h-2.5 w-2.5 ${h.tone}`} />
                    </span>
                    <p className="text-xs text-foreground">{h.label}</p>
                    <p className="text-[10px] text-muted-foreground">{formatDate(h.ts)}</p>
                  </li>
                ))}
              </ol>
            )}
          </MagicCard>
        </div>

        {/* Members */}
        <MagicCard className="p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground"><Users className="h-4 w-4 text-brand-500" />Équipe<span className="text-xs font-normal text-muted-foreground">{members.length} membre(s)</span></h2>
          {members.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Aucun membre.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {members.map((m) => {
                const pending = !m.userId
                return (
                  <div key={m.id} className="rounded-xl border border-border bg-background/50 p-3">
                    <div className="flex items-start gap-3">
                      {m.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.avatarUrl} alt={m.fullName} className="h-11 w-11 shrink-0 rounded-full object-cover border border-border" />
                      ) : (
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-purple-600 text-xs font-bold text-white">{getInitials(m.fullName)}</div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-semibold text-foreground">{m.fullName}</span>
                          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{MEMBER_TYPE_LABEL[m.type ?? 'INTERNAL']}</span>
                          {pending && <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">Invitation en attente</span>}
                        </div>
                        {(m.headline || m.role) && <p className="text-xs text-muted-foreground">{m.headline || m.role}</p>}
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                          {m.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{m.email}</span>}
                          {m.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{m.phone}</span>}
                          {m.linkedInUrl && <a href={normalizeUrl(m.linkedInUrl)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-[#0a66c2]"><Linkedin className="h-3 w-3" />LinkedIn</a>}
                        </div>
                        {m.responsibilities && <p className="mt-1 text-[11px] text-muted-foreground">{m.responsibilities}</p>}
                        {(m.expertise?.length ?? 0) > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {m.expertise!.map((x) => <span key={x} className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] text-brand-700 dark:text-brand-300">{x}</span>)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </MagicCard>
      </div>
    </AdminLayout>
  )
}
