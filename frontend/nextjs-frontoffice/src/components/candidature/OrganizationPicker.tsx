'use client'
/**
 * OrganizationPicker — first mandatory step of any candidature.
 *
 * The porteur picks an existing organisation they own (their startup), or
 * creates a new one inline. Selection is required before the rest of the
 * form opens. The component is intentionally compact so it can live above
 * the candidature form on /programmes/[id]/candidater.
 */
import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Building2, Plus, Check, Loader2, ChevronDown, Globe2, MapPin } from 'lucide-react'
import toast from 'react-hot-toast'
import { organizationsApi, ORGANIZATION_TYPES } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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
}

const TYPE_LABEL: Record<string, string> = {
  STARTUP: 'Startup', INCUBATOR: 'Incubateur', UNIVERSITY: 'Université',
  ASSOCIATION: 'Association', SPONSOR: 'Sponsor', CORPORATE: 'Corporate',
  GOVERNMENT: 'Public', OTHER: 'Autre',
}

interface Props {
  currentUserId?: number | null
  selectedId: number | null
  onSelect: (orgId: number, org?: Org) => void
}

export function OrganizationPicker({ currentUserId, selectedId, onSelect }: Props) {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)

  // Create form
  const [draft, setDraft] = useState({
    name: '', type: 'STARTUP', sector: '', city: '', country: '', website: '', description: '',
  })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const r = await organizationsApi.list(
          currentUserId ? { createdByUserId: currentUserId } : undefined
        )
        if (!cancelled) setOrgs(r.data ?? [])
      } finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [currentUserId])

  const selected = useMemo(() => orgs.find(o => o.id === selectedId), [orgs, selectedId])

  const onCreate = async () => {
    if (!draft.name.trim()) { toast.error('Le nom est requis'); return }
    setCreating(true)
    try {
      const r = await organizationsApi.create({
        name: draft.name.trim(),
        type: draft.type,
        sector: draft.sector || undefined,
        city: draft.city || undefined,
        country: draft.country || undefined,
        website: draft.website || undefined,
        description: draft.description || undefined,
      })
      const created: Org = r.data
      setOrgs(arr => [created, ...arr])
      onSelect(created.id, created)
      setDraft({ name: '', type: 'STARTUP', sector: '', city: '', country: '', website: '', description: '' })
      setShowCreate(false)
      toast.success('Organisation créée et sélectionnée')
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erreur')
    } finally { setCreating(false) }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 text-white">
          <Building2 className="h-4 w-4" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Votre organisation</h3>
          <p className="text-xs text-muted-foreground">
            Étape obligatoire — sélectionnez la startup avec laquelle vous candidatez.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-6 text-center text-muted-foreground">
          <Loader2 className="mx-auto h-4 w-4 animate-spin" />
        </div>
      ) : (
        <>
          {orgs.length === 0 ? (
            <div className="mb-3 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
              Vous n'avez pas encore enregistré d'organisation.
              <br />
              Créez la vôtre ci-dessous pour candidater.
            </div>
          ) : (
            <div className="mb-3 space-y-2">
              {orgs.map(o => {
                const active = o.id === selectedId
                return (
                  <button key={o.id} type="button" onClick={() => onSelect(o.id, o)}
                    className={`w-full text-left rounded-xl border p-3 transition-all ${
                      active
                        ? 'border-brand-500 bg-brand-500/5 ring-2 ring-brand-500/30'
                        : 'border-border hover:border-brand-400 hover:bg-accent/40'}`}>
                    <div className="flex items-start gap-3">
                      {o.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={o.logoUrl} alt={o.name} className="h-10 w-10 rounded-lg object-cover border border-border" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted">
                          <Building2 className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{o.name}</span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                            {TYPE_LABEL[o.type ?? 'OTHER']}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground flex flex-wrap gap-3 mt-0.5">
                          {o.sector && <span>{o.sector}</span>}
                          {(o.city || o.country) && (
                            <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />
                              {[o.city, o.country].filter(Boolean).join(', ')}
                            </span>
                          )}
                          {o.website && (
                            <span className="inline-flex items-center gap-1"><Globe2 className="h-3 w-3" />
                              {o.website.replace(/^https?:\/\//, '').slice(0, 26)}
                            </span>
                          )}
                        </p>
                      </div>
                      {active && (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-white">
                          <Check className="h-3.5 w-3.5" />
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {selected && (
            <div className="mb-3 text-xs text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
              <Check className="h-3.5 w-3.5" />Organisation sélectionnée : <b className="font-semibold">{selected.name}</b>
            </div>
          )}

          {/* Create new */}
          {!showCreate ? (
            <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-3.5 w-3.5" />Créer une nouvelle organisation
            </Button>
          ) : (
            <AnimatePresence>
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                className="overflow-hidden">
                <div className="rounded-xl border border-border bg-background/50 p-3 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-xs font-medium text-muted-foreground">Type</label>
                      <div className="flex flex-wrap gap-1.5">
                        {ORGANIZATION_TYPES.map(t => (
                          <button key={t} type="button" onClick={() => setDraft(d => ({ ...d, type: t }))}
                            className={`rounded-full px-3 py-1 text-xs font-semibold border transition-all ${
                              draft.type === t
                                ? 'border-brand-500 bg-brand-500/15 text-brand-700 dark:text-brand-300'
                                : 'border-border text-muted-foreground hover:border-brand-400'}`}>
                            {TYPE_LABEL[t]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-xs font-medium text-muted-foreground">Nom de l'organisation *</label>
                      <Input value={draft.name}
                        onChange={(e) => setDraft(d => ({ ...d, name: e.target.value }))}
                        placeholder="Ex. Acme FoodTech" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Secteur</label>
                      <Input value={draft.sector}
                        onChange={(e) => setDraft(d => ({ ...d, sector: e.target.value }))}
                        placeholder="FoodTech, FinTech…" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Ville</label>
                      <Input value={draft.city}
                        onChange={(e) => setDraft(d => ({ ...d, city: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Pays</label>
                      <Input value={draft.country}
                        onChange={(e) => setDraft(d => ({ ...d, country: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Site web</label>
                      <Input value={draft.website}
                        onChange={(e) => setDraft(d => ({ ...d, website: e.target.value }))}
                        placeholder="https://…" />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-xs font-medium text-muted-foreground">Description</label>
                      <Input value={draft.description}
                        onChange={(e) => setDraft(d => ({ ...d, description: e.target.value }))}
                        placeholder="Quelques mots sur la mission" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="brand" size="sm" onClick={onCreate} disabled={creating}>
                      {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                      {creating ? 'Création…' : 'Créer et sélectionner'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>Annuler</Button>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </>
      )}
    </div>
  )
}
