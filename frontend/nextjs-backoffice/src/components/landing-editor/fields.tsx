'use client'
import { useState } from 'react'
import { ChevronDown, ChevronUp, Copy, Plus, Trash2, ChevronRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ImageUpload } from '@/components/upload/ImageUpload'
import { cn } from '@/lib/utils'
import { ICON_NAMES, type BlockBackground } from './schema'

/** Label + control + optional hint, the one field layout used by every editor. */
export function Field({ label, hint, children, className, asDiv = false }: {
  label: string; hint?: string; children: React.ReactNode; className?: string
  /** Use a <div> when the control holds several buttons (a <label> would forward clicks). */
  asDiv?: boolean
}) {
  const Tag = asDiv ? 'div' : 'label'
  return (
    <Tag className={cn('block space-y-1', className)}>
      <span className="block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-muted-foreground/80">{hint}</span>}
    </Tag>
  )
}

export function TextField({ label, value, onChange, placeholder, hint, className }: {
  label: string; value?: string; onChange: (v: string) => void; placeholder?: string; hint?: string; className?: string
}) {
  return (
    <Field label={label} hint={hint} className={className}>
      <Input value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </Field>
  )
}

export function AreaField({ label, value, onChange, rows = 3, placeholder, hint }: {
  label: string; value?: string; onChange: (v: string) => void; rows?: number; placeholder?: string; hint?: string
}) {
  return (
    <Field label={label} hint={hint}>
      <Textarea rows={rows} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
        className="min-h-0 resize-y" />
    </Field>
  )
}

export function NumberField({ label, value, onChange, min, max }: {
  label: string; value?: number; onChange: (v: number) => void; min?: number; max?: number
}) {
  return (
    <Field label={label}>
      <Input type="number" value={value ?? ''} min={min} max={max}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))} />
    </Field>
  )
}

/** Small segmented control. */
export function Segmented<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void
}) {
  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex rounded-lg border border-border bg-muted/30 p-0.5">
        {options.map((o) => (
          <button key={o.value} type="button" onClick={() => onChange(o.value)}
            className={cn('flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors',
              value === o.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function BackgroundField({ value, onChange }: { value?: BlockBackground; onChange: (v: BlockBackground) => void }) {
  return (
    <Segmented label="Fond de la section" value={value ?? 'default'} onChange={onChange}
      options={[{ value: 'default', label: 'Clair' }, { value: 'muted', label: 'Gris léger' }, { value: 'dark', label: 'Sombre' }]} />
  )
}

export function IconField({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  return (
    <Field label="Icône">
      <select value={value ?? 'Sparkles'} onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm">
        {ICON_NAMES.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
      </select>
    </Field>
  )
}

export function ImageField({ label, value, onChange, folder, query, hint }: {
  label: string; value?: string; onChange: (url: string) => void; folder: string; query?: string; hint?: string
}) {
  return (
    <Field label={label} hint={hint} asDiv>
      <ImageUpload value={value} onChange={onChange} folder={folder} previewHeight={70} compact
        searchContext="feature" defaultQuery={query} />
    </Field>
  )
}

/** Titled group inside a block editor ("Contenu", "Éléments", "Style"…). */
export function Group({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  )
}

/**
 * Editable list (stats, cards, steps, testimonials, questions…): each item can
 * be collapsed, reordered, duplicated or removed.
 */
/** Block data is free JSON; list items are plain records. */
type T = Record<string, any>

export function ItemsEditor({ items, onChange, create, render, itemLabel, addLabel, max = 24 }: {
  items: T[]
  onChange: (items: T[]) => void
  create: () => T
  render: (item: T, update: (patch: Partial<T>) => void) => React.ReactNode
  itemLabel: (item: T, index: number) => string
  addLabel: string
  max?: number
}) {
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({})
  const move = (i: number, d: -1 | 1) => {
    const t = i + d
    if (t < 0 || t >= items.length) return
    const next = [...items]
    ;[next[i], next[t]] = [next[t], next[i]]
    onChange(next)
  }
  const btn = 'flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent'
  return (
    <div className="space-y-2">
      {items.length === 0 && (
        <p className="rounded-lg border border-dashed border-border py-4 text-center text-xs text-muted-foreground">
          Aucun élément pour l’instant.
        </p>
      )}
      {items.map((item, i) => {
        const closed = collapsed[i]
        return (
          <div key={i} className="rounded-lg border border-border bg-background">
            <div className="flex items-center gap-1 px-2 py-1.5">
              <button type="button" onClick={() => setCollapsed((c) => ({ ...c, [i]: !c[i] }))}
                className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
                <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform', !closed && 'rotate-90')} />
                <span className="shrink-0 rounded bg-muted px-1.5 text-[10px] font-bold text-muted-foreground">{i + 1}</span>
                <span className="truncate text-xs font-semibold text-foreground">{itemLabel(item, i) || 'Sans titre'}</span>
              </button>
              <button type="button" className={btn} title="Monter" disabled={i === 0} onClick={() => move(i, -1)}><ChevronUp className="h-3.5 w-3.5" /></button>
              <button type="button" className={btn} title="Descendre" disabled={i === items.length - 1} onClick={() => move(i, 1)}><ChevronDown className="h-3.5 w-3.5" /></button>
              <button type="button" className={btn} title="Dupliquer" disabled={items.length >= max}
                onClick={() => onChange([...items.slice(0, i + 1), structuredClone(item), ...items.slice(i + 1)])}>
                <Copy className="h-3.5 w-3.5" />
              </button>
              <button type="button" className={cn(btn, 'hover:text-destructive')} title="Supprimer"
                onClick={() => onChange(items.filter((_, k) => k !== i))}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            {!closed && (
              <div className="space-y-3 border-t border-border px-3 py-3">
                {render(item, (patch) => onChange(items.map((it, k) => (k === i ? { ...it, ...patch } : it))))}
              </div>
            )}
          </div>
        )
      })}
      <button type="button" disabled={items.length >= max} onClick={() => onChange([...items, create()])}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-brand-500/50 py-2 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-500/5 disabled:opacity-50 dark:text-brand-300">
        <Plus className="h-3.5 w-3.5" />{addLabel}
      </button>
    </div>
  )
}
