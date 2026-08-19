'use client'
/**
 * Mes organisations — a standalone front-office module (separate from Programmes)
 * where a logged-in user manages the organisations they own (their startups).
 * Create / edit happens inline; the same orgs feed the candidature flow's picker.
 */
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Building2, Plus, Loader2, Globe2, MapPin, Check, X, Users, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { organizationsApi, juryApi, participantsApi, ORGANIZATION_TYPES, CATALOG_CATEGORIES } from '@/lib/api'
import { useCatalog } from '@/hooks/useCatalog'
import { useUser, useAuthStore, frontofficeRolesOf } from '@/store/auth.store'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

interface Org {
  id: number
  name: string
  type?: string
  sector?: string
  city?: string
  country?: string
  website?: string
  logoUrl?: string
  description?: string
  contactEmail?: string
  contactPhone?: string
  members?: { id: number }[]
  _role?: 'owner' | 'member' | 'mentor' | 'jury' | 'admin'
}

const TYPE_LABEL: Record<string, string> = {
  STARTUP: 'Startup', INCUBATOR: 'Incubateur', UNIVERSITY: 'Université',
  ASSOCIATION: 'Association', SPONSOR: 'Sponsor', CORPORATE: 'Corporate',
  GOVERNMENT: 'Public', OTHER: 'Autre',
}

const EMPTY = {
  name: '', type: 'STARTUP', sector: '', city: '', country: '', website: '', description: '',
}
type Draft = typeof EMPTY

