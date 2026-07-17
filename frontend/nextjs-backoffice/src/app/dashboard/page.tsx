'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import {
  FolderKanban, FileText, Users, TrendingUp, CheckSquare, CalendarClock,
  Presentation, ArrowRight, AlertTriangle, RefreshCw, ArrowUpRight, ArrowDownRight,
  Minus, Trophy, Video,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { MagicCard } from '@/components/magicui/magic-card'
import { NumberTicker } from '@/components/magicui/number-ticker'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { reportsApi, candidaturesApi, pitchApi, programmesApi } from '@/lib/api'
import { statusColor } from '@/lib/utils'

// Palette shared with /reports so the two pages read as one system.
const C = {
  brand: '#6366f1', purple: '#a855f7', green: '#22c55e', amber: '#f59e0b',
  red: '#ef4444', blue: '#3b82f6', slate: '#94a3b8', teal: '#14b8a6',
}
type Any = Record<string, any>

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-')
  return `${MONTHS[parseInt(m, 10) - 1]} ${y.slice(2)}`
}

const CAND_STATUS = {
  PENDING: { label: 'En attente', color: C.amber },
  UNDER_EVALUATION: { label: 'En évaluation', color: C.blue },
  ACCEPTED: { label: 'Acceptées', color: C.green },
  REJECTED: { label: 'Rejetées', color: C.red },
} as const

