'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Building2, Eye, EyeOff, Globe, Loader2, Pencil, Plus, Rocket, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { incubatedAdminApi, type IncubatedUpsert } from '@/lib/api'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { MagicCard } from '@/components/magicui/magic-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ImageUpload } from '@/components/upload/ImageUpload'

interface Company {
  id: number; name: string; logoUrl?: string
  description?: string; website?: string
  sector?: string; cohortYear?: string
  publicVisible: boolean; sortOrder?: number
}

const EMPTY: IncubatedUpsert = { name: '', logoUrl: '', description: '', website: '', sector: '', cohortYear: '', publicVisible: true }

export default function IncubatedAdminPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const [form, setForm] = useState<IncubatedUpsert>(EMPTY)
  const set = (k: keyof IncubatedUpsert, v: any) => setForm((f) => ({ ...f, [k]: v }))

  const reload = () => incubatedAdminApi.list().then((r) => setCompanies(r.data ?? [])).catch(() => {})
  useEffect(() => { reload().then(() => setLoading(false)) }, [])

  const openEdit = (c: Company) => {
    setForm({
      name: c.name, logoUrl: c.logoUrl ?? '', description: c.description ?? '', website: c.website ?? '',
      sector: c.sector ?? '', cohortYear: c.cohortYear ?? '', publicVisible: c.publicVisible, sortOrder: c.sortOrder,
    })
    setEditing(c.id)
  }

  const save = async () => {
    if (!form.name?.trim()) { toast.error('Le nom est requis.'); return }
    setBusy(true)
    try {
      if (editing === 'new') await incubatedAdminApi.create({ ...form, name: form.name.trim() })
      else if (typeof editing === 'number') await incubatedAdminApi.update(editing, form)
      toast.success(editing === 'new' ? 'Société ajoutée' : 'Société mise à jour')
      setEditing(null); setForm(EMPTY); await reload()
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Enregistrement impossible') }
    finally { setBusy(false) }
  }

  const toggleVisible = async (c: Company) => {
    try {
      await incubatedAdminApi.update(c.id, { publicVisible: !c.publicVisible })
      setCompanies((cs) => cs.map((x) => x.id === c.id ? { ...x, publicVisible: !c.publicVisible } : x))
      toast.success(!c.publicVisible ? `« ${c.name} » est visible sur le site public` : `« ${c.name} » est masquée du site public`)
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Action impossible') }
  }

  const del = async (c: Company) => {
    if (!confirm(`Supprimer « ${c.name} » du catalogue des sociétés incubées ?`)) return
    try { await incubatedAdminApi.delete(c.id); toast.success('Société supprimée'); await reload() }
    catch (e: any) { toast.error(e?.response?.data?.message ?? 'Suppression impossible') }
  }

  return (
    <AdminLayout>
      <div className="space-y-5">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
              <Rocket className="h-6 w-6 text-brand-500" />Sociétés incubées
            </h1>
            <p className="text-sm text-muted-foreground">
              Le portfolio des startups passées par l&apos;incubateur — publié sur la page publique « Sociétés incubées ».
            </p>
          </div>
          <Button variant="brand" className="gap-1.5" onClick={() => { setForm(EMPTY); setEditing('new') }}>
            <Plus className="h-4 w-4" />Ajouter une société
          </Button>
        </motion.div>

        {/* Editor */}
        {editing !== null && (
          <MagicCard className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-foreground">{editing === 'new' ? 'Nouvelle société' : 'Modifier la société'}</h2>
              <button onClick={() => setEditing(null)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nom *</label>
                <Input value={form.name ?? ''} placeholder="Nom de la startup" onChange={(e) => set('name', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Logo</label>
                <ImageUpload value={form.logoUrl ?? ''} folder="incubated" previewHeight={60} compact
                  onChange={(url) => set('logoUrl', url)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</label>
                <Textarea rows={3} value={form.description ?? ''} placeholder="Ce que fait la société, son parcours dans l'incubateur…"
                  onChange={(e) => set('description', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Site web</label>
                <Input value={form.website ?? ''} placeholder="https://…" onChange={(e) => set('website', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Secteur</label>
                <Input value={form.sector ?? ''} placeholder="Ex. Fintech, Agritech…" onChange={(e) => set('sector', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cohorte / année</label>
                <Input value={form.cohortYear ?? ''} placeholder="Ex. 2024" onChange={(e) => set('cohortYear', e.target.value)} />
              </div>
              <label className="flex cursor-pointer items-center gap-2.5 self-end rounded-lg border border-border px-3 py-2.5 text-sm hover:bg-accent/40">
                <input type="checkbox" className="h-4 w-4 accent-emerald-500" checked={!!form.publicVisible}
                  onChange={(e) => set('publicVisible', e.target.checked)} />
                <span className="flex-1 text-foreground">Visible sur la page publique</span>
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(null)}>Annuler</Button>
              <Button variant="brand" onClick={save} disabled={busy} className="gap-1.5">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer
              </Button>
            </div>
          </MagicCard>
        )}

        {/* List */}
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
        ) : companies.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-14 text-center">
            <Rocket className="mx-auto h-10 w-10 text-muted-foreground opacity-30" />
            <p className="mt-3 text-sm font-medium text-foreground">Aucune société pour l&apos;instant</p>
            <p className="mt-1 text-xs text-muted-foreground">Ajoutez les startups déjà passées par l&apos;incubateur.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {companies.map((c) => (
              <MagicCard key={c.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-white">
                    {c.logoUrl ? <img src={c.logoUrl} alt={c.name} className="h-full w-full object-contain p-1" />
                      : <Building2 className="h-5 w-5 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate font-semibold text-foreground">{c.name}</p>
                      {c.cohortYear && <Badge variant="default">Cohorte {c.cohortYear}</Badge>}
                      {c.publicVisible
                        ? <Badge variant="success">Visible</Badge>
                        : <Badge variant="secondary">Masquée</Badge>}
                    </div>
                    {c.sector && <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{c.sector}</p>}
                    {c.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{c.description}</p>}
                    {c.website && <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground"><Globe className="h-3 w-3" />{c.website}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <button onClick={() => toggleVisible(c)} title={c.publicVisible ? 'Masquer' : 'Publier'}
                      className={`rounded-md p-1.5 transition-colors ${c.publicVisible ? 'text-emerald-600 hover:bg-emerald-500/10' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                      {c.publicVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                    <button onClick={() => openEdit(c)} title="Modifier"
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => del(c)} title="Supprimer"
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </MagicCard>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
