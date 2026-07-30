'use client'
/**
 * Coaching panel on an organisation profile.
 *  • Plan — milestones (checklist) + overall notes, editable by the assigned
 *           mentor (or admin). The porteur sees it read-only.
 *  • Journal — a log of coaching / mentoring session notes.
 * Backed by /api/organizations/{id}/coaching. Renders nothing when there's no
 * content and the viewer can't edit (keeps non-coached orgs clean).
 */
import { useCallback, useEffect, useState } from 'react'
import {
  Target, Plus, Trash2, Loader2, CalendarDays, StickyNote, ArrowRight, Check, X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { coachingApi } from '@/lib/api'
import { formatDate } from '@/lib/utils'

type Milestone = { label: string; done: boolean; dueDate?: string }
type Note = { id: number; authorName?: string; sessionDate?: string; title?: string; content?: string; nextSteps?: string }
const todayISO = () => new Date().toISOString().slice(0, 10)

export function CoachingPanel({ orgId }: { orgId: number }) {
  const [loading, setLoading] = useState(true)
  const [canEdit, setCanEdit] = useState(false)
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [planNotes, setPlanNotes] = useState('')
  const [notes, setNotes] = useState<Note[]>([])
  const [hasPlan, setHasPlan] = useState(false)
  const [savingPlan, setSavingPlan] = useState(false)
  const [newMs, setNewMs] = useState('')
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [nf, setNf] = useState({ sessionDate: todayISO(), title: '', content: '', nextSteps: '' })

  const load = useCallback(() => {
    setLoading(true)
    coachingApi.get(orgId).then((r) => {
      const d = r.data ?? {}
      setCanEdit(!!d.canEdit)
      setNotes(d.notes ?? [])
      setPlanNotes(d.plan?.notes ?? '')
      setHasPlan(!!d.plan)
      let ms: Milestone[] = []
      try { ms = d.plan?.milestonesJson ? JSON.parse(d.plan.milestonesJson) : [] } catch { ms = [] }
      setMilestones(Array.isArray(ms) ? ms : [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [orgId])
  useEffect(() => { load() }, [load])

  const savePlan = async (ms: Milestone[], pnotes: string) => {
    setSavingPlan(true)
    try { await coachingApi.savePlan(orgId, { milestonesJson: JSON.stringify(ms), notes: pnotes }); setHasPlan(true) }
    catch (e: any) { toast.error(e.response?.data?.message ?? 'Échec de l’enregistrement') }
    finally { setSavingPlan(false) }
  }

  const toggleMs = (i: number) => { const next = milestones.map((m, j) => (j === i ? { ...m, done: !m.done } : m)); setMilestones(next); savePlan(next, planNotes) }
  const removeMs = (i: number) => { const next = milestones.filter((_, j) => j !== i); setMilestones(next); savePlan(next, planNotes) }
  const addMs = () => { if (!newMs.trim()) return; const next = [...milestones, { label: newMs.trim(), done: false }]; setMilestones(next); setNewMs(''); savePlan(next, planNotes) }

  const submitNote = async () => {
    if (!nf.title.trim() && !nf.content.trim()) { toast.error('Ajoutez un titre ou un contenu.'); return }
    setSavingNote(true)
    try {
      const r = await coachingApi.addNote(orgId, nf)
      setNotes((arr) => [r.data, ...arr])
      setNf({ sessionDate: todayISO(), title: '', content: '', nextSteps: '' })
      setShowNoteForm(false)
      toast.success('Note de séance ajoutée')
    } catch (e: any) { toast.error(e.response?.data?.message ?? 'Échec') }
    finally { setSavingNote(false) }
  }
  const removeNote = async (id: number) => {
    try { await coachingApi.deleteNote(orgId, id); setNotes((arr) => arr.filter((n) => n.id !== id)) }
    catch (e: any) { toast.error(e.response?.data?.message ?? 'Échec') }
  }

  if (loading) return null
  const hasContent = hasPlan || milestones.length > 0 || notes.length > 0 || !!planNotes
  if (!canEdit && !hasContent) return null

  const done = milestones.filter((m) => m.done).length
  const pct = milestones.length ? Math.round((done / milestones.length) * 100) : 0
  const input = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand-500'

  return (
    <div className="space-y-4">
      {/* ── Plan de coaching ── */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Target className="h-4 w-4 text-brand-500" />Plan de coaching
            {milestones.length > 0 && (
              <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-bold text-brand-700 dark:text-brand-300">{pct}%</span>
            )}
          </h2>
          {savingPlan && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        {milestones.length > 0 && (
          <>
            <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-purple-500 transition-all" style={{ width: `${Math.max(3, pct)}%` }} />
            </div>
            <ul className="space-y-1.5">
              {milestones.map((m, i) => (
                <li key={i} className="flex items-center gap-2.5 rounded-lg border border-border bg-background/50 px-3 py-2">
                  <button type="button" disabled={!canEdit} onClick={() => toggleMs(i)}
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${m.done ? 'border-emerald-500 bg-emerald-500' : 'border-border'} ${canEdit ? 'cursor-pointer' : 'cursor-default'}`}>
                    {m.done && <Check className="h-3 w-3 text-white" />}
                  </button>
                  <span className={`flex-1 text-sm ${m.done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{m.label}</span>
                  {canEdit && (
                    <button type="button" onClick={() => removeMs(i)} className="text-muted-foreground hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}

        {canEdit && (
          <div className="mt-2 flex gap-2">
            <input value={newMs} onChange={(e) => setNewMs(e.target.value)} placeholder="Ajouter un jalon (ex. : finaliser le business model)…"
              onKeyDown={(e) => { if (e.key === 'Enter') addMs() }} className={input} />
            <button type="button" onClick={addMs} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600">
              <Plus className="h-4 w-4" />
            </button>
          </div>
        )}
        {!canEdit && milestones.length === 0 && <p className="text-xs italic text-muted-foreground">Aucun jalon défini.</p>}

        {/* Overall notes */}
        <div className="mt-4">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Notes générales</p>
          {canEdit ? (
            <textarea value={planNotes} onChange={(e) => setPlanNotes(e.target.value)} onBlur={() => savePlan(milestones, planNotes)}
              rows={3} placeholder="Axes de travail, forces, points de vigilance…" className={input + ' resize-y'} />
          ) : (
            planNotes ? <p className="whitespace-pre-wrap text-sm text-muted-foreground">{planNotes}</p> : <p className="text-xs italic text-muted-foreground">—</p>
          )}
        </div>
      </div>

      {/* ── Journal de séances ── */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
            <StickyNote className="h-4 w-4 text-brand-500" />Journal de séances
            <span className="text-xs font-normal text-muted-foreground">{notes.length}</span>
          </h2>
          {canEdit && (
            <button type="button" onClick={() => setShowNoteForm((v) => !v)}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-accent">
              {showNoteForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}{showNoteForm ? 'Annuler' : 'Nouvelle note'}
            </button>
          )}
        </div>

        {showNoteForm && canEdit && (
          <div className="mb-4 space-y-2 rounded-xl border border-border bg-background/50 p-3">
            <div className="flex flex-wrap gap-2">
              <input type="date" value={nf.sessionDate} onChange={(e) => setNf({ ...nf, sessionDate: e.target.value })} className={input + ' sm:max-w-[180px]'} />
              <input value={nf.title} onChange={(e) => setNf({ ...nf, title: e.target.value })} placeholder="Titre de la séance" className={input + ' flex-1'} />
            </div>
            <textarea value={nf.content} onChange={(e) => setNf({ ...nf, content: e.target.value })} rows={3} placeholder="Compte-rendu de la séance…" className={input + ' resize-y'} />
            <textarea value={nf.nextSteps} onChange={(e) => setNf({ ...nf, nextSteps: e.target.value })} rows={2} placeholder="Prochaines actions (optionnel)…" className={input + ' resize-y'} />
            <div className="flex justify-end">
              <button type="button" onClick={submitNote} disabled={savingNote}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60">
                {savingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Enregistrer
              </button>
            </div>
          </div>
        )}

        {notes.length === 0 ? (
          <p className="text-xs italic text-muted-foreground">Aucune séance enregistrée pour le moment.</p>
        ) : (
          <ol className="space-y-3">
            {notes.map((n) => (
              <li key={n.id} className="rounded-xl border border-border bg-background/50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {n.sessionDate && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 dark:text-brand-400"><CalendarDays className="h-3 w-3" />{formatDate(n.sessionDate)}</span>}
                      {n.title && <span className="text-sm font-semibold text-foreground">{n.title}</span>}
                    </div>
                    {n.authorName && <p className="text-[11px] text-muted-foreground">par {n.authorName}</p>}
                  </div>
                  {canEdit && (
                    <button type="button" onClick={() => removeNote(n.id)} className="shrink-0 text-muted-foreground hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>
                  )}
                </div>
                {n.content && <p className="mt-1.5 whitespace-pre-wrap text-sm text-muted-foreground">{n.content}</p>}
                {n.nextSteps && (
                  <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-brand-500/5 px-2.5 py-1.5 text-xs text-brand-700 dark:text-brand-300">
                    <ArrowRight className="mt-0.5 h-3 w-3 shrink-0" /><span className="whitespace-pre-wrap">{n.nextSteps}</span>
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
