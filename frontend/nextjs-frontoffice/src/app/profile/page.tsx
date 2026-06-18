'use client'
/**
 * Mon profil — LinkedIn-style self profile for the logged-in porteur.
 * Reads the porteur profile from GET /api/auth/me (UserDto nests porteurProfile)
 * and persists edits via PUT /api/auth/profile/porteur (authApi.updatePorteurProfile).
 */
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Loader2, Save, Pencil, X, Globe2, Linkedin, Twitter, Phone, MapPin,
  Briefcase, Building2, Mail, Sparkles, GraduationCap,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { authApi } from '@/lib/api'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { AvatarUpload } from '@/components/ui/AvatarUpload'
import { useAuthStore, frontofficeRolesOf, type FrontofficeRole } from '@/store/auth.store'
import { getInitials } from '@/lib/utils'

const ROLE_META: Record<FrontofficeRole, { label: string; icon: any; color: string }> = {
  PORTEUR: { label: 'Porteur', icon: Briefcase,     color: 'text-brand-600 dark:text-brand-400'     },
  MENTOR:  { label: 'Mentor',  icon: Sparkles,      color: 'text-emerald-600 dark:text-emerald-400' },
  JURY:    { label: 'Juré',    icon: GraduationCap, color: 'text-amber-600 dark:text-amber-400'     },
}

interface PorteurProfile {
  company?: string; sector?: string; city?: string; phoneNumber?: string
  website?: string; linkedInUrl?: string; avatarUrl?: string; headline?: string
  twitterUrl?: string; bio?: string
}
interface Me {
  id: number; email: string; firstName: string; lastName: string
  roles?: string[]; role?: string; porteurProfile?: PorteurProfile | null
}

const EMPTY: PorteurProfile = {
  company: '', sector: '', city: '', phoneNumber: '', website: '',
  linkedInUrl: '', avatarUrl: '', headline: '', twitterUrl: '', bio: '',
}

