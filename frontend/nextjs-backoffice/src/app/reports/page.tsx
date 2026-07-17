'use client'
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart3, Users, FolderKanban, FileText, Mail, RefreshCw, Download,
  TrendingUp, GraduationCap, AlertTriangle, CheckSquare,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from 'recharts'
import { reportsApi } from '@/lib/api'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { MagicCard } from '@/components/magicui/magic-card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

// ── Palette (works in light + dark) ──────────────────────────────────────────
const C = {
  brand: '#6366f1', purple: '#a855f7', green: '#22c55e', amber: '#f59e0b',
  red: '#ef4444', blue: '#3b82f6', slate: '#94a3b8', teal: '#14b8a6',
}
const STATUS_COLORS: Record<string, string> = {
  PENDING: C.amber, UNDER_EVALUATION: C.blue, ACCEPTED: C.green, REJECTED: C.red,
}
const STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente', UNDER_EVALUATION: 'En évaluation', ACCEPTED: 'Acceptées', REJECTED: 'Rejetées',
}
const TASK_LABELS: Record<string, string> = {
  PENDING: 'À faire', IN_PROGRESS: 'En cours', COMPLETED: 'Terminées', CANCELLED: 'Annulées',
}
const TASK_COLORS: Record<string, string> = {
  PENDING: C.slate, IN_PROGRESS: C.blue, COMPLETED: C.green, CANCELLED: C.red,
}

type AnyReport = Record<string, any>
const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-')
  const names = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
  return `${names[parseInt(m, 10) - 1]} ${y.slice(2)}`
}

