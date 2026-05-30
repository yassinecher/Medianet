'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ArrowLeft, ArrowRight, Send, Check, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { CustomFormSchema, CustomField } from './schema'

// ── Preset templates (mirrors frontoffice TEMPLATE_CONFIG) ────────────────────

const PRESET_SCHEMAS: Record<string, CustomFormSchema> = {
  STANDARD: {
    sections: [
      { key: 'team', title: '1. Votre équipe',
        description: 'Décrivez votre équipe et votre entreprise.',
        fields: [
          { key: 'companyName',     label: "Nom de l'entreprise / startup", type: 'text' },
          { key: 'contactEmail',    label: 'Email de contact',              type: 'email' },
          { key: 'contactPhone',    label: 'Téléphone',                     type: 'tel' },
          { key: 'founderName',     label: 'Nom du fondateur principal',    type: 'text' },
          { key: 'founderEmail',    label: 'Email du fondateur',            type: 'email' },
          { key: 'coFounders',      label: 'Co-fondateurs',                 type: 'textarea' },
          { key: 'teamBackground',  label: "Background de l'équipe",        type: 'textarea' },
          { key: 'engagementLevel', label: "Niveau d'engagement",           type: 'radio',
            options: ['Temps plein', 'Temps partiel'] },
        ]},
      { key: 'project', title: '2. Votre projet', description: 'Décrivez votre projet en détail.',
        fields: [
          { key: 'projectName',           label: 'Nom du projet',         type: 'text', required: true },
          { key: 'projectDescription',    label: 'Description générale',  type: 'textarea' },
          { key: 'problemStatement',      label: 'Problème adressé',      type: 'textarea' },
          { key: 'solutionDescription',   label: 'Solution proposée',     type: 'textarea' },
          { key: 'competitiveAdvantage',  label: 'Avantage concurrentiel',type: 'textarea' },
          { key: 'technologyDescription', label: 'Technologies utilisées',type: 'textarea' },
          { key: 'sector',                label: "Secteur d'activité",    type: 'text' },
          { key: 'currentStage',          label: 'Stade actuel',          type: 'radio',
            options: ['Idée', 'Prototype', 'MVP', 'Commercialisé'] },
        ]},
      { key: 'market', title: '3. Marché & business',
        fields: [
          { key: 'targetMarket',       label: 'Marché cible',          type: 'textarea' },
          { key: 'hasCustomers',       label: 'Avez-vous des clients ?', type: 'radio', options: ['Oui', 'Non'] },
          { key: 'businessModel',      label: 'Modèle économique',     type: 'textarea' },
          { key: 'distributionChannels', label: 'Canaux de distribution', type: 'textarea' },
          { key: 'teamSize',           label: "Taille de l'équipe",    type: 'number' },
          { key: 'fundingRequired',    label: 'Financement (TND)',     type: 'number' },
        ]},
      { key: 'motivation', title: '4. Motivation',
        fields: [
          { key: 'motivation',           label: 'Motivation',     type: 'textarea', required: true },
          { key: 'supportNeeds',         label: 'Accompagnement', type: 'checkbox',
            options: ['Mentorat', 'Financement', 'Formation', 'Locaux', 'Réseau'] },
          { key: 'programmeExpectations', label: 'Attentes',      type: 'textarea' },
          { key: 'pitchDeckUrl',         label: 'Pitch Deck (URL)', type: 'url' },
        ]},
    ],
  },
  MINIMAL: {
    sections: [
      { key: 'project', title: '1. Votre projet',
        fields: [
          { key: 'projectName',        label: 'Nom du projet',        type: 'text', required: true },
          { key: 'projectDescription', label: 'Description',          type: 'textarea' },
        ]},
      { key: 'motivation', title: '2. Motivation',
        fields: [
          { key: 'motivation', label: 'Pourquoi vous ?', type: 'textarea', required: true },
        ]},
    ],
  },
  // FOODSTART / TECH / AGRITECH defined inline at preview-time if needed
}

interface PreviewProps {
  open: boolean
  onClose: () => void
  schema: CustomFormSchema | null
  templateName?: string
  templateLabel?: string
}

