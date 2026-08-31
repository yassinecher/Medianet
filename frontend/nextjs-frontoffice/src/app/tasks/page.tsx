'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Circle, Clock, Send, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { tasksApi } from '@/lib/api'
import { AppShell } from '@/components/layout/AppShell'
import { MagicCard } from '@/components/magicui/magic-card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, statusColor, priorityColor } from '@/lib/utils'
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel'
import type { Task, TaskStatus } from '@/types'

const statusIcons = { PENDING: Circle, IN_PROGRESS: Clock, SUBMITTED: Send, COMPLETED: CheckCircle2, CANCELLED: Circle }
const statusColors = { PENDING: 'text-gray-500', IN_PROGRESS: 'text-blue-500', SUBMITTED: 'text-violet-500', COMPLETED: 'text-emerald-500', CANCELLED: 'text-red-400' }
const statusLabels = { PENDING: 'À faire', IN_PROGRESS: 'En cours', SUBMITTED: 'Soumise', COMPLETED: 'Terminée', CANCELLED: 'Annulée' }
const priorityLabel: Record<string, string> = { LOW: 'Basse', MEDIUM: 'Moyenne', HIGH: 'Haute', URGENT: 'Urgent' }

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'active' | 'all' | 'done'>('active')
  const [openId, setOpenId] = useState<number | null>(null)
  const [startingId, setStartingId] = useState<number | null>(null)

  useEffect(() => {
    tasksApi.myTasks()
      .then((r) => setTasks(r.data?.content ?? r.data ?? []))
      .catch(() => toast.error('Impossible de charger les tâches'))
      .finally(() => setLoading(false))
  }, [])

  const isActive = (s: TaskStatus) => s === 'PENDING' || s === 'IN_PROGRESS' || s === 'SUBMITTED'
  const filtered = tasks.filter((t) => {
    if (filter === 'active') return isActive(t.status)
    if (filter === 'done') return t.status === 'COMPLETED'
    return true
  })

  const setStatus = (id: number, status: TaskStatus) => setTasks((prev) => prev.map((x) => x.id === id ? { ...x, status } : x))

  const start = async (t: Task) => {
    setStartingId(t.id)
    try { await tasksApi.updateStatus(t.id, { status: 'IN_PROGRESS' }); setStatus(t.id, 'IN_PROGRESS'); setOpenId(t.id); toast.success('Tâche démarrée') }
    catch { toast.error('Échec') } finally { setStartingId(null) }
  }

  const tabs = [
    { label: `Actives (${tasks.filter(t => isActive(t.status)).length})`, value: 'active' as const },
    { label: `Toutes (${tasks.length})`, value: 'all' as const },
    { label: `Terminées (${tasks.filter(t => t.status === 'COMPLETED').length})`, value: 'done' as const },
  ]

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Mes Tâches</h1>
          <p className="text-muted-foreground">Ouvrez une tâche pour suivre les étapes, déposer vos documents et soumettre le livrable.</p>
        </motion.div>

        <div className="mb-5 flex w-fit gap-1 rounded-lg border border-border bg-muted p-1">
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
              const open = openId === t.id
              const editable = t.status === 'PENDING' || t.status === 'IN_PROGRESS' || t.status === 'SUBMITTED'
              return (
                <motion.div key={t.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                  <MagicCard className="p-4">
                    <div className="flex items-start gap-3">
                      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${statusColors[t.status]}`} />
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-semibold ${t.status === 'COMPLETED' ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{t.title}</p>
                        {t.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{t.description}</p>}
                        <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
                          {t.programmeName && <span>{t.programmeName}</span>}
                          {t.dueDate && <span>· Échéance : {formatDate(t.dueDate)}</span>}
                          <span className={`font-medium ${priorityColor(t.priority)}`}>{priorityLabel[t.priority]}</span>
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${statusColor(t.status)}`}>{statusLabels[t.status]}</span>
                    </div>

                    <div className="mt-2.5 flex gap-2">
                      {t.status === 'PENDING' && (
                        <button onClick={() => start(t)} disabled={startingId === t.id}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent disabled:opacity-60">
                          {startingId === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock className="h-3.5 w-3.5" />}Démarrer
                        </button>
                      )}
                      <button onClick={() => setOpenId(open ? null : t.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600">
                        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        {open ? 'Fermer' : editable ? 'Ouvrir & soumettre' : 'Voir le détail'}
                      </button>
                    </div>

                    {open && <TaskDetailPanel taskId={t.id} canEdit={editable} onStatus={(s) => setStatus(t.id, s as TaskStatus)} />}
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
