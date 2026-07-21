'use client'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft, ArrowRight, Check, Loader2, Rocket, FileText, CalendarClock,
  ClipboardList, Save, Lock, Info, Sparkles, FormInput, Wand2, X,
  Target, Building2, Mail, Image as ImageIcon, Trash2, Plus, Send, MapPin,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { programmesApi, sessionsApi, partnersApi, notificationsApi, CATALOG_CATEGORIES } from '@/lib/api'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { MagicCard } from '@/components/magicui/magic-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { AiField } from '@/components/ai/AiField'
import { ImageUpload } from '@/components/upload/ImageUpload'
import { CatalogMultiSelect } from '@/components/catalog/CatalogMultiSelect'
import { FormBuilder } from '@/components/formbuilder/FormBuilder'
import { parseSchema, type CustomFormSchema } from '@/components/formbuilder/schema'

/** A person to invite from the wizard's optional invite step. */
interface Invitee { email: string; name: string }
/** An evaluation criterion drafted in the wizard (persisted immediately once it has an id). */
interface WizCriterion { id?: number; name: string; description: string; weight: number }
interface WizPartner { id: number; name: string; logoUrl?: string }
/** Invitation types offered in the wizard (a subset of the full catalogue). */
const INVITE_TYPES: { value: string; label: string }[] = [
  { value: 'PORTEUR', label: 'Porteur / startup' },
  { value: 'JURY', label: 'Jury' },
  { value: 'MENTOR', label: 'Mentor' },
  { value: 'GUEST', label: 'Invité' },
]

const TYPES = { PUBLIC: 'Public', PRIVATE: 'Privé' } as const

const FORM_TEMPLATES = [
  { value: 'STANDARD',  label: 'Standard',    description: 'Formulaire officiel Medianet — 4 sections complètes' },
  { value: 'MINIMAL',   label: 'Minimaliste', description: 'Hackathons / contests — projet + motivation' },
  { value: 'FOODSTART', label: 'FoodStart',   description: 'FoodTech — distribution + production' },
  { value: 'TECH',      label: 'Tech / SaaS', description: 'Startups tech — stack + scalabilité' },
  { value: 'AGRITECH',  label: 'Agritech',    description: 'Agriculture — partenariats + impact' },
]

const STEPS = [
  { key: 'basics',   title: 'L’essentiel',   icon: Rocket,        blurb: 'Nom, type et dates du programme' },
  { key: 'present',  title: 'Présentation',  icon: FileText,      blurb: 'Description, visuel et secteurs' },
  { key: 'criteria', title: 'Critères',      icon: Target,        blurb: 'Critères d’évaluation' },
  { key: 'partners', title: 'Partenaires',   icon: Building2,     blurb: 'Partenaires du programme' },
  { key: 'apply',    title: 'Candidature',   icon: CalendarClock, blurb: 'Formulaire et fenêtre de dépôt' },
  { key: 'invite',   title: 'Invitations',   icon: Mail,          blurb: 'Inviter des personnes (optionnel)' },
  { key: 'review',   title: 'Révision',      icon: ClipboardList, blurb: 'Vérifier et publier' },
] as const
type StepKey = typeof STEPS[number]['key']

interface WizardForm {
  title: string; type: string
  startDate: string; endDate: string
  tagline: string; description: string; sectors: string[]
  logoUrl: string; bannerImageUrl: string; location: string
  formTemplate: string
  /** JSON of a custom form schema; non-empty ⇒ custom form overrides the preset. */
  customFormSchema: string
  candStart: string; candEnd: string
}
const EMPTY: WizardForm = {
  title: '', type: 'PUBLIC', startDate: '', endDate: '',
  tagline: '', description: '', sectors: [],
  logoUrl: '', bannerImageUrl: '', location: '',
  formTemplate: 'STANDARD', customFormSchema: '',
  candStart: '', candEnd: '',
}

const fmt = (d?: string) => d ? new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

export default function NewProgrammePage() {
  return (
    <Suspense fallback={<AdminLayout><div className="mx-auto max-w-3xl"><Skeleton className="h-96 rounded-2xl" /></div></AdminLayout>}>
      <NewProgrammeWizard />
    </Suspense>
  )
}

