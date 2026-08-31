'use client'
/**
 * Rich task detail for the front-office (porteur / collaborator / mentor).
 * Fetches the full task (steps · documents · activity log) and lets the actor:
 *   • tick off checklist steps,
 *   • UPLOAD deliverable documents (the "rendu") + add links,
 *   • submit the deliverable → status SUBMITTED,
 *   • read the reviewer's feedback and the full activity timeline,
 *   • drop a comment.
 * Replaces the old "link-only" submit form.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Target, CheckCircle2, Circle, Paperclip, Upload, Trash2, Send, Loader2, RotateCcw,
  Plus, MessageSquare, FileText, ExternalLink, History, Check,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { tasksApi, filesApi } from '@/lib/api'
import { formatDate } from '@/lib/utils'

type Att = { code: string; kind: string; url: string; name?: string; sizeBytes?: number; uploadedByName?: string; createdAt?: string }
type Step = { code: string; title: string; done: boolean; doneByName?: string; doneAt?: string }
type Log = { actorName?: string; action?: string; note?: string; at?: string }
type Detail = {
  id: number; status: string; description?: string; expectedDeliverable?: string
  submissionText?: string; submissionUrl?: string; submittedAt?: string; reviewNote?: string
  attachments?: Att[]; steps?: Step[]; activityLog?: Log[]
}

const humanSize = (n?: number) => !n ? '' : n < 1024 ? `${n} o` : n < 1048576 ? `${(n / 1024).toFixed(0)} Ko` : `${(n / 1048576).toFixed(1)} Mo`
const ACTION_LABEL: Record<string, string> = {
  CREATED: 'a créé la tâche', ASSIGNED: 'a assigné', STARTED: 'a démarré', STATUS: 'a changé le statut',
  STEP_ADDED: 'a ajouté une étape', STEP_DONE: 'a terminé une étape', STEP_REOPENED: 'a rouvert une étape',
  FILE_ADDED: 'a ajouté un document', SUBMITTED: 'a soumis le livrable', APPROVED: 'a approuvé',
  REVISION_REQUESTED: 'a demandé une révision', COMMENT: 'a commenté', COLLABORATOR: 'a ajouté un acteur',
}

export function TaskDetailPanel({ taskId, canEdit, onStatus }: {
  taskId: number; canEdit: boolean; onStatus?: (status: string) => void
}) {
  const [d, setD] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [subText, setSubText] = useState('')
  const [subUrl, setSubUrl] = useState('')
  const [newStep, setNewStep] = useState('')
  const [comment, setComment] = useState('')
  const [uploadPct, setUploadPct] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(() => {
    setLoading(true)
    tasksApi.detail(taskId)
      .then((r) => { setD(r.data); setSubText(r.data?.submissionText ?? ''); setSubUrl(r.data?.submissionUrl ?? '') })
      .catch(() => toast.error('Impossible de charger la tâche'))
      .finally(() => setLoading(false))
  }, [taskId])
  useEffect(() => { load() }, [load])

  const apply = (data: Detail) => { setD(data); onStatus?.(data.status) }

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    try {
      for (const file of Array.from(files)) {
        setUploadPct(0)
        const up = await filesApi.uploadDoc(file, 'task-docs', (p) => setUploadPct(p))
        const r = await tasksApi.addAttachment(taskId, { kind: 'SUBMISSION', url: up.url, name: up.filename || file.name, sizeBytes: file.size, contentType: file.type })
        apply(r.data)
      }
      toast.success('Document ajouté')
    } catch (e: any) { toast.error(e.response?.data?.message ?? 'Échec de l’envoi') }
    finally { setBusy(false); setUploadPct(null); if (fileRef.current) fileRef.current.value = '' }
  }
  const removeAtt = async (code: string) => {
    try { const r = await tasksApi.removeAttachment(taskId, code); apply(r.data) } catch { toast.error('Échec') }
  }
  const addLink = async () => {
    if (!subUrl.trim()) return
    setBusy(true)
    try { const r = await tasksApi.addAttachment(taskId, { kind: 'SUBMISSION', url: subUrl.trim(), name: subUrl.trim() }); apply(r.data); setSubUrl('') }
    catch { toast.error('Échec') } finally { setBusy(false) }
  }
  const toggleStep = async (s: Step) => {
    try { const r = await tasksApi.updateStep(taskId, s.code, { done: !s.done }); apply(r.data) } catch { toast.error('Échec') }
  }
  const addStep = async () => {
    if (!newStep.trim()) return
    try { const r = await tasksApi.addStep(taskId, newStep.trim()); apply(r.data); setNewStep('') } catch { toast.error('Échec') }
  }
  const removeStep = async (code: string) => {
    try { const r = await tasksApi.removeStep(taskId, code); apply(r.data) } catch { toast.error('Échec') }
  }
  const submit = async () => {
    const subDocs = (d?.attachments ?? []).filter((a) => a.kind === 'SUBMISSION')
    if (!subText.trim() && subDocs.length === 0) { toast.error('Ajoutez un document ou une description'); return }
    setBusy(true)
    try {
      const r = await tasksApi.submit(taskId, { submissionText: subText.trim() || undefined })
      apply(r.data); toast.success('Livrable soumis — en attente de validation')
    } catch (e: any) { toast.error(e.response?.data?.message ?? 'Échec de la soumission') }
    finally { setBusy(false) }
  }
  const postComment = async () => {
    if (!comment.trim()) return
    try { const r = await tasksApi.addComment(taskId, comment.trim()); setD(r.data); setComment('') } catch { toast.error('Échec') }
  }

  if (loading) return <div className="flex h-24 items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
  if (!d) return null

  const resources = (d.attachments ?? []).filter((a) => a.kind === 'RESOURCE')
  const submissionDocs = (d.attachments ?? []).filter((a) => a.kind === 'SUBMISSION')
  const steps = d.steps ?? []
  const doneSteps = steps.filter((s) => s.done).length
  const canSubmit = canEdit && (d.status === 'PENDING' || d.status === 'IN_PROGRESS')
  const input = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand-500'

  return (
    <div className="mt-3 space-y-4 border-t border-border pt-3">
      {d.expectedDeliverable && (
        <div className="flex items-start gap-1.5 rounded-lg bg-brand-500/5 px-3 py-2 text-xs text-foreground">
          <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" />
          <span><span className="font-semibold">À rendre : </span>{d.expectedDeliverable}</span>
        </div>
      )}
      {resources.length > 0 && (
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Ressources</p>
          <ul className="space-y-1">{resources.map((a) => <li key={a.code}><AttRow a={a} /></li>)}</ul>
        </div>
      )}

      {/* Checklist */}
      <div>
        <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          Étapes {steps.length > 0 && <span className="text-foreground">{doneSteps}/{steps.length}</span>}
        </p>
        {steps.length === 0 && !canEdit && <p className="text-xs italic text-muted-foreground">Aucune étape.</p>}
        <ul className="space-y-1">
          {steps.map((s) => (
            <li key={s.code} className="flex items-center gap-2 rounded-lg border border-border bg-background/50 px-2.5 py-1.5">
              <button onClick={() => canEdit && toggleStep(s)} disabled={!canEdit} className="shrink-0">
                {s.done ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
              </button>
              <span className={`flex-1 text-sm ${s.done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{s.title}</span>
              {canEdit && <button onClick={() => removeStep(s.code)} className="text-muted-foreground hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>}
            </li>
          ))}
        </ul>
        {canEdit && (
          <div className="mt-1.5 flex gap-2">
            <input value={newStep} onChange={(e) => setNewStep(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addStep() }}
              placeholder="Ajouter une étape…" className={input} />
            <button onClick={addStep} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 text-sm hover:bg-accent"><Plus className="h-4 w-4" /></button>
          </div>
        )}
      </div>

      {/* Documents (rendu) */}
      <div>
        <p className="mb-1.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          <span>Documents du livrable</span>
          {uploadPct != null && <span className="text-brand-600">{uploadPct}%</span>}
        </p>
        {submissionDocs.length === 0 ? (
          <p className="text-xs italic text-muted-foreground">Aucun document déposé.</p>
        ) : (
          <ul className="space-y-1">{submissionDocs.map((a) => <li key={a.code}><AttRow a={a} onRemove={canEdit ? () => removeAtt(a.code) : undefined} /></li>)}</ul>
        )}
        {canEdit && (
          <div className="mt-2 space-y-2">
            <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => uploadFiles(e.target.files)} />
            <div className="flex flex-wrap gap-2">
              <button onClick={() => fileRef.current?.click()} disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-brand-500/40 bg-brand-500/5 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-500/10 disabled:opacity-60 dark:text-brand-300">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}Téléverser un document
              </button>
              <div className="flex flex-1 gap-1.5">
                <input value={subUrl} onChange={(e) => setSubUrl(e.target.value)} placeholder="…ou coller un lien (Drive, Figma…)" className={input} />
                <button onClick={addLink} disabled={busy || !subUrl.trim()} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 text-sm hover:bg-accent disabled:opacity-50"><Plus className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Submission text + submit */}
      {canSubmit && (
        <div className="space-y-2 rounded-lg border border-brand-500/30 bg-brand-500/5 p-3">
          <textarea rows={2} value={subText} onChange={(e) => setSubText(e.target.value)} placeholder="Décrivez ce que vous avez fait (optionnel)…" className={input + ' resize-y'} />
          <button onClick={submit} disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-60">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}Soumettre le livrable
          </button>
        </div>
      )}
      {d.status === 'SUBMITTED' && <p className="rounded-lg bg-violet-500/10 px-3 py-2 text-[11px] italic text-violet-700 dark:text-violet-300">Livrable soumis — en attente de validation par l’équipe.</p>}
      {d.reviewNote && (d.status === 'IN_PROGRESS' || d.status === 'COMPLETED') && (
        <div className="flex items-start gap-1.5 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          {d.status === 'COMPLETED' ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <RotateCcw className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
          <span><span className="font-semibold">{d.status === 'COMPLETED' ? 'Validation : ' : 'Révision demandée : '}</span>{d.reviewNote}</span>
        </div>
      )}

      {/* Activity log */}
      <div>
        <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground"><History className="h-3.5 w-3.5" />Journal d’activité</p>
        <ol className="space-y-1.5">
          {(d.activityLog ?? []).slice().reverse().map((l, i) => (
            <li key={i} className="flex gap-2 text-xs">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
              <span className="text-muted-foreground">
                <span className="font-semibold text-foreground">{l.actorName}</span> {ACTION_LABEL[l.action ?? ''] ?? l.action}
                {l.note && <span> — {l.note}</span>}
                {l.at && <span className="ml-1 opacity-70">· {formatDate(l.at)}</span>}
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-2 flex gap-2">
          <input value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') postComment() }}
            placeholder="Écrire un commentaire…" className={input} />
          <button onClick={postComment} disabled={!comment.trim()} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 text-sm hover:bg-accent disabled:opacity-50"><MessageSquare className="h-4 w-4" /></button>
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
