'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, ArrowRight, Check, Loader2, Users, Briefcase,
  BarChart3, Heart, Send, ChevronRight, Building2
} from 'lucide-react'
import toast from 'react-hot-toast'
import { programmesApi, candidaturesApi } from '@/lib/api'
import { useUser } from '@/store/auth.store'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Programme, FormTemplate } from '@/types'
import { parseSchema, SectionRenderer, findMissingRequired, type CustomFormSchema } from '@/components/candidature/FormRenderer'
import { OrganizationPicker } from '@/components/candidature/OrganizationPicker'

// ── Types ────────────────────────────────────────────────────────────────────

interface FormData {
  // Section 1: Company & Team
  companyName: string
  contactEmail: string
  contactPhone: string
  founderName: string
  founderEmail: string
  coFounders: string
  teamBackground: string
  engagementLevel: string
  // Section 2: Project
  projectName: string
  projectDescription: string
  problemStatement: string
  solutionDescription: string
  competitiveAdvantage: string
  technologyDescription: string
  sector: string
  currentStage: string
  teamSize: string
  techStack: string
  // Section 3: Market & Business
  targetMarket: string
  hasCustomers: string        // 'true' | 'false' | ''
  hasPriorIncubation: string  // 'true' | 'false' | ''
  priorIncubationDetails: string
  businessModel: string
  distributionChannels: string
  fundingRequired: string
  // Section 4: Motivation
  motivation: string
  supportNeeds: string        // comma-separated
  otherNeeds: string
  programmeExpectations: string
  pitchDeckUrl: string
}

const EMPTY: FormData = {
  companyName: '', contactEmail: '', contactPhone: '', founderName: '', founderEmail: '',
  coFounders: '', teamBackground: '', engagementLevel: '',
  projectName: '', projectDescription: '', problemStatement: '', solutionDescription: '',
  competitiveAdvantage: '', technologyDescription: '', sector: '', currentStage: '', teamSize: '', techStack: '',
  targetMarket: '', hasCustomers: '', hasPriorIncubation: '', priorIncubationDetails: '',
  businessModel: '', distributionChannels: '', fundingRequired: '',
  motivation: '', supportNeeds: '', otherNeeds: '', programmeExpectations: '', pitchDeckUrl: '',
}

const STAGES = [
  { value: 'IDEA',          label: 'Idée' },
  { value: 'PROTOTYPE',     label: 'Prototype' },
  { value: 'MVP',           label: 'MVP' },
  { value: 'COMMERCIALIZED', label: 'Commercialisé' },
]

const SUPPORT_OPTIONS = [
  'Accompagnement business',
  'Accès au financement',
  'Mentorat technique',
  'Mise en réseau',
  'Formation',
  'Espace de travail',
  'Visibilité / médias',
  'Accès aux marchés',
]

// ── Helper components ─────────────────────────────────────────────────────────

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-foreground mb-1.5">
      {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  )
}

function Textarea({ value, onChange, rows = 3, placeholder, className = '' }: {
  value: string; onChange: (v: string) => void; rows?: number; placeholder?: string; className?: string
}) {
  return (
    <textarea
      rows={rows}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none ${className}`}
    />
  )
}

function RadioGroup({ name, value, onChange, options }: {
  name: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {options.map(opt => (
        <label key={opt.value}
          className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors
            ${value === opt.value
              ? 'border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-300'
              : 'border-border bg-card text-muted-foreground hover:border-brand-400 hover:text-foreground'}`}>
          <input type="radio" name={name} value={opt.value} checked={value === opt.value}
            onChange={() => onChange(opt.value)} className="sr-only" />
          {value === opt.value && <Check className="h-3.5 w-3.5" />}
          {opt.label}
        </label>
      ))}
    </div>
  )
}