function NewProgrammeWizard() {
  const router = useRouter()
  const search = useSearchParams()
  const draftParam = search.get('draft')

  const [form, setForm] = useState<WizardForm>(EMPTY)
  const [step, setStep] = useState(0)
  const [draftId, setDraftId] = useState<number | null>(draftParam ? Number(draftParam) : null)
  const [candPhaseId, setCandPhaseId] = useState<number | null>(null)
  const [loading, setLoading] = useState(!!draftParam)
  const [saving, setSaving] = useState(false)
  // 'template' = one of the presets · 'custom' = build your own form (FormBuilder)
  const [formMode, setFormMode] = useState<'template' | 'custom'>('template')
  const [formModal, setFormModal] = useState(false)
  // Criteria / partners are persisted immediately (the draft already has an id by
  // the time these steps are reached), so they live outside the wizard form.
  const [criteria, setCriteria] = useState<WizCriterion[]>([])
  const [critDraft, setCritDraft] = useState<WizCriterion>({ name: '', description: '', weight: 0.25 })
  const [allPartners, setAllPartners] = useState<WizPartner[]>([])
  const [linkedPartnerIds, setLinkedPartnerIds] = useState<number[]>([])
  const [newPartner, setNewPartner] = useState({ name: '', logoUrl: '' })
  const [busy, setBusy] = useState(false)
  // Invitations are optional and fire-and-forget at the invite step.
  const [invitees, setInvitees] = useState<Invitee[]>([])
  const [inviteDraft, setInviteDraft] = useState<Invitee>({ email: '', name: '' })
  const [inviteType, setInviteType] = useState('PORTEUR')
  const [invitesSent, setInvitesSent] = useState(0)
  const set = <K extends keyof WizardForm>(k: K, v: WizardForm[K]) => setForm((f) => ({ ...f, [k]: v }))
  const customSchema = useMemo(() => parseSchema(form.customFormSchema), [form.customFormSchema])
  // Private programmes are invitation-only: no public candidature window.
  const isPrivate = form.type === 'PRIVATE'

  const idx = (k: StepKey) => STEPS.findIndex((s) => s.key === k)
  const reached = (k: StepKey) => step >= idx(k)
  const stepKey = STEPS[step].key

  // The full partner catalogue is needed as soon as the Partenaires step shows.
  useEffect(() => { partnersApi.list().then((r) => setAllPartners(r.data ?? [])).catch(() => {}) }, [])

  // ── Hydrate an existing draft so the wizard is fully resumable ──────────────
  useEffect(() => {
    if (!draftParam) return
    let cancelled = false
    ;(async () => {
      try {
        const { data: p } = await programmesApi.get(Number(draftParam))
        const sess = await sessionsApi.list(Number(draftParam)).then((r) => r.data ?? []).catch(() => [])
        const cand = (sess as any[]).find((s) => s.sessionType === 'CANDIDATURE_SUBMISSION')
        if (cancelled) return
        const custom = (p.customFormSchema ?? '').trim()
        setForm({
          title: p.title ?? '', type: p.type ?? 'PUBLIC',
          startDate: p.startDate?.substring(0, 10) ?? '', endDate: p.endDate?.substring(0, 10) ?? '',
          tagline: p.tagline ?? '', description: p.description ?? '',
          sectors: p.sectors ?? [],
          logoUrl: p.logoUrl ?? '', bannerImageUrl: p.bannerImageUrl ?? '', location: p.location ?? '',
          formTemplate: p.formTemplate ?? 'STANDARD',
          customFormSchema: custom.length > 2 ? custom : '',
          candStart: cand?.startDate?.substring(0, 10) ?? '', candEnd: cand?.endDate?.substring(0, 10) ?? '',
        })
        if (custom.length > 2) setFormMode('custom')
        setCandPhaseId(cand?.id ?? null)
        setLinkedPartnerIds((p.partners ?? []).map((x: any) => x.id))
        try {
          const cr = await programmesApi.criteria(Number(draftParam)).then((r) => r.data ?? [])
          setCriteria(cr.map((c: any) => ({ id: c.id, name: c.name, description: c.description ?? '', weight: c.weight ?? 0 })))
        } catch { /* criteria are optional */ }
        // Resume at the first step still missing something.
        setStep(resumeStep(p, cand))
      } catch { toast.error('Brouillon introuvable') }
      finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [draftParam])

  const contextForAi = useMemo(
    () => [form.title, form.sectors.join(', '), form.tagline].filter(Boolean).join(' — '),
    [form.title, form.sectors, form.tagline],
  )

  // The clôture IS the end of the candidature window — never the opening date.
  const derivedDeadline = form.candEnd

  // ── Per-step validation ─────────────────────────────────────────────────────
  const stepError = (s: number): string | null => {
    const key = STEPS[s]?.key
    if (key === 'basics') {
      if (!form.title.trim()) return 'Donnez un nom au programme.'
      if (!form.startDate || !form.endDate) return 'Les dates de début et de fin sont obligatoires.'
      if (form.endDate < form.startDate) return 'La date de fin doit suivre la date de début.'
    }
    if (key === 'present') {
      if (!form.description.trim()) return 'Ajoutez une description.'
      if (form.sectors.length === 0) return 'Choisissez au moins un secteur.'
    }
    // 'criteria' & 'partners' are optional — no blocking validation.
    if (key === 'apply') {
      if (formMode === 'custom' && (!customSchema || customSchema.sections.length === 0))
        return 'Construisez votre formulaire personnalisé (au moins une section).'
      // Private = invitation-only: no public candidature window to define.
      if (!isPrivate) {
        if (!form.candStart || !form.candEnd) return 'Définissez la fenêtre de candidature (elle fixe la clôture).'
        if (form.candEnd < form.candStart) return 'La fin de candidature doit suivre son début.'
        if (form.startDate && form.candStart < form.startDate) return 'La candidature ne peut pas commencer avant le programme.'
        if (form.endDate && form.candEnd > form.endDate) return 'La candidature ne peut pas se terminer après le programme.'
      }
    }
    // 'invite' is optional — no blocking validation.
    return null
  }

  // ── Criteria — persisted immediately (draft id exists by this step) ─────────
  const addCriterion = async () => {
    const name = critDraft.name.trim()
    if (!name) { toast.error('Nommez le critère.'); return }
    const id = draftId
    if (id == null) { toast.error('Enregistrez d’abord les premières étapes.'); return }
    setBusy(true)
    try {
      const { data } = await programmesApi.addCriterion(id, { name, description: critDraft.description || undefined, weight: critDraft.weight })
      setCriteria((cs) => [...cs, { id: data?.id, name, description: critDraft.description, weight: critDraft.weight }])
      setCritDraft({ name: '', description: '', weight: 0.25 })
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Ajout du critère impossible') }
    finally { setBusy(false) }
  }
  const removeCriterion = async (c: WizCriterion, i: number) => {
    setBusy(true)
    try {
      if (c.id != null && draftId != null) await programmesApi.deleteCriterion(draftId, c.id)
      setCriteria((cs) => cs.filter((_, j) => j !== i))
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Suppression impossible') }
    finally { setBusy(false) }
  }

  // ── Partners — link/unlink immediately ──────────────────────────────────────
  const togglePartner = async (p: WizPartner) => {
    const id = draftId
    if (id == null) { toast.error('Enregistrez d’abord les premières étapes.'); return }
    const linked = linkedPartnerIds.includes(p.id)
    setBusy(true)
    try {
      if (linked) { await partnersApi.removeFromProgramme(id, p.id); setLinkedPartnerIds((xs) => xs.filter((x) => x !== p.id)) }
      else { await partnersApi.addToProgramme(id, p.id); setLinkedPartnerIds((xs) => [...xs, p.id]) }
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Action impossible') }
    finally { setBusy(false) }
  }
  const createAndLinkPartner = async () => {
    const name = newPartner.name.trim()
    if (!name) { toast.error('Nom du partenaire requis.'); return }
    const id = draftId
    if (id == null) { toast.error('Enregistrez d’abord les premières étapes.'); return }
    setBusy(true)
    try {
      const { data: created } = await partnersApi.create({ name, logoUrl: newPartner.logoUrl.trim() || undefined })
      setAllPartners((ps) => [...ps, created])
      await partnersApi.addToProgramme(id, created.id)
      setLinkedPartnerIds((xs) => [...xs, created.id])
      setNewPartner({ name: '', logoUrl: '' })
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Création impossible') }
    finally { setBusy(false) }
  }

  // ── Invitations — optional, sent on demand from the invite step ─────────────
  const addInvitee = () => {
    const email = inviteDraft.email.trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast.error('E-mail invalide.'); return }
    if (invitees.some((v) => v.email === email)) { toast.error('Déjà dans la liste.'); return }
    setInvitees((vs) => [...vs, { email, name: inviteDraft.name.trim() }])
    setInviteDraft({ email: '', name: '' })
  }
  const sendInvites = async () => {
    if (invitees.length === 0) { toast.error('Ajoutez au moins une personne.'); return }
    const id = draftId
    if (id == null) { toast.error('Enregistrez d’abord le programme.'); return }
    setBusy(true)
    const typeLabel = INVITE_TYPES.find((t) => t.value === inviteType)?.label ?? 'invité'
    const results = await Promise.allSettled(invitees.map((v) =>
      notificationsApi.create({
        type: inviteType, programmeId: id, programmeName: form.title.trim(),
        recipientEmail: v.email, recipientName: v.name || undefined,
        subject: `Invitation — « ${form.title.trim()} »`,
        message: `Bonjour ${v.name || ''},\n\nVous êtes invité·e à « ${form.title.trim() }» en tant que ${typeLabel}. Cliquez sur le lien ci-dessous pour en savoir plus.\n\nL’équipe Medianet`,
        requiresRsvp: true,
      })))
    setBusy(false)
    const ok = results.filter((r) => r.status === 'fulfilled').length
    setInvitesSent((n) => n + ok)
    setInvitees([])
    if (ok) toast.success(`${ok} invitation(s) envoyée(s)${ok < results.length ? ` · ${results.length - ok} échec(s)` : ''}`)
    else toast.error('Aucune invitation envoyée')
  }

  // ── Persist the current step (create draft on first save, else update) ───────
  const persist = useCallback(async (): Promise<number | null> => {
    let id = draftId
    // Step 0 creates the DRAFT the first time; later steps just patch it.
    if (id == null) {
      const { data } = await programmesApi.create({
        title: form.title.trim(), type: form.type, status: 'DRAFT',
        startDate: form.startDate, endDate: form.endDate,
      })
      id = data.id
      setDraftId(id)
      router.replace(`/programmes/new?draft=${id}`)
      return id
    }
    const patch: any = { title: form.title.trim(), type: form.type, startDate: form.startDate, endDate: form.endDate }
    if (reached('present')) {
      patch.tagline = form.tagline || undefined
      patch.description = form.description
      patch.sectors = form.sectors
      patch.logoUrl = form.logoUrl || undefined
      patch.bannerImageUrl = form.bannerImageUrl || undefined
      patch.location = form.location || undefined
    }
    if (reached('apply')) {
      patch.formTemplate = form.formTemplate
      // A non-empty custom schema overrides the preset; '' clears it so the preset applies.
      patch.customFormSchema = formMode === 'custom' ? form.customFormSchema : ''
    }
    await programmesApi.update(id, patch)

    // Candidature session — its window drives the clôture automatically (backend).
    // Private programmes are invitation-only, so they never carry one; if the type
    // was switched to private after a session existed, remove the stale session.
    if (reached('apply') && isPrivate) {
      if (candPhaseId != null) {
        try { await sessionsApi.delete(id, candPhaseId); setCandPhaseId(null) } catch { /* non-fatal */ }
      }
    } else if (reached('apply') && form.candStart) {
      const payload = {
        title: 'Candidature', sessionType: 'CANDIDATURE_SUBMISSION', durationKind: 'range',
        startDate: form.candStart, endDate: form.candEnd || form.candStart,
        color: '#0EA5E9', lane: 'Principal', phaseOrder: 0,
      }
      try {
        if (candPhaseId == null) {
          const { data: created } = await sessionsApi.create(id, payload)
          setCandPhaseId((created as any)?.id ?? null)
        } else {
          await sessionsApi.update(id, candPhaseId, payload)
        }
      } catch { /* non-fatal: the programme itself is saved */ }
    }
    return id
  }, [draftId, form, step, candPhaseId, router])

  const goNext = async () => {
    const err = stepError(step)
    if (err) { toast.error(err); return }
    setSaving(true)
    try {
      await persist()
      toast.success('Étape enregistrée', { id: 'wiz-save', duration: 1500 })
      setStep((s) => Math.min(STEPS.length - 1, s + 1))
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Enregistrement impossible')
    } finally { setSaving(false) }
  }

  const saveAndClose = async () => {
    const err = stepError(Math.min(step, 0))
    if (err) { toast.error(err); return }
    setSaving(true)
    try { const id = await persist(); toast.success('Brouillon enregistré'); router.push(id ? `/programmes/${id}` : '/programmes') }
    catch (e: any) { toast.error(e?.response?.data?.message ?? 'Erreur') }
    finally { setSaving(false) }
  }

  const publish = async () => {
    for (const key of ['basics', 'present', 'apply'] as StepKey[]) {
      const s = STEPS.findIndex((x) => x.key === key)
      const e = stepError(s); if (e) { setStep(s); toast.error(e); return }
    }
    setSaving(true)
    try {
      const id = await persist()
      if (id == null) throw new Error('no id')
      await programmesApi.update(id, { status: 'OPEN' })
      toast.success('Programme publié 🎉')
      router.push(`/programmes/${id}`)
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Publication impossible')
    } finally { setSaving(false) }
  }

  if (loading) {
    return <AdminLayout><div className="mx-auto max-w-3xl space-y-4">
      <Skeleton className="h-8 w-64 rounded-lg" /><Skeleton className="h-16 rounded-xl" /><Skeleton className="h-80 rounded-2xl" />
    </div></AdminLayout>
  }

  const CurrentIcon = STEPS[step].icon

  return (
    <AdminLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <Link href="/programmes"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">Nouveau programme</h1>
            <p className="text-sm text-muted-foreground">
              {draftId ? `Brouillon #${draftId} — enregistré automatiquement à chaque étape` : 'Créez votre programme étape par étape'}
            </p>
          </div>
          {draftId && (
            <Button variant="outline" size="sm" onClick={saveAndClose} disabled={saving} className="gap-1.5">
              <Save className="h-3.5 w-3.5" />Enregistrer et quitter
            </Button>
          )}
        </motion.div>

        {/* Stepper — progress bar + fixed-size numbered dots. Labels only show on
            wide screens (md+) under each dot; on small screens the current step's
            title lives in the header line, so nothing ever overflows. */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-foreground">
              Étape {step + 1} / {STEPS.length} · {STEPS[step].title}
            </span>
            <span className="hidden text-muted-foreground sm:block">{STEPS[step].blurb}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-brand-500 transition-all duration-300"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
          </div>
          <ol className="flex items-start gap-1">
            {STEPS.map((s, i) => {
              const done = i < step, active = i === step
              return (
                <li key={s.key} className="flex flex-1 flex-col items-center gap-1">
                  <button type="button" disabled={i > step} title={s.title}
                    onClick={() => i <= step && setStep(i)}
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-colors ${
                      active ? 'border-brand-500 bg-brand-500 text-white'
                      : done ? 'border-emerald-500 bg-emerald-500 text-white'
                      : 'border-border bg-muted text-muted-foreground'} ${
                      i <= step ? 'cursor-pointer hover:opacity-90' : 'cursor-not-allowed opacity-50'}`}>
                    {done ? <Check className="h-4 w-4" /> : i + 1}
                  </button>
                  <span className={`hidden text-center text-[10px] font-medium leading-tight md:block ${
                    active ? 'text-brand-600 dark:text-brand-300' : 'text-muted-foreground'}`}>{s.title}</span>
                </li>
              )
            })}
          </ol>
        </div>

        <MagicCard className="p-6">
          <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
            <CurrentIcon className="h-4 w-4 text-brand-500" />{STEPS[step].title}
          </p>

          {/* ── Basics ──────────────────────────────────────────────── */}
          {stepKey === 'basics' && (
            <div className="space-y-4">
              <AiField field="title" label="Nom du programme" value={form.title} onChange={(v) => set('title', v)}
                context={contextForAi} placeholder="Ex. Accélérateur Agritech 2026" required
                hint="Le bouton « Générer » propose un nom à partir du secteur et de l’accroche." />
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Type</label>
                  <Select value={form.type} onChange={(e) => set('type', e.target.value)}>
                    {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Date de début <span className="text-red-500">*</span></label>
                  <Input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Date de fin <span className="text-red-500">*</span></label>
                  <Input type="date" value={form.endDate} min={form.startDate || undefined}
                    onChange={(e) => set('endDate', e.target.value)} />
                </div>
              </div>
              <p className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] ${
                isPrivate ? 'bg-violet-500/10 text-violet-700 dark:text-violet-300' : 'bg-muted/60 text-muted-foreground'}`}>
                {isPrivate ? <Lock className="h-3 w-3 shrink-0" /> : <Info className="h-3 w-3 shrink-0" />}
                {isPrivate
                  ? 'Programme privé : aucune candidature publique. Seules les personnes invitées le voient et peuvent le rejoindre — vous enverrez les invitations depuis l’onglet Invitations après création.'
                  : 'Programme public : visible dans le catalogue, avec une fenêtre de candidature ouverte à tous.'}
              </p>
            </div>
          )}

          {/* ── Presentation — text, visuals & location ─────────────── */}
          {stepKey === 'present' && (
            <div className="space-y-4">
              <AiField field="tagline" label="Accroche (tagline)" value={form.tagline} onChange={(v) => set('tagline', v)}
                context={contextForAi} placeholder="Une phrase qui donne envie de candidater" />
              <AiField field="description" label="Description" value={form.description} onChange={(v) => set('description', v)}
                context={contextForAi} multiline rows={6} required
                placeholder="À qui s’adresse ce programme, ce qu’il apporte, comment il se déroule…"
                hint="« Générer » écrit une première version ; « Améliorer » retravaille votre texte." />
              <div className="space-y-1">
                <label className="text-sm font-medium">Secteurs <span className="text-red-500">*</span></label>
                <CatalogMultiSelect category={CATALOG_CATEGORIES.PROGRAMME_SECTOR} categoryLabel="Secteurs de programme"
                  selected={form.sectors} onChange={(v) => set('sectors', v)} addLabel="Nouveau secteur" />
              </div>

              {/* Visuals + location — all optional */}
              <div className="rounded-xl border border-border p-4 space-y-4">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <ImageIcon className="h-4 w-4 text-brand-500" />Visuel &amp; lieu <span className="text-[11px] font-normal text-muted-foreground">(optionnel)</span>
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Logo</label>
                    <ImageUpload value={form.logoUrl} onChange={(url) => set('logoUrl', url)} folder="logos" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Bannière</label>
                    <ImageUpload value={form.bannerImageUrl} onChange={(url) => set('bannerImageUrl', url)} folder="banners" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><MapPin className="h-3 w-3" />Lieu</label>
                  <Input value={form.location} placeholder="Ex. Tunis · Medianet HQ, ou « En ligne »"
                    onChange={(e) => set('location', e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* ── Critères d’évaluation (optional) ─────────────────────── */}
          {stepKey === 'criteria' && (
            <div className="space-y-4">
              <p className="flex items-start gap-1.5 rounded-lg bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Définissez les critères sur lesquels le jury notera les candidatures. Le <b>coefficient</b> pondère le score.
                Optionnel ici — vous pourrez en ajouter à tout moment dans l’onglet « Critères ».
              </p>

              {criteria.length > 0 && (
                <ul className="space-y-1.5">
                  {criteria.map((c, i) => (
                    <li key={c.id ?? i} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
                      <Target className="h-4 w-4 shrink-0 text-brand-500" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{c.name}</p>
                        {c.description && <p className="truncate text-[11px] text-muted-foreground">{c.description}</p>}
                      </div>
                      <span className="shrink-0 rounded-full bg-brand-500/10 px-2 py-0.5 text-[11px] font-semibold text-brand-600 dark:text-brand-300">
                        coef. {Math.round((c.weight ?? 0) * 100)}%
                      </span>
                      <button type="button" onClick={() => removeCriterion(c, i)} disabled={busy}
                        className="shrink-0 rounded p-1 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600 disabled:opacity-50">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="rounded-xl border border-dashed border-border p-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input value={critDraft.name} placeholder="Nom du critère (ex. Innovation)"
                    onChange={(e) => setCritDraft((d) => ({ ...d, name: e.target.value }))} />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">Coefficient</span>
                    <input type="range" min={0} max={100} step={5} value={Math.round((critDraft.weight ?? 0) * 100)}
                      onChange={(e) => setCritDraft((d) => ({ ...d, weight: Number(e.target.value) / 100 }))}
                      className="flex-1 accent-brand-500" />
                    <span className="w-10 text-right text-xs font-bold text-brand-600">{Math.round((critDraft.weight ?? 0) * 100)}%</span>
                  </div>
                </div>
                <Input value={critDraft.description} placeholder="Description (optionnel)"
                  onChange={(e) => setCritDraft((d) => ({ ...d, description: e.target.value }))} />
                <Button type="button" variant="outline" size="sm" onClick={addCriterion} disabled={busy} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" />Ajouter le critère
                </Button>
              </div>
            </div>
          )}

          {/* ── Partenaires (optional) ───────────────────────────────── */}
          {stepKey === 'partners' && (
            <div className="space-y-4">
              <p className="flex items-start gap-1.5 rounded-lg bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Associez les partenaires (sponsors, structures d’accompagnement…) affichés sur le programme. Optionnel.
              </p>

              {allPartners.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {allPartners.map((p) => {
                    const on = linkedPartnerIds.includes(p.id)
                    return (
                      <button type="button" key={p.id} onClick={() => togglePartner(p)} disabled={busy}
                        className={`flex items-center gap-2 rounded-xl border p-2.5 text-left transition-colors disabled:opacity-60 ${
                          on ? 'border-brand-500 bg-brand-500/10' : 'border-border hover:border-brand-400'}`}>
                        {p.logoUrl
                          ? <img src={p.logoUrl} alt="" className="h-8 w-8 shrink-0 rounded-md object-contain" />
                          : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted"><Building2 className="h-4 w-4 text-muted-foreground" /></span>}
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{p.name}</span>
                        {on && <Check className="h-4 w-4 shrink-0 text-brand-600" />}
                      </button>
                    )
                  })}
                </div>
              )}

              <div className="rounded-xl border border-dashed border-border p-4">
                <p className="mb-2 text-xs font-semibold text-foreground">Nouveau partenaire</p>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[160px] flex-1 space-y-1">
                    <label className="text-[11px] text-muted-foreground">Nom</label>
                    <Input value={newPartner.name} placeholder="Nom du partenaire"
                      onChange={(e) => setNewPartner((p) => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div className="min-w-[160px] flex-1 space-y-1">
                    <label className="text-[11px] text-muted-foreground">Logo (URL, optionnel)</label>
                    <Input value={newPartner.logoUrl} placeholder="https://…"
                      onChange={(e) => setNewPartner((p) => ({ ...p, logoUrl: e.target.value }))} />
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={createAndLinkPartner} disabled={busy} className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" />Créer &amp; associer
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── Candidature (form + the session that drives clôture) ── */}
          {stepKey === 'apply' && (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Formulaire de candidature</label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {FORM_TEMPLATES.map((t) => {
                    const on = formMode === 'template' && form.formTemplate === t.value
                    return (
                      <button type="button" key={t.value}
                        onClick={() => { setFormMode('template'); set('formTemplate', t.value) }}
                        className={`rounded-xl border p-3 text-left transition-colors ${
                          on ? 'border-brand-500 bg-brand-500/10' : 'border-border hover:border-brand-400'}`}>
                        <p className="text-sm font-semibold text-foreground">{t.label}</p>
                        <p className="text-[11px] text-muted-foreground">{t.description}</p>
                      </button>
                    )
                  })}
                  {/* Custom form — build your own sections & fields */}
                  <button type="button" onClick={() => { setFormMode('custom'); setFormModal(true) }}
                    className={`rounded-xl border p-3 text-left transition-colors sm:col-span-2 ${
                      formMode === 'custom' ? 'border-brand-500 bg-brand-500/10' : 'border-dashed border-brand-400 hover:bg-brand-500/5'}`}>
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      <Wand2 className="h-3.5 w-3.5 text-brand-500" />Personnalisé
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {formMode === 'custom' && customSchema
                        ? `${customSchema.sections.length} section(s) · ${customSchema.sections.reduce((a, s) => a + s.fields.length, 0)} champ(s) — cliquez pour modifier`
                        : 'Construisez vos propres sections et champs'}
                    </p>
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  {formMode === 'custom'
                    ? 'Votre formulaire personnalisé remplace le modèle. Modifiable ensuite dans le Parcours.'
                    : 'Le formulaire détaillé reste personnalisable ensuite dans le Parcours du programme.'}
                </p>
              </div>

              {isPrivate ? (
                <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
                  <p className="mb-1 flex items-center gap-1.5 text-sm font-medium text-foreground">
                    <Lock className="h-4 w-4 text-violet-500" />Programme sur invitation
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Un programme privé n’a <b>pas de fenêtre de candidature publique</b> : il n’apparaît pas dans le
                    catalogue et seules les personnes que vous invitez peuvent le voir et le rejoindre. Une fois le
                    programme créé, ouvrez son onglet <b>Invitations</b> pour convier des porteurs, un jury ou des invités —
                    chacun reçoit un lien personnel. Le formulaire ci-dessus reste celui qu’ils rempliront.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-border p-4">
                  <p className="mb-1 flex items-center gap-1.5 text-sm font-medium text-foreground">
                    <CalendarClock className="h-4 w-4 text-sky-500" />Session de candidature
                  </p>
                  <p className="mb-3 text-[11px] text-muted-foreground">
                    Ces dates créent la <b>session de candidature</b> du programme : il accepte les dépôts pendant cette période.
                    La <b>clôture est automatique</b> — c’est la fin de cette session. Elle doit rester dans la fenêtre du
                    programme ({fmt(form.startDate)} → {fmt(form.endDate)}).
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Ouverture des candidatures <span className="text-red-500">*</span></label>
                      <Input type="date" value={form.candStart}
                        min={form.startDate || undefined} max={form.endDate || undefined}
                        onChange={(e) => set('candStart', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Clôture (fin de session) <span className="text-red-500">*</span></label>
                      <Input type="date" value={form.candEnd}
                        min={form.candStart || form.startDate || undefined} max={form.endDate || undefined}
                        onChange={(e) => set('candEnd', e.target.value)} />
                    </div>
                  </div>
                  {derivedDeadline ? (
                    <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-sky-500/10 px-2.5 py-1.5 text-[11px] text-sky-700 dark:text-sky-300">
                      <Lock className="h-3 w-3" />Clôture des candidatures fixée automatiquement au <b>{fmt(derivedDeadline)}</b> (fin de la session).
                    </p>
                  ) : (
                    <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-muted/60 px-2.5 py-1.5 text-[11px] text-muted-foreground">
                      <Info className="h-3 w-3" />Renseignez la date de clôture — elle deviendra automatiquement la clôture des candidatures.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Invitations (optional) ──────────────────────────────── */}
          {stepKey === 'invite' && (
            <div className="space-y-4">
              <p className="flex items-start gap-1.5 rounded-lg bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Étape facultative : invitez dès maintenant des porteurs, un jury, des mentors ou des invités. Chacun reçoit
                un lien personnel. Vous pourrez toujours en inviter d’autres depuis l’onglet « Invitations ».
              </p>

              <div className="flex flex-wrap items-end gap-2">
                <div className="w-40 space-y-1">
                  <label className="text-[11px] text-muted-foreground">Rôle</label>
                  <Select value={inviteType} onChange={(e) => setInviteType(e.target.value)}>
                    {INVITE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </Select>
                </div>
                <div className="min-w-[150px] flex-1 space-y-1">
                  <label className="text-[11px] text-muted-foreground">E-mail</label>
                  <Input type="email" value={inviteDraft.email} placeholder="personne@exemple.com"
                    onChange={(e) => setInviteDraft((d) => ({ ...d, email: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addInvitee() } }} />
                </div>
                <div className="min-w-[130px] flex-1 space-y-1">
                  <label className="text-[11px] text-muted-foreground">Nom (optionnel)</label>
                  <Input value={inviteDraft.name} placeholder="Prénom Nom"
                    onChange={(e) => setInviteDraft((d) => ({ ...d, name: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addInvitee() } }} />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addInvitee} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" />Ajouter
                </Button>
              </div>

              {/* Clean, readable list of people to invite */}
              {invitees.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-muted/10 p-6 text-center text-xs text-muted-foreground">
                  {invitesSent > 0 ? `${invitesSent} invitation(s) déjà envoyée(s). Ajoutez-en d’autres ou passez à la suite.` : 'Personne dans la liste — cette étape est optionnelle.'}
                </div>
              ) : (
                <ul className="divide-y divide-border rounded-xl border border-border">
                  {invitees.map((v, i) => (
                    <li key={v.email} className="flex items-center gap-3 px-3 py-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-xs font-bold text-brand-600 dark:text-brand-300">
                        {(v.name || v.email).slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{v.name || v.email}</p>
                        {v.name && <p className="truncate text-[11px] text-muted-foreground">{v.email}</p>}
                      </div>
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        {INVITE_TYPES.find((t) => t.value === inviteType)?.label}
                      </span>
                      <button type="button" onClick={() => setInvitees((vs) => vs.filter((_, j) => j !== i))}
                        className="shrink-0 rounded p-1 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {invitees.length > 0 && (
                <Button type="button" variant="brand" size="sm" onClick={sendInvites} disabled={busy} className="gap-1.5">
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Envoyer {invitees.length} invitation(s)
                </Button>
              )}
            </div>
          )}

          {/* ── Review ──────────────────────────────────────────────── */}
          {stepKey === 'review' && (
            <div className="space-y-3">
              <p className="flex items-center gap-1.5 rounded-lg bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
                <Info className="h-3.5 w-3.5" />Tout est déjà enregistré en brouillon. Publiez pour rendre le programme visible et ouvrir les candidatures.
              </p>
              <Review label="Nom" value={form.title} onEdit={() => setStep(idx('basics'))} />
              <Review label="Type" value={TYPES[form.type as keyof typeof TYPES]} onEdit={() => setStep(idx('basics'))} />
              <Review label="Dates" value={`${fmt(form.startDate)} → ${fmt(form.endDate)}`} onEdit={() => setStep(idx('basics'))} />
              <Review label="Accroche" value={form.tagline || '—'} onEdit={() => setStep(idx('present'))} />
              <Review label="Description" value={form.description ? form.description.slice(0, 140) + (form.description.length > 140 ? '…' : '') : '—'} onEdit={() => setStep(idx('present'))} />
              <Review label="Secteurs" value={form.sectors.join(', ') || '—'} onEdit={() => setStep(idx('present'))} />
              <Review label="Visuel & lieu"
                value={[form.logoUrl && 'logo', form.bannerImageUrl && 'bannière', form.location].filter(Boolean).join(' · ') || '—'}
                onEdit={() => setStep(idx('present'))} />
              <Review label="Critères" value={criteria.length ? `${criteria.length} critère(s) — ${criteria.map((c) => c.name).join(', ')}` : 'Aucun'} onEdit={() => setStep(idx('criteria'))} />
              <Review label="Partenaires" value={linkedPartnerIds.length ? allPartners.filter((p) => linkedPartnerIds.includes(p.id)).map((p) => p.name).join(', ') : 'Aucun'} onEdit={() => setStep(idx('partners'))} />
              <Review label="Formulaire"
                value={formMode === 'custom'
                  ? `Personnalisé — ${customSchema?.sections.length ?? 0} section(s), ${customSchema?.sections.reduce((a, s) => a + s.fields.length, 0) ?? 0} champ(s)`
                  : (FORM_TEMPLATES.find((t) => t.value === form.formTemplate)?.label ?? form.formTemplate)}
                onEdit={() => setStep(idx('apply'))} />
              {isPrivate ? (
                <Review label="Accès" value="Sur invitation — aucune candidature publique" onEdit={() => setStep(idx('basics'))} highlight />
              ) : (
                <>
                  <Review label="Session de candidature" value={`${fmt(form.candStart)} → ${fmt(form.candEnd)}`} onEdit={() => setStep(idx('apply'))} />
                  <Review label="Clôture (auto)" value={fmt(derivedDeadline)} onEdit={() => setStep(idx('apply'))} highlight />
                </>
              )}
              <Review label="Invitations" value={invitesSent ? `${invitesSent} envoyée(s)` : 'Aucune'} onEdit={() => setStep(idx('invite'))} />
            </div>
          )}

          {/* Footer nav */}
          <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
            <Button variant="ghost" disabled={step === 0 || saving} onClick={() => setStep((s) => Math.max(0, s - 1))}>
              Précédent
            </Button>
            {step < STEPS.length - 1 ? (
              <Button variant="brand" onClick={goNext} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                Suivant
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" onClick={saveAndClose} disabled={saving}>Garder en brouillon</Button>
                <Button variant="brand" onClick={publish} disabled={saving} className="gap-1.5">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Publier le programme
                </Button>
              </div>
            )}
          </div>
        </MagicCard>
      </div>

      {/* Custom form builder — full sections/fields editor in a modal */}
      {formModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setFormModal(false)} />
          <div className="relative z-10 flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <div>
                <h3 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                  <FormInput className="h-4 w-4 text-brand-500" />Formulaire de candidature personnalisé
                </h3>
                <p className="text-[11px] text-muted-foreground">Sections et champs vus par les porteurs. Enregistré avec l’étape.</p>
              </div>
              <button type="button" onClick={() => setFormModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <FormBuilder value={customSchema}
                onChange={(next: CustomFormSchema | null) =>
                  set('customFormSchema', next && next.sections.length ? JSON.stringify(next) : '')} />
            </div>
            <div className="flex shrink-0 justify-end border-t border-border px-4 py-2.5">
              <Button type="button" size="sm" onClick={() => setFormModal(false)}>Terminé</Button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

/** Which step to resume at for an existing draft — first one still incomplete. */
function resumeStep(p: any, cand: any): number {
  const at = (k: StepKey) => STEPS.findIndex((s) => s.key === k)
  if (!p.title || !p.startDate || !p.endDate) return at('basics')
  if (!p.description || !(p.sectors?.length)) return at('present')
  if ((p.type ?? 'PUBLIC') !== 'PRIVATE' && !cand?.startDate) return at('apply')
  return at('review')
}

function Review({ label, value, onEdit, highlight }: { label: string; value: string; onEdit: () => void; highlight?: boolean }) {
  return (
    <div className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-2 ${highlight ? 'border-sky-500/30 bg-sky-500/5' : 'border-border'}`}>
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground">{value}</p>
      </div>
      <button type="button" onClick={onEdit} className="shrink-0 text-[11px] font-medium text-brand-600 hover:underline dark:text-brand-400">Modifier</button>
    </div>
  )
}
