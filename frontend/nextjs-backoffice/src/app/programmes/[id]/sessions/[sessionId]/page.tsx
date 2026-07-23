'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Loader2, Trash2, Plus, CalendarDays, CalendarRange,
  Layers, Clock, ChevronRight, Check, X, Target, Link2, History, Globe, UserRound,
  Image as ImageIcon,
} from 'lucide-react'
import { ImageUpload } from '@/components/upload/ImageUpload'
import toast from 'react-hot-toast'
import { sessionsApi, programmesApi } from '@/lib/api'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { MagicCard } from '@/components/magicui/magic-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { performDelete } from '@/lib/deleteChoice'
import { CandidaturePhasePanel, PreselectionPhasePanel } from '@/app/programmes/builder/PhasePanels'
import { SessionNotifyButton } from '@/app/programmes/[id]/SessionNotify'
import { UpdateNotifySuggestion, type UpdateSuggest } from '@/app/programmes/[id]/SessionUpdateNotify'

interface Activity { id?: number; title: string; startTime?: string; endTime?: string; location?: string }
interface SessionDay { id?: number; title?: string; date?: string; activities?: Activity[] }
interface Session {
  id: number; title: string; description?: string
  startDate?: string; endDate?: string; durationKind?: string
  location?: string; color?: string
  sessionType?: string; visibility?: string; status?: string
  parentSessionId?: number | null
  allowOverlap?: boolean; allowActivities?: boolean
  focusCriteriaIds?: number[]; criterionWeightsJson?: string
  evaluationSelectionId?: number | null
  responsibles?: string[]; days?: SessionDay[]
  galleryUrls?: string[]
}
interface Criterion { id: number; name: string; weight?: number; description?: string }

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
  const [allSessions, setAllSessions] = useState<Session[]>([])
  const [criteria, setCriteria] = useState<Criterion[]>([])
  const [programmeName, setProgrammeName] = useState('Programme')
  // Post-critical-update suggestion: « notifier les personnes concernées ? »
  const [suggest, setSuggest] = useState<UpdateSuggest | null>(null)
  const [afterSuggest, setAfterSuggest] = useState<string | null>(null)

  const [f, setF] = useState({
    title: '',
    sessionType: 'INCUBATION',
    durationKind: parentParam ? 'day' : 'range',
    startDate: '', endDate: '',
    location: '', color: '#6366F1',
    status: 'UPCOMING', visibility: 'VISIBLE', description: '',
    // Overlap ON by default: planning two sessions on the same dates is normal
    // (ateliers parallèles) — no more nagging update prompts.
    allowOverlap: true, allowActivities: true,
  })
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))
  const isDay = f.durationKind === 'day'
  const fonction = session?.sessionType === 'CANDIDATURE_SUBMISSION' || session?.sessionType === 'PRESELECTION'
    ? session.sessionType : 'STANDARD'

  // Step-by-step CREATION (editing shows the full form directly).
  const CREATE_STEPS = [
    { title: 'L’essentiel', blurb: 'Nom et type de session' },
    { title: 'Calendrier', blurb: 'Durée et dates' },
    { title: 'Détails', blurb: 'Lieu, couleur, visibilité…' },
  ]
  const [step, setStep] = useState(0)
  const stepError = (n: number): string | null => {
    if (n === 0 && !f.title.trim()) return 'Donnez un titre à la session.'
    if (n === 1 && !f.startDate) return 'Choisissez une date de début.'
    return null
  }
  const nextStep = () => {
    const e = stepError(step)
    if (e) { toast.error(e); return }
    setStep((s) => Math.min(CREATE_STEPS.length - 1, s + 1))
  }

  const load = useCallback(async () => {
    const all: Session[] = await sessionsApi.list(programmeId).then((r) => r.data ?? []).catch(() => [])
    setAllSessions(all)
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
        allowOverlap: !!s.allowOverlap, allowActivities: s.allowActivities !== false,
      })
    }
  }, [programmeId, sessionId])

  useEffect(() => {
    programmesApi.get(programmeId).then((r) => setProgrammeName(r.data?.title ?? r.data?.name ?? 'Programme')).catch(() => {})
    programmesApi.criteria(programmeId).then((r) => setCriteria(r.data ?? [])).catch(() => {})
  }, [programmeId])

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
      allowOverlap: f.allowOverlap, allowActivities: f.allowActivities,
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
        // Critical change (dates / lieu / statut) → suggest notifying everyone
        // related to this session, with a role-by-role editable mail wizard.
        const changes: string[] = []
        if (d10(session.startDate) !== payload.startDate || d10(session.endDate ?? session.startDate) !== payload.endDate)
          changes.push(`Dates : ${fmtDay(session.startDate)} → ${fmtDay(session.endDate ?? session.startDate)}  ⇒  ${fmtDay(payload.startDate)} → ${fmtDay(payload.endDate)}`)
        if ((session.location ?? '') !== (payload.location ?? ''))
          changes.push(`Lieu : ${session.location || '—'}  ⇒  ${payload.location || '—'}`)
        if ((session.status || 'UPCOMING') !== payload.status)
          changes.push(`Statut : ${session.status || 'UPCOMING'}  ⇒  ${payload.status}`)
        if (changes.length > 0)
          setSuggest({ session: { ...session, ...payload }, changeSummary: changes.join('\n') })
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
    // Before leaving: offer to notify the people related to the cancelled session.
    setAfterSuggest(parent ? `/programmes/${programmeId}/sessions/${parent.id}` : `/programmes/${programmeId}?tab=phases`)
    setSuggest({
      session,
      changeSummary: outcome === 'purge'
        ? 'La session a été annulée et supprimée du parcours.'
        : 'La session a été annulée (déplacée vers la corbeille).',
    })
  }

  // ── Parent attach / detach (session imbriquée) ────────────────────────────
  const eligibleParents = useMemo(() => {
    if (!session || !f.startDate) return []
    const sd = new Date(f.startDate + 'T12:00:00').getTime()
    return allSessions.filter((p) => {
      if (p.id === session.id) return false
      const kind = p.durationKind === 'day' ? 'day' : 'range'
      if (kind !== 'range') return false
      const ps = p.startDate ? new Date(d10(p.startDate) + 'T12:00:00').getTime() : null
      const pe = p.endDate ? new Date(d10(p.endDate) + 'T12:00:00').getTime() : ps
      return ps != null && pe != null && sd >= ps && sd <= pe
    })
  }, [allSessions, session, f.startDate])

  const setParentSession = async (value: string) => {
    if (!session) return
    setBusy(true)
    try {
      await sessionsApi.update(programmeId, session.id, { parentSessionId: value ? Number(value) : -1 })
      toast.success(value ? 'Session rattachée' : 'Session détachée — elle est maintenant autonome')
      await load()
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Action impossible') }
    finally { setBusy(false) }
  }

  const backHref = parent
    ? `/programmes/${programmeId}/sessions/${parent.id}`
    : `/programmes/${programmeId}?tab=phases`
  // Return EXACTLY where the user was (Parcours/Gantt scroll included) when the
  // page was reached in-app; fall back to the hub for direct visits.
  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back()
    else router.push(backHref)
  }

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
          <Button variant="ghost" size="icon" onClick={goBack} title="Retour"><ArrowLeft className="h-4 w-4" /></Button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: f.color }} />
              <h1 className="truncate text-xl font-bold text-foreground">{isNew ? (parentParam ? 'Nouvelle sous-session' : 'Nouvelle session') : (session?.title || 'Session')}</h1>
              {!isNew && <Badge variant="secondary">{isDay ? 'Journée' : 'Plage'}</Badge>}
              {!isNew && fonction !== 'STANDARD' && (
                <Badge variant="default">{fonction === 'CANDIDATURE_SUBMISSION' ? 'Candidature' : 'Présélection'}</Badge>
              )}
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {parent ? <>Sous-session de <Link href={`/programmes/${programmeId}/sessions/${parent.id}`} className="font-medium text-brand-600 hover:underline">{parent.title}</Link></> : 'Session du parcours'}
            </p>
          </div>
          {!isNew && session && isDay && (
            <SessionNotifyButton programmeId={programmeId} programmeName={programmeName} session={session as any}
              onSessionPatched={() => load()}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-brand-500/10 hover:text-brand-600" />
          )}
          {!isNew && (
            <Button variant="ghost" size="icon" onClick={del} title="Supprimer" className="text-muted-foreground hover:text-rose-600">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </motion.div>

        {/* Editor — step-by-step when creating, full form when editing */}
        <MagicCard className="p-5 sm:p-6">
          {isNew && (
            <div className="mb-6 space-y-2.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-foreground">Étape {step + 1} / {CREATE_STEPS.length} · {CREATE_STEPS[step].title}</span>
                <span className="hidden text-muted-foreground sm:block">{CREATE_STEPS[step].blurb}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-brand-500 transition-all duration-300"
                  style={{ width: `${((step + 1) / CREATE_STEPS.length) * 100}%` }} />
              </div>
              <ol className="flex items-start gap-1">
                {CREATE_STEPS.map((st, i) => (
                  <li key={st.title} className="flex flex-1 flex-col items-center gap-1">
                    <button type="button" disabled={i > step} onClick={() => i <= step && setStep(i)}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-colors ${
                        i === step ? 'border-brand-500 bg-brand-500 text-white'
                        : i < step ? 'border-emerald-500 bg-emerald-500 text-white'
                        : 'border-border bg-muted text-muted-foreground'} ${i <= step ? 'cursor-pointer hover:opacity-90' : 'cursor-not-allowed opacity-50'}`}>
                      {i < step ? <Check className="h-4 w-4" /> : i + 1}
                    </button>
                    <span className={`text-center text-[10px] font-medium leading-tight ${i === step ? 'text-brand-600 dark:text-brand-300' : 'text-muted-foreground'}`}>{st.title}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="space-y-5">
            {(!isNew || step === 0) && (<>
            <Field label="Titre" required>
              <Input value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Ex. Atelier Business Model" className="h-11 text-base font-semibold" autoFocus />
            </Field>

            <Field label="Type de session" hint="Détermine le comportement (candidatures / jury) et le badge affiché aux participants.">
              <Select value={f.sessionType} onChange={(e) => set('sessionType', e.target.value)}>
                {TYPE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            </Field>
            </>)}

            {(!isNew || step === 1) && (
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
              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 text-sm hover:bg-accent/40">
                <input type="checkbox" className="h-4 w-4 accent-emerald-500" checked={f.allowOverlap}
                  onChange={(e) => set('allowOverlap', e.target.checked)} />
                <span className="flex-1 text-foreground">Autoriser le chevauchement
                  <span className="block text-[11px] font-normal text-muted-foreground">Permet de planifier cette session aux mêmes dates qu&apos;une autre (activé par défaut).</span>
                </span>
              </label>
            </div>
            )}

            {(!isNew || step === 2) && (<>
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

            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 text-sm hover:bg-accent/40">
              <input type="checkbox" className="h-4 w-4 accent-emerald-500" checked={f.allowActivities}
                onChange={(e) => set('allowActivities', e.target.checked)} />
              <span className="flex-1 text-foreground">Autoriser les activités (agenda horaire)</span>
            </label>
            </>)}

            {/* Footer — wizard nav when creating, save when editing */}
            <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
              {isNew ? (<>
                {step > 0 ? (
                  <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} className="w-full sm:w-auto">Précédent</Button>
                ) : (
                  <Link href={backHref}><Button variant="ghost" className="w-full sm:w-auto">Annuler</Button></Link>
                )}
                {step < CREATE_STEPS.length - 1 ? (
                  <Button variant="brand" onClick={nextStep} className="w-full gap-1.5 sm:w-auto">
                    Suivant<ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button variant="brand" onClick={save} disabled={saving} className="w-full gap-1.5 sm:w-auto">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Créer la session
                  </Button>
                )}
              </>) : (<>
                <Button variant="ghost" onClick={goBack} className="w-full sm:order-1 sm:w-auto">Annuler</Button>
                <Button variant="brand" onClick={save} disabled={saving} className="w-full gap-1.5 sm:order-2 sm:w-auto">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Enregistrer
                </Button>
              </>)}
            </div>
          </div>
        </MagicCard>

        {/* ── Feature panels — the session's REAL content, no longer empty ── */}

        {/* Candidature sessions: intake panel */}
        {!isNew && session && fonction === 'CANDIDATURE_SUBMISSION' && (
          <MagicCard className="overflow-hidden p-0">
            <div className="border-b border-border bg-muted/20 px-5 py-3">
              <h2 className="font-semibold text-foreground">Candidatures de cette session</h2>
              <p className="text-xs text-muted-foreground">Les dépôts reçus pendant la fenêtre de candidature.</p>
            </div>
            <div className="max-h-[560px] overflow-y-auto">
              <CandidaturePhasePanel programmeId={programmeId} />
            </div>
          </MagicCard>
        )}

        {/* Présélection sessions: jury / evaluation panel */}
        {!isNew && session && fonction === 'PRESELECTION' && (
          <MagicCard className="overflow-hidden p-0">
            <div className="border-b border-border bg-muted/20 px-5 py-3">
              <h2 className="font-semibold text-foreground">Évaluation par le jury</h2>
              <p className="text-xs text-muted-foreground">Sélection des candidatures évaluées et suivi du jury.</p>
            </div>
            <div className="max-h-[560px] overflow-y-auto">
              <PreselectionPhasePanel programmeId={programmeId}
                session={{ id: session.id, title: session.title, focusCriteriaIds: session.focusCriteriaIds,
                  criterionWeightsJson: session.criterionWeightsJson, evaluationSelectionId: session.evaluationSelectionId }}
                onUpdateSession={async (patch: any) => { await sessionsApi.update(programmeId, session.id, patch); await load() }} />
            </div>
          </MagicCard>
        )}

        {/* Criteria evaluated in this session */}
        {!isNew && session && criteria.length > 0 && (
          <CriteriaCard programmeId={programmeId} session={session} criteria={criteria} onChanged={load} />
        )}

        {/* Attach / detach from a parent range (day sessions) */}
        {!isNew && session && isDay && (eligibleParents.length > 0 || parent) && (
          <MagicCard className="p-5">
            <h2 className="mb-1 flex items-center gap-2 font-semibold text-foreground">
              <Link2 className="h-4 w-4 text-brand-500" />Rattachement
            </h2>
            <p className="mb-3 text-xs text-muted-foreground">
              Une journée peut être imbriquée dans une plage (ex. un atelier pendant l&apos;incubation) — ou autonome.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex-1">
                <Select value={session.parentSessionId ?? ''} disabled={busy}
                  onChange={(e) => setParentSession(e.target.value)}>
                  <option value="">— Aucune (session autonome) —</option>
                  {eligibleParents.map((p) => (
                    <option key={p.id} value={p.id}>{p.title} ({fmtDay(p.startDate)} → {fmtDay(p.endDate)})</option>
                  ))}
                  {/* Keep the current parent selectable even if dates drifted outside it. */}
                  {parent && !eligibleParents.some((p) => p.id === parent.id) && (
                    <option value={parent.id}>{parent.title}</option>
                  )}
                </Select>
              </div>
              {parent && (
                <Button variant="outline" size="sm" disabled={busy} onClick={() => setParentSession('')} className="gap-1.5">
                  <X className="h-3.5 w-3.5" />Détacher de « {parent.title} »
                </Button>
              )}
            </div>
          </MagicCard>
        )}

        {/* Sub-sessions (range sessions) */}
        {!isNew && session && !isDay && (
          <SubSessions programmeId={programmeId} parentId={session.id} children={children} />
        )}

        {/* Activities agenda (day sessions) */}
        {!isNew && session && isDay && (
          <Activities programmeId={programmeId} session={session} onChanged={load} busy={busy} setBusy={setBusy} />
        )}

        {/* Session gallery — retour en images, feeds the presentation studio */}
        {!isNew && session && (
          <SessionGalleryCard programmeId={programmeId} session={session} onChanged={load} />
        )}

        {/* Update history — who changed what, from which account + IP */}
        {!isNew && session && (
          <SessionHistoryCard programmeId={programmeId} sessionId={session.id} />
        )}
      </div>

      {/* Post-critical-update suggestion → role-by-role mail wizard */}
      <UpdateNotifySuggestion programmeId={programmeId} programmeName={programmeName}
        suggest={suggest}
        onClose={() => {
          setSuggest(null)
          if (afterSuggest) { const t = afterSuggest; setAfterSuggest(null); router.push(t) }
        }} />
    </AdminLayout>
  )
}

// ── Session gallery (retour en images) ───────────────────────────────────────
function SessionGalleryCard({ programmeId, session, onChanged }: {
  programmeId: number; session: Session; onChanged: () => Promise<void>
}) {
  const urls = session.galleryUrls ?? []
  const [busy, setBusy] = useState(false)
  const save = async (next: string[]) => {
    setBusy(true)
    try { await sessionsApi.update(programmeId, session.id, { galleryUrls: next }); await onChanged() }
    catch (e: any) { toast.error(e?.response?.data?.message ?? 'Enregistrement impossible') }
    finally { setBusy(false) }
  }
  return (
    <MagicCard className="p-5">
      <h2 className="mb-1 flex items-center gap-2 font-semibold text-foreground">
        <ImageIcon className="h-4 w-4 text-brand-500" />Retour en images
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Photos de cette session — elles alimentent la galerie du studio de présentation.
      </p>
      {urls.length > 0 && (
        <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {urls.map((u, i) => (
            <div key={`${u}-${i}`} className="group relative overflow-hidden rounded-xl border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" className="h-24 w-full object-cover" />
              <button type="button" title="Retirer" disabled={busy}
                onClick={() => save(urls.filter((_, j) => j !== i))}
                className="absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white group-hover:flex">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      {/* key = length → the picker resets after each successful add */}
      <ImageUpload key={urls.length} value="" folder="sessions" compact searchContext="feature"
        onChange={(u) => { if (u) save([...urls, u]) }} />
      {busy && <p className="mt-2 text-[11px] text-muted-foreground">Enregistrement…</p>}
    </MagicCard>
  )
}

// ── Update history (audit trail) ─────────────────────────────────────────────
const AUDIT_ACTION: Record<string, { label: string; cls: string }> = {
  CREATED:  { label: 'Création',    cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  UPDATED:  { label: 'Modification', cls: 'bg-sky-500/15 text-sky-700 dark:text-sky-300' },
  TRASHED:  { label: 'Corbeille',   cls: 'bg-rose-500/15 text-rose-700 dark:text-rose-300' },
  RESTORED: { label: 'Restauration', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  PURGED:   { label: 'Suppression définitive', cls: 'bg-rose-500/15 text-rose-700 dark:text-rose-300' },
}

function SessionHistoryCard({ programmeId, sessionId }: { programmeId: number; sessionId: number }) {
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let cancelled = false
    sessionsApi.history(programmeId, sessionId)
      .then((r) => { if (!cancelled) setEntries(r.data ?? []) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [programmeId, sessionId])

  const shown = expanded ? entries : entries.slice(0, 5)

  return (
    <MagicCard className="p-5">
      <h2 className="mb-1 flex items-center gap-2 font-semibold text-foreground">
        <History className="h-4 w-4 text-brand-500" />Historique des modifications
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Chaque changement est journalisé avec le compte et l&apos;adresse IP qui l&apos;ont effectué.
      </p>
      {loading ? (
        <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
      ) : entries.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-5 text-center text-xs text-muted-foreground">
          Aucune modification journalisée pour l&apos;instant.
        </p>
      ) : (
        <div className="space-y-1.5">
          {shown.map((e) => {
            const meta = AUDIT_ACTION[e.action] ?? { label: e.action, cls: 'bg-muted text-muted-foreground' }
            return (
              <div key={e.id} className="rounded-xl border border-border bg-card p-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.cls}`}>{meta.label}</span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <UserRound className="h-3 w-3" />{e.userEmail || 'Compte inconnu'}
                  </span>
                  {e.ipAddress && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      <Globe className="h-3 w-3" />{e.ipAddress}
                    </span>
                  )}
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {e.createdAt ? new Date(e.createdAt).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : ''}
                  </span>
                </div>
                {e.details && <p className="mt-1 whitespace-pre-wrap text-[11px] leading-snug text-foreground/80">{e.details}</p>}
              </div>
            )
          })}
          {entries.length > 5 && (
            <button onClick={() => setExpanded((v) => !v)}
              className="w-full rounded-lg border border-border px-3 py-1.5 text-[11px] font-semibold text-muted-foreground hover:bg-accent">
              {expanded ? 'Réduire' : `Afficher tout (${entries.length})`}
            </button>
          )}
        </div>
      )}
    </MagicCard>
  )
}

