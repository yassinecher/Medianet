'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts'
import { FolderKanban, FileText, Users, TrendingUp, Bot, CheckSquare, Sparkles } from 'lucide-react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { MagicCard } from '@/components/magicui/magic-card'
import { NumberTicker } from '@/components/magicui/number-ticker'
import { Globe } from '@/components/magicui/globe'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { programmesApi, candidaturesApi, tasksApi, usersApi } from '@/lib/api'
import { useUser } from '@/store/auth.store'
import { statusColor } from '@/lib/utils'
import type { Programme, Candidature, Task } from '@/types'

const COLORS = ['#6272f6', '#a78bfa', '#34d399', '#fbbf24', '#f87171']

const statusLabels: Record<string, string> = {
  PENDING: 'Soumises',
  UNDER_EVALUATION: 'En éval.',
  ACCEPTED: 'Acceptées',
  REJECTED: 'Refusées',
}

export default function AdminDashboardPage() {
  const user = useUser()
  const [programmes, setProgrammes] = useState<Programme[]>([])
  const [candidatures, setCandidatures] = useState<Candidature[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [userCount, setUserCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.allSettled([
      programmesApi.list().then((r) => setProgrammes(r.data?.content ?? r.data ?? [])),
      candidaturesApi.list().then((r) => setCandidatures(r.data?.content ?? r.data ?? [])),
      tasksApi.byProgramme(0).catch(() => null).then((r) => { if (r) setTasks(r.data?.content ?? r.data ?? []) }),
      usersApi.list().catch(() => null).then((r) => { if (r) setUserCount((r.data?.content ?? r.data ?? []).length) }),
    ]).finally(() => setLoading(false))
  }, [])

  const openProgrammes = programmes.filter((p) => p.status === 'OPEN').length
  const acceptedRate = candidatures.length ? Math.round((candidatures.filter((c) => c.status === 'ACCEPTED').length / candidatures.length) * 100) : 0

  const statusData = Object.entries(statusLabels).map(([k, name]) => ({
    name, value: candidatures.filter((c) => c.status === k).length,
  }))

  const programmeActivityData = programmes.slice(0, 6).map((p) => ({
    name: ((t) => t.length > 14 ? t.slice(0, 14) + '…' : t)(p.title ?? p.name ?? ''),
    candidatures: candidatures.filter((c) => c.programmeId === p.id).length,
  }))

  const stats = [
    { label: 'Programmes', value: programmes.length, sub: `${openProgrammes} ouverts`, icon: FolderKanban, color: 'text-brand-600 dark:text-brand-400', bg: 'bg-brand-500/10' },
    { label: 'Candidatures', value: candidatures.length, sub: `${acceptedRate}% acceptées`, icon: FileText, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-500/10' },
    { label: 'Utilisateurs', value: userCount || '—', sub: 'inscrits', icon: Users, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Taux d\'acceptation', value: acceptedRate, sub: 'des candidatures', icon: TrendingUp, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10', suffix: '%' },
  ]

  return (
    <AdminLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-foreground">Tableau de bord</h1>
          <p className="text-muted-foreground">Vue d'ensemble — Medianet Incubateur</p>
        </motion.div>

        {/* Stat cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {loading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />) :
            stats.map((s, i) => {
              const Icon = s.icon
              return (
                <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
                  <MagicCard className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">{s.label}</p>
                        <p className={`mt-1 text-3xl font-bold ${s.color}`}>
                          {typeof s.value === 'number' ? <NumberTicker value={s.value} suffix={(s as any).suffix ?? ''} /> : s.value}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{s.sub}</p>
                      </div>
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.bg}`}>
                        <Icon className={`h-5 w-5 ${s.color}`} />
                      </div>
                    </div>
                  </MagicCard>
                </motion.div>
              )
            })
          }
        </div>

        {/* Charts row */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Programme activity */}
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Candidatures par programme</CardTitle></CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-52" /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={programmeActivityData} barSize={30}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid hsl(var(--border))' }} />
                    <Bar dataKey="candidatures" fill="#6272f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Status pie */}
          <Card>
            <CardHeader><CardTitle>Statuts des candidatures</CardTitle></CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-52" /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={48} outerRadius={80} paddingAngle={3} dataKey="value">
                      {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid hsl(var(--border))' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Globe + recent */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="flex flex-col items-center justify-center overflow-hidden lg:col-span-1">
            <CardHeader className="w-full pb-2">
              <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-brand-500" />Présence mondiale</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Globe className="scale-[0.7]" />
            </CardContent>
          </Card>

          {/* Recent candidatures */}
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Dernières candidatures</CardTitle></CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-52" /> : (
                <div className="space-y-2">
                  {candidatures.slice(0, 5).map((c) => (
                    <div key={c.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm">
                      <div>
                        <p className="font-medium text-foreground">{c.projectName}</p>
                        <p className="text-xs text-muted-foreground">{c.porteurFirstName} {c.porteurLastName} · {c.programmeName ?? 'Sans programme'}</p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColor(c.status)}`}>
                        {statusLabels[c.status] ?? c.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  )
}
