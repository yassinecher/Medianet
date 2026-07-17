'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Loader2, Check, Settings2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { catalogApi } from '@/lib/api'

interface CatalogItem { id: number; value: string; label: string; active?: boolean }

/**
 * Multi-select over an admin-managed catalog (sectors, org types…). Options come
 * live from the catalog, and — the point of this component — a new option can be
 * added right here without leaving the form: it persists to the catalog and is
 * selected immediately. A link to the full « Référentiels » page is always shown
 * so it's clear where these lists live.
 */
export function CatalogMultiSelect({
  category, categoryLabel, selected, onChange, addLabel = 'Ajouter',
}: {
  category: string
  categoryLabel: string
  /** Selected `value`s. */
  selected: string[]
  onChange: (values: string[]) => void
  addLabel?: string
}) {
  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await catalogApi.list(category)
      setItems((data ?? []).filter((i: CatalogItem) => i.active !== false))
    } catch { /* keep whatever we had */ }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [category])

  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value])

  const addNew = async () => {
    const label = draft.trim()
    if (!label) return
    // Reuse an existing option (case-insensitive) instead of duplicating it.
    const existing = items.find((i) => i.label.toLowerCase() === label.toLowerCase() || i.value.toLowerCase() === label.toLowerCase())
    if (existing) {
      if (!selected.includes(existing.value)) toggle(existing.value)
      setDraft(''); setAdding(false); return
    }
    const value = label.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    setSaving(true)
    try {
      const { data } = await catalogApi.create({ category, value, label })
      const created: CatalogItem = data ?? { id: Date.now(), value, label }
      setItems((prev) => [...prev, created])
      onChange([...selected, created.value])
      setDraft(''); setAdding(false)
      toast.success(`« ${label} » ajouté au référentiel`)
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Ajout impossible')
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-2">
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Chargement…</div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((i) => {
            const on = selected.includes(i.value)
            return (
              <button type="button" key={i.id} onClick={() => toggle(i.value)}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  on ? 'border-brand-500 bg-brand-500/15 font-medium text-brand-700 dark:text-brand-300'
                     : 'border-border text-muted-foreground hover:border-brand-400'}`}>
                {on && <Check className="h-3 w-3" />}{i.label}
              </button>
            )
          })}

          {adding ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-brand-400 bg-background px-1.5 py-0.5">
              <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addNew() } if (e.key === 'Escape') { setAdding(false); setDraft('') } }}
                placeholder={`Nouveau ${categoryLabel.toLowerCase()}…`}
                className="h-6 w-40 bg-transparent px-1 text-xs outline-none" />
              <button type="button" onClick={addNew} disabled={saving || !draft.trim()}
                className="rounded-full p-0.5 text-brand-600 disabled:opacity-40 dark:text-brand-400">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-brand-400 px-2.5 py-1 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-500/10 dark:text-brand-400">
              <Plus className="h-3 w-3" />{addLabel}
            </button>
          )}
        </div>
      )}

      <Link href="/catalogs" target="_blank"
        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground">
        <Settings2 className="h-3 w-3" />Gérer le référentiel « {categoryLabel} »
      </Link>
    </div>
  )
}
