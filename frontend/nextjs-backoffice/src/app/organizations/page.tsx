'use client'
/**
 * /organizations — admin-side directory of every organisation registered on
 * the platform, plus its members.
 *
 * An Organization is a single concept that covers startups (porteurs apply
 * with one), sponsors/partners, universities, incubator-internal teams.
 * Each org owns N members with role + expertise + responsibilities, marked
 * INTERNAL or EXTERNAL. Filters in the toolbar narrow by type/internal.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Trash2, Edit2, Save, Building2, ChevronDown, ChevronRight, Loader2,
  Users, Globe2, Mail, Phone, MapPin, Search, X, UserPlus, ArrowUpRight, Eye, EyeOff,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { organizationsApi, showcaseApi, ORGANIZATION_TYPES, MEMBER_TYPES } from '@/lib/api'
import type { OrganizationType, MemberType } from '@/lib/api'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { MagicCard } from '@/components/magicui/magic-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// ── Types (mirror backend DTOs) ────────────────────────────────────────────

interface Member {
  id?: number
  userId?: number | null
  fullName: string
  email?: string
  phone?: string
  role?: string
  responsibilities?: string
  expertise?: string[]
  type?: MemberType | string
}

interface Organization {
  id?: number
  name: string
  type?: OrganizationType | string
  description?: string
  sector?: string
  city?: string
  country?: string
  website?: string
  contactEmail?: string
  contactPhone?: string
  logoUrl?: string
  internal?: boolean
  /** Visible on the public « Sociétés incubées » page (admin-set). */
  showcased?: boolean
  createdByUserId?: number | null
  linkedCompanyId?: number | null
  members?: Member[]
}

// ── Display helpers ────────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  STARTUP: 'Startup', INCUBATOR: 'Incubateur', UNIVERSITY: 'Université',
  ASSOCIATION: 'Association', SPONSOR: 'Sponsor', CORPORATE: 'Corporate',
  GOVERNMENT: 'Public', OTHER: 'Autre',
}