export function FormPreview({ open, onClose, schema, templateName, templateLabel }: PreviewProps) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})

  // If a templateName is given and no custom schema, use the preset
  const activeSchema = schema ?? (templateName ? PRESET_SCHEMAS[templateName] ?? PRESET_SCHEMAS.STANDARD : null)

  if (!open || !activeSchema || activeSchema.sections.length === 0) return null

  const sections = activeSchema.sections
  const currentSection = sections[step]
  const isLast = step === sections.length - 1
  const isFirst = step === 0

  const setAnswer = (key: string, v: string) => setAnswers((prev) => ({ ...prev, [key]: v }))

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose} />

          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl bg-card border border-border shadow-2xl flex flex-col">

              {/* Header */}
              <div className="flex items-center justify-between border-b border-border px-5 py-3.5 bg-muted/30">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-foreground">Aperçu du formulaire</h2>
                    <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-semibold text-brand-700 dark:text-brand-300">
                      {schema ? 'Personnalisé' : (templateLabel ?? 'Template')}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">Ce qu'un porteur verra sur la page "Rejoindre le programme".</p>
                </div>
                <button type="button" onClick={() => { onClose(); setStep(0); setAnswers({}) }}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Step indicator */}
              <div className="border-b border-border px-5 pt-3 pb-2">
                <div className="flex items-center gap-1 sm:gap-2">
                  {sections.map((s, i) => (
                    <div key={s.key} className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
                      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all
                        ${i === step ? 'bg-brand-500 text-white scale-110' :
                          i < step ? 'bg-green-500 text-white' :
                          'bg-muted text-muted-foreground'}`}>
                        {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
                      </div>
                      {i < sections.length - 1 && (
                        <div className={`flex-1 h-0.5 ${i < step ? 'bg-green-500' : 'bg-muted'}`} />
                      )}
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-sm font-bold text-foreground">{currentSection.title}</p>
                <p className="text-xs text-muted-foreground">Étape {step + 1} sur {sections.length}</p>
              </div>

              {/* Body — scrollable */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {currentSection.description && (
                  <p className="text-sm text-muted-foreground">{currentSection.description}</p>
                )}
                {currentSection.fields.map((field) => (
                  <PreviewField key={field.key} field={field}
                    value={answers[field.key] ?? ''}
                    onChange={(v) => setAnswer(field.key, v)} />
                ))}
                {currentSection.fields.length === 0 && (
                  <p className="text-sm text-muted-foreground italic">Aucun champ dans cette section.</p>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3 bg-muted/20">
                <Button type="button" variant="outline" size="sm"
                  onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={isFirst} className="gap-1.5">
                  <ArrowLeft className="h-3.5 w-3.5" />Précédent
                </Button>
                {!isLast ? (
                  <Button type="button" size="sm" onClick={() => setStep((s) => s + 1)} className="gap-1.5">
                    Suivant<ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <Button type="button" size="sm" disabled
                    className="gap-1.5 bg-gradient-to-r from-brand-600 to-purple-600 text-white opacity-70">
                    <Send className="h-3.5 w-3.5" />Soumettre <span className="text-[10px] font-normal opacity-80">(aperçu — désactivé)</span>
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ── Preview field renderer (same look as frontoffice) ─────────────────────────

function PreviewField({ field, value, onChange }: { field: CustomField; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">
        {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {field.type === 'textarea' ? (
        <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none" />
      ) : field.type === 'select' ? (
        <select value={value} onChange={(e) => onChange(e.target.value)}
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm">
          <option value="">{field.placeholder ?? '— Sélectionner —'}</option>
          {(field.options ?? []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      ) : field.type === 'radio' ? (
        <div className="flex flex-wrap gap-2">
          {(field.options ?? []).map((opt) => (
            <label key={opt}
              className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors
                ${value === opt ? 'border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-300' : 'border-border bg-card text-muted-foreground hover:border-brand-400'}`}>
              <input type="radio" name={field.key} value={opt} checked={value === opt}
                onChange={() => onChange(opt)} className="sr-only" />
              {value === opt && <Check className="h-3.5 w-3.5" />}
              {opt}
            </label>
          ))}
        </div>
      ) : field.type === 'checkbox' ? (
        <CheckboxField field={field} value={value} onChange={onChange} />
      ) : (
        <Input type={field.type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} />
      )}
      {field.helpText && <p className="mt-1 text-xs text-muted-foreground">{field.helpText}</p>}
    </div>
  )
}

function CheckboxField({ field, value, onChange }: { field: CustomField; value: string; onChange: (v: string) => void }) {
  const selected = value ? value.split(',').filter(Boolean) : []
  const toggle = (opt: string) => {
    const next = selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt]
    onChange(next.join(','))
  }
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {(field.options ?? []).map((opt) => (
        <label key={opt}
          className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors
            ${selected.includes(opt) ? 'border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-300' : 'border-border bg-card text-muted-foreground hover:border-brand-400'}`}>
          <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} className="sr-only" />
          <div className={`h-4 w-4 shrink-0 rounded border flex items-center justify-center
            ${selected.includes(opt) ? 'border-brand-500 bg-brand-500' : 'border-border bg-background'}`}>
            {selected.includes(opt) && <Check className="h-2.5 w-2.5 text-white" />}
          </div>
          <span className="leading-tight">{opt}</span>
        </label>
      ))}
    </div>
  )
}
