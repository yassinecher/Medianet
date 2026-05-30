'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, Save, Loader2, Plus, X, Building2, Upload, FileText } from 'lucide-react'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { programmesApi, partnersApi } from '@/lib/api'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { MagicCard } from '@/components/magicui/magic-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Partner } from '@/types'

const STATUSES = {
  DRAFT:       'Brouillon',
  OPEN:        'Ouvert',
  IN_PROGRESS: 'En cours',
  EVALUATION:  'Évaluation',
  CLOSED:      'Fermé',
  CANCELLED:   'Annulé',
}

const TYPES = {
  PUBLIC:  'Public',
  PRIVATE: 'Privé',
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
  { value: 'TECH',      label: 'Tech / SaaS',  description: 'Startups tech — stack + scalabilité', steps: 3 },
  { value: 'AGRITECH',  label: 'Agritech',     description: 'Agriculture — partenariats agricoles + impact', steps: 4 },
]

export default function NewProgrammePage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: '', description: '', type: 'PUBLIC', status: 'DRAFT', formTemplate: 'STANDARD',
    startDate: '', endDate: '', applicationDeadline: '', maxApplications: '',
    sectors: [] as string[],
  })

  // Partner library
  const [allPartners, setAllPartners] = useState<Partner[]>([])
  const [selectedPartnerIds, setSelectedPartnerIds] = useState<number[]>([])
  const [newPartnerName, setNewPartnerName] = useState('')
  const [newPartnerLogo, setNewPartnerLogo] = useState('')
  const [addingPartner, setAddingPartner] = useState(false)
  const [showPartnerForm, setShowPartnerForm] = useState(false)

  useEffect(() => {
    partnersApi.list().then((r) => setAllPartners(r.data ?? [])).catch(() => {})
  }, [])

  const u = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const handleCreatePartner = async () => {
    if (!newPartnerName.trim()) { toast.error('Nom du partenaire requis'); return }
    setAddingPartner(true)
    try {
      const res = await partnersApi.create({ name: newPartnerName.trim(), logoUrl: newPartnerLogo.trim() || undefined })
      const created: Partner = res.data
      setAllPartners((prev) => [...prev, created])
      setSelectedPartnerIds((prev) => [...prev, created.id])
      setNewPartnerName('')
      setNewPartnerLogo('')
      setShowPartnerForm(false)
      toast.success('Partenaire créé')
    } catch { toast.error('Erreur lors de la création') } finally { setAddingPartner(false) }
  }

  const togglePartner = (id: number) => {
    setSelectedPartnerIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) { toast.error('Le titre est requis'); return }
    setSaving(true)
    try {
      const payload = {
        title: form.title,
        description: form.description || undefined,
        type: form.type,
        status: form.status,
        formTemplate: form.formTemplate,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        applicationDeadline: form.applicationDeadline || undefined,
        maxApplications: form.maxApplications ? Number(form.maxApplications) : undefined,
        sectors: form.sectors.length > 0 ? form.sectors : undefined,
      }
      const res = await programmesApi.create(payload)
      const programmeId: number = res.data.id

      // Link selected partners
      await Promise.all(
        selectedPartnerIds.map((pid) => partnersApi.addToProgramme(programmeId, pid))
      )

      toast.success('Programme créé')
      router.push(`/programmes/${programmeId}`)
    } catch { toast.error('Erreur lors de la création') } finally { setSaving(false) }
  }

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-2xl">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <Link href="/programmes">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">Nouveau programme</h1>
            <p className="text-sm text-muted-foreground">Créer un nouveau programme d'incubation</p>
          </div>
          <Link href="/programmes/builder">
            <Button variant="outline" className="gap-1.5 border-brand-500/30 bg-gradient-to-r from-brand-500/5 to-purple-500/5 hover:from-brand-500/10 hover:to-purple-500/10">
              <Plus className="h-3.5 w-3.5 text-brand-500" />
              Mode visuel
              <span className="ml-1 rounded-full bg-brand-500/15 px-1.5 py-0.5 text-[9px] font-bold text-brand-700 dark:text-brand-300">BETA</span>
            </Button>
          </Link>
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ── Informations générales ── */}
          <MagicCard className="p-6">
            <h2 className="mb-4 font-semibold text-foreground">Informations générales</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <label className="text-sm font-medium">Titre du programme *</label>
                <Input placeholder="Titre du programme" value={form.title} onChange={(e) => u('title', e.target.value)} required />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Type</label>
                <select value={form.type} onChange={(e) => u('type', e.target.value)}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Statut</label>
                <select value={form.status} onChange={(e) => u('status', e.target.value)}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Date de début</label>
                <Input type="date" value={form.startDate} onChange={(e) => u('startDate', e.target.value)} />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Date de fin</label>
                <Input type="date" value={form.endDate} onChange={(e) => u('endDate', e.target.value)} />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Clôture candidatures</label>
                <Input type="date" value={form.applicationDeadline} onChange={(e) => u('applicationDeadline', e.target.value)} />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Candidatures max</label>
                <Input type="number" min="1" placeholder="Illimité si vide" value={form.maxApplications} onChange={(e) => u('maxApplications', e.target.value)} />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <label className="text-sm font-medium">Secteurs <span className="text-muted-foreground font-normal">(optionnel)</span></label>
                <div className="flex flex-wrap gap-2">
                  {SECTORS.map((s) => {
                    const selected = form.sectors.includes(s)
                    return (
                      <button key={s} type="button"
                        onClick={() => setForm((f) => ({
                          ...f,
                          sectors: selected ? f.sectors.filter((x) => x !== s) : [...f.sectors, s],
                        }))}
                        className={`rounded-full px-3 py-1 text-xs font-medium border transition-all ${selected ? 'border-brand-500 bg-brand-500/15 text-brand-700 dark:text-brand-300' : 'border-border hover:border-brand-400 text-muted-foreground'}`}>
                        {s}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-sm font-medium">Description</label>
                <textarea value={form.description} onChange={(e) => u('description', e.target.value)}
                  placeholder="Décrivez les objectifs, le public cible et les avantages du programme..."
                  rows={4}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
              </div>

              {/* ── Form template selector ── */}
              <div className="space-y-2 sm:col-span-2 pt-2 border-t border-border">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-brand-500" />
                  Squelette du formulaire de candidature
                </label>
                <p className="text-xs text-muted-foreground -mt-1">
                  Quel formulaire les porteurs vont-ils remplir ? Vous pourrez le changer plus tard.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {FORM_TEMPLATES.map((tmpl) => {
                    const selected = form.formTemplate === tmpl.value
                    return (
                      <button key={tmpl.value} type="button"
                        onClick={() => u('formTemplate', tmpl.value)}
                        className={`text-left rounded-xl border-2 p-3.5 transition-all
                          ${selected
                            ? 'border-brand-500 bg-brand-500/10 shadow-sm'
                            : 'border-border bg-card hover:border-brand-400 hover:bg-accent/30'}`}>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className={`text-sm font-bold ${selected ? 'text-brand-700 dark:text-brand-300' : 'text-foreground'}`}>
                            {tmpl.label}
                          </span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                            {tmpl.steps} sections
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-snug">{tmpl.description}</p>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </MagicCard>

          {/* ── Partenaires ── */}
          <MagicCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-brand-500" />
                <h2 className="font-semibold text-foreground">Partenaires <span className="text-muted-foreground font-normal text-sm">(optionnel)</span></h2>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowPartnerForm((v) => !v)}>
                <Plus className="h-4 w-4 mr-1" />Nouveau partenaire
              </Button>
            </div>

            {/* Create new partner inline */}
            {showPartnerForm && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                className="mb-4 rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                <p className="text-sm font-medium text-foreground">Créer un partenaire</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Nom *</label>
                    <Input placeholder="Nom de l'entreprise" value={newPartnerName}
                      onChange={(e) => setNewPartnerName(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Upload className="h-3 w-3" />URL du logo <span className="text-muted-foreground/60">(optionnel)</span>
                    </label>
                    <Input placeholder="https://..." value={newPartnerLogo}
                      onChange={(e) => setNewPartnerLogo(e.target.value)} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="brand" size="sm" onClick={handleCreatePartner} disabled={addingPartner}>
                    {addingPartner ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Créer et ajouter
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowPartnerForm(false)}>Annuler</Button>
                </div>
              </motion.div>
            )}

            {/* Partner grid (select from library) */}
            {allPartners.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Aucun partenaire enregistré — créez-en un ci-dessus.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {allPartners.map((p) => {
                  const selected = selectedPartnerIds.includes(p.id)
                  return (
                    <button key={p.id} type="button" onClick={() => togglePartner(p.id)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all text-left ${
                        selected
                          ? 'border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-300'
                          : 'border-border hover:border-brand-300 hover:bg-accent'
                      }`}>
                      {p.logoUrl ? (
                        <img src={p.logoUrl} alt={p.name} className="h-6 w-6 rounded object-contain bg-white flex-shrink-0" />
                      ) : (
                        <div className="flex h-6 w-6 items-center justify-center rounded bg-muted flex-shrink-0">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      )}
                      <span className="truncate font-medium">{p.name}</span>
                      {selected && <X className="h-3 w-3 ml-auto flex-shrink-0 text-brand-600" />}
                    </button>
                  )
                })}
              </div>
            )}

            {selectedPartnerIds.length > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                {selectedPartnerIds.length} partenaire(s) sélectionné(s)
              </p>
            )}
          </MagicCard>

          {/* ── Actions ── */}
          <div className="flex gap-3">
            <Button type="submit" variant="brand" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Création...' : 'Créer le programme'}
            </Button>
            <Link href="/programmes">
              <Button type="button" variant="ghost">Annuler</Button>
            </Link>
          </div>
        </form>
      </div>
    </AdminLayout>
  )
}