const normalizeUrl = (u?: string) => (!u ? '' : /^https?:\/\//.test(u) ? u : `https://${u}`)

export default function ProfilePage() {
  const router = useRouter()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => { setHydrated(true) }, [])

  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<PorteurProfile>(EMPTY)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await authApi.me()
      setMe(r.data)
    } catch { toast.error('Impossible de charger le profil') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (hydrated && !isAuthenticated) { router.replace('/login'); return }
    if (hydrated) load()
  }, [hydrated, isAuthenticated, load, router])

  const p = me?.porteurProfile ?? {}
  const roles = frontofficeRolesOf(me as any)

  const startEdit = () => {
    setDraft({
      company: p.company ?? '', sector: p.sector ?? '', city: p.city ?? '',
      phoneNumber: p.phoneNumber ?? '', website: p.website ?? '',
      linkedInUrl: p.linkedInUrl ?? '', avatarUrl: p.avatarUrl ?? '',
      headline: p.headline ?? '', twitterUrl: p.twitterUrl ?? '', bio: p.bio ?? '',
    })
    setEditing(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      const r = await authApi.updatePorteurProfile(draft)
      setMe((m) => (m ? { ...m, porteurProfile: r.data } : m))
      setEditing(false)
      toast.success('Profil mis à jour ✓')
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erreur lors de la mise à jour')
    } finally { setSaving(false) }
  }

  if (loading) {
    return <AppShell><div className="mx-auto max-w-3xl space-y-4"><Skeleton className="h-44 rounded-2xl" /><Skeleton className="h-40 rounded-2xl" /></div></AppShell>
  }
  if (!me) {
    return <AppShell><div className="mx-auto max-w-3xl py-20 text-center text-muted-foreground">Profil indisponible.</div></AppShell>
  }

  const fullName = `${me.firstName ?? ''} ${me.lastName ?? ''}`.trim()
  const field = (k: keyof PorteurProfile, label: string, props: any = {}) => (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <Input value={draft[k] ?? ''} onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))} {...props} />
    </div>
  )

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-5">
        {/* ── Header card (cover + avatar) ── */}
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="h-28 bg-gradient-to-r from-brand-500 via-brand-600 to-purple-600" />
          <div className="px-5 pb-5">
            <div className="-mt-10 flex items-end gap-4">
              {p.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.avatarUrl} alt={fullName} className="h-20 w-20 rounded-2xl object-cover border-4 border-card shadow-md" />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-card bg-gradient-to-br from-brand-500 to-purple-600 text-white text-2xl font-black shadow-md">
                  {getInitials(fullName || me.email)}
                </div>
              )}
              {!editing && (
                <div className="ml-auto pb-1">
                  <Button variant="outline" size="sm" onClick={startEdit} className="gap-1.5">
                    <Pencil className="h-3.5 w-3.5" />Modifier le profil
                  </Button>
                </div>
              )}
            </div>

            {!editing ? (
              <div className="mt-3">
                <h1 className="text-xl font-bold text-foreground">{fullName || me.email}</h1>
                {p.headline && <p className="text-sm font-medium text-muted-foreground">{p.headline}</p>}
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{me.email}</span>
                  {p.company && <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" />{p.company}</span>}
                  {p.city && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{p.city}</span>}
                  {p.phoneNumber && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{p.phoneNumber}</span>}
                </div>
                {roles.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {roles.map((r) => {
                      const Icon = ROLE_META[r].icon
                      return (
                        <span key={r} className={`inline-flex items-center gap-1 rounded-full bg-card border border-border px-2 py-0.5 text-[10px] font-bold ${ROLE_META[r].color}`}>
                          <Icon className="h-3 w-3" />{ROLE_META[r].label}
                        </span>
                      )
                    })}
                  </div>
                )}
                {/* Social links */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {p.website && (
                    <a href={normalizeUrl(p.website)} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:text-brand-600 hover:border-brand-400">
                      <Globe2 className="h-3.5 w-3.5" />Site web
                    </a>
                  )}
                  {p.linkedInUrl && (
                    <a href={normalizeUrl(p.linkedInUrl)} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:text-[#0a66c2] hover:border-[#0a66c2]/50">
                      <Linkedin className="h-3.5 w-3.5" />LinkedIn
                    </a>
                  )}
                  {p.twitterUrl && (
                    <a href={normalizeUrl(p.twitterUrl)} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
                      <Twitter className="h-3.5 w-3.5" />X / Twitter
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">Photo de profil</label>
                  <AvatarUpload value={draft.avatarUrl} onChange={(url) => setDraft((d) => ({ ...d, avatarUrl: url }))}
                    folder="avatars" initials={fullName} shape="circle" />
                </div>
                <div className="sm:col-span-2">{field('headline', 'Titre / Headline', { placeholder: 'Founder & CEO @ Acme — FoodTech' })}</div>
                {field('company', 'Entreprise', { placeholder: 'Acme FoodTech' })}
                {field('sector', 'Secteur', { placeholder: 'FoodTech, FinTech…' })}
                {field('city', 'Ville')}
                {field('phoneNumber', 'Téléphone')}
                {field('website', 'Site web', { placeholder: 'https://…' })}
                {field('linkedInUrl', 'LinkedIn', { placeholder: 'https://linkedin.com/in/…' })}
                {field('twitterUrl', 'X / Twitter', { placeholder: 'https://x.com/…' })}
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">À propos / Bio</label>
                  <textarea value={draft.bio ?? ''} onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))}
                    rows={4} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Votre parcours, votre mission, ce qui vous motive…" />
                </div>
                <div className="sm:col-span-2 flex gap-2">
                  <Button variant="brand" size="sm" onClick={save} disabled={saving}>
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}Enregistrer
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(false)}><X className="h-3.5 w-3.5" />Annuler</Button>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* ── About ── */}
        {!editing && p.bio && (
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-sm font-bold text-foreground mb-2">À propos</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{p.bio}</p>
          </div>
        )}

        {/* ── Details ── */}
        {!editing && (p.company || p.sector) && (
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-sm font-bold text-foreground mb-3">Détails</h2>
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              {p.company && <div><p className="text-xs text-muted-foreground">Entreprise</p><p className="font-medium text-foreground">{p.company}</p></div>}
              {p.sector && <div><p className="text-xs text-muted-foreground">Secteur</p><p className="font-medium text-foreground">{p.sector}</p></div>}
            </div>
          </div>
        )}

        {!editing && !p.bio && !p.headline && !p.company && (
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center">
            <Briefcase className="mx-auto h-9 w-9 text-muted-foreground opacity-30 mb-2" />
            <p className="text-sm text-muted-foreground mb-3">Votre profil est vide. Présentez-vous !</p>
            <Button variant="brand" size="sm" onClick={startEdit} className="gap-1.5"><Pencil className="h-3.5 w-3.5" />Compléter mon profil</Button>
          </div>
        )}
      </div>
    </AppShell>
  )
}