// ── Criteria evaluated in this session ───────────────────────────────────────
function CriteriaCard({ programmeId, session, criteria, onChanged }: {
  programmeId: number; session: Session; criteria: Criterion[]; onChanged: () => Promise<void>
}) {
  const allIds = criteria.map((c) => c.id)
  const focus = session.focusCriteriaIds ?? []
  const isSelected = (cid: number) => focus.length === 0 || focus.includes(cid)
  let weights: Record<string, number> = {}
  try { if (session.criterionWeightsJson) weights = JSON.parse(session.criterionWeightsJson) } catch { /* ignore */ }

  const toggle = async (cid: number) => {
    const setIds = new Set<number>(focus.length ? focus : allIds)
    if (setIds.has(cid)) setIds.delete(cid); else setIds.add(cid)
    const next = allIds.filter((x) => setIds.has(x))
    try {
      await sessionsApi.update(programmeId, session.id, { focusCriteriaIds: next.length === allIds.length ? [] : next })
      await onChanged()
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Mise à jour impossible') }
  }
  const commitWeight = async (cid: number, val: number) => {
    try {
      await sessionsApi.update(programmeId, session.id, { criterionWeightsJson: JSON.stringify({ ...weights, [cid]: val }) })
      await onChanged()
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Mise à jour impossible') }
  }

  return (
    <MagicCard className="p-5">
      <h2 className="mb-1 flex items-center gap-2 font-semibold text-foreground">
        <Target className="h-4 w-4 text-brand-500" />Critères de cette session
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Les critères sur lesquels le jury note pendant cette session. Rien de coché = tous les critères du programme s&apos;appliquent.
      </p>
      <div className="space-y-1.5">
        {criteria.map((c) => {
          const sel = isSelected(c.id)
          const w = weights[c.id] ?? c.weight ?? 0
          return (
            <div key={c.id} className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2">
              <input type="checkbox" checked={sel} onChange={() => toggle(c.id)} className="h-4 w-4 shrink-0 accent-brand-500" />
              <span className={`min-w-0 flex-1 truncate text-sm ${sel ? 'text-foreground' : 'text-muted-foreground line-through'}`} title={c.name}>{c.name}</span>
              {sel && (
                <label className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                  Poids
                  <input type="number" min={0} max={1} step={0.05} defaultValue={Number(w)} key={`${c.id}-${w}`}
                    onBlur={(e) => {
                      const val = Math.max(0, Math.min(1, Number(e.target.value) || 0))
                      if (val !== Number(w)) commitWeight(c.id, val)
                    }}
                    className="h-8 w-16 rounded-md border border-input bg-background px-1.5 text-xs" title="Poids (0–1)" />
                </label>
              )}
            </div>
          )
        })}
      </div>
    </MagicCard>
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

// ── Activities agenda — 2-step creation (Quoi ? → Quand ?) ───────────────────
function Activities({ programmeId, session, onChanged, busy, setBusy }: {
  programmeId: number; session: Session; onChanged: () => Promise<void>; busy: boolean; setBusy: (b: boolean) => void
}) {
  const [adding, setAdding] = useState(false)
  const [aStep, setAStep] = useState(0)
  const [draft, setDraft] = useState({ title: '', location: '', startTime: '', endTime: '' })

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

  const openAdd = () => { setDraft({ title: '', location: '', startTime: '', endTime: '' }); setAStep(0); setAdding(true) }

  const add = async () => {
    setBusy(true)
    try {
      const dayId = await ensureDayId()
      if (dayId == null) throw new Error('no day')
      await sessionsApi.addActivity(programmeId, session.id, dayId, {
        title: draft.title.trim(), location: draft.location.trim() || undefined,
        startTime: draft.startTime || undefined, endTime: draft.endTime || undefined,
      })
      setAdding(false)
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
        <Button variant="outline" size="sm" className="gap-1.5" onClick={openAdd}>
          <Plus className="h-3.5 w-3.5" />Activité
        </Button>
      </div>

      {adding && (
        <div className="mb-3 space-y-3 rounded-xl border border-border bg-muted/20 p-4">
          {/* mini stepper */}
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground">Étape {aStep + 1} / 2 · {aStep === 0 ? 'Quoi ?' : 'Quand ?'}</span>
            <button onClick={() => setAdding(false)} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${((aStep + 1) / 2) * 100}%` }} />
          </div>

          {aStep === 0 ? (
            <div className="space-y-2">
              <Input value={draft.title} placeholder="Titre (ex. Pitch training)" autoFocus
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter' && draft.title.trim()) setAStep(1) }} />
              <Input value={draft.location} placeholder="Lieu (optionnel)"
                onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))} />
              <div className="flex justify-end">
                <Button variant="brand" size="sm" className="gap-1.5"
                  onClick={() => { if (!draft.title.trim()) { toast.error('Titre requis.'); return } setAStep(1) }}>
                  Suivant<ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Input type="time" value={draft.startTime} onChange={(e) => setDraft((d) => ({ ...d, startTime: e.target.value }))} className="w-32" />
                <span className="text-muted-foreground">→</span>
                <Input type="time" value={draft.endTime} onChange={(e) => setDraft((d) => ({ ...d, endTime: e.target.value }))} className="w-32" />
              </div>
              <div className="flex justify-between">
                <Button variant="ghost" size="sm" onClick={() => setAStep(0)}>Précédent</Button>
                <Button variant="brand" size="sm" className="gap-1.5" onClick={add} disabled={busy}>
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}Ajouter l&apos;activité
                </Button>
              </div>
            </div>
          )}
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
              {a.location && <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{a.location}</span>}
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
