'use client'
/**
 * Organisation profile — LinkedIn-style startup space: cover + identity, more
 * details + a location map, and the team. The team is invite-only: the owner
 * supplies only an email; the invited person fills their own profile after
 * accepting. The owner can send / cancel an invitation and remove a member from
 * the org (which never deletes their account).
 */
import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Building2, ArrowLeft, Loader2, Globe2, Mail, Phone, Pencil, Check, X, MapPin,
  Users, Plus, Trash2, UserPlus, Linkedin, ArrowRight, Clock, Send, Calendar, Briefcase,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { organizationsApi, ORGANIZATION_TYPES, CATALOG_CATEGORIES } from '@/lib/api'
import { useCatalog } from '@/hooks/useCatalog'
import { useUser, useAuthStore } from '@/store/auth.store'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { AvatarUpload } from '@/components/ui/AvatarUpload'
import { getInitials } from '@/lib/utils'

interface Member {
  id: number; fullName: string; email?: string; phone?: string; userId?: number | null
  role?: string; responsibilities?: string; expertise?: string[]; type?: string
  avatarUrl?: string; headline?: string; linkedInUrl?: string
}
interface Org {
  id: number; name: string; type?: string; sector?: string; city?: string; country?: string
  address?: string; website?: string; logoUrl?: string; description?: string
  contactEmail?: string; contactPhone?: string; foundedYear?: number; employeeCount?: string
  createdByUserId?: number; members?: Member[]
}