function CheckboxGroup({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: string[]
}) {
  const selected = value ? value.split(',').filter(Boolean) : []
  const toggle = (opt: string) => {
    const next = selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]
    onChange(next.join(','))
  }
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {options.map(opt => (
        <label key={opt}
          className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors
            ${selected.includes(opt)
              ? 'border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-300'
              : 'border-border bg-card text-muted-foreground hover:border-brand-400'}`}>
          <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} className="sr-only" />
          <div className={`h-4 w-4 shrink-0 rounded border flex items-center justify-center transition-colors
            ${selected.includes(opt) ? 'border-brand-500 bg-brand-500' : 'border-border bg-background'}`}>
            {selected.includes(opt) && <Check className="h-2.5 w-2.5 text-white" />}
          </div>
          <span className="leading-tight">{opt}</span>
        </label>
      ))}
    </div>
  )
}

// ── Step components ────────────────────────────────────────────────────────────

function StepTeam({ form, set }: { form: FormData; set: (k: keyof FormData, v: string) => void }) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Décrivez votre équipe et votre entreprise. Ces informations nous aident à comprendre votre contexte.
      </p>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label>Nom de l'entreprise / startup</Label>
          <Input value={form.companyName} onChange={e => set('companyName', e.target.value)}
            placeholder="Ex: FoodTech Innovations" />
        </div>
        <div>
          <Label>Email de contact</Label>
          <Input type="email" value={form.contactEmail} onChange={e => set('contactEmail', e.target.value)}
            placeholder="contact@startup.com" />
        </div>
        <div>
          <Label>Téléphone</Label>
          <Input type="tel" value={form.contactPhone} onChange={e => set('contactPhone', e.target.value)}
            placeholder="+216 xx xxx xxx" />
        </div>
        <div>
          <Label>Nom du fondateur principal</Label>
          <Input value={form.founderName} onChange={e => set('founderName', e.target.value)}
            placeholder="Prénom Nom" />
        </div>
        <div className="sm:col-span-2">
          <Label>Email du fondateur</Label>
          <Input type="email" value={form.founderEmail} onChange={e => set('founderEmail', e.target.value)}
            placeholder="fondateur@startup.com" />
        </div>
      </div>

      <div>
        <Label>Co-fondateurs (le cas échéant)</Label>
        <Textarea value={form.coFounders} onChange={v => set('coFounders', v)}
          placeholder="Prénom Nom — Rôle&#10;Prénom Nom — Rôle" rows={3} />
        <p className="mt-1 text-xs text-muted-foreground">Un co-fondateur par ligne avec son rôle</p>
      </div>

      <div>
        <Label>Background de l'équipe</Label>
        <Textarea value={form.teamBackground} onChange={v => set('teamBackground', v)} rows={4}
          placeholder="Décrivez les compétences clés, les parcours académiques et professionnels de votre équipe..." />
      </div>

      <div>
        <Label>Niveau d'engagement</Label>
        <RadioGroup name="engagement" value={form.engagementLevel} onChange={v => set('engagementLevel', v)}
          options={[
            { value: 'FULL_TIME', label: 'Temps plein' },
            { value: 'PART_TIME', label: 'Temps partiel' },
          ]} />
      </div>
    </div>
  )
}

function StepProject({ form, set, programmeSectors }: {
  form: FormData; set: (k: keyof FormData, v: string) => void; programmeSectors: string[]
}) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Décrivez votre projet en détail. Soyez précis et concret pour maximiser vos chances de sélection.
      </p>

      <div>
        <Label required>Nom du projet</Label>
        <Input value={form.projectName} onChange={e => set('projectName', e.target.value)}
          placeholder="Le nom de votre startup / projet" />
      </div>

      <div>
        <Label>Description générale du projet</Label>
        <Textarea value={form.projectDescription} onChange={v => set('projectDescription', v)} rows={4}
          placeholder="Décrivez votre projet en quelques phrases claires..." />
      </div>

      <div>
        <Label>Problème adressé</Label>
        <Textarea value={form.problemStatement} onChange={v => set('problemStatement', v)} rows={4}
          placeholder="Quel problème résolvez-vous ? Pour qui ? Quelle est l'ampleur de ce problème ?" />
      </div>

      <div>
        <Label>Solution proposée</Label>
        <Textarea value={form.solutionDescription} onChange={v => set('solutionDescription', v)} rows={4}
          placeholder="Comment votre solution résout-elle ce problème ? Qu'est-ce qui la rend unique ?" />
      </div>

      <div>
        <Label>Avantage concurrentiel</Label>
        <Textarea value={form.competitiveAdvantage} onChange={v => set('competitiveAdvantage', v)} rows={3}
          placeholder="Pourquoi votre solution est-elle meilleure que ce qui existe ?" />
      </div>

      <div>
        <Label>Technologies utilisées</Label>
        <Textarea value={form.technologyDescription} onChange={v => set('technologyDescription', v)} rows={3}
          placeholder="Décrivez les technologies / innovations techniques au cœur de votre projet..." />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {programmeSectors.length > 0 ? (
          <div className="sm:col-span-2">
            <Label>Secteur d'activité</Label>
            <div className="flex flex-wrap gap-2">
              {programmeSectors.map(s => (
                <label key={s}
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors
                    ${form.sector === s
                      ? 'border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-300'
                      : 'border-border bg-card text-muted-foreground hover:border-brand-400'}`}>
                  <input type="radio" name="sector" value={s} checked={form.sector === s}
                    onChange={() => set('sector', s)} className="sr-only" />
                  {form.sector === s && <Check className="h-3.5 w-3.5" />}
                  {s}
                </label>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <Label>Secteur d'activité</Label>
            <Input value={form.sector} onChange={e => set('sector', e.target.value)}
              placeholder="Ex: AgriTech, FinTech, HealthTech..." />
          </div>
        )}

        <div>
          <Label>Stack technique</Label>
          <Input value={form.techStack} onChange={e => set('techStack', e.target.value)}
            placeholder="React, Node.js, Python, AWS..." />
        </div>
      </div>

      <div>
        <Label>Stade actuel du projet</Label>
        <RadioGroup name="stage" value={form.currentStage} onChange={v => set('currentStage', v)}
          options={STAGES} />
      </div>
    </div>
  )
}

