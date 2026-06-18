'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, Plus, Trash2, Edit2, Save, Loader2, CheckCircle2, Building2, X, Upload, Link2, Image, BarChart3, Target, Star, FileText, Wand2, ChevronRight, Calendar, Tag } from 'lucide-react'
import toast from 'react-hot-toast'
import { programmesApi, partnersApi, CATALOG_CATEGORIES } from '@/lib/api'
import { useCatalog } from '@/hooks/useCatalog'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { MagicCard } from '@/components/magicui/magic-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, statusColor } from '@/lib/utils'
import type { Programme, Partner } from '@/types'
import { parseSchema, type CustomFormSchema } from '@/components/formbuilder/schema'
import { ImageUpload } from '@/components/upload/ImageUpload'
import { TimelineTab } from '../builder/TimelineTab'
import { InvitationsPanel } from './InvitationsPanel'
import { ParcoursFlow } from './ParcoursFlow'
import { ProgrammeDashboard } from './ProgrammeDashboard'
import { EvaluationDashboard } from './EvaluationDashboard'

const statusLabel: Record<string, string> = {
  DRAFT: 'Brouillon', OPEN: 'Ouvert', IN_PROGRESS: 'En cours',
  EVALUATION: 'Évaluation', CLOSED: 'Fermé', CANCELLED: 'Annulé', ARCHIVED: 'Archivé',
}

const SECTORS = [
  'Tech / Numérique', 'Finance / Fintech', 'Agriculture / Agritech',
  'Santé / Medtech', 'Éducation', 'Énergie / Cleantech',
  'Commerce / Retail', 'Industrie', 'Transport / Mobilité', 'Tourisme', 'Immobilier',
]

const FORM_TEMPLATES: { value: string; label: string; description: string; steps: number }[] = [
  { value: 'STANDARD',  label: 'Standard',     description: 'Formulaire officiel Medianet — 4 sections complètes', steps: 4 },
  { value: 'MINIMAL',   label: 'Minimaliste',  description: 'Idéal pour hackathons / contests — projet + motivation', steps: 2 },
  { value: 'FOODSTART', label: 'FoodStart',    description: 'FoodTech — accent distribution + production', steps: 4 },
  { value: 'TECH',      label: 'Tech / SaaS',  description: 'Startups tech — stack + scalabilité, sans distribution physique', steps: 3 },
  { value: 'AGRITECH',  label: 'Agritech',     description: 'Agriculture — partenariats agricoles + impact environnemental', steps: 4 },
]

interface Phase {
  id?: number
  title: string
  startDate?: string
  endDate?: string
  description?: string
  order?: number
}

interface Criterion {
  id?: number
  name: string
  weight: number
  description?: string
  maxScore?: number
}

