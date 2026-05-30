'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Circle, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import { tasksApi } from '@/lib/api'
import { AppShell } from '@/components/layout/AppShell'
import { MagicCard } from '@/components/magicui/magic-card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, statusColor, priorityColor } from '@/lib/utils'
import type { Task, TaskStatus } from '@/types'

const statusIcons = { PENDING: Circle, IN_PROGRESS: Clock, COMPLETED: CheckCircle2, CANCELLED: Circle }
const statusColors = { PENDING: 'text-gray-500', IN_PROGRESS: 'text-blue-500', COMPLETED: 'text-emerald-500', CANCELLED: 'text-red-400' }
const statusLabels = { PENDING: 'À faire', IN_PROGRESS: 'En cours', COMPLETED: 'Terminée', CANCELLED: 'Annulée' }
const priorityLabel: Record<string, string> = { LOW: 'Basse', MEDIUM: 'Moyenne', HIGH: 'Haute', URGENT: 'Urgent' }

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'active' | 'all' | 'done'>('active')

  useEffect(() => {
    tasksApi.myTasks()
      .then((r) => setTasks(r.data?.content ?? r.data ?? []))
      .catch(() => toast.error('Impossible de charger les tâches'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = tasks.filter((t) => {
    if (filter === 'active') return t.status === 'PENDING' || t.status === 'IN_PROGRESS'
    if (filter === 'done') return t.status === 'COMPLETED'
    return true
  })

  const advance = async (t: Task) => {
    if (t.status === 'COMPLETED' || t.status === 'CANCELLED') return
    const next: Record<TaskStatus, TaskStatus> = { PENDING: 'IN_PROGRESS', IN_PROGRESS: 'COMPLETED', COMPLETED: 'COMPLETED', CANCELLED: 'CANCELLED' }
    try {
      await tasksApi.updateStatus(t.id, { status: next[t.status] })
      setTasks((prev) => prev.map((x) => x.id === t.id ? { ...x, status: next[x.status] } : x))
      toast.success(next[t.status] === 'COMPLETED' ? 'Tâche terminée ! 🎉' : 'Statut mis à jour')
    } catch { toast.error('Échec') }
  }

  const tabs = [
    { label: `Active (${tasks.filter(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS').length})`, value: 'active' as const },
    { label: `Toutes (${tasks.length})`, value: 'all' as const },
    { label: `Terminées (${tasks.filter(t => t.status === 'COMPLETED').length})`, value: 'done' as const },
  ]

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Mes Tâches</h1>
          <p className="text-muted-foreground">Cliquez sur l'icône pour avancer le statut</p>
        </motion.div>

        <div className="mb-5 flex gap-1 rounded-lg border border-border bg-muted p-1 w-fit">
          {tabs.map((tab) => (
            <button key={tab.value} onClick={() => setFilter(tab.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${filter === tab.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
        ) : (
          <div className="space-y-3">
            {filtered.map((t, i) => {
              const Icon = statusIcons[t.status]
              const canAdvance = t.status !== 'COMPLETED' && t.status !== 'CANCELLED'
              return (
                <motion.div key={t.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                  <MagicCard className="p-4">
                    <div className="flex items-start gap-3">
                      <button onClick={() => advance(t)} disabled={!canAdvance}
                        className={`mt-0.5 transition-transform ${canAdvance ? 'hover:scale-110' : 'opacity-50 cursor-default'}`}>
                        <Icon className={`h-5 w-5 ${statusColors[t.status]}`} />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm ${t.status === 'COMPLETED' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{t.title}</p>
                        {t.description && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{t.description}</p>}
                        <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
                          {t.programmeName && <span>{t.programmeName}</span>}
                          {t.dueDate && <span>· Échéance : {formatDate(t.dueDate)}</span>}
                          <span className={`font-medium ${priorityColor(t.priority)}`}>{priorityLabel[t.priority]}</span>
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${statusColor(t.status)}`}>
                        {statusLabels[t.status]}
                      </span>
                    </div>
                  </MagicCard>
                </motion.div>
              )
            })}
            {filtered.length === 0 && <div className="py-16 text-center text-muted-foreground">Aucune tâche ici</div>}
          </div>
        )}
      </div>
    </AppShell>
  )
}