function StepMarket({ form, set }: { form: FormData; set: (k: keyof FormData, v: string) => void }) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Montrez-nous que vous comprenez votre marché et avez un modèle économique viable.
      </p>

      <div>
        <Label>Marché cible</Label>
        <Textarea value={form.targetMarket} onChange={v => set('targetMarket', v)} rows={3}
          placeholder="Qui sont vos clients ? Quelle est la taille du marché adressable ?" />
      </div>

      <div>
        <Label>Avez-vous déjà des clients / utilisateurs ?</Label>
        <RadioGroup name="hasCustomers" value={form.hasCustomers} onChange={v => set('hasCustomers', v)}
          options={[{ value: 'true', label: 'Oui' }, { value: 'false', label: 'Non' }]} />
      </div>

      <div>
        <Label>Modèle économique</Label>
        <Textarea value={form.businessModel} onChange={v => set('businessModel', v)} rows={4}
          placeholder="Comment générez-vous (ou comptez-vous générer) des revenus ? Décrivez votre modèle de tarification..." />
      </div>

      <div>
        <Label>Canaux de distribution</Label>
        <Textarea value={form.distributionChannels} onChange={v => set('distributionChannels', v)} rows={3}
          placeholder="Comment allez-vous atteindre vos clients ? (vente directe, partenariats, digital, etc.)" />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label>Taille de l'équipe</Label>
          <Input type="number" min={1} value={form.teamSize} onChange={e => set('teamSize', e.target.value)}
            placeholder="Nombre de personnes" />
        </div>
        <div>
          <Label>Financement recherché (TND)</Label>
          <Input type="number" min={0} value={form.fundingRequired} onChange={e => set('fundingRequired', e.target.value)}
            placeholder="Ex: 50000" />
        </div>
      </div>

      <div>
        <Label>Avez-vous bénéficié d'une incubation / accélération précédente ?</Label>
        <RadioGroup name="hasPriorIncubation" value={form.hasPriorIncubation} onChange={v => set('hasPriorIncubation', v)}
          options={[{ value: 'true', label: 'Oui' }, { value: 'false', label: 'Non' }]} />
      </div>

      {form.hasPriorIncubation === 'true' && (
        <div>
          <Label>Détails de l'incubation précédente</Label>
          <Textarea value={form.priorIncubationDetails} onChange={v => set('priorIncubationDetails', v)} rows={3}
            placeholder="Nom du programme, dates, résultats obtenus..." />
        </div>
      )}
    </div>
  )
}