export default function ProgrammeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [programme, setProgramme] = useState<Programme | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'info' | 'phases' | 'criteria' | 'evaluations' | 'partners' | 'invitations'>('dashboard')
  // Programme sectors + eligible organisation types come from the admin-managed
  // catalogues (Référentiels). Fallback to the built-in lists if unreachable.
  const { options: sectorOptions } = useCatalog(CATALOG_CATEGORIES.PROGRAMME_SECTOR, SECTORS)
  const { options: orgTypeOptions } = useCatalog(CATALOG_CATEGORIES.ORGANIZATION_TYPE, [])

  // Info edit form
  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState({
    title: '', description: '', type: '', region: '', status: '',
    applicationDeadline: '', startDate: '', endDate: '', sectors: [] as string[],
    eligibleOrgTypes: [] as string[],
    formTemplate: 'STANDARD',
    customFormSchema: null as CustomFormSchema | null,
    // Rich fields
    tagline: '', logoUrl: '', bannerImageUrl: '', location: '', applicationUrl: '',
    expertCount: '', trainingSessionsCount: '', mentoringHoursPerMonth: '', maxStartups: '',
    objectives: [] as string[], benefits: [] as string[],
  })
  const [newObjective, setNewObjective] = useState('')
  const [newBenefit, setNewBenefit] = useState('')

  // Phases state
  const [phases, setPhases] = useState<Phase[]>([])
  const [newPhase, setNewPhase] = useState<Phase>({ title: '', startDate: '', endDate: '', description: '' })
  const [addingPhase, setAddingPhase] = useState(false)

  // Criteria state
  const [criteria, setCriteria] = useState<Criterion[]>([])
  const [newCriterion, setNewCriterion] = useState<Criterion>({ name: '', weight: 1, description: '', maxScore: 10 })
  const [addingCriterion, setAddingCriterion] = useState(false)

  // Session inline-edit state
  const [editingPhaseId, setEditingPhaseId] = useState<number | null>(null)
  const [editPhaseForm, setEditPhaseForm] = useState<Phase & { focusCriteriaIds?: number[] }>({ title: '' })

  // Partners state
  const [programmePartners, setProgrammePartners] = useState<Partner[]>([])
  const [allPartners, setAllPartners] = useState<Partner[]>([])
  const [showPartnerForm, setShowPartnerForm] = useState(false)
  const [newPartnerName, setNewPartnerName] = useState('')
  const [newPartnerLogo, setNewPartnerLogo] = useState('')
  const [addingPartner, setAddingPartner] = useState(false)

  useEffect(() => {
    programmesApi.get(Number(id))
      .then((r) => {
        const p: Programme = r.data
        setProgramme(p)
        setForm({
          title: p.title ?? p.name ?? '',
          description: p.description ?? '',
          type: (p.type === 'PUBLIC' || p.type === 'PRIVATE') ? p.type : 'PUBLIC',
          region: p.region ?? '',
          status: p.status ?? 'DRAFT',
          applicationDeadline: p.applicationDeadline ? p.applicationDeadline.substring(0, 10) : '',
          startDate: p.startDate ? p.startDate.substring(0, 10) : '',
          endDate: p.endDate ? p.endDate.substring(0, 10) : '',
          sectors: p.sectors ?? [],
          eligibleOrgTypes: (p as any).eligibleOrgTypes ?? [],
          formTemplate: (p as any).formTemplate ?? 'STANDARD',
          customFormSchema: parseSchema((p as any).customFormSchema),
          tagline: (p as any).tagline ?? '',
          logoUrl: (p as any).logoUrl ?? '',
          bannerImageUrl: (p as any).bannerImageUrl ?? '',
          location: (p as any).location ?? '',
          applicationUrl: (p as any).applicationUrl ?? '',
          expertCount: (p as any).expertCount?.toString() ?? '',
          trainingSessionsCount: (p as any).trainingSessionsCount?.toString() ?? '',
          mentoringHoursPerMonth: (p as any).mentoringHoursPerMonth?.toString() ?? '',
          maxStartups: (p as any).maxStartups?.toString() ?? '',
          objectives: (p as any).objectives ?? [],
          benefits: (p as any).benefits ?? [],
        })
        setPhases(p.phases ?? [])
        setCriteria(p.criteria ?? [])
        setProgrammePartners(p.partners ?? [])
      })
      .finally(() => setLoading(false))
    partnersApi.list().then((r) => setAllPartners(r.data ?? [])).catch(() => {})
  }, [id])

  const handleSaveInfo = async () => {
    if (!programme) return
    setSaving(true)
    try {
      const res = await programmesApi.update(programme.id, {
        title: form.title,
        description: form.description,
        type: form.type,
        region: form.region,
        status: form.status,
        // applicationDeadline NOT sent — fully derived from the candidature session.
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        sectors: form.sectors,
        eligibleOrgTypes: form.eligibleOrgTypes,
        // formTemplate / customFormSchema intentionally NOT sent — the form is
        // edited only in the Parcours candidature-session panel (single source).
        tagline: form.tagline || undefined,
        logoUrl: form.logoUrl || undefined,
        bannerImageUrl: form.bannerImageUrl || undefined,
        location: form.location || undefined,
        applicationUrl: form.applicationUrl || undefined,
        expertCount: form.expertCount ? Number(form.expertCount) : undefined,
        trainingSessionsCount: form.trainingSessionsCount ? Number(form.trainingSessionsCount) : undefined,
        mentoringHoursPerMonth: form.mentoringHoursPerMonth ? Number(form.mentoringHoursPerMonth) : undefined,
        maxStartups: form.maxStartups ? Number(form.maxStartups) : undefined,
        objectives: form.objectives,
        benefits: form.benefits,
      })
      setProgramme(res.data)
      setEditMode(false)
      toast.success('Programme mis à jour')
    } catch { toast.error('Erreur lors de la mise à jour') } finally { setSaving(false) }
  }

  const handleAddPhase = async () => {
    if (!newPhase.title.trim()) { toast.error('Titre de la session requis'); return }
    setAddingPhase(true)
    try {
      const res = await programmesApi.addPhase(Number(id), newPhase)
      setPhases((prev) => [...prev, res.data])
      setNewPhase({ title: '', startDate: '', endDate: '', description: '' })
      toast.success('Session ajoutée')
    } catch { toast.error('Erreur') } finally { setAddingPhase(false) }
  }

  const handleDeletePhase = async (phaseId: number) => {
    if (!confirm('Supprimer cette session ?')) return
    try {
      await programmesApi.deletePhase(Number(id), phaseId)
      setPhases((prev) => prev.filter((p) => p.id !== phaseId))
      toast.success('Session supprimée')
    } catch { toast.error('Erreur') }
  }

  const handleAddCriterion = async () => {
    if (!newCriterion.name.trim()) { toast.error('Nom du critère requis'); return }
    setAddingCriterion(true)
    try {
      const res = await programmesApi.addCriterion(Number(id), newCriterion)
      setCriteria((prev) => [...prev, res.data])
      setNewCriterion({ name: '', weight: 1, description: '', maxScore: 10 })
      toast.success('Critère ajouté')
    } catch { toast.error('Erreur') } finally { setAddingCriterion(false) }
  }

  const handleDeleteCriterion = async (criterionId: number) => {
    if (!confirm('Supprimer ce critère ?')) return
    try {
      await programmesApi.deleteCriterion(Number(id), criterionId)
      setCriteria((prev) => prev.filter((c) => c.id !== criterionId))
      toast.success('Critère supprimé')
    } catch { toast.error('Erreur') }
  }

  const handleUpdatePhase = async () => {
    if (!editingPhaseId || !editPhaseForm.title.trim()) { toast.error('Titre requis'); return }
    try {
      const res = await programmesApi.updatePhase(Number(id), editingPhaseId, {
        title: editPhaseForm.title,
        description: editPhaseForm.description || undefined,
        startDate: editPhaseForm.startDate || undefined,
        endDate: editPhaseForm.endDate || undefined,
        focusCriteriaIds: editPhaseForm.focusCriteriaIds ?? [],
      })
      setPhases((prev) => prev.map((p) => p.id === editingPhaseId ? res.data : p))
      setEditingPhaseId(null)
      toast.success('Session mise à jour')
    } catch { toast.error('Erreur') }
  }

  const totalWeight = criteria.reduce((sum, c) => sum + (c.weight ?? 0), 0)

  // ── Status workflow ────────────────────────────────────────────────────────
  const [changingStatus, setChangingStatus] = useState(false)

  const handleStatusChange = async (newStatus: string) => {
    if (!programme) return
    setChangingStatus(true)
    try {
      const res = await programmesApi.update(programme.id, { status: newStatus })
      setProgramme(res.data)
      setForm((f) => ({ ...f, status: newStatus }))
      toast.success(`Statut mis à jour : ${statusLabel[newStatus] ?? newStatus}`)
    } catch { toast.error('Impossible de mettre à jour le statut') }
    finally { setChangingStatus(false) }
  }

  // Workflow transitions per status. OPEN/IN_PROGRESS/CLOSED are normally driven
  // automatically by the session flow (ProgrammeLifecycle); DRAFT / EVALUATION /
  // CANCELLED are manual "holds" the auto-flow never overrides.
  // Simple, session-aligned lifecycle: Ouvrir / Brouillon / Fermer / Archiver.
  // (The date-driven ProgrammeLifecycle still auto-progresses OPEN↔IN_PROGRESS↔CLOSED.)
  const OPEN_ACTIONS = [
    { label: 'Brouillon', next: 'DRAFT',    variant: 'outline', icon: '✏️' },
    { label: 'Fermer',    next: 'CLOSED',   variant: 'outline', icon: '🔒' },
    { label: 'Archiver',  next: 'ARCHIVED', variant: 'outline', icon: '📦' },
  ]
  const statusActions: Record<string, { label: string; next: string; variant: string; icon: string }[]> = {
    DRAFT:       [{ label: 'Ouvrir', next: 'OPEN', variant: 'brand', icon: '🚀' }, { label: 'Archiver', next: 'ARCHIVED', variant: 'outline', icon: '📦' }],
    OPEN:        OPEN_ACTIONS,
    IN_PROGRESS: OPEN_ACTIONS,
    EVALUATION:  OPEN_ACTIONS,
    CLOSED:      [{ label: 'Ouvrir', next: 'OPEN', variant: 'brand', icon: '🔓' }, { label: 'Archiver', next: 'ARCHIVED', variant: 'outline', icon: '📦' }],
    CANCELLED:   [{ label: 'Ouvrir', next: 'OPEN', variant: 'outline', icon: '🔄' }, { label: 'Archiver', next: 'ARCHIVED', variant: 'outline', icon: '📦' }],
    ARCHIVED:    [{ label: 'Désarchiver', next: 'DRAFT', variant: 'outline', icon: '♻️' }],
  }

  const handleCreateAndAddPartner = async () => {
    if (!newPartnerName.trim()) { toast.error('Nom requis'); return }
    setAddingPartner(true)
    try {
      const res = await partnersApi.create({ name: newPartnerName.trim(), logoUrl: newPartnerLogo.trim() || undefined })
      const created: Partner = res.data
      setAllPartners((prev) => [...prev, created])
      await partnersApi.addToProgramme(Number(id), created.id)
      setProgrammePartners((prev) => [...prev, created])
      setNewPartnerName(''); setNewPartnerLogo(''); setShowPartnerForm(false)
      toast.success('Partenaire créé et ajouté')
    } catch { toast.error('Erreur') } finally { setAddingPartner(false) }
  }

  const handleAddExistingPartner = async (partner: Partner) => {
    if (programmePartners.find((p) => p.id === partner.id)) return
    try {
      await partnersApi.addToProgramme(Number(id), partner.id)
      setProgrammePartners((prev) => [...prev, partner])
      toast.success('Partenaire ajouté')
    } catch { toast.error('Erreur') }
  }

  const handleRemovePartner = async (partnerId: number) => {
    try {
      await partnersApi.removeFromProgramme(Number(id), partnerId)
      setProgrammePartners((prev) => prev.filter((p) => p.id !== partnerId))
      toast.success('Partenaire retiré')
    } catch { toast.error('Erreur') }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <Link href="/programmes">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          {loading ? (
            <Skeleton className="h-8 w-48" />
          ) : (
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground truncate">{programme?.title ?? programme?.name}</h1>
                {programme && <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColor(programme.status)}`}>{statusLabel[programme.status]}</span>}
                {programme && (
                  <div className="ml-auto sm:ml-2 flex gap-2">
                    <Link href={`/programmes/${programme.id}/timeline`}>
                      <Button variant="outline" size="sm" className="gap-1.5 border-amber-500/40 bg-gradient-to-r from-amber-500/5 to-rose-500/5 hover:from-amber-500/10 hover:to-rose-500/10">
                        <BarChart3 className="h-3.5 w-3.5 text-amber-500" />
                        🗺️ Parcours
                      </Button>
                    </Link>
                    <Link href={`/programmes/${programme.id}/builder`}>
                      <Button variant="outline" size="sm" className="gap-1.5 border-brand-500/40 bg-gradient-to-r from-brand-500/5 to-purple-500/5 hover:from-brand-500/10 hover:to-purple-500/10">
                        <Wand2 className="h-3.5 w-3.5 text-brand-500" />
                        Mode visuel
                        <span className="ml-1 rounded-full bg-brand-500/15 px-1.5 py-0.5 text-[9px] font-bold text-brand-700 dark:text-brand-300">BETA</span>
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {programme?.domain}{programme?.region && ` · ${programme.region}`}
                {programme?.applicationDeadline && ` · Clôture : ${formatDate(programme.applicationDeadline)}`}
              </p>
              {/* Status workflow buttons */}
              {programme && (statusActions[programme.status] ?? []).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {(statusActions[programme.status] ?? []).map((action) => (
                    <button key={action.next} type="button" disabled={changingStatus}
                      onClick={() => handleStatusChange(action.next)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-50
                        ${action.variant === 'brand'
                          ? 'border-brand-500 bg-brand-500 text-white hover:bg-brand-600 shadow-sm'
                          : 'border-border bg-card text-foreground hover:border-brand-400 hover:bg-accent'}`}>
                      <span>{action.icon}</span>
                      {changingStatus ? '...' : action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          {(['dashboard', 'info', 'phases', 'criteria', 'evaluations', 'partners', 'invitations'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${activeTab === tab ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
              {tab === 'dashboard' ? 'Tableau de bord'
                : tab === 'info' ? 'Informations'
                : tab === 'phases' ? `Sessions (${phases.length})`
                : tab === 'criteria' ? `Critères (${criteria.length})`
                : tab === 'evaluations' ? 'Évaluations'
                : tab === 'partners' ? `Partenaires (${programmePartners.length})`
                : 'Invitations'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
        ) : (
          <>
            {/* DASHBOARD TAB */}
            {activeTab === 'dashboard' && programme && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <ProgrammeDashboard programmeId={programme.id} programme={programme}
                  phases={phases as any} criteria={criteria as any} onOpenTab={setActiveTab} />
              </motion.div>
            )}

            {/* INFO TAB */}
            {activeTab === 'info' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                {programme && <ParcoursFlow phases={phases as any} />}
                <MagicCard className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-foreground">Informations générales</h2>
                    {!editMode ? (
                      <Button variant="ghost" size="sm" onClick={() => setEditMode(true)}>
                        <Edit2 className="h-4 w-4 mr-1" />Modifier
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button variant="brand" size="sm" onClick={handleSaveInfo} disabled={saving}>
                          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditMode(false)}>Annuler</Button>
                      </div>
                    )}
                  </div>
                  {!editMode ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {[
                        { label: 'Titre', value: programme?.title ?? programme?.name },
                        { label: 'Statut', value: statusLabel[programme?.status ?? ''] ?? programme?.status },
                        { label: 'Type', value: programme?.type === 'PUBLIC' ? 'Public' : programme?.type === 'PRIVATE' ? 'Privé' : programme?.domain },
                        {
                          label: 'Formulaire (géré dans le Parcours → session Candidature)',
                          value: form.customFormSchema
                            ? `Personnalisé (${form.customFormSchema.sections.length} sections, ${form.customFormSchema.sections.reduce((acc, s) => acc + s.fields.length, 0)} champs)`
                            : FORM_TEMPLATES.find((t) => t.value === ((programme as any)?.formTemplate ?? 'STANDARD'))?.label ?? 'Standard'
                        },
                        { label: 'Début', value: programme?.startDate ? formatDate(programme.startDate) : '—' },
                        { label: 'Fin', value: programme?.endDate ? formatDate(programme.endDate) : '—' },
                        { label: 'Clôture candidatures', value: programme?.applicationDeadline ? formatDate(programme.applicationDeadline) : '—' },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <p className="text-xs text-muted-foreground">{label}</p>
                          <p className="text-sm font-medium text-foreground">{value ?? '—'}</p>
                        </div>
                      ))}
                      {programme?.sectors && programme.sectors.length > 0 && (
                        <div className="sm:col-span-2">
                          <p className="text-xs text-muted-foreground mb-1.5">Secteurs</p>
                          <div className="flex flex-wrap gap-1.5">
                            {programme.sectors.map((s) => (
                              <span key={s} className="rounded-full bg-brand-500/10 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:text-brand-300">{s}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {programme?.description && (
                        <div className="sm:col-span-2">
                          <p className="text-xs text-muted-foreground">Description</p>
                          <p className="text-sm text-foreground">{programme.description}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {/* ── Essentiel ── */}
                      <section className="rounded-xl border border-border bg-muted/10 p-4">
                        <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-3">
                          <FileText className="h-3.5 w-3.5" />Essentiel
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Titre *</label>
                            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Type</label>
                            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                              <option value="PUBLIC">Public</option>
                              <option value="PRIVATE">Privé</option>
                            </select>
                          </div>
                          <div className="space-y-1 sm:col-span-2">
                            <label className="text-xs font-medium text-muted-foreground">Description</label>
                            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                              rows={3}
                              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
                          </div>
                        </div>
                      </section>

                      {/* ── Calendrier ── */}
                      <section className="rounded-xl border border-border bg-muted/10 p-4">
                        <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-3">
                          <Calendar className="h-3.5 w-3.5" />Calendrier
                        </p>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Date de début</label>
                            <Input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Date de fin</label>
                            <Input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Clôture candidatures</label>
                            <Input type="date" value={form.applicationDeadline} disabled readOnly
                              className="opacity-70 cursor-not-allowed" />
                            <p className="text-[10px] text-muted-foreground">
                              🔒 Entièrement automatique — calée sur la session « Candidature » du Parcours. Modifiez ses dates pour changer la clôture.
                            </p>
                          </div>
                        </div>
                      </section>

                      {/* ── Secteurs ── */}
                      <section className="rounded-xl border border-border bg-muted/10 p-4">
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                            <Tag className="h-3.5 w-3.5" />Secteurs <span className="font-normal opacity-60">(optionnel)</span>
                          </p>
                          <Link href="/catalogs"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 dark:text-brand-400 hover:underline">
                            <Plus className="h-3 w-3" />Ajouter / gérer les secteurs
                          </Link>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {sectorOptions.map((o) => {
                            const selected = form.sectors.includes(o.value)
                            return (
                              <button key={o.value} type="button"
                                onClick={() => setForm((f) => ({
                                  ...f,
                                  sectors: selected ? f.sectors.filter((x) => x !== o.value) : [...f.sectors, o.value],
                                }))}
                                className={`rounded-full px-3 py-1 text-xs font-medium border transition-all ${selected ? 'border-brand-500 bg-brand-500/15 text-brand-700 dark:text-brand-300' : 'border-border hover:border-brand-400 text-muted-foreground'}`}>
                                {o.label}
                              </button>
                            )
                          })}
                        </div>
                        <p className="mt-2 text-[10px] text-muted-foreground">
                          Pour ajouter un nouveau secteur à la liste, ouvrez <strong>Référentiels → Secteurs de programme</strong>.
                        </p>
                      </section>

                      {/* ── Types d'organisation éligibles ── */}
                      <section className="rounded-xl border border-border bg-muted/10 p-4">
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5" />Types d&apos;organisation éligibles
                          </p>
                          <Link href="/catalogs"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 dark:text-brand-400 hover:underline">
                            <Plus className="h-3 w-3" />Gérer les types
                          </Link>
                        </div>
                        <p className="text-[11px] text-muted-foreground mb-2">
                          Choisissez les types d&apos;organisation autorisés à candidater. Aucun coché = tous les types sont éligibles.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {orgTypeOptions.map((o) => {
                            const selected = form.eligibleOrgTypes.includes(o.value)
                            return (
                              <button key={o.value} type="button"
                                onClick={() => setForm((f) => ({
                                  ...f,
                                  eligibleOrgTypes: selected ? f.eligibleOrgTypes.filter((x) => x !== o.value) : [...f.eligibleOrgTypes, o.value],
                                }))}
                                className={`rounded-full px-3 py-1 text-xs font-medium border transition-all ${selected ? 'border-brand-500 bg-brand-500/15 text-brand-700 dark:text-brand-300' : 'border-border hover:border-brand-400 text-muted-foreground'}`}>
                                {o.label}
                              </button>
                            )
                          })}
                          {orgTypeOptions.length === 0 && (
                            <span className="text-[11px] text-muted-foreground italic">Aucun type — ajoutez-en dans Référentiels.</span>
                          )}
                        </div>
                      </section>

                      {/* ── Présentation ── */}
                      <section className="rounded-xl border border-border bg-muted/10 p-4">
                        <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-3">
                          <Image className="h-3.5 w-3.5" />Présentation visuelle
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1 sm:col-span-2">
                            <label className="text-xs font-medium text-muted-foreground">Accroche / Tagline</label>
                            <Input placeholder="ex : Le programme FoodTech de référence" value={form.tagline}
                              onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Upload className="h-3 w-3" />Logo du programme</label>
                            <ImageUpload value={form.logoUrl} folder="logos" previewHeight={70} compact
                              onChange={(url) => setForm((f) => ({ ...f, logoUrl: url }))} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Image className="h-3 w-3" />Image bannière</label>
                            <ImageUpload value={form.bannerImageUrl} folder="banners" previewHeight={70} compact
                              onChange={(url) => setForm((f) => ({ ...f, bannerImageUrl: url }))} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Link2 className="h-3 w-3" />Lien candidature externe</label>
                            <Input placeholder="https://typeform.com/..." value={form.applicationUrl}
                              onChange={(e) => setForm((f) => ({ ...f, applicationUrl: e.target.value }))} />
                            <p className="text-[10px] text-muted-foreground">
                              Doit commencer par <code>http://</code> ou <code>https://</code>. Laissez vide pour utiliser le formulaire interne.
                            </p>
                            {form.applicationUrl && !/^https?:\/\//i.test(form.applicationUrl) && (
                              <p className="text-[10px] text-amber-600 dark:text-amber-400">
                                ⚠ URL invalide — sera ignorée, le formulaire interne sera utilisé.
                              </p>
                            )}
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Lieu / Localisation</label>
                            <Input placeholder="ex : Startup Village, Tunis" value={form.location}
                              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
                          </div>
                        </div>
                      </section>

                      {/* ── Statistiques clés ── */}
                      <section className="rounded-xl border border-border bg-muted/10 p-4">
                        <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-3">
                          <BarChart3 className="h-3.5 w-3.5" />Chiffres clés <span className="font-normal opacity-60">(affichés sur la page du programme)</span>
                        </p>
                        <div className="grid gap-3 sm:grid-cols-4">
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Startups sélectionnées</label>
                            <Input type="number" min="1" placeholder="ex : 5" value={form.maxStartups}
                              onChange={(e) => setForm((f) => ({ ...f, maxStartups: e.target.value }))} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Nombre d'experts</label>
                            <Input type="number" min="1" placeholder="ex : 35" value={form.expertCount}
                              onChange={(e) => setForm((f) => ({ ...f, expertCount: e.target.value }))} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Sessions de formation</label>
                            <Input type="number" min="1" placeholder="ex : 20" value={form.trainingSessionsCount}
                              onChange={(e) => setForm((f) => ({ ...f, trainingSessionsCount: e.target.value }))} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">H. mentorat / mois</label>
                            <Input type="number" min="1" placeholder="ex : 10" value={form.mentoringHoursPerMonth}
                              onChange={(e) => setForm((f) => ({ ...f, mentoringHoursPerMonth: e.target.value }))} />
                          </div>
                        </div>
                      </section>

                      <div className="grid gap-5 lg:grid-cols-2 items-start">
                      {/* ── Objectifs ── */}
                      <section className="rounded-xl border border-border bg-muted/10 p-4">
                        <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-3">
                          <Target className="h-3.5 w-3.5" />Objectifs du programme
                        </p>
                        <div className="space-y-2">
                          {form.objectives.map((obj, i) => (
                            <div key={i} className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
                              <span className="flex-1 text-sm text-foreground">{obj}</span>
                              <button type="button" onClick={() => setForm((f) => ({ ...f, objectives: f.objectives.filter((_, j) => j !== i) }))}
                                className="text-muted-foreground hover:text-destructive transition-colors">
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                          <div className="flex gap-2">
                            <Input placeholder="Ajouter un objectif..." value={newObjective}
                              onChange={(e) => setNewObjective(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && newObjective.trim()) {
                                  e.preventDefault()
                                  setForm((f) => ({ ...f, objectives: [...f.objectives, newObjective.trim()] }))
                                  setNewObjective('')
                                }
                              }} />
                            <Button type="button" variant="ghost" size="icon"
                              onClick={() => { if (newObjective.trim()) { setForm((f) => ({ ...f, objectives: [...f.objectives, newObjective.trim()] })); setNewObjective('') } }}>
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">Appuyez sur Entrée ou ✚ pour ajouter</p>
                        </div>
                      </section>

                      {/* ── Bénéfices ── */}
                      <section className="rounded-xl border border-border bg-muted/10 p-4">
                        <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-3">
                          <Star className="h-3.5 w-3.5" />Ce que les participants gagnent
                        </p>
                        <div className="space-y-2">
                          {form.benefits.map((b, i) => (
                            <div key={i} className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
                              <span className="flex-1 text-sm text-foreground">{b}</span>
                              <button type="button" onClick={() => setForm((f) => ({ ...f, benefits: f.benefits.filter((_, j) => j !== i) }))}
                                className="text-muted-foreground hover:text-destructive transition-colors">
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                          <div className="flex gap-2">
                            <Input placeholder="Ajouter un bénéfice..." value={newBenefit}
                              onChange={(e) => setNewBenefit(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && newBenefit.trim()) {
                                  e.preventDefault()
                                  setForm((f) => ({ ...f, benefits: [...f.benefits, newBenefit.trim()] }))
                                  setNewBenefit('')
                                }
                              }} />
                            <Button type="button" variant="ghost" size="icon"
                              onClick={() => { if (newBenefit.trim()) { setForm((f) => ({ ...f, benefits: [...f.benefits, newBenefit.trim()] })); setNewBenefit('') } }}>
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">Appuyez sur Entrée ou ✚ pour ajouter</p>
                        </div>
                      </section>
                      </div>
                    </div>
                  )}
                </MagicCard>
              </motion.div>
            )}

            {/* SESSIONS TAB — the unified Parcours editor (same as /timeline) */}
            {activeTab === 'phases' && programme && (
              <div className="space-y-2">
                <div className="flex justify-end">
                  <Link href={`/programmes/${programme.id}/timeline`}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                    <ChevronRight className="h-3.5 w-3.5" />Plein écran
                  </Link>
                </div>
                <div className="h-[calc(100vh-17rem)] min-h-[520px] rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
                  <TimelineTab programmeId={programme.id} programme={programme as any} />
                </div>
              </div>
            )}

            {/* CRITERIA TAB */}
            {activeTab === 'criteria' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                {/* Add criterion form */}
                <MagicCard className="p-5">
                  <h2 className="mb-4 font-semibold text-foreground flex items-center gap-2">
                    <Plus className="h-4 w-4 text-brand-500" />Ajouter un critère
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-xs font-medium text-muted-foreground">Nom du critère *</label>
                      <Input placeholder="ex : Innovation" value={newCriterion.name}
                        onChange={(e) => setNewCriterion((c) => ({ ...c, name: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Poids (1-10)</label>
                      <Input type="number" min="1" max="10" value={newCriterion.weight}
                        onChange={(e) => setNewCriterion((c) => ({ ...c, weight: Number(e.target.value) }))} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Score max</label>
                      <Input type="number" min="1" value={newCriterion.maxScore}
                        onChange={(e) => setNewCriterion((c) => ({ ...c, maxScore: Number(e.target.value) }))} />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-xs font-medium text-muted-foreground">Description</label>
                      <Input placeholder="Description optionnelle" value={newCriterion.description}
                        onChange={(e) => setNewCriterion((c) => ({ ...c, description: e.target.value }))} />
                    </div>
                  </div>
                  <Button variant="brand" className="mt-3" onClick={handleAddCriterion} disabled={addingCriterion}>
                    {addingCriterion ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    {addingCriterion ? 'Ajout...' : 'Ajouter le critère'}
                  </Button>
                </MagicCard>

                {criteria.length > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <p className="text-muted-foreground">Poids total : <span className="font-bold text-foreground">{totalWeight}</span></p>
                    {totalWeight === 10 && (
                      <span className="flex items-center gap-1 text-green-600 text-xs">
                        <CheckCircle2 className="h-3.5 w-3.5" />Distribution parfaite (10)
                      </span>
                    )}
                  </div>
                )}

                {criteria.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-12 text-center">
                    <Target className="h-10 w-10 text-muted-foreground opacity-30" />
                    <p className="text-sm font-medium text-foreground">Aucun critère défini</p>
                    <p className="text-xs text-muted-foreground max-w-sm">
                      Les jurés noteront les candidatures selon ces critères pondérés.
                      Ajoutez-en via le formulaire ci-dessus — ex : Innovation (3), Faisabilité (3), Équipe (2), Impact (2).
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {criteria.map((c, i) => (
                      <motion.div key={c.id ?? i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                        <MagicCard className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-foreground">{c.name}</p>
                                <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-xs font-semibold text-brand-600 dark:text-brand-400">
                                  Poids {c.weight}
                                </span>
                                {c.maxScore && (
                                  <span className="text-xs text-muted-foreground">/ {c.maxScore} pts</span>
                                )}
                              </div>
                              {c.description && <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>}
                              {/* Weight bar */}
                              <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
                                <div className="h-1.5 rounded-full bg-brand-500 transition-all"
                                  style={{ width: `${totalWeight > 0 ? (c.weight / totalWeight) * 100 : 0}%` }} />
                              </div>
                            </div>
                            {c.id && (
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive shrink-0"
                                onClick={() => handleDeleteCriterion(c.id!)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </MagicCard>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* EVALUATIONS TAB — consolidated evaluation dashboard */}
            {activeTab === 'evaluations' && programme && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <EvaluationDashboard programmeId={programme.id} programme={programme}
                  criteria={criteria as any} phases={phases as any} />
              </motion.div>
            )}

            {/* PARTNERS TAB */}
            {activeTab === 'partners' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">

                {/* Current programme partners */}
                {programmePartners.length > 0 && (
                  <MagicCard className="p-5">
                    <h2 className="mb-4 font-semibold text-foreground">Partenaires du programme</h2>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {programmePartners.map((p) => (
                        <div key={p.id} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                          {p.logoUrl ? (
                            <img src={p.logoUrl} alt={p.name} className="h-8 w-8 rounded object-contain bg-white flex-shrink-0" />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded bg-muted flex-shrink-0">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                          <span className="flex-1 truncate text-sm font-medium">{p.name}</span>
                          <button onClick={() => handleRemovePartner(p.id)}
                            className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </MagicCard>
                )}

                {/* Add from library */}
                <MagicCard className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-foreground">Bibliothèque de partenaires</h2>
                    <Button variant="ghost" size="sm" onClick={() => setShowPartnerForm((v) => !v)}>
                      <Plus className="h-4 w-4 mr-1" />Nouveau partenaire
                    </Button>
                  </div>

                  {showPartnerForm && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                      className="mb-4 rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                      <p className="text-sm font-medium">Créer un partenaire</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground">Nom *</label>
                          <Input placeholder="Nom de l'entreprise" value={newPartnerName}
                            onChange={(e) => setNewPartnerName(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <Upload className="h-3 w-3" />Logo du partenaire <span className="opacity-60">(optionnel)</span>
                          </label>
                          <ImageUpload value={newPartnerLogo} folder="partners" previewHeight={60} compact
                            onChange={setNewPartnerLogo} />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="brand" size="sm" onClick={handleCreateAndAddPartner} disabled={addingPartner}>
                          {addingPartner ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                          Créer et ajouter
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setShowPartnerForm(false)}>Annuler</Button>
                      </div>
                    </motion.div>
                  )}

                  {allPartners.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">Aucun partenaire enregistré</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {allPartners
                        .filter((p) => !programmePartners.find((pp) => pp.id === p.id))
                        .map((p) => (
                          <button key={p.id} type="button" onClick={() => handleAddExistingPartner(p)}
                            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-left hover:border-brand-400 hover:bg-accent transition-all">
                            {p.logoUrl ? (
                              <img src={p.logoUrl} alt={p.name} className="h-6 w-6 rounded object-contain bg-white flex-shrink-0" />
                            ) : (
                              <div className="flex h-6 w-6 items-center justify-center rounded bg-muted flex-shrink-0">
                                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                              </div>
                            )}
                            <span className="truncate font-medium">{p.name}</span>
                            <Plus className="h-3 w-3 ml-auto flex-shrink-0 text-muted-foreground" />
                          </button>
                        ))}
                    </div>
                  )}
                  {allPartners.filter((p) => !programmePartners.find((pp) => pp.id === p.id)).length === 0 && allPartners.length > 0 && (
                    <p className="py-4 text-center text-sm text-muted-foreground">Tous les partenaires sont déjà associés.</p>
                  )}
                </MagicCard>
              </motion.div>
            )}

            {activeTab === 'invitations' && programme && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <InvitationsPanel programmeId={programme.id} />
              </motion.div>
            )}
          </>
        )}
      </div>

    </AdminLayout>
  )
}
