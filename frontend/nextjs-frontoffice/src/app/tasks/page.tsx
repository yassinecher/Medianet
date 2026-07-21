'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Circle, Clock, Send, Target, Paperclip, RotateCcw, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { tasksApi } from '@/lib/api'
import { AppShell } from '@/components/layout/AppShell'
import { MagicCard } from '@/components/magicui/magic-card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, statusColor, priorityColor } from '@/lib/utils'
import type { Task, TaskStatus } from '@/types'

const statusIcons = { PENDING: Circle, IN_PROGRESS: Clock, SUBMITTED: Send, COMPLETED: CheckCircle2, CANCELLED: Circle }
const statusColors = { PENDING: 'text-gray-500', IN_PROGRESS: 'text-blue-500', SUBMITTED: 'text-violet-500', COMPLETED: 'text-emerald-500', CANCELLED: 'text-red-400' }
const statusLabels = { PENDING: 'À faire', IN_PROGRESS: 'En cours', SUBMITTED: 'Soumise', COMPLETED: 'Terminée', CANCELLED: 'Annulée' }
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

  const [submitFor, setSubmitFor] = useState<number | null>(null)
  const [subText, setSubText] = useState('')
  const [subUrl, setSubUrl] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)

  const isActive = (s: TaskStatus) => s === 'PENDING' || s === 'IN_PROGRESS' || s === 'SUBMITTED'
  const filtered = tasks.filter((t) => {
    if (filter === 'active') return isActive(t.status)
    if (filter === 'done') return t.status === 'COMPLETED'
    return true
  })

  /** PENDING → start (IN_PROGRESS). Other transitions go through the submit form. */
  const start = async (t: Task) => {
    try {
      await tasksApi.updateStatus(t.id, { status: 'IN_PROGRESS' })
      setTasks((prev) => prev.map((x) => x.id === t.id ? { ...x, status: 'IN_PROGRESS' } : x))
      toast.success('Tâche démarrée')
    } catch { toast.error('Échec') }
  }
  const openSubmit = (t: Task) => { setSubmitFor(t.id); setSubText(t.submissionText ?? ''); setSubUrl(t.submissionUrl ?? '') }
  const submit = async (t: Task) => {
    if (!subText.trim() && !subUrl.trim()) { toast.error('Ajoutez une description ou un lien'); return }
    setBusyId(t.id)
    try {
      const r = await tasksApi.submit(t.id, { submissionText: subText.trim() || undefined, submissionUrl: subUrl.trim() || undefined })
      setTasks((prev) => prev.map((x) => x.id === t.id ? (r.data ?? { ...x, status: 'SUBMITTED' }) : x))
      setSubmitFor(null); toast.success('Livrable soumis — en attente de validation 🎉')
    } catch { toast.error('Échec de la soumission') }
    finally { setBusyId(null) }
  }

  const tabs = [
    { label: `Active (${tasks.filter(t => isActive(t.status)).length})`, value: 'active' as const },
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
              const clickable = t.status === 'PENDING' || t.status === 'IN_PROGRESS'
              const onIcon = () => { if (t.status === 'PENDING') start(t); else if (t.status === 'IN_PROGRESS') openSubmit(t) }
              const formOpen = submitFor === t.id
              return (
                <motion.div key={t.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                  <MagicCard className="p-4">
                    <div className="flex items-start gap-3">
                      <button onClick={onIcon} disabled={!clickable}
                        title={t.status === 'PENDING' ? 'Démarrer' : t.status === 'IN_PROGRESS' ? 'Soumettre le livrable' : ''}
                        className={`mt-0.5 transition-transform ${clickable ? 'hover:scale-110' : 'opacity-70 cursor-default'}`}>
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

                    {/* What must be delivered */}
                    {t.expectedDeliverable && (
                      <div className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-brand-500/5 px-3 py-2 text-xs text-foreground">
                        <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" />
                        <span><span className="font-semibold">À rendre : </span>{t.expectedDeliverable}</span>
                      </div>
                    )}

                    {/* Changes requested by the reviewer */}
                    {t.status === 'IN_PROGRESS' && t.reviewNote && (
                      <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                        <RotateCcw className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span><span className="font-semibold">Révision demandée : </span>{t.reviewNote}</span>
                      </div>
                    )}

                    {/* Submitted / approved deliverable (read-only) */}
                    {(t.status === 'SUBMITTED' || t.status === 'COMPLETED') && (t.submissionText || t.submissionUrl) && (
                      <div className="mt-2 rounded-lg border border-border bg-muted/20 px-3 py-2">
                        <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                          <Send className="h-3 w-3" />Votre livrable{t.submittedAt ? ` · ${formatDate(t.submittedAt)}` : ''}
                        </p>
                        {t.submissionText && <p className="whitespace-pre-wrap text-xs text-foreground">{t.submissionText}</p>}
                        {t.submissionUrl && (
                          <a href={t.submissionUrl} target="_blank" rel="noreferrer"
                            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">
                            <Paperclip className="h-3 w-3" />{t.submissionUrl}
                          </a>
                        )}
                        {t.status === 'SUBMITTED' && <p className="mt-1 text-[11px] italic text-violet-600 dark:text-violet-400">En attente de validation par l’équipe.</p>}
                      </div>
                    )}

                    {/* Submit form (rendu) */}
                    {formOpen ? (
                      <div className="mt-2.5 space-y-2 rounded-lg border border-brand-500/30 bg-brand-500/5 p-3">
                        <p className="text-xs font-semibold text-foreground">Soumettre votre livrable</p>
                        <textarea rows={3} value={subText} onChange={(e) => setSubText(e.target.value)}
                          placeholder="Décrivez ce que vous avez fait…"
                          className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brand-500" />
                        <input value={subUrl} onChange={(e) => setSubUrl(e.target.value)} placeholder="Lien (Drive, Figma, PDF…) — optionnel"
                          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brand-500" />
                        <div className="flex gap-2">
                          <button onClick={() => submit(t)} disabled={busyId === t.id}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-60">
                            {busyId === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}Envoyer le livrable
                          </button>
                          <button onClick={() => setSubmitFor(null)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-accent">Annuler</button>
                        </div>
                      </div>
                    ) : (t.status === 'PENDING' || t.status === 'IN_PROGRESS') && (
                      <div className="mt-2.5 flex gap-2">
                        {t.status === 'PENDING' && (
                          <button onClick={() => start(t)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent">
                            <Clock className="h-3.5 w-3.5" />Démarrer
                          </button>
                        )}
                        <button onClick={() => openSubmit(t)} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600">
                          <Send className="h-3.5 w-3.5" />Soumettre le livrable
                        </button>
                      </div>
                    )}
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