function StepMotivation({ form, set }: { form: FormData; set: (k: keyof FormData, v: string) => void }) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Aidez-nous à comprendre votre motivation et ce que vous espérez tirer de ce programme.
      </p>

      <div>
        <Label required>Motivation</Label>
        <Textarea value={form.motivation} onChange={v => set('motivation', v)} rows={5}
          placeholder="Pourquoi candidatez-vous à ce programme ? Qu'est-ce qui vous a poussé à postuler ?" />
      </div>

      <div>
        <Label>Type d'accompagnement recherché</Label>
        <CheckboxGroup value={form.supportNeeds} onChange={v => set('supportNeeds', v)} options={SUPPORT_OPTIONS} />
      </div>

      <div>
        <Label>Autres besoins spécifiques</Label>
        <Textarea value={form.otherNeeds} onChange={v => set('otherNeeds', v)} rows={3}
          placeholder="Y a-t-il des besoins particuliers non listés ci-dessus ?" />
      </div>

      <div>
        <Label>Attentes vis-à-vis du programme</Label>
        <Textarea value={form.programmeExpectations} onChange={v => set('programmeExpectations', v)} rows={4}
          placeholder="Qu'attendez-vous concrètement de ce programme ? Quels objectifs espérez-vous atteindre à la fin ?" />
      </div>

      <div>
        <Label>Lien vers votre Pitch Deck</Label>
        <Input type="url" value={form.pitchDeckUrl} onChange={e => set('pitchDeckUrl', e.target.value)}
          placeholder="https://drive.google.com/..." />
        <p className="mt-1 text-xs text-muted-foreground">Google Drive, Dropbox, Notion, Docsend… (accès public ou avec lien)</p>
      </div>
    </div>
  )
}

// ── Review ─────────────────────────────────────────────────────────────────────

function ReviewRow({ label, value }: { label: string; value: string | number | undefined | null }) {
  if (!value && value !== 0) return null
  return (
    <div className="grid grid-cols-5 gap-2 py-2.5 border-b border-border/60 last:border-0">
      <span className="col-span-2 text-xs text-muted-foreground">{label}</span>
      <span className="col-span-3 text-sm font-medium text-foreground break-words">{String(value)}</span>
    </div>
  )
}

