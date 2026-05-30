'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Trash2, ChevronUp, ChevronDown, GripVertical, X, Eye, EyeOff,
  Type, AlignLeft, Mail, Phone, Link2, Hash, ListChecks, CheckSquare, Circle
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  type CustomField, type CustomSection, type CustomFormSchema, type FieldType,
  FIELD_TYPES, slugify, emptySchema,
} from './schema'

const TYPE_ICON: Record<FieldType, React.ElementType> = {
  text:     Type,
  textarea: AlignLeft,
  email:    Mail,
  tel:      Phone,
  url:      Link2,
  number:   Hash,
  select:   ListChecks,
  radio:    Circle,
  checkbox: CheckSquare,
}

interface BuilderProps {
  value: CustomFormSchema | null
  onChange: (next: CustomFormSchema | null) => void
}

export function FormBuilder({ value, onChange }: BuilderProps) {
  const schema = value ?? emptySchema()
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null)

  // ── Section operations ──────────────────────────────────────────────────
  const addSection = () => {
    const i = schema.sections.length + 1
    onChange({
      sections: [
        ...schema.sections,
        { key: `section_${i}`, title: `Section ${i}`, description: '', fields: [] },
      ],
    })
  }

  const removeSection = (idx: number) => {
    if (!confirm('Supprimer cette section ?')) return
    onChange({ sections: schema.sections.filter((_, i) => i !== idx) })
  }

  const moveSection = (idx: number, dir: -1 | 1) => {
    const next = [...schema.sections]
    const tgt = idx + dir
    if (tgt < 0 || tgt >= next.length) return
    ;[next[idx], next[tgt]] = [next[tgt], next[idx]]
    onChange({ sections: next })
  }

  const updateSection = (idx: number, patch: Partial<CustomSection>) => {
    onChange({
      sections: schema.sections.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    })
  }

  // ── Field operations ────────────────────────────────────────────────────
  const addField = (sIdx: number) => {
    const sec = schema.sections[sIdx]
    const newField: CustomField = {
      key: `field_${Date.now()}`,
      label: 'Nouveau champ',
      type: 'text',
      required: false,
    }
    updateSection(sIdx, { fields: [...sec.fields, newField] })
    setEditingFieldId(newField.key)
  }

  const removeField = (sIdx: number, fIdx: number) => {
    const sec = schema.sections[sIdx]
    updateSection(sIdx, { fields: sec.fields.filter((_, i) => i !== fIdx) })
  }

  const moveField = (sIdx: number, fIdx: number, dir: -1 | 1) => {
    const sec = schema.sections[sIdx]
    const next = [...sec.fields]
    const tgt = fIdx + dir
    if (tgt < 0 || tgt >= next.length) return
    ;[next[fIdx], next[tgt]] = [next[tgt], next[fIdx]]
    updateSection(sIdx, { fields: next })
  }

  const updateField = (sIdx: number, fIdx: number, patch: Partial<CustomField>) => {
    const sec = schema.sections[sIdx]
    updateSection(sIdx, {
      fields: sec.fields.map((f, i) => (i === fIdx ? { ...f, ...patch } : f)),
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {schema.sections.length} section(s) · {schema.sections.reduce((acc, s) => acc + s.fields.length, 0)} champ(s)
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}
          className="text-xs text-muted-foreground hover:text-destructive">
          <X className="h-3 w-3" />Repasser au template
        </Button>
      </div>

      <div className="space-y-3">
        {schema.sections.map((section, sIdx) => (
          <motion.div key={sIdx} layout
            className="rounded-2xl border-2 border-border bg-card overflow-hidden">
            {/* Section header */}
            <div className="flex items-start gap-2 border-b border-border bg-muted/30 p-3">
              <div className="flex flex-col gap-0.5 pt-2">
                <button type="button" disabled={sIdx === 0}
                  onClick={() => moveSection(sIdx, -1)}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button type="button" disabled={sIdx === schema.sections.length - 1}
                  onClick={() => moveSection(sIdx, 1)}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex-1 space-y-2">
                <Input
                  className="font-bold text-sm bg-background"
                  placeholder="Titre de la section"
                  value={section.title}
                  onChange={(e) => updateSection(sIdx, { title: e.target.value })}
                />
                <Input
                  className="text-xs bg-background"
                  placeholder="Description (optionnel)"
                  value={section.description ?? ''}
                  onChange={(e) => updateSection(sIdx, { description: e.target.value })}
                />
              </div>
              <button type="button" onClick={() => removeSection(sIdx)}
                className="text-muted-foreground hover:text-destructive transition-colors p-1">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {/* Fields list */}
            <div className="p-3 space-y-2">
              {section.fields.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3">
                  Aucun champ dans cette section.
                </p>
              )}
              {section.fields.map((field, fIdx) => {
                const Icon = TYPE_ICON[field.type] ?? Type
                const isEditing = editingFieldId === field.key
                return (
                  <div key={fIdx} className="rounded-xl border border-border bg-muted/20">
                    <div className="flex items-center gap-2 p-2.5">
                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Icon className="h-3.5 w-3.5 text-brand-500" />
                      </div>
                      <span className="flex-1 text-sm font-medium text-foreground truncate">
                        {field.label || <span className="text-muted-foreground italic">Sans titre</span>}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </span>
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground shrink-0">
                        {FIELD_TYPES.find((t) => t.value === field.type)?.label}
                      </span>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button type="button" disabled={fIdx === 0}
                          onClick={() => moveField(sIdx, fIdx, -1)}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-0.5">
                          <ChevronUp className="h-3 w-3" />
                        </button>
                        <button type="button" disabled={fIdx === section.fields.length - 1}
                          onClick={() => moveField(sIdx, fIdx, 1)}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-0.5">
                          <ChevronDown className="h-3 w-3" />
                        </button>
                        <button type="button"
                          onClick={() => setEditingFieldId(isEditing ? null : field.key)}
                          className="text-xs text-brand-600 hover:underline px-1.5">
                          {isEditing ? 'Fermer' : 'Éditer'}
                        </button>
                        <button type="button" onClick={() => removeField(sIdx, fIdx)}
                          className="text-muted-foreground hover:text-destructive p-0.5">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Inline field editor */}
                    <AnimatePresence>
                      {isEditing && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden">
                          <div className="border-t border-border bg-background p-3 space-y-2.5">
                            <div className="grid gap-2 sm:grid-cols-2">
                              <div>
                                <label className="text-[10px] font-semibold text-muted-foreground uppercase">Libellé</label>
                                <Input value={field.label}
                                  onChange={(e) => updateField(sIdx, fIdx, {
                                    label: e.target.value,
                                    // auto-derive key from label on first edit only
                                    key: field.key.startsWith('field_')
                                      ? slugify(e.target.value) || field.key
                                      : field.key,
                                  })} />
                              </div>
                              <div>
                                <label className="text-[10px] font-semibold text-muted-foreground uppercase">Type</label>
                                <select value={field.type}
                                  onChange={(e) => updateField(sIdx, fIdx, { type: e.target.value as FieldType })}
                                  className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm">
                                  {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="text-[10px] font-semibold text-muted-foreground uppercase">Placeholder</label>
                                <Input value={field.placeholder ?? ''}
                                  onChange={(e) => updateField(sIdx, fIdx, { placeholder: e.target.value })} />
                              </div>
                              <div>
                                <label className="text-[10px] font-semibold text-muted-foreground uppercase">Clé (technique)</label>
                                <Input value={field.key}
                                  onChange={(e) => updateField(sIdx, fIdx, { key: slugify(e.target.value) })} />
                              </div>
                            </div>

                            <div>
                              <label className="text-[10px] font-semibold text-muted-foreground uppercase">Aide</label>
                              <Input value={field.helpText ?? ''}
                                placeholder="Texte d'aide affiché sous le champ"
                                onChange={(e) => updateField(sIdx, fIdx, { helpText: e.target.value })} />
                            </div>

                            {/* Options for select / radio / checkbox */}
                            {(field.type === 'select' || field.type === 'radio' || field.type === 'checkbox') && (
                              <div>
                                <label className="text-[10px] font-semibold text-muted-foreground uppercase">Options (une par ligne)</label>
                                <textarea
                                  rows={4}
                                  value={(field.options ?? []).join('\n')}
                                  onChange={(e) => updateField(sIdx, fIdx, {
                                    options: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
                                  })}
                                  placeholder="Option 1&#10;Option 2&#10;Option 3"
                                  className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm resize-none" />
                              </div>
                            )}

                            <label className="flex items-center gap-2 text-sm pt-1">
                              <input type="checkbox" checked={field.required ?? false}
                                onChange={(e) => updateField(sIdx, fIdx, { required: e.target.checked })}
                                className="h-4 w-4 rounded border-input" />
                              <span className="text-foreground">Champ obligatoire</span>
                            </label>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
              <Button type="button" variant="ghost" size="sm"
                onClick={() => addField(sIdx)}
                className="w-full justify-center text-xs gap-1.5 text-muted-foreground border border-dashed border-border hover:border-brand-400 hover:text-brand-600">
                <Plus className="h-3 w-3" />Ajouter un champ
              </Button>
            </div>
          </motion.div>
        ))}
      </div>

      <Button type="button" variant="outline" size="sm" onClick={addSection} className="w-full gap-1.5">
        <Plus className="h-3.5 w-3.5" />Ajouter une section
      </Button>
    </div>
  )
}