export default function ReportsPage() {
  const [usersR, setUsersR] = useState<AnyReport | null>(null)
  const [candR, setCandR] = useState<AnyReport | null>(null)
  const [progR, setProgR] = useState<AnyReport | null>(null)
  const [invR, setInvR] = useState<AnyReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [months, setMonths] = useState<3 | 6 | 12>(6)

  const load = async () => {
    setLoading(true)
    const results = await Promise.allSettled([
      reportsApi.users(), reportsApi.candidatures(), reportsApi.programmes(), reportsApi.invitations(),
    ])
    const [u, c, p, i] = results
    if (u.status === 'fulfilled') setUsersR(u.value.data)
    if (c.status === 'fulfilled') setCandR(c.value.data)
    if (p.status === 'fulfilled') setProgR(p.value.data)
    if (i.status === 'fulfilled') setInvR(i.value.data)
    const failed = results.filter((r) => r.status === 'rejected').length
    if (failed > 0) toast.error(`${failed} rapport(s) indisponible(s)`, { id: 'reports-partial' })
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // ── Time series: merge the three byMonth maps, keep the selected window ────
  const activity = useMemo(() => {
    const keys = Object.keys(candR?.byMonth ?? usersR?.signupsByMonth ?? invR?.byMonth ?? {})
    return keys.slice(-months).map((k) => ({
      month: monthLabel(k),
      candidatures: candR?.byMonth?.[k] ?? 0,
      inscriptions: usersR?.signupsByMonth?.[k] ?? 0,
      invitations: invR?.byMonth?.[k] ?? 0,
    }))
  }, [candR, usersR, invR, months])

  const candStatus = useMemo(() =>
    Object.entries(candR?.byStatus ?? {}).map(([k, v]) => ({
      name: STATUS_LABELS[k] ?? k, value: Number(v), color: STATUS_COLORS[k] ?? C.slate,
    })).filter((d) => d.value > 0), [candR])

  const usersByRole = useMemo(() =>
    (usersR?.roles ?? []).map((r: AnyReport) => ({
      name: r.displayName ?? r.name, utilisateurs: Number(r.userCount), custom: !r.systemRole,
    })), [usersR])

  const sectors = useMemo(() =>
    Object.entries(candR?.topSectors ?? {}).map(([k, v]) => ({ name: k, candidatures: Number(v) })),
    [candR])

  const taskStatus = useMemo(() =>
    Object.entries(progR?.tasksByStatus ?? {}).map(([k, v]) => ({
      name: TASK_LABELS[k] ?? k, value: Number(v), color: TASK_COLORS[k] ?? C.slate,
    })).filter((d) => d.value > 0), [progR])

  const funnel = useMemo(() => {
    if (!invR) return []
    const total = Number(invR.total ?? 0)
    return [
      { label: 'Créées', value: total, color: C.slate },
      { label: 'Délivrées', value: Number(invR.delivered ?? 0), color: C.blue },
      { label: 'Répondues', value: Number(invR.answered ?? 0), color: C.purple },
      { label: 'Acceptées', value: Number(invR.accepted ?? 0), color: C.green },
    ].map((s) => ({ ...s, pct: total > 0 ? Math.round((s.value / total) * 100) : 0 }))
  }, [invR])

  const perProgramme = useMemo(() => {
    const titles: Record<string, string> = progR?.programmeTitles ?? {}
    return (candR?.perProgramme ?? []).map((row: AnyReport) => ({
      ...row,
      title: titles[String(row.programmeId)] ?? `Programme #${row.programmeId}`,
      acceptRate: (Number(row.accepted) + Number(row.rejected)) > 0
        ? Math.round(Number(row.accepted) * 100 / (Number(row.accepted) + Number(row.rejected)))
        : null,
    }))
  }, [candR, progR])

  const exportCsv = () => {
    const header = ['Programme', 'Total', 'En attente', 'En évaluation', 'Acceptées', 'Rejetées', 'Score moyen', "Taux d'acceptation (%)"]
    const rows = perProgramme.map((r: AnyReport) => [
      `"${String(r.title).replace(/"/g, '""')}"`, r.total, r.pending, r.under_evaluation,
      r.accepted, r.rejected, r.averageScore ?? '', r.acceptRate ?? '',
    ])
    const csv = [header.join(';'), ...rows.map((r: any[]) => r.join(';'))].join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `rapport-programmes-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const activeProgrammes =
    Number(progR?.programmesByStatus?.OPEN ?? 0) + Number(progR?.programmesByStatus?.IN_PROGRESS ?? 0)

  const kpis = [
    { icon: Users, label: 'Utilisateurs actifs', value: usersR ? `${usersR.activeUsers}/${usersR.totalUsers}` : '—',
      sub: usersR ? `${usersR.customRoles} rôle(s) personnalisé(s)` : '' },
    { icon: FolderKanban, label: 'Programmes actifs', value: progR ? `${activeProgrammes}/${progR.totalProgrammes}` : '—',
      sub: progR ? `${progR.upcomingSessions} session(s) à venir` : '' },
    { icon: FileText, label: 'Candidatures', value: candR?.total ?? '—',
      sub: candR?.acceptanceRate != null ? `${candR.acceptanceRate}% acceptées (décidées)` : 'aucune décision' },
    { icon: GraduationCap, label: 'Score moyen (jury)', value: candR?.averageScore ?? '—',
      sub: candR ? `${candR.evaluationsTotal} évaluation(s)` : '' },
    { icon: Mail, label: 'Invitations', value: invR?.total ?? '—',
      sub: invR?.acceptanceRate != null ? `${invR.acceptanceRate}% de réponses positives` : '' },
    { icon: AlertTriangle, label: 'Tâches en retard', value: progR?.overdueTasks ?? '—',
      sub: progR ? `sur ${progR.totalTasks} tâche(s)` : '', alert: Number(progR?.overdueTasks ?? 0) > 0 },
  ]

  const tooltipStyle = {
    backgroundColor: 'rgba(24,24,27,0.92)', border: 'none', borderRadius: 8,
    color: '#fff', fontSize: 12,
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-brand-500" />Rapports &amp; statistiques
            </h1>
            <p className="text-muted-foreground">Vue analytique : utilisateurs, programmes, candidatures et invitations</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-border p-0.5">
              {([3, 6, 12] as const).map((m) => (
                <button key={m} type="button" onClick={() => setMonths(m)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors
                    ${months === m ? 'bg-brand-500 text-white' : 'text-muted-foreground hover:text-foreground'}`}>
                  {m} mois
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCsv} disabled={perProgramme.length === 0}>
              <Download className="h-3.5 w-3.5" />Export CSV
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={load} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />Actualiser
            </Button>
          </div>
        </motion.div>

        {loading && !usersR ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}
            </div>
          </div>
        ) : (
          <>
            {/* KPI cards */}
            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
              {kpis.map((k, i) => {
                const Icon = k.icon
                return (
                  <motion.div key={k.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}>
                    <MagicCard className="p-4 h-full">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Icon className={`h-4 w-4 ${(k as any).alert ? 'text-red-500' : 'text-brand-500'}`} />
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{k.label}</p>
                      </div>
                      <p className={`text-2xl font-black tabular-nums ${(k as any).alert ? 'text-red-500' : 'text-foreground'}`}>
                        {String(k.value)}
                      </p>
                      {k.sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{k.sub}</p>}
                    </MagicCard>
                  </motion.div>
                )
              })}
            </div>

            {/* Charts row 1: activity + candidature status */}
            <div className="grid gap-4 lg:grid-cols-3">
              <MagicCard className="p-4 lg:col-span-2">
                <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <TrendingUp className="h-4 w-4 text-brand-500" />Activité ({months} derniers mois)
                </p>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={activity} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#8884" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#888" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#888" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="candidatures" name="Candidatures" stroke={C.brand} fill={C.brand} fillOpacity={0.25} strokeWidth={2} />
                    <Area type="monotone" dataKey="inscriptions" name="Inscriptions" stroke={C.green} fill={C.green} fillOpacity={0.18} strokeWidth={2} />
                    <Area type="monotone" dataKey="invitations" name="Invitations" stroke={C.purple} fill={C.purple} fillOpacity={0.15} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </MagicCard>

              <MagicCard className="p-4">
                <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <FileText className="h-4 w-4 text-brand-500" />Candidatures par statut
                </p>
                {candStatus.length === 0 ? (
                  <p className="py-16 text-center text-sm text-muted-foreground">Aucune candidature</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={candStatus} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                        {candStatus.map((d) => <Cell key={d.name} fill={d.color} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </MagicCard>
            </div>

            {/* Charts row 2: roles + sectors + funnel */}
            <div className="grid gap-4 lg:grid-cols-3">
              <MagicCard className="p-4">
                <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Users className="h-4 w-4 text-brand-500" />Utilisateurs par rôle
                </p>
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={usersByRole} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#8884" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#888" interval={0} angle={-18} textAnchor="end" height={44} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#888" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="utilisateurs" name="Utilisateurs" radius={[4, 4, 0, 0]}>
                      {usersByRole.map((d: AnyReport) => (
                        <Cell key={d.name} fill={d.custom ? C.teal : C.brand} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  <span className="inline-block h-2 w-2 rounded-full mr-1" style={{ background: C.teal }} />rôles personnalisés
                </p>
              </MagicCard>

              <MagicCard className="p-4">
                <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <FolderKanban className="h-4 w-4 text-brand-500" />Top secteurs (candidatures)
                </p>
                {sectors.length === 0 ? (
                  <p className="py-16 text-center text-sm text-muted-foreground">Aucune donnée secteur</p>
                ) : (
                  <ResponsiveContainer width="100%" height={230}>
                    <BarChart data={sectors} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#8884" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="#888" />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} stroke="#888" width={90} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="candidatures" name="Candidatures" fill={C.purple} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </MagicCard>

              <MagicCard className="p-4">
                <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Mail className="h-4 w-4 text-brand-500" />Entonnoir des invitations
                </p>
                <div className="space-y-3 pt-2">
                  {funnel.map((s) => (
                    <div key={s.label}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium text-foreground">{s.label}</span>
                        <span className="tabular-nums text-muted-foreground">{s.value} · {s.pct}%</span>
                      </div>
                      <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${s.pct}%`, background: s.color }} />
                      </div>
                    </div>
                  ))}
                  {Number(invR?.failed ?? 0) > 0 && (
                    <p className="flex items-center gap-1 text-[11px] text-red-500">
                      <AlertTriangle className="h-3 w-3" />{invR?.failed} envoi(s) en échec
                    </p>
                  )}
                </div>
              </MagicCard>
            </div>

            {/* Charts row 3: tasks + per-programme table */}
            <div className="grid gap-4 lg:grid-cols-3">
              <MagicCard className="p-4">
                <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <CheckSquare className="h-4 w-4 text-brand-500" />Tâches par statut
                </p>
                {taskStatus.length === 0 ? (
                  <p className="py-16 text-center text-sm text-muted-foreground">Aucune tâche</p>
                ) : (
                  <ResponsiveContainer width="100%" height={230}>
                    <PieChart>
                      <Pie data={taskStatus} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>
                        {taskStatus.map((d) => <Cell key={d.name} fill={d.color} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </MagicCard>

              <MagicCard className="p-4 lg:col-span-2">
                <div className="mb-3 flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <FolderKanban className="h-4 w-4 text-brand-500" />Détail par programme
                  </p>
                  <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={exportCsv} disabled={perProgramme.length === 0}>
                    <Download className="h-3 w-3" />CSV
                  </Button>
                </div>
                {perProgramme.length === 0 ? (
                  <p className="py-16 text-center text-sm text-muted-foreground">Aucune candidature rattachée à un programme</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/40 text-muted-foreground">
                          <th className="py-1.5 px-2 text-left font-medium">Programme</th>
                          <th className="py-1.5 px-2 font-medium">Total</th>
                          <th className="py-1.5 px-2 font-medium">En attente</th>
                          <th className="py-1.5 px-2 font-medium">En évaluation</th>
                          <th className="py-1.5 px-2 font-medium">Acceptées</th>
                          <th className="py-1.5 px-2 font-medium">Rejetées</th>
                          <th className="py-1.5 px-2 font-medium">Score moyen</th>
                          <th className="py-1.5 px-2 font-medium">Taux d&apos;accept.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {perProgramme.map((r: AnyReport) => (
                          <tr key={r.programmeId} className="border-t border-border/50">
                            <td className="py-1.5 px-2 font-medium text-foreground">{r.title}</td>
                            <td className="py-1.5 px-2 text-center tabular-nums font-semibold">{r.total}</td>
                            <td className="py-1.5 px-2 text-center tabular-nums" style={{ color: C.amber }}>{r.pending}</td>
                            <td className="py-1.5 px-2 text-center tabular-nums" style={{ color: C.blue }}>{r.under_evaluation}</td>
                            <td className="py-1.5 px-2 text-center tabular-nums" style={{ color: C.green }}>{r.accepted}</td>
                            <td className="py-1.5 px-2 text-center tabular-nums" style={{ color: C.red }}>{r.rejected}</td>
                            <td className="py-1.5 px-2 text-center tabular-nums">{r.averageScore ?? '—'}</td>
                            <td className="py-1.5 px-2 text-center tabular-nums">{r.acceptRate != null ? `${r.acceptRate}%` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </MagicCard>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  )
}