const TYPE_TONE: Record<string, string> = {
  STARTUP:     'bg-sky-500/15 text-sky-700 border-sky-300/40 dark:text-sky-300',
  INCUBATOR:   'bg-purple-500/15 text-purple-700 border-purple-300/40 dark:text-purple-300',
  UNIVERSITY:  'bg-emerald-500/15 text-emerald-700 border-emerald-300/40 dark:text-emerald-300',
  ASSOCIATION: 'bg-amber-500/15 text-amber-700 border-amber-300/40 dark:text-amber-300',
  SPONSOR:     'bg-rose-500/15 text-rose-700 border-rose-300/40 dark:text-rose-300',
  CORPORATE:   'bg-indigo-500/15 text-indigo-700 border-indigo-300/40 dark:text-indigo-300',
  GOVERNMENT:  'bg-slate-500/15 text-slate-700 border-slate-300/40 dark:text-slate-300',
  OTHER:       'bg-muted text-muted-foreground border-border',
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('')
  const [filterInternal, setFilterInternal] = useState<'all' | 'internal' | 'external'>('all')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  const [form, setForm] = useState<Organization>({ name: '', type: 'STARTUP', internal: false })
  const [submitting, setSubmitting] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = {}
      if (filterType)               params.type = filterType
      if (filterInternal === 'internal') params.internal = true
      const r = await organizationsApi.list(params)
      setOrgs(r.data ?? [])
    } finally { setLoading(false) }
  }, [filterType, filterInternal])

  useEffect(() => { reload() }, [reload])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return orgs
    return orgs.filter(o =>
      o.name?.toLowerCase().includes(q)
      || o.sector?.toLowerCase().includes(q)
      || o.city?.toLowerCase().includes(q)
      || o.contactEmail?.toLowerCase().includes(q)
    )
  }, [orgs, search])

  // ── CRUD ────────────────────────────────────────────────────────────────

  const onCreate = async () => {
    if (!form.name.trim()) { toast.error('Le nom est requis'); return }
    setSubmitting(true)
    try {
      await organizationsApi.create({
        name: form.name.trim(),
        type: form.type ?? 'STARTUP',
        description: form.description,
        sector: form.sector,
        city: form.city,
        country: form.country,
        website: form.website,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone,
        logoUrl: form.logoUrl,
        internal: form.internal,
      } as any)
      toast.success('Organisation créée')
      setForm({ name: '', type: 'STARTUP', internal: false })
      setShowCreate(false)
      await reload()
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erreur')
    } finally { setSubmitting(false) }
  }

  const onDelete = async (id: number) => {
    if (!confirm('Supprimer cette organisation et tous ses membres ?')) return
    try {
      await organizationsApi.delete(id)
      setOrgs(arr => arr.filter(o => o.id !== id))
      toast.success('Supprimée')
    } catch { toast.error('Erreur — réservée aux administrateurs') }
  }

  const onSaveEdit = async (id: number, patch: Partial<Organization>) => {
    try {
      const r = await organizationsApi.update(id, patch)
      setOrgs(arr => arr.map(o => o.id === id ? { ...o, ...r.data } : o))
      setEditingId(null)
      toast.success('Mis à jour')
    } catch { toast.error('Erreur') }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 shadow-lg shadow-brand-500/25">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-foreground">Organisations</h1>
            <p className="text-sm text-muted-foreground">
              Startups, partenaires, sponsors, universités — et leurs équipes ({orgs.length} au total)
            </p>
          </div>
          <Button variant="brand" onClick={() => setShowCreate(s => !s)}>
            <Plus className="h-4 w-4" />Nouvelle organisation
          </Button>
        </motion.div>

        {/* Filters */}
        <MagicCard className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input className="pl-8" placeholder="Rechercher par nom, secteur, ville…"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setFilterType('')}
                className={`rounded-full px-3 py-1 text-xs font-semibold border transition-all ${
                  !filterType ? 'border-brand-500 bg-brand-500/15 text-brand-700 dark:text-brand-300'
                              : 'border-border text-muted-foreground hover:border-brand-400'}`}>
                Tous
              </button>
              {ORGANIZATION_TYPES.map(t => (
                <button key={t} onClick={() => setFilterType(t)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold border transition-all ${
                    filterType === t ? TYPE_TONE[t] + ' ring-2 ring-offset-1 ring-offset-card ring-current'
                                     : 'border-border text-muted-foreground hover:border-brand-400'}`}>
                  {TYPE_LABEL[t]}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              {(['all', 'internal', 'external'] as const).map(k => (
                <button key={k} onClick={() => setFilterInternal(k)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold border transition-all ${
                    filterInternal === k ? 'border-brand-500 bg-brand-500/15 text-brand-700 dark:text-brand-300'
                                          : 'border-border text-muted-foreground hover:border-brand-400'}`}>
                  {k === 'all' ? 'Toutes' : k === 'internal' ? 'Internes' : 'Externes'}
                </button>
              ))}
            </div>
          </div>
        </MagicCard>

        {/* Create form */}
        <AnimatePresence>
          {showCreate && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <MagicCard className="p-5">
                <h2 className="mb-4 font-semibold text-foreground flex items-center gap-2">
                  <Plus className="h-4 w-4 text-brand-500" />Nouvelle organisation
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground">Type *</label>
                    <div className="flex flex-wrap gap-2">
                      {ORGANIZATION_TYPES.map(t => (
                        <button key={t} type="button"
                          onClick={() => setForm(f => ({ ...f, type: t }))}
                          className={`rounded-full px-3 py-1 text-xs font-semibold border transition-all ${
                            form.type === t ? TYPE_TONE[t] + ' ring-2 ring-offset-1 ring-offset-card ring-current'
                                            : 'border-border text-muted-foreground hover:border-brand-400'}`}>
                          {TYPE_LABEL[t]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground">Nom *</label>
                    <Input placeholder="Ex. Medianet Tunis, Acme Corp" value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground">Description</label>
                    <Input placeholder="Description courte (mission, secteur)" value={form.description ?? ''}
                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Secteur</label>
                    <Input placeholder="FinTech, AgriTech…" value={form.sector ?? ''}
                      onChange={e => setForm(f => ({ ...f, sector: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Ville</label>
                    <Input value={form.city ?? ''}
                      onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Pays</label>
                    <Input value={form.country ?? ''}
                      onChange={e => setForm(f => ({ ...f, country: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Site web</label>
                    <Input placeholder="https://…" value={form.website ?? ''}
                      onChange={e => setForm(f => ({ ...f, website: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Email de contact</label>
                    <Input type="email" value={form.contactEmail ?? ''}
                      onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Téléphone</label>
                    <Input value={form.contactPhone ?? ''}
                      onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))} />
                  </div>
                  <div className="space-y-1 sm:col-span-2 flex items-center gap-2 pt-1">
                    <input id="internal-cb" type="checkbox" checked={!!form.internal}
                      onChange={e => setForm(f => ({ ...f, internal: e.target.checked }))}
                      className="rounded" />
                    <label htmlFor="internal-cb" className="text-xs font-medium text-muted-foreground">
                      Organisation interne (équipe de l'incubateur)
                    </label>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button variant="brand" onClick={onCreate} disabled={submitting}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {submitting ? 'Création…' : 'Créer'}
                  </Button>
                  <Button variant="ghost" onClick={() => setShowCreate(false)}>Annuler</Button>
                </div>
              </MagicCard>
            </motion.div>
          )}
        </AnimatePresence>

        {/* List */}
        {loading ? (
          <div className="py-12 text-center text-muted-foreground">
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <MagicCard className="py-16 text-center text-muted-foreground">
            <Building2 className="mx-auto mb-3 h-8 w-8 opacity-50" />
            Aucune organisation
          </MagicCard>
        ) : (
          <div className="space-y-3">
            {filtered.map((o, i) => (
              <motion.div key={o.id ?? i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}>
                <OrgCard
                  org={o}
                  expanded={expandedId === o.id}
                  editing={editingId === o.id}
                  onToggleExpand={() => setExpandedId(prev => prev === o.id ? null : (o.id ?? null))}
                  onEdit={() => setEditingId(o.id ?? null)}
                  onCancelEdit={() => setEditingId(null)}
                  onSave={(patch) => onSaveEdit(o.id!, patch)}
                  onDelete={() => onDelete(o.id!)}
                  onMembersChanged={reload}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

// ── Org card ───────────────────────────────────────────────────────────────

function OrgCard({
  org, expanded, editing, onToggleExpand, onEdit, onCancelEdit, onSave, onDelete, onMembersChanged,
}: {
  org: Organization
  expanded: boolean
  editing: boolean
  onToggleExpand: () => void
  onEdit: () => void
  onCancelEdit: () => void
  onSave: (patch: Partial<Organization>) => void
  onDelete: () => void
  onMembersChanged: () => void
}) {
  const tone = TYPE_TONE[org.type ?? 'OTHER']
  const label = TYPE_LABEL[org.type ?? 'OTHER']

  // Edit state — initialized from props once on open
  const [draft, setDraft] = useState<Organization>(org)
  useEffect(() => { if (editing) setDraft(org) }, [editing, org])

  // « Sociétés incubées » — publish/hide this organisation on the public page.
  const [showcased, setShowcased] = useState(!!org.showcased)
  useEffect(() => { setShowcased(!!org.showcased) }, [org.showcased])
  const toggleShowcase = async () => {
    if (!org.id) return
    try {
      await showcaseApi.set(org.id, !showcased)
      setShowcased(!showcased)
      toast.success(!showcased
        ? `« ${org.name} » est visible sur la page publique « Sociétés incubées »`
        : `« ${org.name} » est retirée de la page publique`)
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Action impossible') }
  }

  return (
    <MagicCard className="p-4">
      {!editing ? (
        <div className="flex items-start gap-3">
          <button onClick={onToggleExpand}
            className="mt-1 rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-accent">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          {org.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logoUrl} alt={org.name} className="h-10 w-10 rounded-lg object-cover border border-border" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted">
              <Building2 className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-0.5">
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold border ${tone}`}>{label}</span>
              {org.internal && (
                <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-brand-500/15 text-brand-700 dark:text-brand-300 border border-brand-300/40">
                  Interne
                </span>
              )}
              {showcased && (
                <span className="rounded-full border border-emerald-300/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                  Société incubée · publique
                </span>
              )}
              <h3 className="font-semibold text-foreground truncate">{org.name}</h3>
            </div>
            <p className="text-xs text-muted-foreground flex flex-wrap gap-3">
              {org.sector && <span>🏷️ {org.sector}</span>}
              {(org.city || org.country) && (
                <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />
                  {[org.city, org.country].filter(Boolean).join(', ')}
                </span>
              )}
              {org.website && (
                <a href={org.website} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 text-brand-600 hover:underline dark:text-brand-400">
                  <Globe2 className="h-3 w-3" />{org.website.replace(/^https?:\/\//, '').slice(0, 30)}
                </a>
              )}
              <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />
                {(org.members ?? []).length} membre{(org.members ?? []).length > 1 ? 's' : ''}
              </span>
            </p>
            {org.description && !expanded && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{org.description}</p>
            )}
          </div>
          <div className="flex gap-1">
            {org.id && (
              <Link href={`/organizations/${org.id}`} title="Ouvrir la fiche">
                <Button variant="outline" size="sm" className="gap-1 text-xs"><ArrowUpRight className="h-3.5 w-3.5" />Ouvrir</Button>
              </Link>
            )}
            <Button variant="ghost" size="icon" onClick={toggleShowcase}
              title={showcased ? 'Retirer de la page publique « Sociétés incubées »' : 'Publier sur la page « Sociétés incubées »'}>
              {showcased ? <Eye className="h-4 w-4 text-emerald-600" /> : <EyeOff className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={onEdit} title="Modifier"><Edit2 className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={onDelete} title="Supprimer">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      ) : (
        // ── Edit form ────────────────────────────────────────────────────────
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Type</label>
              <div className="flex flex-wrap gap-2">
                {ORGANIZATION_TYPES.map(t => (
                  <button key={t} type="button" onClick={() => setDraft(d => ({ ...d, type: t }))}
                    className={`rounded-full px-3 py-1 text-xs font-semibold border transition-all ${
                      draft.type === t ? TYPE_TONE[t] + ' ring-2 ring-offset-1 ring-offset-card ring-current'
                                       : 'border-border text-muted-foreground hover:border-brand-400'}`}>
                    {TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>
            <Field label="Nom *" value={draft.name ?? ''} onChange={(v) => setDraft(d => ({ ...d, name: v }))} className="sm:col-span-2" />
            <Field label="Description" value={draft.description ?? ''} onChange={(v) => setDraft(d => ({ ...d, description: v }))} className="sm:col-span-2" />
            <Field label="Secteur"     value={draft.sector ?? ''}      onChange={(v) => setDraft(d => ({ ...d, sector: v }))} />
            <Field label="Ville"       value={draft.city ?? ''}        onChange={(v) => setDraft(d => ({ ...d, city: v }))} />
            <Field label="Pays"        value={draft.country ?? ''}     onChange={(v) => setDraft(d => ({ ...d, country: v }))} />
            <Field label="Site web"    value={draft.website ?? ''}     onChange={(v) => setDraft(d => ({ ...d, website: v }))} />
            <Field label="Email"       value={draft.contactEmail ?? ''} onChange={(v) => setDraft(d => ({ ...d, contactEmail: v }))} />
            <Field label="Téléphone"   value={draft.contactPhone ?? ''} onChange={(v) => setDraft(d => ({ ...d, contactPhone: v }))} />
            <Field label="Logo (URL)"  value={draft.logoUrl ?? ''}     onChange={(v) => setDraft(d => ({ ...d, logoUrl: v }))} className="sm:col-span-2" />
            <div className="space-y-1 sm:col-span-2 flex items-center gap-2 pt-1">
              <input type="checkbox" checked={!!draft.internal}
                onChange={e => setDraft(d => ({ ...d, internal: e.target.checked }))}
                className="rounded" />
              <label className="text-xs font-medium text-muted-foreground">
                Organisation interne (équipe de l'incubateur)
              </label>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="brand" size="sm" onClick={() => onSave(draft)}>
              <Save className="h-3.5 w-3.5" />Sauvegarder
            </Button>
            <Button variant="ghost" size="sm" onClick={onCancelEdit}>Annuler</Button>
          </div>
        </div>
      )}

      {/* Members panel */}
      <AnimatePresence initial={false}>
        {expanded && !editing && org.id && (
          <motion.div key="members"
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-4 pt-4 border-t border-border">
              <MembersPanel orgId={org.id} initialMembers={org.members ?? []} onChanged={onMembersChanged} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </MagicCard>
  )
}

function Field({ label, value, onChange, className = '' }: {
  label: string; value: string; onChange: (v: string) => void; className?: string
}) {
  return (
    <div className={`space-y-1 ${className}`}>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

// ── Members panel ─────────────────────────────────────────────────────────

function MembersPanel({ orgId, initialMembers, onChanged }: {
  orgId: number
  initialMembers: Member[]
  onChanged: () => void
}) {
  const [members, setMembers] = useState<Member[]>(initialMembers)
  const [showAdd, setShowAdd] = useState(false)
  const [draft, setDraft] = useState<Member>({ fullName: '', type: 'INTERNAL', expertise: [] })
  const [expertiseInput, setExpertiseInput] = useState('')

  useEffect(() => { setMembers(initialMembers) }, [initialMembers])

  const addExpertiseFromInput = () => {
    const tag = expertiseInput.trim()
    if (!tag) return
    setDraft(d => ({ ...d, expertise: [...(d.expertise ?? []), tag] }))
    setExpertiseInput('')
  }
  const removeExpertise = (idx: number) =>
    setDraft(d => ({ ...d, expertise: (d.expertise ?? []).filter((_, i) => i !== idx) }))

  const onAdd = async () => {
    if (!draft.fullName.trim()) { toast.error('Nom complet requis'); return }
    try {
      const r = await organizationsApi.addMember(orgId, {
        fullName: draft.fullName.trim(),
        email: draft.email,
        phone: draft.phone,
        role: draft.role,
        responsibilities: draft.responsibilities,
        expertise: draft.expertise ?? [],
        type: draft.type ?? 'INTERNAL',
      })
      setMembers(m => [...m, r.data])
      setDraft({ fullName: '', type: 'INTERNAL', expertise: [] })
      setShowAdd(false)
      toast.success('Membre ajouté')
      onChanged()
    } catch { toast.error('Erreur') }
  }

  const onRemove = async (id: number) => {
    if (!confirm('Retirer ce membre ?')) return
    try {
      await organizationsApi.removeMember(orgId, id)
      setMembers(arr => arr.filter(m => m.id !== id))
      onChanged()
    } catch { toast.error('Erreur') }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Users className="h-4 w-4 text-brand-500" />Membres ({members.length})
        </h4>
        <Button variant="outline" size="sm" onClick={() => setShowAdd(s => !s)}>
          <UserPlus className="h-3.5 w-3.5" />Ajouter un membre
        </Button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="rounded-lg border border-border bg-card/60 p-3 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nom complet *" value={draft.fullName} onChange={(v) => setDraft(d => ({ ...d, fullName: v }))} className="sm:col-span-2" />
                <Field label="Email"          value={draft.email ?? ''}    onChange={(v) => setDraft(d => ({ ...d, email: v }))} />
                <Field label="Téléphone"      value={draft.phone ?? ''}    onChange={(v) => setDraft(d => ({ ...d, phone: v }))} />
                <Field label="Rôle"           value={draft.role ?? ''}     onChange={(v) => setDraft(d => ({ ...d, role: v }))} />
                <Field label="Responsabilités" value={draft.responsibilities ?? ''} onChange={(v) => setDraft(d => ({ ...d, responsibilities: v }))} />
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">Type</label>
                  <div className="flex gap-2">
                    {MEMBER_TYPES.map(t => (
                      <button key={t} type="button" onClick={() => setDraft(d => ({ ...d, type: t }))}
                        className={`rounded-full px-3 py-1 text-xs font-semibold border transition-all ${
                          draft.type === t ? 'border-brand-500 bg-brand-500/15 text-brand-700 dark:text-brand-300'
                                           : 'border-border text-muted-foreground hover:border-brand-400'}`}>
                        {t === 'INTERNAL' ? 'Interne' : 'Externe'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">Compétences / Expertise</label>
                  <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border p-2">
                    {(draft.expertise ?? []).map((tag, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-full bg-brand-500/15 px-2 py-0.5 text-xs text-brand-700 dark:text-brand-300">
                        {tag}
                        <button onClick={() => removeExpertise(i)} className="hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    <input
                      className="flex-1 min-w-[100px] bg-transparent text-xs outline-none"
                      value={expertiseInput}
                      onChange={(e) => setExpertiseInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addExpertiseFromInput() }
                      }}
                      onBlur={addExpertiseFromInput}
                      placeholder="Tapez une compétence puis Entrée…"
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="brand" size="sm" onClick={onAdd}>
                  <Save className="h-3.5 w-3.5" />Ajouter
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)}>Annuler</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {members.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted/20 py-4 text-center text-xs text-muted-foreground">
          Aucun membre — ajoutez-en pour cette organisation.
        </div>
      ) : (
        <div className="space-y-2">
          {members.map(m => (
            <div key={m.id} className="flex items-start gap-3 rounded-md border border-border bg-background/50 p-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-purple-600 text-xs font-bold text-white shrink-0">
                {(m.fullName ?? '?').split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">{m.fullName}</span>
                  {m.role && <span className="text-xs text-muted-foreground">· {m.role}</span>}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                    m.type === 'INTERNAL'
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300/40'
                      : 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-300/40'
                  }`}>
                    {m.type === 'INTERNAL' ? 'Interne' : 'Externe'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground flex flex-wrap gap-3 mt-0.5">
                  {m.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{m.email}</span>}
                  {m.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{m.phone}</span>}
                </p>
                {m.responsibilities && (
                  <p className="text-xs text-foreground/80 mt-1">{m.responsibilities}</p>
                )}
                {(m.expertise ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {(m.expertise ?? []).map((tag, i) => (
                      <span key={i} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={() => m.id && onRemove(m.id)} title="Retirer">
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
