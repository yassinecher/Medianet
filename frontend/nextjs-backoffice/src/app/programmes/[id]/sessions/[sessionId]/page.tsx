'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Save, Loader2, Trash2, Plus, CalendarDays, CalendarRange, MapPin,
  Layers, Clock, ChevronRight, Check, X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { sessionsApi } from '@/lib/api'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { MagicCard } from '@/components/magicui/magic-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { performDelete } from '@/lib/deleteChoice'

interface Activity { id?: number; title: string; startTime?: string; endTime?: string; location?: string }
interface SessionDay { id?: number; title?: string; date?: string; activities?: Activity[] }
interface Session {
  id: number; title: string; description?: string
  startDate?: string; endDate?: string; durationKind?: string
  location?: string; color?: string
  sessionType?: string; visibility?: string; status?: string
  parentSessionId?: number | null
  responsibles?: string[]; days?: SessionDay[]
}

const TYPE_OPTIONS: [string, string][] = [
  ['CANDIDATURE_SUBMISSION', 'Candidature — accepter les candidatures'],
  ['PRESELECTION', 'Présélection — jury'],
  ['PITCH_DAY', 'Pitch Day'],
  ['ONBOARDING', 'Onboarding'],
  ['INCUBATION', 'Incubation / Standard'],
  ['TRAINING_DAY', 'Formation'],
  ['DEMO_DAY', 'Demo Day'],
]
const VIS_SEG: [string, string, string][] = [
  ['VISIBLE', 'Visible', 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'],
  ['HIDDEN', 'Interne', 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300'],
  ['PRIVATE', 'Privé', 'border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300'],
]
const SWATCHES = ['#0EA5E9', '#6366F1', '#A855F7', '#EC4899', '#EF4444', '#F97316', '#F59E0B', '#10B981', '#14B8A6', '#64748B']
const d10 = (s?: string) => (s ? s.substring(0, 10) : '')
const fmtDay = (s?: string) => (s ? new Date(s.substring(0, 10) + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}{required && <span className="text-rose-500"> *</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  )
}

export default function SessionPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>()
  const router = useRouter()
  const search = useSearchParams()
  const programmeId = Number(id)
  const isNew = sessionId === 'new'
  const parentParam = search.get('parent')

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [children, setChildren] = useState<Session[]>([])
  const [parent, setParent] = useState<Session | null>(null)

  const [f, setF] = useState({
    title: '',
    sessionType: 'INCUBATION',
    durationKind: parentParam ? 'day' : 'range',
    startDate: '', endDate: '',
    location: '', color: '#6366F1',
    status: 'UPCOMING', visibility: 'VISIBLE', description: '',
  })
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))
  const isDay = f.durationKind === 'day'

  const load = useCallback(async () => {
    const all: Session[] = await sessionsApi.list(programmeId).then((r) => r.data ?? []).catch(() => [])
    const sid = Number(sessionId)
    const s = all.find((x) => x.id === sid) ?? null
    setSession(s)
    setChildren(all.filter((x) => x.parentSessionId === sid))
    setParent(s?.parentSessionId ? all.find((x) => x.id === s.parentSessionId) ?? null : null)
    if (s) {
      setF({
        title: s.title ?? '',
        sessionType: s.sessionType || 'INCUBATION',
        durationKind: s.durationKind === 'day' ? 'day' : (s.endDate && d10(s.endDate) !== d10(s.startDate) ? 'range' : (s.durationKind ?? 'day')),
        startDate: d10(s.startDate), endDate: d10(s.endDate),
        location: s.location ?? '', color: s.color || '#6366F1',
        status: s.status || 'UPCOMING', visibility: s.visibility || 'VISIBLE', description: s.description ?? '',
      })
    }
  }, [programmeId, sessionId])

  useEffect(() => {
    if (isNew) { setLoading(false); return }
    setLoading(true)
    load().finally(() => setLoading(false))
  }, [isNew, load])

  const save = async () => {
    if (!f.title.trim()) { toast.error('Donnez un titre à la session.'); return }
    if (!f.startDate) { toast.error('Choisissez une date de début.'); return }
    const payload: any = {
      title: f.title.trim(), sessionType: f.sessionType, durationKind: f.durationKind,
      startDate: f.startDate, endDate: isDay ? f.startDate : (f.endDate || f.startDate),
      location: f.location.trim() || undefined, color: f.color,
      status: f.status, visibility: f.visibility, description: f.description.trim() || undefined,
    }
    setSaving(true)
    try {
      if (isNew) {
        if (parentParam) payload.parentSessionId = Number(parentParam)
        const { data } = await sessionsApi.create(programmeId, { ...payload, lane: 'Principal', phaseOrder: 0 })
        toast.success('Session créée')
        router.replace(`/programmes/${programmeId}/sessions/${data?.id ?? ''}`)
      } else if (session) {
        await sessionsApi.update(programmeId, session.id, payload)
        toast.success('Session enregistrée')
        await load()
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Enregistrement impossible')
    } finally { setSaving(false) }
  }

  const del = async () => {
    if (!session) return
    const outcome = await performDelete('session', session.id, () => sessionsApi.delete(programmeId, session.id), {
      label: `la session « ${session.title} »`,
    })
    if (!outcome) return
    toast.success(outcome === 'purge' ? 'Session supprimée définitivement' : 'Session mise à la corbeille')
    router.push(parent ? `/programmes/${programmeId}/sessions/${parent.id}` : `/programmes/${programmeId}?tab=phases`)
  }

  const backHref = parent
    ? `/programmes/${programmeId}/sessions/${parent.id}`
    : `/programmes/${programmeId}?tab=phases`

  if (loading) {
    return <AdminLayout><div className="mx-auto max-w-3xl space-y-4">
      <Skeleton className="h-8 w-64 rounded-lg" /><Skeleton className="h-96 rounded-2xl" />
    </div></AdminLayout>
  }

  if (!isNew && !session) {
    return <AdminLayout><div className="mx-auto max-w-3xl py-16 text-center">
      <p className="text-sm text-muted-foreground">Session introuvable.</p>
      <Link href={`/programmes/${programmeId}?tab=phases`} className="mt-3 inline-block text-sm font-medium text-brand-600 hover:underline">← Retour au parcours</Link>
    </div></AdminLayout>
  }

  return (
    <AdminLayout>
      <div className="mx-auto max-w-3xl space-y-5">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <Link href={backHref}><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: f.color }} />
              <h1 className="truncate text-xl font-bold text-foreground">{isNew ? (parentParam ? 'Nouvelle sous-session' : 'Nouvelle session') : (session?.title || 'Session')}</h1>
              {!isNew && <Badge variant="secondary">{isDay ? 'Journée' : 'Plage'}</Badge>}
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {parent ? <>Sous-session de <Link href={`/programmes/${programmeId}/sessions/${parent.id}`} className="font-medium text-brand-600 hover:underline">{parent.title}</Link></> : 'Session du parcours'}
            </p>
          </div>
          {!isNew && (
            <Button variant="ghost" size="icon" onClick={del} title="Supprimer" className="text-muted-foreground hover:text-rose-600">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </motion.div>

        {/* Editor */}
        <MagicCard className="p-5 sm:p-6">
          <div className="space-y-5">
            <Field label="Titre" required>
              <Input value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Ex. Atelier Business Model" className="h-11 text-base font-semibold" autoFocus />
            </Field>

            <Field label="Type de session" hint="Détermine le comportement (candidatures / jury) et le badge affiché aux participants.">
              <Select value={f.sessionType} onChange={(e) => set('sessionType', e.target.value)}>
                {TYPE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            </Field>

            {/* Calendrier */}
            <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Calendrier</p>
              <div className="grid grid-cols-2 gap-2">
                {([['day', 'Journée', CalendarDays], ['range', 'Plage', CalendarRange]] as const).map(([k, lbl, Icon]) => (
                  <button key={k} type="button"
                    onClick={() => { set('durationKind', k); if (k === 'day') set('endDate', f.startDate) }}
                    className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border text-sm font-semibold transition-colors ${
                      f.durationKind === k ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : 'border-border text-muted-foreground hover:border-emerald-400'}`}>
                    <Icon className="h-4 w-4" />{lbl}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">Début</label>
                  <Input type="date" value={f.startDate} onChange={(e) => { set('startDate', e.target.value); if (isDay) set('endDate', e.target.value) }} />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">Fin {isDay && '(= début)'}</label>
                  <Input type="date" value={f.endDate} min={f.startDate || undefined} disabled={isDay} onChange={(e) => set('endDate', e.target.value)} className={isDay ? 'opacity-60' : ''} />
                </div>
              </div>
            </div>

            <Field label="Lieu">
              <Input value={f.location} placeholder='Ex. "Salle A · Medianet HQ" ou "En ligne"' onChange={(e) => set('location', e.target.value)} />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Couleur</label>
                <div className="flex flex-wrap gap-1.5">
                  {SWATCHES.map((hex) => (
                    <button key={hex} type="button" onClick={() => set('color', hex)} title={hex}
                      className={`h-7 w-7 rounded-full border-2 transition-transform ${f.color === hex ? 'scale-110 border-foreground' : 'border-transparent hover:scale-105'}`}
                      style={{ background: hex }} />
                  ))}
                </div>
              </div>
              <Field label="Statut">
                <Select value={f.status} onChange={(e) => set('status', e.target.value)}>
                  <option value="UPCOMING">À venir</option>
                  <option value="ACTIVE">En cours</option>
                  <option value="COMPLETED">Terminée</option>
                </Select>
              </Field>
            </div>

            <Field label="Visibilité"
              hint={f.visibility === 'VISIBLE' ? 'Affichée dans le parcours public aux invités.' : f.visibility === 'HIDDEN' ? 'Interne — visible des admins uniquement.' : 'Privée — réservée aux utilisateurs invités.'}>
              <div className="grid grid-cols-3 gap-2">
                {VIS_SEG.map(([v, lbl, cls]) => (
                  <button key={v} type="button" onClick={() => set('visibility', v)}
                    className={`h-9 rounded-lg border text-xs font-semibold transition-colors ${f.visibility === v ? cls : 'border-border text-muted-foreground hover:border-emerald-400'}`}>
                    {lbl}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Description">
              <Textarea rows={4} value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Objectifs, déroulé, informations utiles…" />
            </Field>

            <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
              <Link href={backHref} className="sm:order-1"><Button variant="ghost" className="w-full sm:w-auto">Annuler</Button></Link>
              <Button variant="brand" onClick={save} disabled={saving} className="w-full gap-1.5 sm:order-2 sm:w-auto">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {isNew ? 'Créer la session' : 'Enregistrer'}
              </Button>
            </div>
          </div>
        </MagicCard>

        {/* Sub-sessions (only meaningful for an existing range session) */}
        {!isNew && session && !isDay && (
          <SubSessions programmeId={programmeId} parentId={session.id} children={children} />
        )}

        {/* Activities agenda (for an existing day session) */}
        {!isNew && session && isDay && (
          <Activities programmeId={programmeId} session={session} onChanged={load} busy={busy} setBusy={setBusy} />
        )}
      </div>
    </AdminLayout>
  )
}

// ── Nested sub-sessions ──────────────────────────────────────────────────────
function SubSessions({ programmeId, parentId, children }: { programmeId: number; parentId: number; children: Session[] }) {
  return (
    <MagicCard className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold text-foreground">
          <Layers className="h-4 w-4 text-brand-500" />Sous-sessions
          {children.length > 0 && <Badge variant="secondary">{children.length}</Badge>}
        </h2>
        <Link href={`/programmes/${programmeId}/sessions/new?parent=${parentId}`}>
          <Button variant="outline" size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" />Ajouter</Button>
        </Link>
      </div>
      {children.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-muted/10 px-4 py-6 text-center text-xs text-muted-foreground">
          Aucune sous-session. Ajoutez des journées (atelier, mentorat, workshop…) rattachées à cette plage.
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {[...children].sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? '')).map((c) => (
            <li key={c.id}>
              <Link href={`/programmes/${programmeId}/sessions/${c.id}`}
                className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-accent/50">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color || '#6366F1' }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{c.title || 'Journée'}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{fmtDay(c.startDate)}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </MagicCard>
  )
}

// ── Activities agenda (simple list + add) ────────────────────────────────────
function Activities({ programmeId, session, onChanged, busy, setBusy }: {
  programmeId: number; session: Session; onChanged: () => Promise<void>; busy: boolean; setBusy: (b: boolean) => void
}) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ title: '', startTime: '', endTime: '' })

  // A day session usually carries a single day holding its activities.
  const day = (session.days ?? [])[0]
  const activities = useMemo(
    () => (session.days ?? []).flatMap((d) => (d.activities ?? []).map((a) => ({ ...a, dayId: d.id }))),
    [session.days],
  )

  const ensureDayId = async (): Promise<number | null> => {
    if (day?.id) return day.id
    const { data } = await sessionsApi.addDay(programmeId, session.id, { date: session.startDate, title: '' })
    return data?.id ?? null
  }

  const add = async () => {
    if (!draft.title.trim()) { toast.error('Titre de l’activité requis.'); return }
    setBusy(true)
    try {
      const dayId = await ensureDayId()
      if (dayId == null) throw new Error('no day')
      await sessionsApi.addActivity(programmeId, session.id, dayId, {
        title: draft.title.trim(), startTime: draft.startTime || undefined, endTime: draft.endTime || undefined,
      })
      setDraft({ title: '', startTime: '', endTime: '' }); setAdding(false)
      toast.success('Activité ajoutée'); await onChanged()
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Ajout impossible') }
    finally { setBusy(false) }
  }

  const remove = async (dayId: number | undefined, aid: number | undefined) => {
    if (dayId == null || aid == null) return
    setBusy(true)
    try { await sessionsApi.deleteActivity(programmeId, session.id, dayId, aid); toast.success('Activité retirée'); await onChanged() }
    catch { toast.error('Suppression impossible') } finally { setBusy(false) }
  }

  return (
    <MagicCard className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold text-foreground">
          <Clock className="h-4 w-4 text-brand-500" />Agenda de la journée
          {activities.length > 0 && <Badge variant="secondary">{activities.length}</Badge>}
        </h2>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setAdding((v) => !v)}>
          <Plus className="h-3.5 w-3.5" />Activité
        </Button>
      </div>

      {adding && (
        <div className="mb-3 space-y-2 rounded-xl border border-border bg-muted/20 p-3">
          <Input value={draft.title} placeholder="Titre (ex. Pitch training)" onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
          <div className="flex items-center gap-2">
            <Input type="time" value={draft.startTime} onChange={(e) => setDraft((d) => ({ ...d, startTime: e.target.value }))} className="w-32" />
            <span className="text-muted-foreground">→</span>
            <Input type="time" value={draft.endTime} onChange={(e) => setDraft((d) => ({ ...d, endTime: e.target.value }))} className="w-32" />
            <Button variant="brand" size="sm" className="ml-auto gap-1.5" onClick={add} disabled={busy}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}Ajouter
            </Button>
          </div>
        </div>
      )}

      {activities.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-muted/10 px-4 py-6 text-center text-xs text-muted-foreground">
          Aucune activité. Ajoutez le déroulé horaire de cette journée.
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {activities.sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? '')).map((a, i) => (
            <li key={a.id ?? i} className="flex items-center gap-3 px-3 py-2.5">
              {(a.startTime || a.endTime) && (
                <span className="w-24 shrink-0 text-xs font-medium text-muted-foreground tabular-nums">{a.startTime}{a.endTime ? `–${a.endTime}` : ''}</span>
              )}
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{a.title}</span>
              <button onClick={() => remove(a.dayId, a.id)} disabled={busy} className="shrink-0 rounded p-1 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600">
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </MagicCard>
  )
}