/** Dark-mode-safe tooltip (recharts' default is a white box). */
function ChartTip({ active, payload, label }: Any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs shadow-lg">
      {label != null && <p className="mb-0.5 font-medium text-foreground">{label}</p>}
      {payload.map((p: Any, i: number) => (
        <p key={i} className="flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.fill }} />
          {p.name}: <span className="font-semibold text-foreground">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

export default function AdminDashboardPage() {
  const [usersR, setUsersR] = useState<Any | null>(null)
  const [candR, setCandR] = useState<Any | null>(null)
  const [progR, setProgR] = useState<Any | null>(null)
  const [invR, setInvR] = useState<Any | null>(null)
  const [recent, setRecent] = useState<Any[]>([])
  const [pitch, setPitch] = useState<{ total: number; analyzed: number; avg: number | null; best: number | null; finals: number }>({ total: 0, analyzed: 0, avg: null, best: null, finals: 0 })
  const [loading, setLoading] = useState(true)
  const [months, setMonths] = useState<3 | 6 | 12>(6)

  const load = async () => {
    setLoading(true)
    // Aggregated server-side — the dashboard no longer pulls every row to count it.
    const res = await Promise.allSettled([
      reportsApi.users(), reportsApi.candidatures(), reportsApi.programmes(), reportsApi.invitations(),
      candidaturesApi.list(),
    ])
    const [u, c, p, i, cl] = res
    if (u.status === 'fulfilled') setUsersR(u.value.data)
    if (c.status === 'fulfilled') setCandR(c.value.data)
    if (p.status === 'fulfilled') setProgR(p.value.data)
    if (i.status === 'fulfilled') setInvR(i.value.data)
    if (cl.status === 'fulfilled') {
      const arr: Any[] = cl.value.data?.content ?? cl.value.data ?? []
      setRecent([...arr].sort((a, b) => (b.id ?? 0) - (a.id ?? 0)).slice(0, 6))
    }
    if (res.slice(0, 4).some((r) => r.status === 'rejected')) toast.error('Certains indicateurs sont indisponibles', { id: 'dash' })
    setLoading(false)

    // Pitch analytics across programmes — best-effort, never blocks the page.
    if (p.status === 'fulfilled') {
      const titles: Any = p.value.data?.programmeTitles ?? {}
      const ids = Object.keys(titles).map(Number)
      const subs = (await Promise.allSettled(ids.map((id) => pitchApi.list(id))))
        .flatMap((r) => (r.status === 'fulfilled' ? (r.value.data ?? []) : []))
      const scored = subs.filter((s: Any) => s.aiScore != null).map((s: Any) => s.aiScore as number)
      setPitch({
        total: subs.length,
        analyzed: scored.length,
        avg: scored.length ? Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 10) / 10 : null,
        best: scored.length ? Math.max(...scored) : null,
        finals: subs.filter((s: Any) => s.kind === 'FINAL').length,
      })
    }
  }
  useEffect(() => { load() }, [])

  // ── Time series: merge candidatures / signups / invitations by month ────────
  const activity = useMemo(() => {
    const keys = Object.keys(candR?.byMonth ?? usersR?.signupsByMonth ?? invR?.byMonth ?? {}).sort()
    return keys.slice(-months).map((k) => ({
      month: monthLabel(k),
      Candidatures: candR?.byMonth?.[k] ?? 0,
      Inscriptions: usersR?.signupsByMonth?.[k] ?? 0,
      Invitations: invR?.byMonth?.[k] ?? 0,
    }))
  }, [candR, usersR, invR, months])

  // Month-over-month deltas for the KPI arrows.
  const delta = (map?: Any) => {
    if (!map) return null
    const ks = Object.keys(map).sort()
    if (ks.length < 2) return null
    return (map[ks[ks.length - 1]] ?? 0) - (map[ks[ks.length - 2]] ?? 0)
  }

  const candByStatus = candR?.byStatus ?? {}
  const totalCand = candR?.total ?? 0
  const accepted = candByStatus.ACCEPTED ?? 0
  const acceptRate = totalCand ? Math.round((accepted / totalCand) * 100) : 0
  const pending = (candByStatus.PENDING ?? 0) + (candByStatus.UNDER_EVALUATION ?? 0)

  const statusData = Object.entries(CAND_STATUS)
    .map(([k, v]) => ({ name: v.label, value: candByStatus[k] ?? 0, color: v.color }))
    .filter((d) => d.value > 0)

  // Conversion funnel — where candidates drop off.
  const funnel = [
    { stage: 'Soumises', value: totalCand, color: C.slate },
    { stage: 'En évaluation', value: (candByStatus.UNDER_EVALUATION ?? 0) + accepted + (candByStatus.REJECTED ?? 0), color: C.blue },
    { stage: 'Acceptées', value: accepted, color: C.green },
  ]

  const roleData = (usersR?.roles ?? [])
    .filter((r: Any) => (r.userCount ?? 0) > 0)
    .sort((a: Any, b: Any) => b.userCount - a.userCount)
    .slice(0, 6)
    .map((r: Any) => ({ name: r.displayName ?? r.name, value: r.userCount }))

  const openProg = progR?.programmesByStatus?.OPEN ?? 0
  const inProgress = progR?.programmesByStatus?.IN_PROGRESS ?? 0
  const overdue = progR?.overdueTasks ?? 0
  const upcoming = progR?.upcomingSessions ?? 0

  const kpis = [
    {
      label: 'Programmes', value: progR?.totalProgrammes ?? 0,
      sub: `${openProg} ouvert${openProg > 1 ? 's' : ''} · ${inProgress} en cours`,
      icon: FolderKanban, color: C.brand, href: '/programmes',
    },
    {
      label: 'Candidatures', value: totalCand,
      sub: `${pending} à traiter`, delta: delta(candR?.byMonth),
      icon: FileText, color: C.purple, href: '/candidatures',
    },
    {
      label: 'Utilisateurs', value: usersR?.totalUsers ?? 0,
      sub: `${usersR?.activeUsers ?? 0} actifs`, delta: delta(usersR?.signupsByMonth),
      icon: Users, color: C.green, href: '/users',
    },
    {
      label: "Taux d'acceptation", value: acceptRate, suffix: '%',
      sub: `${accepted} accepté${accepted > 1 ? 's' : ''} sur ${totalCand}`,
      icon: TrendingUp, color: C.amber, href: '/reports',
    },
  ]

  return (
    <AdminLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Tableau de bord</h1>
            <p className="text-muted-foreground">Vue d’ensemble — Medianet Incubateur</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-border p-0.5">
              {([3, 6, 12] as const).map((m) => (
                <button key={m} onClick={() => setMonths(m)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    months === m ? 'bg-brand-500 text-white' : 'text-muted-foreground hover:bg-accent'}`}>
                  {m}m
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />Actualiser
            </Button>
          </div>
        </motion.div>

        {/* Alerts strip — only shows when something needs attention */}
        {!loading && (overdue > 0 || pending > 0) && (
          <div className="flex flex-wrap gap-2">
            {pending > 0 && (
              <Link href="/candidatures" className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-500/20 dark:text-amber-300">
                <FileText className="h-3.5 w-3.5" />{pending} candidature{pending > 1 ? 's' : ''} à traiter<ArrowRight className="h-3 w-3" />
              </Link>
            )}
            {overdue > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-300">
                <AlertTriangle className="h-3.5 w-3.5" />{overdue} tâche{overdue > 1 ? 's' : ''} en retard
              </span>
            )}
            {upcoming > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
                <CalendarClock className="h-3.5 w-3.5" />{upcoming} session{upcoming > 1 ? 's' : ''} à venir
              </span>
            )}
          </div>
        )}

        {/* KPI cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {loading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />) :
            kpis.map((k, i) => {
              const Icon = k.icon
              const d = (k as Any).delta as number | null | undefined
              const DeltaIcon = d == null ? null : d > 0 ? ArrowUpRight : d < 0 ? ArrowDownRight : Minus
              return (
                <motion.div key={k.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                  <Link href={k.href}>
                    <MagicCard className="p-5 transition-shadow hover:shadow-md">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0">
                          <p className="text-sm text-muted-foreground">{k.label}</p>
                          <p className="mt-1 text-3xl font-bold text-foreground">
                            <NumberTicker value={k.value} suffix={(k as Any).suffix ?? ''} />
                          </p>
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                            {DeltaIcon && d != null && (
                              <span className={`inline-flex items-center font-semibold ${d > 0 ? 'text-emerald-500' : d < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                                <DeltaIcon className="h-3 w-3" />{d > 0 ? '+' : ''}{d}
                              </span>
                            )}
                            <span className="truncate">{k.sub}</span>
                          </p>
                        </div>
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: `${k.color}1a` }}>
                          <Icon className="h-5 w-5" style={{ color: k.color }} />
                        </div>
                      </div>
                    </MagicCard>
                  </Link>
                </motion.div>
              )
            })
          }
        </div>

        {/* Activity trend + status */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Activité — {months} derniers mois</CardTitle></CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-56" /> : activity.length === 0 ? (
                <Empty>Pas encore d’activité mensuelle.</Empty>
              ) : (
                <ResponsiveContainer width="100%" height={230}>
                  <AreaChart data={activity} margin={{ left: -20, right: 8, top: 6 }}>
                    <defs>
                      {[['c', C.brand], ['u', C.green], ['i', C.purple]].map(([id, col]) => (
                        <linearGradient key={id} id={`g-${id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={col} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={col} stopOpacity={0} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<ChartTip />} />
                    <Area type="monotone" dataKey="Candidatures" stroke={C.brand} fill="url(#g-c)" strokeWidth={2} />
                    <Area type="monotone" dataKey="Inscriptions" stroke={C.green} fill="url(#g-u)" strokeWidth={2} />
                    <Area type="monotone" dataKey="Invitations" stroke={C.purple} fill="url(#g-i)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
              {!loading && activity.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                  <Legend color={C.brand} label="Candidatures" />
                  <Legend color={C.green} label="Inscriptions" />
                  <Legend color={C.purple} label="Invitations" />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Statuts des candidatures</CardTitle></CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-56" /> : statusData.length === 0 ? (
                <Empty>Aucune candidature.</Empty>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={170}>
                    <PieChart>
                      <Pie data={statusData} cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={3} dataKey="value">
                        {statusData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip content={<ChartTip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-1 grid grid-cols-2 gap-1 text-[11px]">
                    {statusData.map((d) => (
                      <span key={d.name} className="flex items-center gap-1.5 text-muted-foreground">
                        <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                        {d.name} <span className="ml-auto font-semibold text-foreground">{d.value}</span>
                      </span>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Funnel + roles + pitch */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader><CardTitle className="text-base">Entonnoir de sélection</CardTitle></CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-48" /> : totalCand === 0 ? <Empty>Aucune candidature.</Empty> : (
                <div className="space-y-2.5 pt-1">
                  {funnel.map((f, i) => {
                    const pctOfTop = funnel[0].value ? Math.round((f.value / funnel[0].value) * 100) : 0
                    return (
                      <div key={f.stage}>
                        <div className="mb-0.5 flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{f.stage}</span>
                          <span className="font-semibold text-foreground">{f.value} <span className="font-normal text-muted-foreground">({pctOfTop}%)</span></span>
                        </div>
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(2, pctOfTop)}%`, background: f.color }} />
                        </div>
                        {i < funnel.length - 1 && funnel[i].value > 0 && (
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            → {Math.round((funnel[i + 1].value / funnel[i].value) * 100)}% passent à l’étape suivante
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Répartition des rôles</CardTitle></CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-48" /> : roleData.length === 0 ? <Empty>Aucun utilisateur.</Empty> : (
                <ResponsiveContainer width="100%" height={190}>
                  <BarChart data={roleData} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <XAxis type="number" hide allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTip />} cursor={{ fill: 'hsl(var(--muted))' }} />
                    <Bar dataKey="value" fill={C.brand} radius={[0, 4, 4, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Pitch / presentation analytics — new to the dashboard */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5 text-base">
                <Presentation className="h-4 w-4 text-brand-500" />Pitchs vidéo
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-48" /> : pitch.total === 0 ? (
                <Empty>Aucune vidéo de pitch déposée.</Empty>
              ) : (
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-2 gap-2">
                    <MiniStat icon={<Video className="h-3.5 w-3.5" />} label="Vidéos" value={pitch.total} sub={`${pitch.analyzed} analysée${pitch.analyzed > 1 ? 's' : ''}`} />
                    <MiniStat icon={<Trophy className="h-3.5 w-3.5" />} label="Score moyen" value={pitch.avg ?? '—'} sub={pitch.avg != null ? '/ 10' : 'en attente'} tone={pitch.avg != null && pitch.avg >= 7 ? C.green : pitch.avg != null && pitch.avg >= 5 ? C.amber : C.red} />
                    <MiniStat icon={<Trophy className="h-3.5 w-3.5" />} label="Meilleur" value={pitch.best ?? '—'} sub={pitch.best != null ? '/ 10' : '—'} />
                    <MiniStat icon={<Presentation className="h-3.5 w-3.5" />} label="Pitchs finaux" value={pitch.finals} sub="déposés" />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Analyse IA de l’élocution, du contenu et de la présence sur chaque vidéo.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent candidatures */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Dernières candidatures</CardTitle>
            <Link href="/candidatures" className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">Tout voir</Link>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-40" /> : recent.length === 0 ? <Empty>Aucune candidature récente.</Empty> : (
              <div className="space-y-2">
                {recent.map((c) => (
                  <Link key={c.id} href={`/candidatures?id=${c.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 text-sm transition-colors hover:bg-accent/50">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{c.projectName || c.companyName || `Candidature #${c.id}`}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.porteurName || c.porteurEmail} · {c.programmeName ?? 'Sans programme'}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${statusColor(c.status)}`}>
                      {CAND_STATUS[c.status as keyof typeof CAND_STATUS]?.label ?? c.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: color }} />{label}</span>
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="flex h-40 items-center justify-center text-center text-xs text-muted-foreground">{children}</div>
}

function MiniStat({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: number | string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-border p-2">
      <p className="flex items-center gap-1 text-[10px] text-muted-foreground">{icon}{label}</p>
      <p className="text-lg font-bold tabular-nums" style={tone ? { color: tone } : undefined}>{value}</p>
      {sub && <p className="text-[9px] text-muted-foreground">{sub}</p>}
    </div>
  )
}
