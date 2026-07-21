'use client'
import { useEffect, useMemo, useState } from 'react'
import {
  FileText, GraduationCap, Mail, AlertTriangle, CalendarDays, RefreshCw, TrendingUp, CheckSquare,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from 'recharts'
import { reportsApi, candidaturesApi, sessionsApi, programmesApi } from '@/lib/api'
import { downloadScoresWorkbook, downloadApplicationsWorkbook, downloadScheduleWorkbook } from '@/lib/reports-excel'
import { FileSpreadsheet } from 'lucide-react'
import { MagicCard } from '@/components/magicui/magic-card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

const C = {
  brand: '#6366f1', purple: '#a855f7', green: '#22c55e', amber: '#f59e0b',
  red: '#ef4444', blue: '#3b82f6', slate: '#94a3b8',
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
const SESSION_LABELS: Record<string, string> = {
  UPCOMING: 'À venir', ACTIVE: 'Actives', COMPLETED: 'Terminées', CANCELLED: 'Annulées',
}

type AnyReport = Record<string, any>
const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-')
  const names = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
  return `${names[parseInt(m, 10) - 1]} ${y.slice(2)}`
}
const tooltipStyle = {
  backgroundColor: 'rgba(24,24,27,0.92)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12,
}

/** Programme-scoped analytics — rendered in the "Rapports" tab of a programme. */
export function ProgrammeReports({ programmeId, programmeName = 'Programme' }: { programmeId: number; programmeName?: string }) {
  const [cand, setCand] = useState<AnyReport | null>(null)
  const [prog, setProg] = useState<AnyReport | null>(null)
  const [inv, setInv] = useState<AnyReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState<'scores' | 'applications' | 'schedule' | null>(null)

  const arr = (r: any) => r?.data?.content ?? r?.data ?? []

  const exportScores = async () => {
    setExporting('scores')
    try {
      const [c, cr] = await Promise.all([candidaturesApi.byProgramme(programmeId), programmesApi.criteria(programmeId)])
      const list = arr(c)
      if (!list.length) { toast.error('Aucune candidature à exporter'); return }
      downloadScoresWorkbook(programmeName, list, arr(cr))
      toast.success('Export Excel — scores & sélection téléchargé')
    } catch { toast.error('Échec de l’export des scores') }
    finally { setExporting(null) }
  }
  const exportApplications = async () => {
    setExporting('applications')
    try {
      const [c, cr] = await Promise.all([candidaturesApi.byProgramme(programmeId), programmesApi.criteria(programmeId)])
      const list = arr(c)
      if (!list.length) { toast.error('Aucune candidature à exporter'); return }
      downloadApplicationsWorkbook(programmeName, list, arr(cr))
      toast.success('Export Excel — fiches projets & entretiens téléchargé')
    } catch { toast.error('Échec de l’export des fiches projets') }
    finally { setExporting(null) }
  }
  const exportSchedule = async () => {
    setExporting('schedule')
    try {
      const [s, c] = await Promise.all([sessionsApi.list(programmeId), candidaturesApi.byProgramme(programmeId)])
      const list = arr(s)
      if (!list.length) { toast.error('Aucune session à exporter'); return }
      downloadScheduleWorkbook(programmeName, list, arr(c))
      toast.success('Export Excel — programme workshops / conférences téléchargé')
    } catch { toast.error('Échec de l’export du programme') }
    finally { setExporting(null) }
  }

  const load = async () => {
    setLoading(true)
    const [c, p, i] = await Promise.allSettled([
      reportsApi.programmeCandidatures(programmeId),
      reportsApi.programmeSessions(programmeId),
      reportsApi.programmeInvitations(programmeId),
    ])
    if (c.status === 'fulfilled') setCand(c.value.data)
    if (p.status === 'fulfilled') setProg(p.value.data)
    if (i.status === 'fulfilled') setInv(i.value.data)
    if ([c, p, i].some((r) => r.status === 'rejected')) {
      toast.error('Certaines statistiques sont indisponibles', { id: 'prog-report-partial' })
    }
    setLoading(false)
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [programmeId])

  const candStatus = useMemo(() =>
    Object.entries(cand?.byStatus ?? {}).map(([k, v]) => ({
      name: STATUS_LABELS[k] ?? k, value: Number(v), color: STATUS_COLORS[k] ?? C.slate,
    })).filter((d) => d.value > 0), [cand])

  const submissions = useMemo(() =>
    Object.entries(cand?.byMonth ?? {}).map(([k, v]) => ({ month: monthLabel(k), candidatures: Number(v) })),
    [cand])

  const sessionBars = useMemo(() =>
    Object.entries(prog?.sessionsByStatus ?? {})
      .map(([k, v]) => ({ name: SESSION_LABELS[k] ?? k, sessions: Number(v) }))
      .filter((d) => d.sessions > 0), [prog])

  const taskBars = useMemo(() =>
    Object.entries(prog?.tasksByStatus ?? {})
      .map(([k, v]) => ({ name: TASK_LABELS[k] ?? k, taches: Number(v) }))
      .filter((d) => d.taches > 0), [prog])

  const funnel = useMemo(() => {
    if (!inv) return []
    const total = Number(inv.total ?? 0)
    return [
      { label: 'Créées', value: total, color: C.slate },
      { label: 'Délivrées', value: Number(inv.delivered ?? 0), color: C.blue },
      { label: 'Répondues', value: Number(inv.answered ?? 0), color: C.purple },
      { label: 'Acceptées', value: Number(inv.accepted ?? 0), color: C.green },
    ].map((s) => ({ ...s, pct: total > 0 ? Math.round((s.value / total) * 100) : 0 }))
  }, [inv])

  const kpis = [
    { icon: FileText, label: 'Candidatures', value: cand?.total ?? '—',
      sub: cand?.acceptanceRate != null ? `${cand.acceptanceRate}% acceptées (décidées)` : 'aucune décision' },
    { icon: GraduationCap, label: 'Score moyen (jury)', value: cand?.averageScore ?? '—',
      sub: cand ? `${cand.evaluationsTotal} évaluation(s)` : '' },
    { icon: CalendarDays, label: 'Sessions', value: prog?.totalSessions ?? '—',
      sub: prog ? `${prog.upcomingSessions} à venir` : '' },
    { icon: CheckSquare, label: 'Tâches', value: prog?.totalTasks ?? '—',
      sub: prog ? `${prog.overdueTasks} en retard` : '', alert: Number(prog?.overdueTasks ?? 0) > 0 },
    { icon: Mail, label: 'Invitations', value: inv?.total ?? '—',
      sub: inv?.acceptanceRate != null ? `${inv.acceptanceRate}% de réponses positives` : '' },
  ]

  if (loading && !cand) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="mr-auto text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Exports Excel</span>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={exportScores} disabled={!!exporting}
          title="Scores du jury par critère, un onglet par projet + synthèse & sélection (Excel)">
          <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
          {exporting === 'scores' ? 'Export…' : 'Scores & sélection'}
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={exportApplications} disabled={!!exporting}
          title="Fiches projets (formulaires) + liste des entretiens + grille de notation (Excel)">
          <FileSpreadsheet className="h-3.5 w-3.5 text-indigo-600" />
          {exporting === 'applications' ? 'Export…' : 'Fiches projets & entretiens'}
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={exportSchedule} disabled={!!exporting}
          title="Programme des conférences / workshops + startups accompagnées (Excel)">
          <FileSpreadsheet className="h-3.5 w-3.5 text-sky-600" />
          {exporting === 'schedule' ? 'Export…' : 'Workshops & conférences'}
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />Actualiser
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {kpis.map((k) => {
          const Icon = k.icon
          return (
            <MagicCard key={k.label} className="p-4">
              <div className="mb-1.5 flex items-center gap-2">
                <Icon className={`h-4 w-4 ${(k as any).alert ? 'text-red-500' : 'text-brand-500'}`} />
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{k.label}</p>
              </div>
              <p className={`text-2xl font-black tabular-nums ${(k as any).alert ? 'text-red-500' : 'text-foreground'}`}>
                {String(k.value)}
              </p>
              {k.sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{k.sub}</p>}
            </MagicCard>
          )
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Submissions timeline */}
        <MagicCard className="p-4">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <TrendingUp className="h-4 w-4 text-brand-500" />Candidatures reçues (12 mois)
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={submissions} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#8884" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="#888" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#888" />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="candidatures" name="Candidatures"
                stroke={C.brand} fill={C.brand} fillOpacity={0.25} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </MagicCard>

        {/* Status donut */}
        <MagicCard className="p-4">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <FileText className="h-4 w-4 text-brand-500" />Pipeline des candidatures
          </p>
          {candStatus.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">Aucune candidature pour ce programme</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={candStatus} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={3}>
                  {candStatus.map((d) => <Cell key={d.name} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </MagicCard>

        {/* Sessions + tasks */}
        <MagicCard className="p-4">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <CalendarDays className="h-4 w-4 text-brand-500" />Sessions &amp; tâches
          </p>
          {sessionBars.length === 0 && taskBars.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">Aucune session ni tâche</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={[...sessionBars.map((s) => ({ name: `S · ${s.name}`, valeur: s.sessions })),
                               ...taskBars.map((t) => ({ name: `T · ${t.name}`, valeur: t.taches }))]}
                margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#8884" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} stroke="#888" interval={0} angle={-18} textAnchor="end" height={48} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#888" />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="valeur" name="Total" radius={[4, 4, 0, 0]}>
                  {[...sessionBars.map(() => C.purple), ...taskBars.map(() => C.blue)].map((color, i) => (
                    <Cell key={i} fill={color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          <p className="mt-1 text-[10px] text-muted-foreground">S = sessions · T = tâches</p>
        </MagicCard>

        {/* Invitation funnel */}
        <MagicCard className="p-4">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Mail className="h-4 w-4 text-brand-500" />Invitations du programme
          </p>
          {Number(inv?.total ?? 0) === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">Aucune invitation pour ce programme</p>
          ) : (
            <div className="space-y-3 pt-2">
              {funnel.map((s) => (
                <div key={s.label}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">{s.label}</span>
                    <span className="tabular-nums text-muted-foreground">{s.value} · {s.pct}%</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full transition-all" style={{ width: `${s.pct}%`, background: s.color }} />
                  </div>
                </div>
              ))}
              {Number(inv?.failed ?? 0) > 0 && (
                <p className="flex items-center gap-1 text-[11px] text-red-500">
                  <AlertTriangle className="h-3 w-3" />{inv?.failed} envoi(s) en échec
                </p>
              )}
            </div>
          )}
        </MagicCard>
      </div>
    </div>
  )
}
