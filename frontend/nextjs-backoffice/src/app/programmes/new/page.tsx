'use client'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft, ArrowRight, Check, Loader2, Rocket, FileText, CalendarClock,
  ClipboardList, Save, Lock, Info, Sparkles, FormInput, Wand2, X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { programmesApi, sessionsApi, CATALOG_CATEGORIES } from '@/lib/api'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { MagicCard } from '@/components/magicui/magic-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { AiField } from '@/components/ai/AiField'
import { CatalogMultiSelect } from '@/components/catalog/CatalogMultiSelect'
import { FormBuilder } from '@/components/formbuilder/FormBuilder'
import { parseSchema, type CustomFormSchema } from '@/components/formbuilder/schema'

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
  { key: 'present',  title: 'Présentation',  icon: FileText,      blurb: 'Description, accroche et secteurs' },
  { key: 'apply',    title: 'Candidature',   icon: CalendarClock, blurb: 'Formulaire et fenêtre de dépôt' },
  { key: 'review',   title: 'Révision',      icon: ClipboardList, blurb: 'Vérifier et publier' },
] as const
type StepKey = typeof STEPS[number]['key']

interface WizardForm {
  title: string; type: string
  startDate: string; endDate: string
  tagline: string; description: string; sectors: string[]
  formTemplate: string
  /** JSON of a custom form schema; non-empty ⇒ custom form overrides the preset. */
  customFormSchema: string
  candStart: string; candEnd: string
}
const EMPTY: WizardForm = {
  title: '', type: 'PUBLIC', startDate: '', endDate: '',
  tagline: '', description: '', sectors: [], formTemplate: 'STANDARD', customFormSchema: '',
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
  const set = <K extends keyof WizardForm>(k: K, v: WizardForm[K]) => setForm((f) => ({ ...f, [k]: v }))
  const customSchema = useMemo(() => parseSchema(form.customFormSchema), [form.customFormSchema])

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
          sectors: p.sectors ?? [], formTemplate: p.formTemplate ?? 'STANDARD',
          customFormSchema: custom.length > 2 ? custom : '',
          candStart: cand?.startDate?.substring(0, 10) ?? '', candEnd: cand?.endDate?.substring(0, 10) ?? '',
        })
        if (custom.length > 2) setFormMode('custom')
        setCandPhaseId(cand?.id ?? null)
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
    if (s === 0) {
      if (!form.title.trim()) return 'Donnez un nom au programme.'
      if (!form.startDate || !form.endDate) return 'Les dates de début et de fin sont obligatoires.'
      if (form.endDate < form.startDate) return 'La date de fin doit suivre la date de début.'
    }
    if (s === 1) {
      if (!form.description.trim()) return 'Ajoutez une description.'
      if (form.sectors.length === 0) return 'Choisissez au moins un secteur.'
    }
    if (s === 2) {
      if (formMode === 'custom' && (!customSchema || customSchema.sections.length === 0))
        return 'Construisez votre formulaire personnalisé (au moins une section).'
      if (!form.candStart || !form.candEnd) return 'Définissez la fenêtre de candidature (elle fixe la clôture).'
      if (form.candEnd < form.candStart) return 'La fin de candidature doit suivre son début.'
    }
    return null
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
    if (step >= 1) { patch.tagline = form.tagline || undefined; patch.description = form.description; patch.sectors = form.sectors }
    if (step >= 2) {
      patch.formTemplate = form.formTemplate
      // A non-empty custom schema overrides the preset; '' clears it so the preset applies.
      patch.customFormSchema = formMode === 'custom' ? form.customFormSchema : ''
    }
    await programmesApi.update(id, patch)

    // Candidature session — its window drives the clôture automatically (backend).
    if (step >= 2 && form.candStart) {
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
    for (let s = 0; s <= 2; s++) { const e = stepError(s); if (e) { setStep(s); toast.error(e); return } }
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

        {/* Stepper — click any reached/adjacent step to jump back */}
        <ol className="flex items-center gap-1.5">
          {STEPS.map((s, i) => {
            const done = i < step, active = i === step
            const Icon = s.icon
            return (
              <li key={s.key} className="flex flex-1 items-center gap-1.5">
                <button type="button" disabled={i > step}
                  onClick={() => i <= step && setStep(i)}
                  className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors ${
                    active ? 'border-brand-500 bg-brand-500/10'
                    : done ? 'border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10'
                    : 'border-border opacity-60'}`}>
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    active ? 'bg-brand-500 text-white' : done ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                    {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className={`block truncate text-xs font-semibold ${active ? 'text-brand-700 dark:text-brand-300' : 'text-foreground'}`}>{s.title}</span>
                    <span className="hidden truncate text-[10px] text-muted-foreground sm:block">{s.blurb}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>

        <MagicCard className="p-6">
          <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
            <CurrentIcon className="h-4 w-4 text-brand-500" />{STEPS[step].title}
          </p>

          {/* ── Step 1 — Basics ─────────────────────────────────────── */}
          {step === 0 && (
            <div className="space-y-4">
              <AiField field="title" label="Nom du programme" value={form.title} onChange={(v) => set('title', v)}
                context={contextForAi} placeholder="Ex. Accélérateur Agritech 2026" required
                hint="Le bouton « Générer » propose un nom à partir du secteur et de l’accroche." />
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Type</label>
                  <select value={form.type} onChange={(e) => set('type', e.target.value)}
                    className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm">
                    {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Date de début <span className="text-red-500">*</span></label>
                  <Input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Date de fin <span className="text-red-500">*</span></label>
                  <Input type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2 — Presentation ───────────────────────────────── */}
          {step === 1 && (
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
            </div>
          )}

          {/* ── Step 3 — Candidature (form + the session that drives clôture) ── */}
          {step === 2 && (
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

              <div className="rounded-xl border border-border p-4">
                <p className="mb-1 flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <CalendarClock className="h-4 w-4 text-sky-500" />Session de candidature
                </p>
                <p className="mb-3 text-[11px] text-muted-foreground">
                  Ces dates créent la <b>session de candidature</b> du programme : il accepte les dépôts pendant cette période.
                  La <b>clôture est automatique</b> — c’est la fin de cette session.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Ouverture des candidatures <span className="text-red-500">*</span></label>
                    <Input type="date" value={form.candStart} onChange={(e) => set('candStart', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Clôture (fin de session) <span className="text-red-500">*</span></label>
                    <Input type="date" value={form.candEnd} min={form.candStart || undefined} onChange={(e) => set('candEnd', e.target.value)} />
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
            </div>
          )}

          {/* ── Step 4 — Review ─────────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-3">
              <p className="flex items-center gap-1.5 rounded-lg bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
                <Info className="h-3.5 w-3.5" />Tout est déjà enregistré en brouillon. Publiez pour rendre le programme visible et ouvrir les candidatures.
              </p>
              <Review label="Nom" value={form.title} onEdit={() => setStep(0)} />
              <Review label="Type" value={TYPES[form.type as keyof typeof TYPES]} onEdit={() => setStep(0)} />
              <Review label="Dates" value={`${fmt(form.startDate)} → ${fmt(form.endDate)}`} onEdit={() => setStep(0)} />
              <Review label="Accroche" value={form.tagline || '—'} onEdit={() => setStep(1)} />
              <Review label="Description" value={form.description ? form.description.slice(0, 140) + (form.description.length > 140 ? '…' : '') : '—'} onEdit={() => setStep(1)} />
              <Review label="Secteurs" value={form.sectors.join(', ') || '—'} onEdit={() => setStep(1)} />
              <Review label="Formulaire"
                value={formMode === 'custom'
                  ? `Personnalisé — ${customSchema?.sections.length ?? 0} section(s), ${customSchema?.sections.reduce((a, s) => a + s.fields.length, 0) ?? 0} champ(s)`
                  : (FORM_TEMPLATES.find((t) => t.value === form.formTemplate)?.label ?? form.formTemplate)}
                onEdit={() => setStep(2)} />
              <Review label="Session de candidature" value={`${fmt(form.candStart)} → ${fmt(form.candEnd)}`} onEdit={() => setStep(2)} />
              <Review label="Clôture (auto)" value={fmt(derivedDeadline)} onEdit={() => setStep(2)} highlight />
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
  if (!p.title || !p.startDate || !p.endDate) return 0
  if (!p.description || !(p.sectors?.length)) return 1
  if (!cand?.startDate) return 2
  return 3
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
