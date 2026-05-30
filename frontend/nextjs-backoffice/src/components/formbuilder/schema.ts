// Shared shape between backoffice (builder) and frontoffice (renderer).
// Keep in sync with frontend/nextjs-frontoffice/src/components/candidature/FormRenderer.tsx.

export type FieldType =
  | 'text' | 'textarea' | 'email' | 'tel' | 'url' | 'number'
  | 'select' | 'radio' | 'checkbox'

export interface CustomField {
  key: string
  label: string
  type: FieldType
  placeholder?: string
  required?: boolean
  options?: string[]
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

export const FIELD_TYPES: { value: FieldType; label: string; needsOptions: boolean }[] = [
  { value: 'text',     label: 'Texte court',         needsOptions: false },
  { value: 'textarea', label: 'Texte long',          needsOptions: false },
  { value: 'email',    label: 'Email',               needsOptions: false },
  { value: 'tel',      label: 'Téléphone',           needsOptions: false },
  { value: 'url',      label: 'URL',                 needsOptions: false },
  { value: 'number',   label: 'Nombre',              needsOptions: false },
  { value: 'select',   label: 'Liste déroulante',    needsOptions: true  },
  { value: 'radio',    label: 'Choix unique',        needsOptions: true  },
  { value: 'checkbox', label: 'Choix multiples',     needsOptions: true  },
]

export function emptySchema(): CustomFormSchema {
  return {
    sections: [
      {
        key: 'section_1',
        title: 'Présentation du projet',
        description: '',
        fields: [
          { key: 'project_name', label: 'Nom du projet', type: 'text', required: true, placeholder: 'Ex: EcoBuild' },
          { key: 'project_description', label: 'Description', type: 'textarea', required: true, placeholder: 'Décrivez votre projet…' },
        ],
      },
    ],
  }
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove accents
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || `field_${Date.now()}`
}

export function parseSchema(raw: string | null | undefined): CustomFormSchema | null {
  if (!raw) return null
  try {
    const obj = JSON.parse(raw)
    if (!obj || !Array.isArray(obj.sections)) return null
    return obj as CustomFormSchema
  } catch { return null }
}
