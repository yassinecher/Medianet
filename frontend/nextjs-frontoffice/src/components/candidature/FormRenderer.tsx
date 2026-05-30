'use client'
/**
 * Renders a custom candidature form from a JSON schema.
 * The schema is authored by admins in the programme builder and stored on the
 * programme as `customFormSchema`. Shape:
 *
 *   { sections: [ { key, title, description?, fields: [ { key, label, type,
 *     required?, placeholder?, helpText?, options? } ] } ] }
 */
import { useState } from 'react'
import { Info, AlertCircle, Check } from 'lucide-react'
import { Input } from '@/components/ui/input'

export interface CustomFormField {
  key: string
  label: string
  type: 'text' | 'textarea' | 'email' | 'tel' | 'url' | 'number' | 'date' | 'select' | 'radio' | 'checkbox'
  required?: boolean
  placeholder?: string
  helpText?: string
  options?: string[]
}

export interface CustomFormSection {
  key: string
  title: string
  description?: string
  fields: CustomFormField[]
}

export interface CustomFormSchema {
  sections: CustomFormSection[]
}

/** Parse the raw JSON schema string → object, or null if invalid/empty. */
export function parseSchema(raw: string | null | undefined): CustomFormSchema | null {
  if (!raw || !raw.trim()) return null
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.sections)) return null
    return parsed as CustomFormSchema
  } catch {
    return null
  }
}

/** Find the first required field in a section that has no answer. Returns null if all good. */
export function findMissingRequired(
  section: CustomFormSection,
  answers: Record<string, string>,
): CustomFormField | null {
  for (const f of section.fields) {
    if (f.required && !(answers[f.key] ?? '').trim()) return f
  }
  return null
}

const FIELD_BASE =
  "w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring"

function FieldInput({ field, value, onChange, onBlur, invalid }: {
  field: CustomFormField
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  invalid?: boolean
}) {
  const border = invalid ? 'border-destructive ring-1 ring-destructive/30' : 'border-input'
  const cls = `${FIELD_BASE} ${border}`
  const opts = field.options ?? []

  switch (field.type) {
    case 'textarea': {
      const len = (value ?? '').length
      return (
        <div>
          <textarea rows={4} value={value} placeholder={field.placeholder} onBlur={onBlur}
            onChange={(e) => onChange(e.target.value)} className={`${cls} resize-y`} />
          <div className="mt-0.5 text-right text-[10px] text-muted-foreground tabular-nums">{len} caractères</div>
        </div>
      )
    }

    case 'select':
      return (
        <select value={value} onBlur={onBlur} onChange={(e) => onChange(e.target.value)}
          className={`${cls} cursor-pointer ${value ? '' : 'text-muted-foreground'}`}>
          <option value="">{field.placeholder || '— Sélectionner —'}</option>
          {opts.map((o) => <option key={o} value={o} className="text-foreground">{o}</option>)}
        </select>
      )

    case 'radio':
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          {opts.map((o) => {
            const active = value === o
            return (
              <button key={o} type="button" onClick={() => { onChange(o); onBlur?.() }}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm text-left transition-all
                  ${active
                    ? 'border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-300 font-semibold ring-1 ring-brand-500/40'
                    : invalid ? 'border-destructive/50 bg-card text-muted-foreground hover:border-brand-400'
                              : 'border-border bg-card text-muted-foreground hover:border-brand-400 hover:text-foreground'}`}>
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${active ? 'border-brand-500' : 'border-muted-foreground/40'}`}>
                  {active && <span className="h-2 w-2 rounded-full bg-brand-500" />}
                </span>
                {o}
              </button>
            )
          })}
        </div>
      )

    case 'checkbox': {
      // Multi-value stored as comma-separated string
      const selected = value ? value.split(',').filter(Boolean) : []
      const toggle = (o: string) => {
        const next = selected.includes(o) ? selected.filter((x) => x !== o) : [...selected, o]
        onChange(next.join(','))
        onBlur?.()
      }
      return (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {opts.map((o) => {
            const active = selected.includes(o)
            return (
              <button key={o} type="button" onClick={() => toggle(o)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm text-left transition-all
                  ${active
                    ? 'border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-300 font-semibold ring-1 ring-brand-500/40'
                    : 'border-border bg-card text-muted-foreground hover:border-brand-400'}`}>
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 ${active ? 'border-brand-500 bg-brand-500 text-white' : 'border-muted-foreground/40'}`}>
                  {active && <Check className="h-3 w-3" />}
                </span>
                <span className="leading-tight">{o}</span>
              </button>
            )
          })}
        </div>
      )
    }

    default:
      return (
        <Input type={field.type} value={value} placeholder={field.placeholder} onBlur={onBlur}
          onChange={(e) => onChange(e.target.value)}
          className={invalid ? 'border-destructive ring-1 ring-destructive/30' : ''} />
      )
  }
}

export function SectionRenderer({ section, answers, onChange, showErrors = false }: {
  section: CustomFormSection
  answers: Record<string, string>
  onChange: (key: string, value: string) => void
  /** When true, every empty required field shows its error immediately (e.g. on submit attempt). */
  showErrors?: boolean
}) {
  // Track which fields the user has interacted with so we only flag mistakes
  // after they've had a chance to fill them (or when the parent forces showErrors).
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const isMissing = (f: CustomFormField) => f.required && !(answers[f.key] ?? '').trim()
  const requiredCount = section.fields.filter((f) => f.required).length
  const filledRequired = section.fields.filter((f) => f.required && (answers[f.key] ?? '').trim()).length

  return (
    <div className="space-y-5">
      {section.description && (
        <p className="text-sm text-muted-foreground">{section.description}</p>
      )}

      {requiredCount > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 font-medium">
            {filledRequired}/{requiredCount} champ{requiredCount > 1 ? 's' : ''} requis complété{filledRequired > 1 ? 's' : ''}
          </span>
          <span className="text-destructive">*</span> = obligatoire
        </div>
      )}

      {section.fields.map((field) => {
        const invalid = (showErrors || touched[field.key]) && isMissing(field)
        return (
          <div key={field.key}>
            <label className="flex items-center gap-1 text-sm font-medium text-foreground mb-1.5">
              {field.label}
              {field.required && <span className="text-destructive">*</span>}
            </label>
            <FieldInput
              field={field}
              value={answers[field.key] ?? ''}
              onChange={(v) => onChange(field.key, v)}
              onBlur={() => setTouched((t) => ({ ...t, [field.key]: true }))}
              invalid={!!invalid}
            />
            {field.helpText && !invalid && (
              <p className="mt-1 text-xs text-muted-foreground flex items-start gap-1">
                <Info className="h-3 w-3 mt-0.5 shrink-0 opacity-70" />{field.helpText}
              </p>
            )}
            {invalid && (
              <p className="mt-1 text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />Ce champ est obligatoire
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