const TYPE_LABEL: Record<string, string> = {
  STARTUP: 'Startup', INCUBATOR: 'Incubateur', UNIVERSITY: 'Université',
  ASSOCIATION: 'Association', SPONSOR: 'Sponsor', CORPORATE: 'Corporate',
  GOVERNMENT: 'Public', OTHER: 'Autre',
}
const EMPLOYEE_RANGES = ['1-10', '11-50', '51-200', '201-500', '500+']
const normalizeUrl = (u?: string) => (!u ? '' : /^https?:\/\//.test(u) ? u : `https://${u}`)

export default function OrganizationProfilePage() {
  const params = useParams()
  const router = useRouter()
  const id = Number(Array.isArray(params.id) ? params.id[0] : params.id)
  const user = useUser()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => { setHydrated(true) }, [])
  const orgTypes = useCatalog(CATALOG_CATEGORIES.ORGANIZATION_TYPE,
    ORGANIZATION_TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] })))

  const [org, setOrg] = useState<Org | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Org edit
  const [editingOrg, setEditingOrg] = useState(false)
  const [savingOrg, setSavingOrg] = useState(false)
  const [orgDraft, setOrgDraft] = useState<any>({})

  // Member invitation
  const [inviting, setInviting] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [sendingInvite, setSendingInvite] = useState(false)

  const isOwner = !!user && org?.createdByUserId === user.id

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await organizationsApi.get(id)
      setOrg(r.data)
      setMembers(r.data?.members ?? [])
    } catch {
      setError('Organisation introuvable.')
    } finally { setLoading(false) }
  }, [id])

  useEffect(() => {
    if (hydrated && !isAuthenticated) { router.replace('/login'); return }
    if (hydrated && !isNaN(id)) load()
  }, [hydrated, isAuthenticated, id, load, router])

  // ── Org edit ───────────────────────────────────────────────────────────────
  const startEditOrg = () => {
    if (!org) return
    setOrgDraft({
      name: org.name ?? '', type: org.type ?? 'STARTUP', sector: org.sector ?? '',
      city: org.city ?? '', country: org.country ?? '', address: org.address ?? '',
      website: org.website ?? '', description: org.description ?? '', logoUrl: org.logoUrl ?? '',
      contactEmail: org.contactEmail ?? '', contactPhone: org.contactPhone ?? '',
      foundedYear: org.foundedYear ? String(org.foundedYear) : '', employeeCount: org.employeeCount ?? '',
    })
    setEditingOrg(true)
  }
  const saveOrg = async () => {
    if (!orgDraft.name?.trim()) { toast.error('Le nom est requis'); return }
    setSavingOrg(true)
    try {
      const r = await organizationsApi.update(id, {
        name: orgDraft.name.trim(), type: orgDraft.type,
        sector: orgDraft.sector || undefined, city: orgDraft.city || undefined,
        country: orgDraft.country || undefined, address: orgDraft.address || undefined,
        website: orgDraft.website || undefined, description: orgDraft.description || undefined,
        logoUrl: orgDraft.logoUrl || undefined, contactEmail: orgDraft.contactEmail || undefined,
        contactPhone: orgDraft.contactPhone || undefined,
        foundedYear: orgDraft.foundedYear ? Number(orgDraft.foundedYear) : undefined,
        employeeCount: orgDraft.employeeCount || undefined,
      })
      setOrg((o) => (o ? { ...o, ...r.data } : r.data))
      setEditingOrg(false)
      toast.success('Profil mis à jour')
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Erreur') }
    finally { setSavingOrg(false) }
  }

  // ── Members (invite-only) ──────────────────────────────────────────────────
  const sendInvite = async () => {
    const email = inviteEmail.trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast.error('Email invalide'); return }
    if (members.some((m) => (m.email ?? '').toLowerCase() === email)) { toast.error('Ce membre est déjà invité'); return }
    setSendingInvite(true)
    try {
      const r = await organizationsApi.addMember(id, { email })
      setMembers((arr) => [...arr, r.data])
      setInviteEmail(''); setInviting(false)
      toast.success('Invitation envoyée par email')
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Erreur') }
    finally { setSendingInvite(false) }
  }
  const removeMember = async (m: Member) => {
    const pending = !m.userId
    const msg = pending
      ? `Annuler l'invitation de ${m.email || m.fullName} ?`
      : `Retirer ${m.fullName} de l'organisation ? Son compte n'est pas supprimé.`
    if (!confirm(msg)) return
    try {
      await organizationsApi.removeMember(id, m.id)
      setMembers((arr) => arr.filter((x) => x.id !== m.id))
      toast.success(pending ? 'Invitation annulée' : 'Membre retiré')
    } catch { toast.error('Erreur') }
  }

  // ── Render ──────────────────────────────────────────────────────────────
  if (loading) {
    return <AppShell><div className="mx-auto max-w-3xl space-y-4"><Skeleton className="h-44 rounded-2xl" /><Skeleton className="h-40 rounded-2xl" /></div></AppShell>
  }
  if (error || !org) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl py-20 text-center">
          <Building2 className="mx-auto h-10 w-10 text-muted-foreground opacity-30" />
          <p className="mt-3 text-sm text-muted-foreground">{error ?? 'Organisation introuvable.'}</p>
          <Link href="/organizations" className="mt-4 inline-block"><Button variant="brand">Mes organisations</Button></Link>
        </div>
      </AppShell>
    )
  }

  const field = (k: string, label: string, props: any = {}) => (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <Input value={orgDraft[k] ?? ''} onChange={(e) => setOrgDraft((d: any) => ({ ...d, [k]: e.target.value }))} {...props} />
    </div>
  )

  const headline = [org.sector, [org.city, org.country].filter(Boolean).join(', ')].filter(Boolean).join(' · ')
  const mapQuery = org.address || [org.city, org.country].filter(Boolean).join(', ')
  const detailRows = [
    org.foundedYear ? { icon: Calendar, label: 'Fondée en', value: String(org.foundedYear) } : null,
    org.employeeCount ? { icon: Users, label: 'Effectif', value: `${org.employeeCount} employés` } : null,
    org.sector ? { icon: Briefcase, label: 'Secteur', value: org.sector } : null,
    org.address ? { icon: MapPin, label: 'Adresse', value: org.address } : null,
  ].filter(Boolean) as { icon: any; label: string; value: string }[]

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-5">
        <Link href="/organizations" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Mes organisations
        </Link>

        {/* ── Header / identity (cover + avatar) ── */}
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="h-28 bg-gradient-to-r from-brand-500 via-brand-600 to-purple-600" />
          <div className="px-5 pb-5">
            {!editingOrg ? (
              <>
                <div className="-mt-10 flex items-end gap-4">
                  {org.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={org.logoUrl} alt={org.name} className="h-20 w-20 rounded-2xl object-cover border-4 border-card shadow-md bg-card" />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-card bg-muted shadow-md">
                      <Building2 className="h-9 w-9 text-muted-foreground" />
                    </div>
                  )}
                  {isOwner && (
                    <div className="ml-auto pb-1">
                      <Button variant="outline" size="sm" onClick={startEditOrg} className="gap-1.5">
                        <Pencil className="h-3.5 w-3.5" />Modifier
                      </Button>
                    </div>
                  )}
                </div>
                <div className="mt-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl font-bold text-foreground">{org.name}</h1>
                    <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:text-brand-300">
                      {TYPE_LABEL[org.type ?? 'OTHER'] ?? org.type}
                    </span>
                    {!isOwner && (
                      <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:text-sky-300">
                        Membre · lecture seule
                      </span>
                    )}
                  </div>
                  {headline && <p className="mt-0.5 text-sm font-medium text-muted-foreground">{headline}</p>}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {org.website && (
                      <a href={normalizeUrl(org.website)} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:text-brand-600 hover:border-brand-400">
                        <Globe2 className="h-3.5 w-3.5" />{org.website.replace(/^https?:\/\//, '')}
                      </a>
                    )}
                    {org.contactEmail && (
                      <a href={`mailto:${org.contactEmail}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:text-brand-600 hover:border-brand-400">
                        <Mail className="h-3.5 w-3.5" />{org.contactEmail}
                      </a>
                    )}
                    {org.contactPhone && (
                      <a href={`tel:${org.contactPhone}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
                        <Phone className="h-3.5 w-3.5" />{org.contactPhone}
                      </a>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground">Type</label>
                    <div className="flex flex-wrap gap-1.5">
                      {orgTypes.map((t) => (
                        <button key={t.value} type="button" onClick={() => setOrgDraft((d: any) => ({ ...d, type: t.value }))}
                          className={`rounded-full px-3 py-1 text-xs font-semibold border transition-all ${
                            orgDraft.type === t.value ? 'border-brand-500 bg-brand-500/15 text-brand-700 dark:text-brand-300' : 'border-border text-muted-foreground hover:border-brand-400'}`}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="sm:col-span-2">{field('name', "Nom de l'organisation *", { placeholder: 'Ex. Acme FoodTech' })}</div>
                  {field('sector', 'Secteur', { placeholder: 'FoodTech, FinTech…' })}
                  {field('website', 'Site web', { placeholder: 'https://…' })}
                  {field('city', 'Ville')}
                  {field('country', 'Pays')}
                  <div className="sm:col-span-2">{field('address', 'Adresse (pour la carte)', { placeholder: 'Rue, ville, pays' })}</div>
                  {field('foundedYear', 'Année de création', { type: 'number', placeholder: '2021' })}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Effectif</label>
                    <select value={orgDraft.employeeCount ?? ''} onChange={(e) => setOrgDraft((d: any) => ({ ...d, employeeCount: e.target.value }))}
                      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm">
                      <option value="">—</option>
                      {EMPLOYEE_RANGES.map((r) => <option key={r} value={r}>{r} employés</option>)}
                    </select>
                  </div>
                  {field('contactEmail', 'Email de contact', { type: 'email' })}
                  {field('contactPhone', 'Téléphone')}
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground">Logo</label>
                    <AvatarUpload value={orgDraft.logoUrl} onChange={(url) => setOrgDraft((d: any) => ({ ...d, logoUrl: url }))}
                      folder="logos" initials={orgDraft.name || 'O'} shape="square" />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground">Description</label>
                    <textarea value={orgDraft.description ?? ''} onChange={(e) => setOrgDraft((d: any) => ({ ...d, description: e.target.value }))}
                      rows={3} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="Mission, produit, traction…" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="brand" size="sm" onClick={saveOrg} disabled={savingOrg}>
                    {savingOrg ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}Enregistrer
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditingOrg(false)}><X className="h-3.5 w-3.5" />Annuler</Button>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* ── About ── */}
        {!editingOrg && org.description && (
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-sm font-bold text-foreground mb-2">À propos</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{org.description}</p>
          </div>
        )}

        {/* ── Details ── */}
        {!editingOrg && detailRows.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-sm font-bold text-foreground mb-3">Détails</h2>
            <dl className="grid gap-4 sm:grid-cols-2">
              {detailRows.map((d) => (
                <div key={d.label} className="flex items-start gap-2">
                  <d.icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                  <div className="min-w-0">
                    <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{d.label}</dt>
                    <dd className="text-sm text-foreground break-words">{d.value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>
        )}

        {/* ── Map ── */}
        {!editingOrg && mapQuery && (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex items-center gap-2 px-5 py-3">
              <MapPin className="h-4 w-4 text-brand-500" />
              <h2 className="text-sm font-bold text-foreground">Localisation</h2>
              <span className="text-xs text-muted-foreground truncate">{mapQuery}</span>
            </div>
            <iframe
              title="Carte de l'organisation"
              className="h-64 w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              src={`https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`}
            />
          </div>
        )}

        {/* ── Team members ── */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-brand-500" />Équipe
              <span className="text-xs font-normal text-muted-foreground">{members.length} membre(s)</span>
            </h2>
            {isOwner && !inviting && (
              <Button variant="outline" size="sm" onClick={() => setInviting(true)} className="gap-1.5">
                <UserPlus className="h-3.5 w-3.5" />Inviter un membre
              </Button>
            )}
          </div>

          {/* Invite-by-email form — the owner only provides an email. */}
          {isOwner && inviting && (
            <div className="mb-3 rounded-xl border border-border bg-background/50 p-4">
              <p className="mb-2 text-xs text-muted-foreground">
                Saisissez l&apos;email de la personne à inviter. Elle recevra un lien pour créer son compte et compléter son propre profil.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') sendInvite() }}
                  placeholder="prenom.nom@email.com" className="flex-1" autoFocus />
                <div className="flex gap-2">
                  <Button variant="brand" size="sm" onClick={sendInvite} disabled={sendingInvite} className="gap-1.5">
                    {sendingInvite ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}Envoyer l&apos;invitation
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setInviting(false); setInviteEmail('') }}><X className="h-3.5 w-3.5" />Annuler</Button>
                </div>
              </div>
            </div>
          )}

          {members.length === 0 && !inviting ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center">
              <Users className="mx-auto h-8 w-8 text-muted-foreground opacity-30 mb-2" />
              <p className="text-sm text-muted-foreground">Aucun membre pour l&apos;instant.</p>
              {isOwner && <Button variant="brand" size="sm" className="mt-3 gap-1.5" onClick={() => setInviting(true)}><Plus className="h-3.5 w-3.5" />Inviter le premier membre</Button>}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 mt-2">
              {members.map((m) => {
                const pending = !m.userId
                const Inner = (
                  <div className="flex items-start gap-3">
                    {m.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.avatarUrl} alt={m.fullName} className="h-12 w-12 shrink-0 rounded-full object-cover border border-border" />
                    ) : (
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold ${pending ? 'bg-muted text-muted-foreground' : 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'}`}>
                        {pending ? <Clock className="h-5 w-5" /> : getInitials(m.fullName)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`font-semibold text-sm ${pending ? 'text-muted-foreground' : 'text-foreground group-hover:text-brand-600 dark:group-hover:text-brand-400'} transition-colors`}>
                          {pending ? (m.email || m.fullName) : m.fullName}
                        </span>
                        {pending ? (
                          <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">Invitation envoyée</span>
                        ) : (
                          <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">Membre</span>
                        )}
                      </div>
                      {!pending && (m.headline || m.role) && (
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{m.headline || m.role}</p>
                      )}
                      {!pending && (m.expertise?.length ?? 0) > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {m.expertise!.slice(0, 3).map((x) => <span key={x} className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] text-brand-700 dark:text-brand-300">{x}</span>)}
                        </div>
                      )}
                      {pending && <p className="mt-0.5 text-[11px] text-muted-foreground">En attente d&apos;acceptation</p>}
                    </div>
                    {!pending && <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:text-brand-500 transition-all" />}
                  </div>
                )
                return (
                  <div key={m.id} className="group relative rounded-xl border border-border bg-background/50 p-4 transition-all hover:border-brand-400 hover:shadow-sm">
                    {pending ? Inner : <Link href={`/organizations/${id}/members/${m.id}`}>{Inner}</Link>}
                    {!pending && m.linkedInUrl && (
                      <a href={normalizeUrl(m.linkedInUrl)} target="_blank" rel="noreferrer" title="LinkedIn"
                        className="absolute bottom-3 right-3 text-muted-foreground hover:text-[#0a66c2]">
                        <Linkedin className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {isOwner && (
                      <div className="mt-2 flex gap-1 border-t border-border pt-2">
                        <Button variant="ghost" size="sm" onClick={() => removeMember(m)} className="gap-1 h-7 text-xs text-destructive hover:text-destructive">
                          <Trash2 className="h-3 w-3" />{pending ? "Annuler l'invitation" : 'Retirer'}
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
