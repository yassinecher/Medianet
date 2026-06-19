'use client'
import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Trash2, CheckCircle2, Clock, Circle, Loader2, ClipboardList, X, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { tasksApi, usersApi, programmesApi } from '@/lib/api'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { MagicCard } from '@/components/magicui/magic-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/utils'
import type { Programme, User, Task } from '@/types'

// Canonical statuses matching the backend TaskStatus enum.
const STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const
type Status = typeof STATUSES[number]

const statusLabel: Record<string, string> = {
  PENDING:     'À faire',
  IN_PROGRESS: 'En cours',
  COMPLETED:   'Terminée',
  CANCELLED:   'Annulée',
}
const statusColor: Record<string, string> = {
  PENDING:     'bg-muted text-muted-foreground',
  IN_PROGRESS: 'bg-amber-500/10 text-amber-600',
  COMPLETED:   'bg-green-500/10 text-green-600',
  CANCELLED:   'bg-red-500/10 text-red-600',
}

const statusIcon = (status: string) => {
  if (status === 'COMPLETED') return <CheckCircle2 className="h-4 w-4 text-green-500" />
  if (status === 'IN_PROGRESS') return <Clock className="h-4 w-4 text-amber-500" />
  if (status === 'CANCELLED') return <X className="h-4 w-4 text-red-500" />
  return <Circle className="h-4 w-4 text-muted-foreground" />
}

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const
const priorityLabel: Record<string, string> = {
  LOW: 'Basse', MEDIUM: 'Moyenne', HIGH: 'Haute', URGENT: 'Urgente',
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [programmes, setProgrammes] = useState<Programme[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: '', description: '',
    assignedToUserId: '', programmeId: '',
    dueDate: '', priority: 'MEDIUM' as typeof PRIORITIES[number],
  })

  const [formDataLoaded, setFormDataLoaded] = useState(false)

  // Only the task list blocks the initial render. Users + programmes are needed
  // exclusively by the create form, so they load lazily when it first opens —
  // the list no longer waits on the slowest of three calls.
  useEffect(() => {
    tasksApi.all()
      .then((r) => setTasks(r.data?.content ?? r.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const loadFormData = useCallback(() => {
    if (formDataLoaded) return
    setFormDataLoaded(true)
    usersApi.list().then((r) => setUsers(r.data?.content ?? r.data ?? [])).catch(() => {})
    programmesApi.list().then((r) => setProgrammes(r.data?.content ?? r.data ?? [])).catch(() => {})
  }, [formDataLoaded])

  const reset = () => setForm({
    title: '', description: '', assignedToUserId: '', programmeId: '',
    dueDate: '', priority: 'MEDIUM',
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    // Validation — these are required by the backend
    if (!form.title.trim()) { toast.error('Le titre est requis'); return }
    if (!form.programmeId)  { toast.error('Sélectionnez un programme'); return }
    if (!form.assignedToUserId) { toast.error("Sélectionnez la personne à qui assigner la tâche"); return }

    setSaving(true)
    try {
      const assignee = users.find((u) => String(u.id) === form.assignedToUserId)
      const payload = {
        programmeId: Number(form.programmeId),
        assignedToUserId: Number(form.assignedToUserId),
        assignedToEmail: assignee?.email,
        assignedToName: assignee ? `${assignee.firstName ?? ''} ${assignee.lastName ?? ''}`.trim() : undefined,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        dueDate: form.dueDate || undefined,
        priority: form.priority,
      }
      const res = await tasksApi.create(payload)
      setTasks((prev) => [res.data, ...prev])
      reset()
      setShowForm(false)
      toast.success('Tâche créée')
    } catch (err: any) {
      const msg = err.response?.data?.message ?? 'Erreur lors de la création'
      toast.error(msg)
    } finally { setSaving(false) }
  }

  const handleStatusChange = async (task: Task, newStatus: Status) => {
    try {
      const res = await tasksApi.updateStatus(task.id, { status: newStatus })
      setTasks((prev) => prev.map((t) => t.id === task.id ? res.data : t))
      toast.success('Statut mis à jour')
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Erreur')
    }
  }

  const handleDelete = async (id: number, title: string) => {
    if (!confirm(`Supprimer la tâche "${title}" ?`)) return
    try {
      await tasksApi.delete(id)
      setTasks((prev) => prev.filter((t) => t.id !== id))
      toast.success('Tâche supprimée')
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Erreur')
    }
  }

  const filtered = tasks.filter((t) => statusFilter === 'ALL' || t.status === statusFilter)

  const u = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <AdminLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <ClipboardList className="h-6 w-6 text-brand-500" />Tâches
            </h1>
            <p className="text-muted-foreground">{filtered.length} tâche(s)</p>
          </div>
          <Button variant="brand" onClick={() => { setShowForm(!showForm); loadFormData() }}>
            <Plus className="h-4 w-4" />Nouvelle tâche
          </Button>
        </motion.div>

        {/* Create form */}
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <MagicCard className="p-5">
              <h2 className="mb-4 font-semibold text-foreground">Créer une tâche</h2>
              <form onSubmit={handleCreate} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Titre *</label>
                  <Input placeholder="Ex: Préparer le pitch" value={form.title} onChange={(e) => u('title', e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Description</label>
                  <textarea
                    placeholder="Description (optionnel)"
                    value={form.description} onChange={(e) => u('description', e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Programme *</label>
                    <select value={form.programmeId} onChange={(e) => u('programmeId', e.target.value)} required
                      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <option value="">— Sélectionner —</option>
                      {programmes.map((p) => <option key={p.id} value={String(p.id)}>{p.title ?? p.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Assigner à *</label>
                    <select value={form.assignedToUserId} onChange={(e) => u('assignedToUserId', e.target.value)} required
                      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <option value="">— Sélectionner —</option>
                      {users.map((usr) => (
                        <option key={usr.id} value={String(usr.id)}>
                          {usr.firstName} {usr.lastName} {usr.role ? `· ${usr.role}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Échéance</label>
                    <Input type="date" value={form.dueDate} onChange={(e) => u('dueDate', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Priorité</label>
                    <select value={form.priority} onChange={(e) => u('priority', e.target.value)}
                      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      {PRIORITIES.map((p) => <option key={p} value={p}>{priorityLabel[p]}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" variant="brand" disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    {saving ? 'Création...' : 'Créer'}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => { setShowForm(false); reset() }}>Annuler</Button>
                </div>
              </form>
            </MagicCard>
          </motion.div>
        )}

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2">
          {['ALL', ...STATUSES].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${statusFilter === s ? 'bg-brand-500 text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
              {s === 'ALL' ? 'Toutes' : statusLabel[s]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>Aucune tâche</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((t, i) => (
              <motion.div key={t.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}>
                <MagicCard className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{statusIcon(t.status)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`font-medium ${t.status === 'COMPLETED' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                          {t.title}
                        </p>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[t.status] ?? 'bg-muted text-muted-foreground'}`}>
                          {statusLabel[t.status] ?? t.status}
                        </span>
                        {t.priority && t.priority !== 'MEDIUM' && (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase
                            ${t.priority === 'URGENT' ? 'bg-red-500/10 text-red-600' :
                              t.priority === 'HIGH' ? 'bg-orange-500/10 text-orange-600' :
                              'bg-gray-500/10 text-gray-600'}`}>
                            {priorityLabel[t.priority]}
                          </span>
                        )}
                      </div>
                      {t.description && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{t.description}</p>}
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {t.programmeName && <span>📦 {t.programmeName}</span>}
                        {(t.assignedToName || t.assignee) && (
                          <span>→ {t.assignedToName ?? `${t.assignee?.firstName} ${t.assignee?.lastName}`}</span>
                        )}
                        {t.dueDate && <span>· Échéance : {formatDate(t.dueDate)}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <select
                        value={t.status}
                        onChange={(e) => handleStatusChange(t, e.target.value as Status)}
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none">
                        {STATUSES.map((s) => <option key={s} value={s}>{statusLabel[s]}</option>)}
                      </select>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive h-8 w-8"
                        onClick={() => handleDelete(t.id, t.title)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </MagicCard>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
