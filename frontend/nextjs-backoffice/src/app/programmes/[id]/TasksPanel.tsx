'use client'
/**
 * Programme dashboard → « Tâches » tab.
 *
 * The programme-scoped view of the shared Task module: list, create, reassign,
 * change status and delete the tasks attached to THIS programme. Powered by the
 * existing TaskController (/api/programmes/{id}/tasks + /api/tasks).
 */
import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2, CheckCircle2, Clock, Circle, Loader2, ClipboardList, X, Send, RotateCcw, Check, Paperclip, Target } from 'lucide-react'
import toast from 'react-hot-toast'
import { tasksApi, usersApi } from '@/lib/api'
import { performDelete } from '@/lib/deleteChoice'
import { MagicCard } from '@/components/magicui/magic-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/utils'
import type { User, Task } from '@/types'

const STATUSES = ['PENDING', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED', 'CANCELLED'] as const
type Status = typeof STATUSES[number]
const statusLabel: Record<string, string> = {
  PENDING: 'À faire', IN_PROGRESS: 'En cours', SUBMITTED: 'Soumise', COMPLETED: 'Terminée', CANCELLED: 'Annulée',
}
const statusColor: Record<string, string> = {
  PENDING: 'bg-muted text-muted-foreground',
  IN_PROGRESS: 'bg-amber-500/10 text-amber-600',
  SUBMITTED: 'bg-violet-500/10 text-violet-600',
  COMPLETED: 'bg-green-500/10 text-green-600',
  CANCELLED: 'bg-red-500/10 text-red-600',
}
const statusIcon = (s: string) =>
  s === 'COMPLETED' ? <CheckCircle2 className="h-4 w-4 text-green-500" />
    : s === 'SUBMITTED' ? <Send className="h-4 w-4 text-violet-500" />
    : s === 'IN_PROGRESS' ? <Clock className="h-4 w-4 text-amber-500" />
    : s === 'CANCELLED' ? <X className="h-4 w-4 text-red-500" />
    : <Circle className="h-4 w-4 text-muted-foreground" />

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const
const priorityLabel: Record<string, string> = { LOW: 'Basse', MEDIUM: 'Moyenne', HIGH: 'Haute', URGENT: 'Urgente' }

export function TasksPanel({ programmeId, programmeName }: { programmeId: number; programmeName?: string }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', expectedDeliverable: '', assignedToUserId: '', dueDate: '', priority: 'MEDIUM' as typeof PRIORITIES[number] })
  const u = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const reset = () => setForm({ title: '', description: '', expectedDeliverable: '', assignedToUserId: '', dueDate: '', priority: 'MEDIUM' })
  const [reviewingId, setReviewingId] = useState<number | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    tasksApi.byProgramme(programmeId)
      .then((r) => setTasks(r.data?.content ?? r.data ?? []))
      .catch(() => toast.error('Impossible de charger les tâches'))
      .finally(() => setLoading(false))
  }, [programmeId])
  useEffect(() => { load() }, [load])
  useEffect(() => { usersApi.list().then((r) => setUsers(r.data?.content ?? r.data ?? [])).catch(() => {}) }, [])

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) { toast.error('Le titre est requis'); return }
    if (!form.assignedToUserId) { toast.error('Assignez la tâche à quelqu’un'); return }
    setSaving(true)
    try {
      const assignee = users.find((x) => String(x.id) === form.assignedToUserId)
      const res = await tasksApi.create({
        programmeId, programmeName,
        assignedToUserId: Number(form.assignedToUserId),
        assignedToEmail: assignee?.email,
        assignedToName: assignee ? `${assignee.firstName ?? ''} ${assignee.lastName ?? ''}`.trim() : undefined,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        expectedDeliverable: form.expectedDeliverable.trim() || undefined,
        dueDate: form.dueDate || undefined,
        priority: form.priority,
      })
      setTasks((prev) => [res.data, ...prev])
      reset(); setShowForm(false); toast.success('Tâche créée')
    } catch (err: any) { toast.error(err.response?.data?.message ?? 'Erreur lors de la création') }
    finally { setSaving(false) }
  }

  const changeStatus = async (t: Task, status: Status) => {
    try {
      const res = await tasksApi.updateStatus(t.id, { status })
      setTasks((prev) => prev.map((x) => x.id === t.id ? res.data : x))
    } catch (err: any) { toast.error(err.response?.data?.message ?? 'Erreur') }
  }
  const review = async (t: Task, approve: boolean) => {
    let reviewNote: string | undefined
    if (!approve) {
      const note = window.prompt('Que faut-il corriger ? (renvoyé au porteur)', '')
      if (note === null) return
      reviewNote = note.trim() || undefined
    }
    setReviewingId(t.id)
    try {
      const res = await tasksApi.review(t.id, { approve, reviewNote })
      setTasks((prev) => prev.map((x) => x.id === t.id ? res.data : x))
      toast.success(approve ? 'Livrable approuvé — tâche terminée' : 'Renvoyé au porteur pour révision')
    } catch (err: any) { toast.error(err.response?.data?.message ?? 'Erreur') }
    finally { setReviewingId(null) }
  }
  const remove = async (id: number, title: string) => {
    const outcome = await performDelete('task', id, () => tasksApi.delete(id), { label: `la tâche « ${title} »` })
    if (!outcome) return
    setTasks((prev) => prev.filter((x) => x.id !== id))
    toast.success(outcome === 'purge' ? 'Tâche supprimée définitivement' : 'Tâche mise à la corbeille')
  }

  const filtered = tasks.filter((t) => statusFilter === 'ALL' || t.status === statusFilter)
  const counts = STATUSES.reduce((a, s) => ({ ...a, [s]: tasks.filter((t) => t.status === s).length }), {} as Record<string, number>)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ClipboardList className="h-4 w-4 text-brand-500" />Tâches du programme
          </h3>
          <p className="text-xs text-muted-foreground">
            {tasks.length} tâche(s) · {counts.COMPLETED ?? 0} terminée(s) · {counts.IN_PROGRESS ?? 0} en cours
          </p>
        </div>
        <Button variant="brand" size="sm" className="gap-1.5" onClick={() => setShowForm((v) => !v)}>
          {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}{showForm ? 'Fermer' : 'Nouvelle tâche'}
        </Button>
      </div>

      {showForm && (
        <MagicCard className="p-4">
          <form onSubmit={create} className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Titre <span className="text-red-500">*</span></label>
              <Input placeholder="Ex : Préparer le jury du Demo Day" value={form.title} onChange={(e) => u('title', e.target.value)} required />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Description</label>
              <textarea rows={2} value={form.description} onChange={(e) => u('description', e.target.value)}
                className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Détails (optionnel)" />
            </div>
            <div className="space-y-1">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Target className="h-3 w-3 text-brand-500" />Livrable attendu (rendu)
              </label>
              <textarea rows={2} value={form.expectedDeliverable} onChange={(e) => u('expectedDeliverable', e.target.value)}
                className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Ce que le porteur doit rendre (ex : business plan en PDF, lien vers la maquette…)" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Assigner à <span className="text-red-500">*</span></label>
                <select value={form.assignedToUserId} onChange={(e) => u('assignedToUserId', e.target.value)} required
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm">
                  <option value="">— Sélectionner —</option>
                  {users.map((usr) => <option key={usr.id} value={String(usr.id)}>{usr.firstName} {usr.lastName}{usr.role ? ` · ${usr.role}` : ''}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Échéance</label>
                <Input type="date" value={form.dueDate} onChange={(e) => u('dueDate', e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Priorité</label>
                <select value={form.priority} onChange={(e) => u('priority', e.target.value)}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm">
                  {PRIORITIES.map((p) => <option key={p} value={p}>{priorityLabel[p]}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" variant="brand" size="sm" disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}Créer
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => { setShowForm(false); reset() }}>Annuler</Button>
            </div>
          </form>
        </MagicCard>
      )}

      <div className="flex flex-wrap gap-1.5">
        {['ALL', ...STATUSES].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${statusFilter === s ? 'bg-brand-500 text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
            {s === 'ALL' ? `Toutes (${tasks.length})` : `${statusLabel[s]} (${counts[s] ?? 0})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border bg-muted/10 py-10 text-center text-sm text-muted-foreground">
          <ClipboardList className="mx-auto mb-2 h-8 w-8 opacity-30" />
          {tasks.length === 0 ? 'Aucune tâche pour ce programme.' : 'Aucune tâche dans ce filtre.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => (
            <MagicCard key={t.id} className="p-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{statusIcon(t.status)}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`text-sm font-medium ${t.status === 'COMPLETED' ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{t.title}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColor[t.status] ?? 'bg-muted text-muted-foreground'}`}>{statusLabel[t.status] ?? t.status}</span>
                    {t.priority && t.priority !== 'MEDIUM' && (
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                        t.priority === 'URGENT' ? 'bg-red-500/10 text-red-600'
                        : t.priority === 'HIGH' ? 'bg-orange-500/10 text-orange-600'
                        : 'bg-gray-500/10 text-gray-600'}`}>{priorityLabel[t.priority]}</span>
                    )}
                  </div>
                  {t.description && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{t.description}</p>}
                  <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                    {t.assignedToName && <span>→ {t.assignedToName}</span>}
                    {t.dueDate && <span>· échéance {formatDate(t.dueDate)}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <select value={t.status} onChange={(e) => changeStatus(t, e.target.value as Status)}
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs">
                    {STATUSES.map((s) => <option key={s} value={s}>{statusLabel[s]}</option>)}
                  </select>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => remove(t.id, t.title)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Expected deliverable (rendu) */}
              {t.expectedDeliverable && (
                <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-brand-500/5 px-2.5 py-1.5 text-[11px] text-foreground">
                  <Target className="mt-0.5 h-3 w-3 shrink-0 text-brand-500" />
                  <span><span className="font-semibold">Attendu : </span>{t.expectedDeliverable}</span>
                </div>
              )}

              {/* Changes requested — feedback sent back to the porteur */}
              {t.status === 'IN_PROGRESS' && t.reviewNote && (
                <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-700 dark:text-amber-300">
                  <RotateCcw className="mt-0.5 h-3 w-3 shrink-0" />
                  <span><span className="font-semibold">Révision demandée : </span>{t.reviewNote}</span>
                </div>
              )}

              {/* Submitted deliverable + review actions */}
              {t.status === 'SUBMITTED' && (
                <div className="mt-2 rounded-lg border border-violet-500/30 bg-violet-500/5 p-2.5">
                  <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold text-violet-700 dark:text-violet-300">
                    <Send className="h-3 w-3" />Livrable soumis{t.submittedAt ? ` · ${formatDate(t.submittedAt)}` : ''}
                  </p>
                  {t.submissionText && <p className="whitespace-pre-wrap text-xs text-foreground">{t.submissionText}</p>}
                  {t.submissionUrl && (
                    <a href={t.submissionUrl} target="_blank" rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">
                      <Paperclip className="h-3 w-3" />{t.submissionUrl}
                    </a>
                  )}
                  <div className="mt-2 flex gap-2">
                    <Button variant="brand" size="sm" className="h-7 gap-1.5 text-xs" disabled={reviewingId === t.id} onClick={() => review(t, true)}>
                      {reviewingId === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}Approuver
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" disabled={reviewingId === t.id} onClick={() => review(t, false)}>
                      <RotateCcw className="h-3 w-3" />Demander une révision
                    </Button>
                  </div>
                </div>
              )}
            </MagicCard>
          ))}
        </div>
      )}
    </div>
  )
}
