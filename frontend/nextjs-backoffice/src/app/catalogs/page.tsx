'use client'
/**
 * Référentiels — admin-managed reference lists (taxonomies). Edit the options
 * that feed dropdowns across the app: organisation types and programme sectors.
 * Each list supports add / rename / reorder / (de)activate / delete.
 */
import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Tags, Plus, Loader2, Check, X, Trash2, ChevronUp, ChevronDown, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { catalogApi, CATALOG_CATEGORIES } from '@/lib/api'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { MagicCard } from '@/components/magicui/magic-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

interface CatalogItem { id: number; category: string; value: string; label: string; sortOrder?: number; active?: boolean }

const TABS = [
  { key: CATALOG_CATEGORIES.ORGANIZATION_TYPE, label: "Types d'organisation",
    hint: 'Catégories proposées quand un porteur crée son organisation (Startup, Incubateur…).' },
  { key: CATALOG_CATEGORIES.PROGRAMME_SECTOR, label: 'Secteurs de programme',
    hint: 'Secteurs cochés dans la fiche programme (Tech, Fintech, Santé…).' },
  { key: CATALOG_CATEGORIES.SESSION_TYPE, label: 'Types de session',
    hint: 'Types proposés pour les sessions du Parcours (Pitch Day, Demo Day, Hackathon…). Les types intégrés gardent leur comportement; les types ajoutés ici sont génériques.' },
] as const

export default function CatalogsPage() {
  const [tab, setTab] = useState<string>(TABS[0].key)
  return (
    <AdminLayout>
      <div className="mx-auto max-w-3xl space-y-5">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Tags className="h-6 w-6 text-brand-500" />Référentiels
          </h1>
          <p className="text-sm text-muted-foreground">Listes d&apos;options gérées, utilisées dans les formulaires.</p>
        </motion.div>

        <div className="flex gap-1 border-b border-border">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.key ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {TABS.filter((t) => t.key === tab).map((t) => (
          <CatalogEditor key={t.key} category={t.key} hint={t.hint} />
        ))}
      </div>
    </AdminLayout>
  )
}

function CatalogEditor({ category, hint }: { category: string; hint: string }) {
  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [newLabel, setNewLabel] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    catalogApi.list(category)
      .then((r) => setItems(r.data ?? []))
      .catch(() => toast.error('Erreur de chargement'))
      .finally(() => setLoading(false))
  }, [category])
  useEffect(() => { load() }, [load])

  const add = async () => {
    const label = newLabel.trim()
    if (!label) return
    // Org & session types use an enum-style value (UPPER_SNAKE); sectors use the label.
    const value = (category === 'organization_type' || category === 'session_type')
      ? label.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '')
      : label
    setBusy(true)
    try {
      const r = await catalogApi.create({ category, value, label })
      setItems((a) => [...a, r.data])
      setNewLabel('')
      toast.success('Option ajoutée')
    } catch (e: any) { toast.error(e?.response?.data?.message ?? e?.response?.data?.error ?? 'Erreur') }
    finally { setBusy(false) }
  }

  const patch = async (it: CatalogItem, data: Partial<CatalogItem>) => {
    setItems((a) => a.map((x) => (x.id === it.id ? { ...x, ...data } : x)))
    try { await catalogApi.update(it.id, data) }
    catch { toast.error('Erreur'); load() }
  }

  const move = async (it: CatalogItem, dir: -1 | 1) => {
    const sorted = [...items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    const i = sorted.findIndex((x) => x.id === it.id)
    const j = i + dir
    if (j < 0 || j >= sorted.length) return
    const a = sorted[i], b = sorted[j]
    const ao = a.sortOrder ?? i, bo = b.sortOrder ?? j
    await patch(a, { sortOrder: bo }); await patch(b, { sortOrder: ao })
  }

  const remove = async (it: CatalogItem) => {
    if (!confirm(`Supprimer « ${it.label} » ? (les données déjà enregistrées avec cette valeur ne changent pas)`)) return
    try { await catalogApi.delete(it.id); setItems((a) => a.filter((x) => x.id !== it.id)); toast.success('Supprimé') }
    catch { toast.error('Erreur') }
  }

  const sorted = [...items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

  return (
    <MagicCard className="p-5 space-y-4">
      <p className="text-xs text-muted-foreground">{hint}</p>

      {/* Add */}
      <div className="flex gap-2">
        <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Nouvelle option…"
          onKeyDown={(e) => { if (e.key === 'Enter') add() }} />
        <Button variant="brand" onClick={add} disabled={busy || !newLabel.trim()} className="gap-1.5 shrink-0">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Ajouter
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>
      ) : sorted.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Aucune option — ajoutez la première ci-dessus.</p>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
          {sorted.map((it, idx) => (
            <div key={it.id} className={`flex items-center gap-2 px-3 py-2 ${it.active === false ? 'opacity-50' : ''}`}>
              <div className="flex flex-col">
                <button onClick={() => move(it, -1)} disabled={idx === 0} className="p-0.5 rounded hover:bg-accent disabled:opacity-30"><ChevronUp className="h-3 w-3" /></button>
                <button onClick={() => move(it, 1)} disabled={idx === sorted.length - 1} className="p-0.5 rounded hover:bg-accent disabled:opacity-30"><ChevronDown className="h-3 w-3" /></button>
              </div>
              <InlineLabel item={it} onSave={(label) => patch(it, { label })} />
              <span className="text-[10px] font-mono text-muted-foreground shrink-0 hidden sm:inline">{it.value}</span>
              <button onClick={() => patch(it, { active: !(it.active !== false) })}
                title={it.active === false ? 'Activer' : 'Désactiver'}
                className="p-1.5 rounded hover:bg-accent text-muted-foreground shrink-0">
                {it.active === false ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
              <button onClick={() => remove(it)} title="Supprimer"
                className="p-1.5 rounded hover:bg-rose-500/10 text-muted-foreground hover:text-rose-600 shrink-0">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </MagicCard>
  )
}

function InlineLabel({ item, onSave }: { item: CatalogItem; onSave: (label: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(item.label)
  useEffect(() => { setVal(item.label) }, [item.label])
  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="flex-1 min-w-0 text-left text-sm font-medium text-foreground hover:text-brand-600 truncate">
        {item.label}
      </button>
    )
  }
  return (
    <div className="flex-1 flex items-center gap-1">
      <Input value={val} onChange={(e) => setVal(e.target.value)} autoFocus className="h-8"
        onKeyDown={(e) => { if (e.key === 'Enter') { onSave(val.trim() || item.label); setEditing(false) } if (e.key === 'Escape') setEditing(false) }} />
      <button onClick={() => { onSave(val.trim() || item.label); setEditing(false) }} className="p-1.5 rounded hover:bg-accent text-emerald-600"><Check className="h-3.5 w-3.5" /></button>
      <button onClick={() => { setVal(item.label); setEditing(false) }} className="p-1.5 rounded hover:bg-accent text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
    </div>
  )
}
