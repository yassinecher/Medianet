'use client'
/**
 * Rich admin/mentor task detail. Shows the porteur's deliverable (rendu) —
 * text + uploaded DOCUMENTS — for every status (not only SUBMITTED), lets the
 * reviewer approve / request changes, define the checklist, attach brief
 * resources, manage extra actors, and read/post to the activity log.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Target, CheckCircle2, Circle, Upload, Trash2, Send, Loader2, RotateCcw, Check, Plus,
  FileText, ExternalLink, History, MessageSquare, Users, X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { tasksApi, filesApi } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import type { User } from '@/types'

type Att = { code: string; kind: string; url: string; name?: string; sizeBytes?: number; uploadedByName?: string }
type Step = { code: string; title: string; done: boolean }
type Collab = { userId: number; name?: string; role?: string }
type Log = { actorName?: string; action?: string; note?: string; at?: string }
type Detail = {
  id: number; status: string; description?: string; expectedDeliverable?: string
  submissionText?: string; submittedAt?: string; reviewNote?: string
  attachments?: Att[]; steps?: Step[]; collaborators?: Collab[]; activityLog?: Log[]
}

const humanSize = (n?: number) => !n ? '' : n < 1024 ? `${n} o` : n < 1048576 ? `${(n / 1024).toFixed(0)} Ko` : `${(n / 1048576).toFixed(1)} Mo`
const ACTION_LABEL: Record<string, string> = {
  CREATED: 'a créé la tâche', STARTED: 'a démarré', STATUS: 'a changé le statut',
  STEP_ADDED: 'a ajouté une étape', STEP_DONE: 'a terminé une étape', STEP_REOPENED: 'a rouvert une étape',
  FILE_ADDED: 'a ajouté un document', SUBMITTED: 'a soumis le livrable', APPROVED: 'a approuvé',
  REVISION_REQUESTED: 'a demandé une révision', COMMENT: 'a commenté', COLLABORATOR: 'a ajouté un acteur',
}

export function TaskDetailAdmin({ taskId, users, onStatus }: {
  taskId: number; users: User[]; onStatus?: (status: string) => void
}) {
  const [d, setD] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [newStep, setNewStep] = useState('')
  const [comment, setComment] = useState('')
  const [collabId, setCollabId] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(() => {
    setLoading(true)
    tasksApi.detail(taskId).then((r) => setD(r.data)).catch(() => toast.error('Chargement impossible')).finally(() => setLoading(false))
  }, [taskId])
  useEffect(() => { load() }, [load])
  const apply = (data: Detail) => { setD(data); onStatus?.(data.status) }

  const review = async (approve: boolean) => {
    let reviewNote: string | undefined
    if (!approve) { const n = window.prompt('Que faut-il corriger ? (renvoyé au porteur)', ''); if (n === null) return; reviewNote = n.trim() || undefined }
    setBusy(true)
    try { const r = await tasksApi.review(taskId, { approve, reviewNote }); apply(r.data); toast.success(approve ? 'Approuvé — tâche terminée' : 'Renvoyé pour révision') }
    catch (e: any) { toast.error(e.response?.data?.message ?? 'Échec') } finally { setBusy(false) }
  }
  const uploadResource = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    try {
      for (const file of Array.from(files)) {
        const url = await filesApi.uploadAny(file, 'task-resources')
        const r = await tasksApi.addAttachment(taskId, { kind: 'RESOURCE', url, name: file.name, sizeBytes: file.size, contentType: file.type })
        setD(r.data)
      }
      toast.success('Ressource ajoutée')
    } catch (e: any) { toast.error(e.response?.data?.message ?? 'Échec') }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = '' }
  }
  const removeAtt = async (code: string) => { try { const r = await tasksApi.removeAttachment(taskId, code); setD(r.data) } catch { toast.error('Échec') } }
  const toggleStep = async (s: Step) => { try { const r = await tasksApi.updateStep(taskId, s.code, { done: !s.done }); setD(r.data) } catch { toast.error('Échec') } }
  const addStep = async () => { if (!newStep.trim()) return; try { const r = await tasksApi.addStep(taskId, newStep.trim()); setD(r.data); setNewStep('') } catch { toast.error('Échec') } }
  const removeStep = async (code: string) => { try { const r = await tasksApi.removeStep(taskId, code); setD(r.data) } catch { toast.error('Échec') } }
  const addCollab = async () => {
    if (!collabId) return
    const u = users.find((x) => String(x.id) === collabId)
    try { const r = await tasksApi.addCollaborator(taskId, { userId: Number(collabId), name: u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : undefined }); setD(r.data); setCollabId('') }
    catch { toast.error('Échec') }
  }
  const removeCollab = async (uid: number) => { try { const r = await tasksApi.removeCollaborator(taskId, uid); setD(r.data) } catch { toast.error('Échec') } }
  const postComment = async () => { if (!comment.trim()) return; try { const r = await tasksApi.addComment(taskId, comment.trim()); setD(r.data); setComment('') } catch { toast.error('Échec') } }

  if (loading) return <div className="flex h-20 items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
  if (!d) return null

  const resources = (d.attachments ?? []).filter((a) => a.kind === 'RESOURCE')
  const submissionDocs = (d.attachments ?? []).filter((a) => a.kind === 'SUBMISSION')
  const hasRendu = !!d.submissionText || submissionDocs.length > 0
  const steps = d.steps ?? []
  const doneSteps = steps.filter((s) => s.done).length
  const input = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring'

  return (
    <div className="mt-3 grid gap-4 border-t border-border pt-3 lg:grid-cols-2">
      {/* Left: brief + checklist + resources + actors */}
      <div className="space-y-3">
        {d.expectedDeliverable && (
          <div className="flex items-start gap-1.5 rounded-lg bg-brand-500/5 px-2.5 py-1.5 text-[11px] text-foreground">
            <Target className="mt-0.5 h-3 w-3 shrink-0 text-brand-500" />
            <span><span className="font-semibold">Attendu : </span>{d.expectedDeliverable}</span>
          </div>
        )}

        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Étapes {steps.length > 0 && <span className="text-foreground">{doneSteps}/{steps.length}</span>}</p>
          <ul className="space-y-1">
            {steps.map((s) => (
              <li key={s.code} className="flex items-center gap-2 rounded-lg border border-border bg-background/50 px-2.5 py-1.5">
                <button onClick={() => toggleStep(s)} className="shrink-0">{s.done ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Circle className="h-4 w-4 text-muted-foreground" />}</button>
                <span className={`flex-1 text-xs ${s.done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{s.title}</span>
                <button onClick={() => removeStep(s.code)} className="text-muted-foreground hover:text-rose-500"><Trash2 className="h-3 w-3" /></button>
              </li>
            ))}
          </ul>
          <div className="mt-1.5 flex gap-1.5">
            <input value={newStep} onChange={(e) => setNewStep(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addStep() }} placeholder="Ajouter une étape…" className={input} />
            <button onClick={addStep} className="rounded-lg border border-border px-2.5 hover:bg-accent"><Plus className="h-4 w-4" /></button>
          </div>
        </div>

        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Ressources (brief)</p>
          {resources.length > 0 && <ul className="mb-1.5 space-y-1">{resources.map((a) => <li key={a.code}><AttRow a={a} onRemove={() => removeAtt(a.code)} /></li>)}</ul>}
          <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => uploadResource(e.target.files)} />
          <button onClick={() => fileRef.current?.click()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold hover:bg-accent disabled:opacity-60">
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}Ajouter une ressource
          </button>
        </div>

        <div>
          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground"><Users className="h-3 w-3" />Acteurs</p>
          {(d.collaborators ?? []).length > 0 && (
            <div className="mb-1.5 flex flex-wrap gap-1.5">
              {(d.collaborators ?? []).map((c) => (
                <span key={c.userId} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground">
                  {c.name || `#${c.userId}`}<button onClick={() => removeCollab(c.userId)} className="text-muted-foreground hover:text-rose-500"><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-1.5">
            <select value={collabId} onChange={(e) => setCollabId(e.target.value)} className={input + ' h-9'}>
              <option value="">— Ajouter un acteur —</option>
              {users.map((u) => <option key={u.id} value={String(u.id)}>{u.firstName} {u.lastName}{u.role ? ` · ${u.role}` : ''}</option>)}
            </select>
            <button onClick={addCollab} disabled={!collabId} className="rounded-lg border border-border px-2.5 hover:bg-accent disabled:opacity-50"><Plus className="h-4 w-4" /></button>
          </div>
        </div>
      </div>

      {/* Right: the rendu + review + activity */}
      <div className="space-y-3">
        <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-2.5">
          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold text-violet-700 dark:text-violet-300">
            <Send className="h-3 w-3" />Livrable du porteur{d.submittedAt ? ` · ${formatDate(d.submittedAt)}` : ''}
          </p>
          {!hasRendu ? (
            <p className="text-[11px] italic text-muted-foreground">Aucun rendu déposé pour le moment.</p>
          ) : (
            <>
              {d.submissionText && <p className="mb-1.5 whitespace-pre-wrap text-xs text-foreground">{d.submissionText}</p>}
              <ul className="space-y-1">{submissionDocs.map((a) => <li key={a.code}><AttRow a={a} /></li>)}</ul>
            </>
          )}
          {d.status === 'SUBMITTED' && (
            <div className="mt-2 flex gap-2">
              <button onClick={() => review(true)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-60">
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}Approuver
              </button>
              <button onClick={() => review(false)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-accent disabled:opacity-60">
                <RotateCcw className="h-3 w-3" />Demander une révision
              </button>
            </div>
          )}
          {d.reviewNote && d.status !== 'SUBMITTED' && (
            <p className="mt-1.5 rounded-md bg-amber-500/10 px-2 py-1 text-[11px] text-amber-700 dark:text-amber-300">
              {d.status === 'COMPLETED' ? 'Validation : ' : 'Révision : '}{d.reviewNote}
            </p>
          )}
        </div>

        <div>
          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground"><History className="h-3 w-3" />Journal</p>
          <ol className="max-h-56 space-y-1 overflow-y-auto pr-1">
            {(d.activityLog ?? []).slice().reverse().map((l, i) => (
              <li key={i} className="flex gap-2 text-[11px]">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                <span className="text-muted-foreground"><span className="font-semibold text-foreground">{l.actorName}</span> {ACTION_LABEL[l.action ?? ''] ?? l.action}{l.note && <span> — {l.note}</span>}{l.at && <span className="ml-1 opacity-70">· {formatDate(l.at)}</span>}</span>
              </li>
            ))}
          </ol>
          <div className="mt-1.5 flex gap-1.5">
            <input value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') postComment() }} placeholder="Commentaire…" className={input} />
            <button onClick={postComment} disabled={!comment.trim()} className="rounded-lg border border-border px-2.5 hover:bg-accent disabled:opacity-50"><MessageSquare className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
    </div>
  )
}

function AttRow({ a, onRemove }: { a: Att; onRemove?: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-background/50 px-2.5 py-1.5">
      <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <a href={a.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">{a.name || a.url}</a>
      {a.sizeBytes ? <span className="shrink-0 text-[10px] text-muted-foreground">{humanSize(a.sizeBytes)}</span> : null}
      <a href={a.url} target="_blank" rel="noreferrer" className="shrink-0 text-muted-foreground hover:text-foreground"><ExternalLink className="h-3.5 w-3.5" /></a>
      {onRemove && <button onClick={onRemove} className="shrink-0 text-muted-foreground hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>}
    </div>
  )
}
