'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Building2, Eye, EyeOff, Globe, Handshake, Loader2, Mail, Pencil, Phone, Plus, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { partnersApi, type PartnerUpsert } from '@/lib/api'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { MagicCard } from '@/components/magicui/magic-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ImageUpload } from '@/components/upload/ImageUpload'

interface Partner {
  id: number; name: string; logoUrl?: string
  description?: string; website?: string
  contactEmail?: string; contactPhone?: string
  publicVisible: boolean
}

const EMPTY: PartnerUpsert = { name: '', logoUrl: '', description: '', website: '', contactEmail: '', contactPhone: '', publicVisible: false }

export default function PartnersAdminPage() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  // null = closed · 'new' = create · number = editing that partner
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const [form, setForm] = useState<PartnerUpsert>(EMPTY)
  const set = (k: keyof PartnerUpsert, v: any) => setForm((f) => ({ ...f, [k]: v }))

  const reload = () => partnersApi.list().then((r) => setPartners(r.data ?? [])).catch(() => {})
  useEffect(() => { reload().then(() => setLoading(false)) }, [])

  const openEdit = (p: Partner) => {
    setForm({
      name: p.name, logoUrl: p.logoUrl ?? '', description: p.description ?? '', website: p.website ?? '',
      contactEmail: p.contactEmail ?? '', contactPhone: p.contactPhone ?? '', publicVisible: p.publicVisible,
    })
    setEditing(p.id)
  }

  const save = async () => {
    if (!form.name?.trim()) { toast.error('Le nom est requis.'); return }
    setBusy(true)
    try {
      if (editing === 'new') await partnersApi.create({ ...form, name: form.name.trim() })
      else if (typeof editing === 'number') await partnersApi.update(editing, form)
      toast.success(editing === 'new' ? 'Partenaire créé' : 'Partenaire mis à jour')
      setEditing(null); setForm(EMPTY); await reload()
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Enregistrement impossible') }
    finally { setBusy(false) }
  }

  const toggleVisible = async (p: Partner) => {
    try {
      await partnersApi.update(p.id, { publicVisible: !p.publicVisible })
      setPartners((ps) => ps.map((x) => x.id === p.id ? { ...x, publicVisible: !p.publicVisible } : x))
      toast.success(!p.publicVisible ? `« ${p.name} » est maintenant visible sur le site public` : `« ${p.name} » est masqué du site public`)
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Action impossible') }
  }

  const del = async (p: Partner) => {
    if (!confirm(`Supprimer le partenaire « ${p.name} » ? Il sera aussi retiré de tous les programmes.`)) return
    try { await partnersApi.delete(p.id); toast.success('Partenaire supprimé'); await reload() }
    catch (e: any) { toast.error(e?.response?.data?.message ?? 'Suppression impossible') }
  }

  return (
    <AdminLayout>
      <div className="space-y-5">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
              <Handshake className="h-6 w-6 text-brand-500" />Partenaires
            </h1>
            <p className="text-sm text-muted-foreground">
              Bibliothèque des partenaires — activez « Visible » pour les publier sur la page publique du site.
            </p>
          </div>
          <Button variant="brand" className="gap-1.5" onClick={() => { setForm(EMPTY); setEditing('new') }}>
            <Plus className="h-4 w-4" />Nouveau partenaire
          </Button>
        </motion.div>

        {/* Editor */}
        {editing !== null && (
          <MagicCard className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-foreground">{editing === 'new' ? 'Nouveau partenaire' : 'Modifier le partenaire'}</h2>
              <button onClick={() => setEditing(null)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nom *</label>
                <Input value={form.name ?? ''} placeholder="Nom de l'organisation" onChange={(e) => set('name', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Logo</label>
                <ImageUpload value={form.logoUrl ?? ''} folder="partners" previewHeight={60} compact
                  onChange={(url) => set('logoUrl', url)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</label>
                <Textarea rows={3} value={form.description ?? ''} placeholder="Qui est ce partenaire, ce qu'il apporte à l'incubateur…"
                  onChange={(e) => set('description', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Site web</label>
                <Input value={form.website ?? ''} placeholder="https://…" onChange={(e) => set('website', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email de contact</label>
                <Input type="email" value={form.contactEmail ?? ''} placeholder="contact@partenaire.com" onChange={(e) => set('contactEmail', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Téléphone</label>
                <Input value={form.contactPhone ?? ''} placeholder="+216 …" onChange={(e) => set('contactPhone', e.target.value)} />
              </div>
              <label className="flex cursor-pointer items-center gap-2.5 self-end rounded-lg border border-border px-3 py-2.5 text-sm hover:bg-accent/40">
                <input type="checkbox" className="h-4 w-4 accent-emerald-500" checked={!!form.publicVisible}
                  onChange={(e) => set('publicVisible', e.target.checked)} />
                <span className="flex-1 text-foreground">Visible sur la page publique « Partenaires »</span>
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
        ) : partners.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-14 text-center">
            <Building2 className="mx-auto h-10 w-10 text-muted-foreground opacity-30" />
            <p className="mt-3 text-sm font-medium text-foreground">Aucun partenaire</p>
            <p className="mt-1 text-xs text-muted-foreground">Créez le premier partenaire de la bibliothèque.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {partners.map((p) => (
              <MagicCard key={p.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-white">
                    {p.logoUrl ? <img src={p.logoUrl} alt={p.name} className="h-full w-full object-contain p-1" />
                      : <Building2 className="h-5 w-5 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate font-semibold text-foreground">{p.name}</p>
                      {p.publicVisible
                        ? <Badge variant="success">Visible au public</Badge>
                        : <Badge variant="secondary">Masqué</Badge>}
                    </div>
                    {p.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>}
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                      {p.website && <span className="flex items-center gap-1"><Globe className="h-3 w-3" />{p.website}</span>}
                      {p.contactEmail && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{p.contactEmail}</span>}
                      {p.contactPhone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{p.contactPhone}</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <button onClick={() => toggleVisible(p)} title={p.publicVisible ? 'Masquer du site public' : 'Publier sur le site public'}
                      className={`rounded-md p-1.5 transition-colors ${p.publicVisible ? 'text-emerald-600 hover:bg-emerald-500/10' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                      {p.publicVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                    <button onClick={() => openEdit(p)} title="Modifier"
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => del(p)} title="Supprimer"
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