export default function OrganizationsPage() {
  const router = useRouter()
  const user = useUser()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  // Which organisations this module shows depends on the role:
  //   porteur → the ones they own (+ team memberships)   [can create]
  //   mentor  → the startups they're the « vis-à-vis » of
  //   jury    → the organisations behind candidatures assigned to them
  //   admin   → all organisations (admin-only accounts on the front-office)
  const foRoles = frontofficeRolesOf(user)
  const isPorteur = foRoles.includes('PORTEUR')
  const isMentor = foRoles.includes('MENTOR')
  const isJury = foRoles.includes('JURY')
  const isAdmin = ((user?.roles ?? []) as string[]).includes('ADMIN')
  const showAll = isAdmin && !isPorteur && !isMentor && !isJury
  // Title + subtitle follow the dominant role (porteur first).
  const view = isPorteur ? 'porteur' : isMentor ? 'mentor' : showAll ? 'admin' : isJury ? 'jury' : 'porteur'
  const HEAD = {
    porteur: { h: 'Mes organisations', sub: 'vos startups et structures.' },
    mentor: { h: 'Startups que j’accompagne', sub: 'les organisations dont vous êtes le référent.' },
    admin: { h: 'Organisations', sub: 'toutes les organisations de la plateforme.' },
    jury: { h: 'Organisations à évaluer', sub: 'les structures liées à vos candidatures assignées.' },
  }[view]
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => { setHydrated(true) }, [])

  const orgTypes = useCatalog(CATALOG_CATEGORIES.ORGANIZATION_TYPE,
    ORGANIZATION_TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] })))
  const [orgs, setOrgs] = useState<Org[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  // null = closed; 'new' = create form. Editing an existing org happens on its
  // profile page (/organizations/[id]).
  const [editing, setEditing] = useState<'new' | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY)

  // Redirect anonymous visitors to login (this is an authenticated module).
  useEffect(() => {
    if (hydrated && !isAuthenticated) router.replace('/login')
  }, [hydrated, isAuthenticated, router])

  useEffect(() => {
    if (!hydrated) return
    // Wait until the persisted user is available; once hydrated without a user
    // the redirect-to-login effect handles it, so stop the spinner regardless.
    if (!user) { setLoading(false); return }
    if (!user.id) { setLoading(false); return }
    let cancelled = false
    setLoading(true)
    const uid = user.id
    // Fetch every source relevant to the caller's roles; tag each row with the
    // relationship so the card can badge it, then merge by priority.
    type Src = { tag: NonNullable<Org['_role']>; list: Org[] }
    const grab = (p: Promise<any>): Promise<Org[]> => p.then((r) => (r.data ?? []) as Org[]).catch(() => [])
    const sources: Promise<Src>[] = []
    if (isPorteur) {
      sources.push(grab(organizationsApi.list({ createdByUserId: uid })).then((list) => ({ tag: 'owner', list })))
      sources.push(grab(organizationsApi.list({ memberUserId: uid })).then((list) => ({ tag: 'member', list })))
    }
    if (isMentor) sources.push(
      participantsApi.mine()
        .then((r) => ({ tag: 'mentor' as const, list: ((r.data ?? []) as any[]).map((p) => ({ id: p.organizationId, name: p.organizationName || 'Organisation', _role: 'mentor' as const })) as Org[] }))
        .catch(() => ({ tag: 'mentor' as const, list: [] as Org[] })),
    )
    if (showAll) sources.push(grab(organizationsApi.list()).then((list) => ({ tag: 'admin', list })))
    if (isJury) {
      // Jury: the organisations behind the candidatures assigned to me.
      sources.push(
        juryApi.myAssignments()
          .then(async (r) => {
            const ids = Array.from(new Set(((r.data ?? []) as any[]).map((c) => c.organizationId).filter(Boolean))) as number[]
            const orgs = await Promise.all(ids.map((oid) => organizationsApi.get(oid).then((rr) => rr.data as Org).catch(() => null)))
            return { tag: 'jury' as const, list: orgs.filter(Boolean) as Org[] }
          })
          .catch(() => ({ tag: 'jury' as const, list: [] as Org[] })),
      )
    }

    Promise.all(sources).then((results) => {
      if (cancelled) return
      const priority: Record<string, number> = { owner: 5, mentor: 4, admin: 3, jury: 2, member: 1 }
      const map = new Map<number, Org>()
      for (const { tag, list } of results) {
        for (const o of list) {
          const cur = map.get(o.id)
          if (!cur || priority[tag] > priority[cur._role ?? 'member']) map.set(o.id, { ...o, _role: tag })
        }
      }
      setOrgs(Array.from(map.values()))
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [hydrated, user?.id, isPorteur, isMentor, isJury, showAll])

  const startCreate = () => { setDraft(EMPTY); setEditing('new') }
  const cancel = () => { setEditing(null); setDraft(EMPTY) }

  const save = async () => {
    if (!draft.name.trim()) { toast.error('Le nom est requis'); return }
    setSaving(true)
    const payload = {
      name: draft.name.trim(),
      type: draft.type,
      sector: draft.sector || undefined,
      city: draft.city || undefined,
      country: draft.country || undefined,
      website: draft.website || undefined,
      description: draft.description || undefined,
    }
    try {
      const r = await organizationsApi.create(payload)
      // Open the new org's profile so the porteur can add their team next.
      toast.success('Organisation créée')
      cancel()
      router.push(`/organizations/${r.data.id}`)
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erreur')
    } finally { setSaving(false) }
  }

  const orgForm = useMemo(() => (
    <div className="rounded-xl border border-border bg-background/50 p-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground">Type</label>
          <div className="flex flex-wrap gap-1.5">
            {orgTypes.map((t) => (
              <button key={t.value} type="button" onClick={() => setDraft((d) => ({ ...d, type: t.value }))}
                className={`rounded-full px-3 py-1 text-xs font-semibold border transition-all ${
                  draft.type === t.value
                    ? 'border-brand-500 bg-brand-500/15 text-brand-700 dark:text-brand-300'
                    : 'border-border text-muted-foreground hover:border-brand-400'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground">Nom de l&apos;organisation *</label>
          <Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Ex. Acme FoodTech" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Secteur</label>
          <Input value={draft.sector} onChange={(e) => setDraft((d) => ({ ...d, sector: e.target.value }))} placeholder="FoodTech, FinTech…" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Ville</label>
          <Input value={draft.city} onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Pays</label>
          <Input value={draft.country} onChange={(e) => setDraft((d) => ({ ...d, country: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Site web</label>
          <Input value={draft.website} onChange={(e) => setDraft((d) => ({ ...d, website: e.target.value }))} placeholder="https://…" />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground">Description</label>
          <Input value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} placeholder="Quelques mots sur la mission" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="brand" size="sm" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
        <Button variant="ghost" size="sm" onClick={cancel}><X className="h-3.5 w-3.5" />Annuler</Button>
      </div>
    </div>
  ), [draft, saving, orgTypes])

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Building2 className="h-6 w-6 text-brand-500" />{HEAD.h}
            </h1>
            <p className="text-sm text-muted-foreground">{orgs.length} organisation(s) — {HEAD.sub}</p>
          </div>
          {editing !== 'new' && isPorteur && (
            <Button variant="brand" onClick={startCreate} className="gap-1.5">
              <Plus className="h-4 w-4" />Nouvelle organisation
            </Button>
          )}
        </div>

        <AnimatePresence>
          {editing === 'new' && (
            <motion.div key="new" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              {orgForm}
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
        ) : orgs.length === 0 && editing !== 'new' ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-16 text-center">
            <Building2 className="mx-auto h-10 w-10 text-muted-foreground opacity-30 mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              {isPorteur ? 'Vous n’avez pas encore d’organisation.' : 'Aucune organisation à afficher.'}
            </p>
            {isPorteur && (
              <Button variant="brand" onClick={startCreate} className="gap-1.5">
                <Plus className="h-4 w-4" />Créer ma première organisation
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {orgs.map((o) => (
              <Link key={o.id} href={`/organizations/${o.id}`}
                className="group rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:border-brand-400 hover:shadow-md">
                <div className="flex items-start gap-4">
                  {o.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={o.logoUrl} alt={o.name} className="h-12 w-12 rounded-lg object-cover border border-border" />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
                      <Building2 className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">{o.name}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        {TYPE_LABEL[o.type ?? 'OTHER'] ?? o.type}
                      </span>
                      {o._role === 'member' && (
                        <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:text-sky-300">
                          Membre · lecture seule
                        </span>
                      )}
                      {o._role === 'mentor' && (
                        <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] font-semibold text-purple-700 dark:text-purple-300">
                          Référent (vis-à-vis)
                        </span>
                      )}
                      {o._role === 'jury' && (
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                          À évaluer · lecture seule
                        </span>
                      )}
                      {o._role === 'admin' && (
                        <span className="rounded-full bg-brand-500/15 px-2 py-0.5 text-[10px] font-semibold text-brand-700 dark:text-brand-300">
                          Admin
                        </span>
                      )}
                    </div>
                    {o.description && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{o.description}</p>}
                    <p className="mt-1.5 text-xs text-muted-foreground flex flex-wrap gap-3">
                      {o.sector && <span>{o.sector}</span>}
                      {(o.city || o.country) && (
                        <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />
                          {[o.city, o.country].filter(Boolean).join(', ')}
                        </span>
                      )}
                      {(o.members?.length ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{o.members!.length}</span>
                      )}
                      {o.website && (
                        <span className="inline-flex items-center gap-1"><Globe2 className="h-3 w-3" />
                          {o.website.replace(/^https?:\/\//, '').slice(0, 32)}
                        </span>
                      )}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
