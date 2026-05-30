'use client'
import { Check } from 'lucide-react'
import { Input } from '@/components/ui/input'

// ── Schema types ─────────────────────────────────────────────────────────────

export type FieldType = 'text' | 'textarea' | 'email' | 'tel' | 'url' | 'number' | 'select' | 'radio' | 'checkbox'

export interface CustomField {
  key: string
  label: string
  type: FieldType
  placeholder?: string
  required?: boolean
  options?: string[]      // for select / radio / checkbox
  helpText?: string
}

export interface CustomSection {
  key: string
  title: string
  description?: string
  fields: CustomField[]
}

export interface CustomFormSchema {
  sections: CustomSection[]
}

/** Try to parse a JSON-encoded schema. Returns null on invalid input. */
export function parseSchema(raw: string | null | undefined): CustomFormSchema | null {
  if (!raw) return null
  try {
    const obj = JSON.parse(raw)
    if (!obj || !Array.isArray(obj.sections)) return null
    return obj as CustomFormSchema
  } catch { return null }
}

// ── Field renderer ───────────────────────────────────────────────────────────

interface FieldProps {
  field: CustomField
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}

export function FieldRenderer({ field, value, onChange, disabled }: FieldProps) {
  switch (field.type) {
    case 'textarea':
      return (
        <textarea rows={4} disabled={disabled}
          value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none disabled:opacity-60" />
      )

    case 'select':
      return (
        <select disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)}
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60">
          <option value="">{field.placeholder ?? '— Sélectionner —'}</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )

    case 'radio':
      return (
        <div className="flex flex-wrap gap-2">
          {(field.options ?? []).map((opt) => (
            <label key={opt}
              className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors
                ${value === opt
                  ? 'border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-300'
                  : 'border-border bg-card text-muted-foreground hover:border-brand-400'}
                ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}>
              <input type="radio" name={field.key} value={opt} checked={value === opt} disabled={disabled}
                onChange={() => onChange(opt)} className="sr-only" />
              {value === opt && <Check className="h-3.5 w-3.5" />}
              {opt}
            </label>
          ))}
        </div>
      )

    case 'checkbox': {
      const selected = value ? value.split(',').filter(Boolean) : []
      const toggle = (opt: string) => {
        if (disabled) return
        const next = selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt]
        onChange(next.join(','))
      }
      return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(field.options ?? []).map((opt) => (
            <label key={opt}
              className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors
                ${selected.includes(opt)
                  ? 'border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-300'
                  : 'border-border bg-card text-muted-foreground hover:border-brand-400'}
                ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}>
              <input type="checkbox" checked={selected.includes(opt)} disabled={disabled}
                onChange={() => toggle(opt)} className="sr-only" />
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

    case 'email':
    case 'tel':
    case 'url':
    case 'number':
    case 'text':
    default:
      return (
        <Input
          type={field.type === 'text' ? 'text' : field.type}
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
        />
      )
  }
}

// ── Section renderer ─────────────────────────────────────────────────────────

interface SectionProps {
  section: CustomSection
  answers: Record<string, string>
  onChange: (key: string, v: string) => void
  disabled?: boolean
}

export function SectionRenderer({ section, answers, onChange, disabled }: SectionProps) {
  return (
    <div className="space-y-6">
      {section.description && (
        <p className="text-sm text-muted-foreground">{section.description}</p>
      )}
      <div className="space-y-5">
        {section.fields.map((field) => (
          <div key={field.key}>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              {field.label}
              {field.required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            <FieldRenderer
              field={field}
              value={answers[field.key] ?? ''}
              onChange={(v) => onChange(field.key, v)}
              disabled={disabled}
            />
            {field.helpText && (
              <p className="mt-1 text-xs text-muted-foreground">{field.helpText}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Validation helper ────────────────────────────────────────────────────────

/** Returns the first required field that's missing, or null if all valid. */
export function findMissingRequired(
  section: CustomSection,
  answers: Record<string, string>
): CustomField | null {
  for (const field of section.fields) {
    if (!field.required) continue
    const value = answers[field.key]
    if (!value || !value.trim()) return field
  }
  return null
}