function StepReview({ form }: { form: FormData }) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Vérifiez toutes les informations avant de soumettre votre candidature. Vous ne pourrez pas la modifier après envoi.
      </p>

      {[
        {
          title: '1. Entreprise & Équipe', rows: [
            ['Entreprise', form.companyName], ['Email contact', form.contactEmail],
            ['Téléphone', form.contactPhone], ['Fondateur', form.founderName],
            ['Email fondateur', form.founderEmail], ['Co-fondateurs', form.coFounders],
            ['Background équipe', form.teamBackground], ['Engagement', form.engagementLevel === 'FULL_TIME' ? 'Temps plein' : form.engagementLevel === 'PART_TIME' ? 'Temps partiel' : ''],
          ]
        },
        {
          title: '2. Projet', rows: [
            ['Nom du projet', form.projectName], ['Description', form.projectDescription],
            ['Problème', form.problemStatement], ['Solution', form.solutionDescription],
            ['Avantage concurrentiel', form.competitiveAdvantage], ['Technologie', form.technologyDescription],
            ['Secteur', form.sector], ['Stack', form.techStack], ['Stade', form.currentStage],
          ]
        },
        {
          title: '3. Marché & Business', rows: [
            ['Marché cible', form.targetMarket], ['A des clients', form.hasCustomers === 'true' ? 'Oui' : form.hasCustomers === 'false' ? 'Non' : ''],
            ['Modèle économique', form.businessModel], ['Canaux', form.distributionChannels],
            ['Taille équipe', form.teamSize], ['Financement recherché', form.fundingRequired ? `${form.fundingRequired} TND` : ''],
            ['Incubation précédente', form.hasPriorIncubation === 'true' ? 'Oui' : form.hasPriorIncubation === 'false' ? 'Non' : ''],
            ['Détails incubation', form.priorIncubationDetails],
          ]
        },
        {
          title: '4. Motivation', rows: [
            ['Motivation', form.motivation], ['Accompagnement recherché', form.supportNeeds?.replace(/,/g, ', ')],
            ['Autres besoins', form.otherNeeds], ['Attentes', form.programmeExpectations],
            ['Pitch Deck', form.pitchDeckUrl],
          ]
        },
      ].map(section => (
        <div key={section.title} className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-bold text-foreground mb-3">{section.title}</h3>
          {section.rows.map(([label, value]) => (
            <ReviewRow key={label} label={label} value={value} />
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Custom schema review ───────────────────────────────────────────────────────

function CustomReview({ schema, answers }: { schema: CustomFormSchema; answers: Record<string, string> }) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Vérifiez toutes les informations avant de soumettre votre candidature.
      </p>
      {schema.sections.map((section) => (
        <div key={section.key} className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-bold text-foreground mb-3">{section.title}</h3>
          {section.fields.map((field) => {
            const value = answers[field.key]
            if (!value && value !== '0') return null
            return (
              <div key={field.key} className="grid grid-cols-5 gap-2 py-2.5 border-b border-border/60 last:border-0">
                <span className="col-span-2 text-xs text-muted-foreground">{field.label}</span>
                <span className="col-span-3 text-sm font-medium text-foreground break-words">
                  {field.type === 'checkbox' ? value.replace(/,/g, ', ') : value}
                </span>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ── Steps config ────────────────────────────────────────────────────────────────

type StepKey = 'team' | 'project' | 'market' | 'motivation' | 'review'

const ALL_STEPS: Record<StepKey, { title: string; icon: React.ElementType; description: string }> = {
  team:       { title: 'Votre équipe',      icon: Users,     description: 'Entreprise & fondateurs' },
  project:    { title: 'Votre projet',      icon: Briefcase, description: 'Description & solution' },
  market:     { title: 'Marché & business', icon: BarChart3, description: 'Clients & modèle éco.' },
  motivation: { title: 'Motivation',        icon: Heart,     description: 'Besoins & attentes' },
  review:     { title: 'Vérification',      icon: Check,     description: 'Relire & soumettre' },
}

/**
 * Form-template configuration — drives which steps appear and how they're labelled.
 * The admin picks the template when creating/editing a programme; the porteur sees
 * the matching layout when they click "Rejoindre le programme".
 */
const TEMPLATE_CONFIG: Record<FormTemplate, {
  label: string
  description: string
  steps: StepKey[]
  intro?: string
}> = {
  STANDARD: {
    label: 'Standard',
    description: 'Le formulaire officiel Medianet — 4 sections complètes.',
    steps: ['team', 'project', 'market', 'motivation', 'review'],
  },
  MINIMAL: {
    label: 'Minimaliste',
    description: 'Idéal pour les hackathons et contests — projet + motivation.',
    steps: ['project', 'motivation', 'review'],
    intro: 'Formulaire court — concentrez-vous sur le projet et la motivation.',
  },
  FOODSTART: {
    label: 'FoodStart',
    description: 'Programme FoodTech — accent sur la distribution et la production.',
    steps: ['team', 'project', 'market', 'motivation', 'review'],
    intro: 'Programme FoodStart — décrivez votre produit, vos canaux et votre chaîne de production.',
  },
  TECH: {
    label: 'Tech / SaaS',
    description: 'Startups tech — accent sur la stack et la scalabilité.',
    steps: ['team', 'project', 'motivation', 'review'],
    intro: 'Startups tech — pas de questions distribution physique, focus produit et tech.',
  },
  AGRITECH: {
    label: 'Agritech',
    description: 'Programme agriculture — accent sur les partenariats agricoles.',
    steps: ['team', 'project', 'market', 'motivation', 'review'],
    intro: "Programme Agritech — décrivez vos partenariats agricoles et l'impact environnemental.",
  },
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function CandidaterPage() {
  const { id } = useParams<{ id: string }>()
  const user = useUser()
  const router = useRouter()
  const [programme, setProgramme] = useState<Programme | null>(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormData>(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  /** Custom form answers — used when the programme has a custom schema instead of a preset */
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({})
  /** Required first step: porteur must select (or create) an organisation. */
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null)
  const [selectedOrgName, setSelectedOrgName] = useState<string>('')
  /** Flips true when the user tries to advance with missing required fields → highlights them. */
  const [showStepErrors, setShowStepErrors] = useState(false)

  useEffect(() => {
    if (!user) { router.push('/login'); return }
    const numericId = Number(id)
    if (!Number.isFinite(numericId) || numericId <= 0) {
      toast.error('Programme introuvable')
      router.replace('/programmes')
      return
    }
    programmesApi.get(numericId)
      .then(r => setProgramme(r.data))
      .catch(() => {
        toast.error('Programme introuvable')
        router.replace('/programmes')
      })
      .finally(() => setLoading(false))
  }, [id, user])

  const set = (k: keyof FormData, v: string) =>
    setForm(prev => ({ ...prev, [k]: v }))

  const canProceed = () => {
    // Custom schema: validate required fields of the current section
    const schema = parseSchema((programme as any)?.customFormSchema)
    if (schema && step < schema.sections.length) {
      const missing = findMissingRequired(schema.sections[step], customAnswers)
      if (missing) {
        // Visual hint only — we don't block the click; toast on next click
        return false
      }
      return true
    }
    // Preset path
    const cfg = TEMPLATE_CONFIG[(programme?.formTemplate as FormTemplate) ?? 'STANDARD']
    const key = cfg.steps[step]
    if (key === 'project' && !form.projectName.trim()) return false
    if (key === 'motivation' && !form.motivation.trim()) return false
    return true
  }

  const setCustomAnswer = (k: string, v: string) =>
    setCustomAnswers((prev) => ({ ...prev, [k]: v }))

  const handleSubmit = async () => {
    // Hard precondition: porteur must pick an organisation (back-end also enforces this
    // when a session phaseId is supplied — keeping the UI consistent with the model).
    if (!selectedOrgId) {
      toast.error('Sélectionnez d\'abord votre organisation en haut de la page')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    const schema = parseSchema((programme as any)?.customFormSchema)

    // ── Custom schema path ──────────────────────────────────────────────────
    if (schema && schema.sections.length > 0) {
      // Validate all required fields across all sections
      for (const sec of schema.sections) {
        const missing = findMissingRequired(sec, customAnswers)
        if (missing) {
          toast.error(`Champ requis manquant : "${missing.label}"`)
          return
        }
      }

      // Derive a non-empty project name (backend column is NOT NULL)
      const derivedProjectName =
        customAnswers.projectName ||
        customAnswers.project_name ||
        customAnswers.projetNom ||
        Object.values(customAnswers).find((v) => v && v.trim().length > 0) ||
        `Candidature — ${programme?.title ?? 'Programme'}`

      setSubmitting(true)
      try {
        await candidaturesApi.submit({
          programmeId: Number(id),
          organizationId: selectedOrgId,
          projectName: derivedProjectName,
          motivation: customAnswers.motivation || 'Voir réponses au formulaire',
          customAnswers: JSON.stringify(customAnswers),
        })
        toast.success('Candidature soumise avec succès !')
        router.push('/candidatures')
      } catch (err: any) {
        const msg = err.response?.data?.message ?? err.response?.data ?? 'Erreur lors de la soumission'
        toast.error(typeof msg === 'string' ? msg : 'Erreur lors de la soumission')
      } finally {
        setSubmitting(false)
      }
      return
    }

    // ── Preset template path ────────────────────────────────────────────────
    if (!form.projectName.trim()) { toast.error('Le nom du projet est requis'); return }
    if (!form.motivation.trim()) { toast.error('La motivation est requise'); return }
    setSubmitting(true)
    try {
      await candidaturesApi.submit({
        programmeId: Number(id),
        organizationId: selectedOrgId,
        // Section 1
        companyName: form.companyName || undefined,
        contactEmail: form.contactEmail || undefined,
        contactPhone: form.contactPhone || undefined,
        founderName: form.founderName || undefined,
        founderEmail: form.founderEmail || undefined,
        coFounders: form.coFounders || undefined,
        teamBackground: form.teamBackground || undefined,
        engagementLevel: form.engagementLevel || undefined,
        // Section 2
        projectName: form.projectName,
        projectDescription: form.projectDescription || undefined,
        problemStatement: form.problemStatement || undefined,
        solutionDescription: form.solutionDescription || undefined,
        competitiveAdvantage: form.competitiveAdvantage || undefined,
        technologyDescription: form.technologyDescription || undefined,
        sector: form.sector || undefined,
        currentStage: form.currentStage || undefined,
        teamSize: form.teamSize ? Number(form.teamSize) : undefined,
        techStack: form.techStack || undefined,
        // Section 3
        targetMarket: form.targetMarket || undefined,
        hasCustomers: form.hasCustomers !== '' ? form.hasCustomers === 'true' : undefined,
        hasPriorIncubation: form.hasPriorIncubation !== '' ? form.hasPriorIncubation === 'true' : undefined,
        priorIncubationDetails: form.priorIncubationDetails || undefined,
        businessModel: form.businessModel || undefined,
        distributionChannels: form.distributionChannels || undefined,
        fundingRequired: form.fundingRequired ? Number(form.fundingRequired) : undefined,
        // Section 4
        motivation: form.motivation,
        supportNeeds: form.supportNeeds || undefined,
        otherNeeds: form.otherNeeds || undefined,
        programmeExpectations: form.programmeExpectations || undefined,
        pitchDeckUrl: form.pitchDeckUrl || undefined,
      })
      toast.success('Candidature soumise avec succès !')
      router.push('/candidatures')
    } catch (err: any) {
      const msg = err.response?.data?.message ?? err.response?.data ?? 'Erreur lors de la soumission'
      toast.error(typeof msg === 'string' ? msg : 'Erreur lors de la soumission')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <AppShell>
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    </AppShell>
  )

  if (!programme) return null

  // Applications are only possible during the candidature session (server-enforced too).
  if ((programme as any).acceptingApplications === false) {
    return (
      <AppShell>
        <div className="mx-auto max-w-xl px-4 py-20 text-center">
          <div className="rounded-2xl border border-border bg-card p-8">
            <p className="mb-3 text-4xl">🔒</p>
            <h1 className="mb-2 text-xl font-bold text-foreground">Candidatures fermées</h1>
            <p className="mb-5 text-sm text-muted-foreground">
              Les candidatures pour «&nbsp;{programme.title}&nbsp;» ne sont pas ouvertes actuellement.
              Elles ne sont possibles que pendant la session de candidature.
            </p>
            <Button onClick={() => router.push(`/programmes/${id}`)} className="gap-2">
              <ArrowLeft className="h-4 w-4" />Retour au programme
            </Button>
          </div>
        </div>
      </AppShell>
    )
  }

  const programmeSectors = programme.sectors ?? []
  const customSchema: CustomFormSchema | null = parseSchema((programme as any).customFormSchema)
  const useCustom = !!customSchema && customSchema.sections.length > 0
  const template: FormTemplate = (programme.formTemplate as FormTemplate) ?? 'STANDARD'
  const config = TEMPLATE_CONFIG[template] ?? TEMPLATE_CONFIG.STANDARD

  // STEPS: either custom sections + review, OR preset template steps
  const STEPS = useCustom
    ? [
        ...customSchema!.sections.map((s, i) => ({
          id: i, key: `custom_${s.key}`, title: s.title, icon: Briefcase,
          description: s.description ?? '',
        })),
        { id: customSchema!.sections.length, key: 'review', title: 'Vérification', icon: Check, description: 'Relire & soumettre' },
      ]
    : config.steps.map((key, i) => ({ id: i, key, ...ALL_STEPS[key] }))
  const currentKey = STEPS[step]?.key ?? (useCustom ? 'custom_0' : 'team')
  const currentCustomSection = useCustom && step < customSchema!.sections.length
    ? customSchema!.sections[step]
    : null

  return (
    <AppShell>
      {/* Header */}
      <div className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Retour</span>
            </button>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2 min-w-0">
              {programme.logoUrl && (
                <img src={programme.logoUrl} alt={programme.title}
                  className="h-6 w-6 rounded object-contain shrink-0" />
              )}
              <span className="text-sm font-semibold text-foreground truncate">{programme.title}</span>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {/* Required first step: organisation picker */}
        <div className="mb-6">
          <OrganizationPicker
            currentUserId={user?.id ?? null}
            selectedId={selectedOrgId}
            onSelect={(orgId, org) => {
              setSelectedOrgId(orgId)
              setSelectedOrgName(org?.name ?? '')
            }}
          />
        </div>

        <div className="mb-8">
          <h1 className="text-2xl font-black text-foreground mb-1">Rejoindre le programme</h1>
          <p className="text-muted-foreground text-sm">
            {useCustom
              ? `Complétez le formulaire conçu pour ${programme.title}.`
              : (config.intro ?? 'Complétez ce formulaire pour soumettre votre candidature.')}
          </p>
          {(useCustom || template !== 'STANDARD') && (
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-500/10 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:border-brand-800 dark:text-brand-300">
              <Briefcase className="h-3 w-3" />Formulaire : {useCustom ? 'Personnalisé' : config.label}
            </span>
          )}
        </div>

        {/* Step indicator */}
        <div className="mb-8">
          <div className="flex items-center gap-1 sm:gap-2">
            {STEPS.map((s, i) => {
              const Icon = s.icon
              const done = i < step
              const active = i === step
              return (
                <div key={s.id} className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
                  <button
                    onClick={() => done && (setShowStepErrors(false), setStep(i))}
                    disabled={!done}
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all
                      ${active ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/30 scale-110' :
                        done ? 'bg-green-500 text-white cursor-pointer hover:scale-105' :
                          'bg-muted text-muted-foreground'}`}>
                    {done ? <Check className="h-4 w-4" /> : <Icon className="h-3.5 w-3.5" />}
                  </button>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 transition-colors ${i < step ? 'bg-green-500' : 'bg-muted'}`} />
                  )}
                </div>
              )
            })}
          </div>
          <div className="mt-3">
            <p className="text-base font-bold text-foreground">{STEPS[step]?.title}</p>
            <p className="text-xs text-muted-foreground">{STEPS[step]?.description} · Étape {step + 1}/{STEPS.length}</p>
          </div>
        </div>

        {/* Form card */}
        <div className="rounded-2xl border border-border bg-card shadow-sm p-6 sm:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}>
              {/* Custom schema sections */}
              {useCustom && currentCustomSection && (
                <SectionRenderer
                  section={currentCustomSection}
                  answers={customAnswers}
                  onChange={setCustomAnswer}
                  showErrors={showStepErrors} />
              )}
              {/* Custom schema review */}
              {useCustom && currentKey === 'review' && (
                <CustomReview schema={customSchema!} answers={customAnswers} />
              )}
              {/* Preset templates */}
              {!useCustom && currentKey === 'team'       && <StepTeam form={form} set={set} />}
              {!useCustom && currentKey === 'project'    && <StepProject form={form} set={set} programmeSectors={programmeSectors} />}
              {!useCustom && currentKey === 'market'     && <StepMarket form={form} set={set} />}
              {!useCustom && currentKey === 'motivation' && <StepMotivation form={form} set={set} />}
              {!useCustom && currentKey === 'review'     && <StepReview form={form} />}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between gap-4 border-t border-border pt-6">
            <Button variant="outline" onClick={() => setStep(s => s - 1)} disabled={step === 0} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Précédent
            </Button>

            {step < STEPS.length - 1 ? (
              <Button onClick={() => {
                if (canProceed()) { setShowStepErrors(false); setStep(s => s + 1) }
                else {
                  setShowStepErrors(true)
                  if (step === 0 && !selectedOrgId) {
                    toast.error('Sélectionnez d\'abord votre organisation en haut de la page')
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  } else {
                    toast.error('Complétez les champs obligatoires (en rouge) avant de continuer')
                  }
                }
              }} className="gap-2">
                Suivant
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={submitting || (!useCustom && (!form.projectName.trim() || !form.motivation.trim()))}
                className="gap-2 bg-gradient-to-r from-brand-600 to-purple-600 text-white font-bold shadow-lg hover:shadow-brand-500/30 hover:shadow-xl transition-all">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {submitting ? 'Envoi en cours...' : 'Soumettre ma candidature'}
              </Button>
            )}
          </div>
        </div>
      </main>
    </AppShell>
  )
}
