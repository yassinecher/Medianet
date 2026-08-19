'use client'
/**
 * « Ateliers » — workshops held for SPECIFIC incubated startups within the
 * programme, optionally attached to a session. Each target startup brings its
 * assigned mentor automatically. Admin creates / edits / deletes them; they
 * surface on the targeted porteurs' and mentors' shared calendars.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Presentation, Plus, X, Loader2, Trash2, Pencil, CalendarClock, MapPin, Users,
  Handshake, UserRound, AlertTriangle, Building2, Clock,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { workshopsApi, participantsApi, programmesApi, type WorkshopPayload } from '@/lib/api'
import { MagicCard } from '@/components/magicui/magic-card'
import { Button } from '@/components/ui/button'

type Any = Record<string, any>
const fmtDate = (d?: string) => {
  if (!d) return 'Date à définir'
  const [y, m, day] = d.slice(0, 10).split('-')
  const MO = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
  return `${day} ${MO[Number(m) - 1] ?? m} ${y}`
}
const EMPTY: WorkshopPayload = { title: '', description: '', format: 'Atelier', status: 'PLANNED', phaseId: null, workshopDate: '', startTime: '', endTime: '', location: '', facilitator: '', targetParticipantIds: [] }
const FORMATS = ['Atelier', 'Formation', 'Masterclass', 'Bootcamp', 'Mentorat collectif', 'Séance de travail']
const STATUS: Record<string, { label: string; cls: string }> = {
  PLANNED:   { label: 'À venir',  cls: 'bg-brand-500/15 text-brand-700 dark:text-brand-300' },
  DONE:      { label: 'Terminé',  cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  CANCELLED: { label: 'Annulé',   cls: 'bg-rose-500/15 text-rose-700 dark:text-rose-300' },
}

export function WorkshopsPanel({ programmeId }: { programmeId: number }) {
  const [rows, setRows] = useState<Any[]>([])
  const [roster, setRoster] = useState<Any[]>([])
  const [phases, setPhases] = useState<Any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const [form, setForm] = useState<WorkshopPayload>(EMPTY)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    Promise.allSettled([workshopsApi.list(programmeId), participantsApi.list(programmeId), programmesApi.phases(programmeId)])
      .then(([w, p, ph]) => {
        if (w.status === 'fulfilled') setRows(w.value.data ?? [])
        if (p.status === 'fulfilled') setRoster(p.value.data ?? [])
        if (ph.status === 'fulfilled') setPhases(ph.value.data ?? [])
      })
      .finally(() => setLoading(false))
  }, [programmeId])
  useEffect(() => { load() }, [load])

  const rosterById = useMemo(() => {
    const m = new Map<number, Any>()
    roster.forEach((r) => m.set(r.id, r))
    return m
  }, [roster])

  const startNew = () => { setForm(EMPTY); setEditing('new') }
  const startEdit = (w: Any) => {
    setForm({
      title: w.title ?? '', description: w.description ?? '', phaseId: w.phaseId ?? null,
      format: w.format ?? 'Atelier', status: w.status ?? 'PLANNED',
      workshopDate: w.workshopDate ?? '', startTime: w.startTime ?? '', endTime: w.endTime ?? '',
      location: w.location ?? '', facilitator: w.facilitator ?? '',
      targetParticipantIds: (w.targets ?? []).map((t: Any) => t.participantId),
    })
    setEditing(w.id)
  }
  const cancel = () => { setEditing(null); setForm(EMPTY) }

  const toggleTarget = (pid: number) => setForm((f) => ({
    ...f,
    targetParticipantIds: f.targetParticipantIds.includes(pid)
      ? f.targetParticipantIds.filter((x) => x !== pid)
      : [...f.targetParticipantIds, pid],
  }))
  const allSelected = roster.length > 0 && form.targetParticipantIds.length === roster.length
  const toggleAllTargets = () => setForm((f) => ({
    ...f,
    targetParticipantIds: allSelected ? [] : roster.map((r) => r.id),
  }))

  const save = async () => {
    if (!form.title.trim()) { toast.error('Donnez un titre à l’atelier.'); return }
    if (form.targetParticipantIds.length === 0) { toast.error('Sélectionnez au moins une startup.'); return }
    setSaving(true)
    try {
      const payload: WorkshopPayload = { ...form, phaseId: form.phaseId || null }
      if (editing === 'new') await workshopsApi.create(programmeId, payload)
      else if (typeof editing === 'number') await workshopsApi.update(editing, payload)
      toast.success(editing === 'new' ? 'Atelier créé' : 'Atelier mis à jour')
      cancel()
      load()
    } catch (e: any) { toast.error(e.response?.data?.message ?? 'Échec') }
    finally { setSaving(false) }
  }
  const remove = async (id: number) => {
    if (!confirm('Supprimer cet atelier ?')) return
    try { await workshopsApi.delete(id); setRows((a) => a.filter((r) => r.id !== id)); toast.success('Atelier supprimé') }
    catch (e: any) { toast.error(e.response?.data?.message ?? 'Échec') }
  }

  // Mentors auto-included from the currently selected targets (deduped).
  const selectedMentors = useMemo(() => {
    const m = new Map<number, string>()
    form.targetParticipantIds.forEach((pid) => {
      const p = rosterById.get(pid)
      if (p?.mentorUserId) m.set(p.mentorUserId, p.mentorName || `Mentor #${p.mentorUserId}`)
    })
    return Array.from(m.values())
  }, [form.targetParticipantIds, rosterById])
  const targetsWithoutMentor = form.targetParticipantIds.filter((pid) => !rosterById.get(pid)?.mentorUserId).length

  const input = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand-500'

  return (
    <MagicCard className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Presentation className="h-4 w-4 text-brand-500" />Ateliers
          {rows.length > 0 && <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-bold text-brand-700 dark:text-brand-300">{rows.length}</span>}
        </h2>
        {editing === null && (
          <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={startNew}><Plus className="h-3.5 w-3.5" />Nouvel atelier</Button>
        )}
      </div>
      <p className="mb-3 text-[11px] text-muted-foreground">
        Un atelier cible des startups précises et embarque automatiquement leur mentor. Il apparaît sur le calendrier des participants concernés.
      </p>

      {/* Create / edit form */}
      {editing !== null && (
        <div className="mb-4 space-y-3 rounded-xl border border-brand-500/30 bg-brand-500/5 p-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">{editing === 'new' ? 'Nouvel atelier' : 'Modifier l’atelier'}</h3>
            <button onClick={cancel} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>

          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Titre de l’atelier (ex. Atelier Business Model)" className={input} />
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Objectif / description (optionnel)" className={input + ' resize-y'} />

          <div className="flex flex-wrap gap-2">
            <select value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })} className={input + ' sm:max-w-[200px]'} title="Type d’activité">
              {FORMATS.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={input + ' sm:max-w-[160px]'} title="Statut">
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>

          <div className="flex flex-wrap gap-2">
            <select value={form.phaseId ?? ''} onChange={(e) => setForm({ ...form, phaseId: e.target.value ? Number(e.target.value) : null })} className={input + ' sm:max-w-[220px]'}>
              <option value="">Rattacher à une session… (optionnel)</option>
              {phases.map((ph) => <option key={ph.id} value={ph.id}>{ph.title ?? ph.name ?? `Session #${ph.id}`}</option>)}
            </select>
            <input type="date" value={form.workshopDate ?? ''} onChange={(e) => setForm({ ...form, workshopDate: e.target.value })} className={input + ' sm:max-w-[160px]'} />
            <input type="time" value={form.startTime ?? ''} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className={input + ' sm:max-w-[120px]'} title="Heure de début" />
            <input type="time" value={form.endTime ?? ''} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className={input + ' sm:max-w-[120px]'} title="Heure de fin" />
          </div>
          <div className="flex flex-wrap gap-2">
            <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Lieu (Visio, salle…)" className={input + ' flex-1'} />
            <input value={form.facilitator} onChange={(e) => setForm({ ...form, facilitator: e.target.value })} placeholder="Animé par (expert, mentor…)" className={input + ' flex-1'} />
          </div>

          {/* Target startups */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground"><Users className="h-3.5 w-3.5" />Startups ciblées {form.targetParticipantIds.length > 0 && <span className="text-muted-foreground">({form.targetParticipantIds.length})</span>}</p>
              {roster.length > 0 && (
                <button type="button" onClick={toggleAllTargets} className="text-[11px] font-semibold text-brand-600 hover:underline">
                  {allSelected ? 'Tout désélectionner' : 'Toutes les startups'}
                </button>
              )}
            </div>
            {roster.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-3 text-center text-[11px] text-muted-foreground">Aucune startup incubée pour l’instant.</p>
            ) : (
              <div className="grid gap-1.5 sm:grid-cols-2">
                {roster.map((p) => {
                  const on = form.targetParticipantIds.includes(p.id)
                  return (
                    <button key={p.id} type="button" onClick={() => toggleTarget(p.id)}
                      className={`flex items-center gap-2 rounded-lg border p-2 text-left transition-colors ${on ? 'border-brand-400 bg-brand-500/10' : 'border-border hover:bg-accent/50'}`}>
                      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${on ? 'border-brand-500 bg-brand-500 text-white' : 'border-border'}`}>{on && <X className="h-3 w-3 rotate-45" />}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 truncate text-xs font-semibold text-foreground"><Building2 className="h-3 w-3 shrink-0 text-muted-foreground" />{p.organizationName || `Organisation #${p.organizationId}`}</span>
                        <span className={`flex items-center gap-1 text-[10px] ${p.mentorUserId ? 'text-purple-600 dark:text-purple-400' : 'text-rose-500'}`}>
                          <Handshake className="h-2.5 w-2.5" />{p.mentorName || 'Sans mentor'}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Auto-included mentors summary */}
          {form.targetParticipantIds.length > 0 && (
            <div className="rounded-lg border border-border bg-background/60 p-2.5 text-[11px]">
              {selectedMentors.length > 0 ? (
                <p className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
                  <Handshake className="h-3.5 w-3.5 text-purple-500" /><b className="text-foreground">Mentors inclus :</b>
                  {selectedMentors.map((n) => <span key={n} className="rounded-full bg-purple-500/10 px-2 py-0.5 font-semibold text-purple-700 dark:text-purple-300">{n}</span>)}
                </p>
              ) : <p className="text-muted-foreground">Aucun mentor rattaché aux startups sélectionnées.</p>}
              {targetsWithoutMentor > 0 && (
                <p className="mt-1 flex items-center gap-1 font-semibold text-rose-600"><AlertTriangle className="h-3 w-3" />{targetsWithoutMentor} startup(s) sans mentor — assignez un référent depuis l’onglet Participants.</p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={cancel}>Annuler</Button>
            <Button size="sm" className="gap-1.5" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Enregistrer
            </Button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex h-24 items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : rows.length === 0 && editing === null ? (
        <p className="py-6 text-center text-xs text-muted-foreground">Aucun atelier programmé. Créez-en un pour accompagner des startups en petit groupe.</p>
      ) : (
        <div className="space-y-2.5">
          {rows.map((w) => (
            <div key={w.id} className="rounded-xl border border-border bg-background/50 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{w.title}</span>
                    {w.status && (STATUS[w.status] ?? STATUS.PLANNED) && (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${(STATUS[w.status] ?? STATUS.PLANNED).cls}`}>{(STATUS[w.status] ?? STATUS.PLANNED).label}</span>
                    )}
                    {w.format && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{w.format}</span>}
                    {w.phaseTitle && <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-semibold text-brand-700 dark:text-brand-300"><CalendarClock className="h-2.5 w-2.5" />{w.phaseTitle}</span>}
                  </div>
                  {w.description && <p className="mt-0.5 text-[11px] text-muted-foreground">{w.description}</p>}
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><CalendarClock className="h-3 w-3" />{fmtDate(w.workshopDate)}{w.startTime ? ` · ${w.startTime}${w.endTime ? `–${w.endTime}` : ''}` : ''}</span>
                    {w.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{w.location}</span>}
                    {w.facilitator && <span className="inline-flex items-center gap-1"><UserRound className="h-3 w-3" />{w.facilitator}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => startEdit(w)} className="rounded p-1 text-muted-foreground hover:text-brand-500" title="Modifier"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => remove(w.id)} className="rounded p-1 text-muted-foreground hover:text-rose-500" title="Supprimer"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
              {/* Targets + their mentors */}
              {(w.targets ?? []).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border pt-2">
                  {(w.targets ?? []).map((t: Any) => (
                    <span key={t.participantId} className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-[10px] text-foreground">
                      <Building2 className="h-2.5 w-2.5 text-muted-foreground" />{t.organizationName || `#${t.organizationId}`}
                      {t.mentorName && <span className="inline-flex items-center gap-0.5 text-purple-600 dark:text-purple-400"><Handshake className="h-2.5 w-2.5" />{t.mentorName}</span>}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </MagicCard>
  )
}
