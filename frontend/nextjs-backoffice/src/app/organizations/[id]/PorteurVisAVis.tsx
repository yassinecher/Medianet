'use client'
/**
 * « Porteur ↔ Vis-à-vis » — the two counterparts of an organisation, face to face.
 *
 *  • Porteur   — the founder representing the startup. Defaults to the org's
 *                creator; an admin can reassign it to any PORTEUR account.
 *  • Vis-à-vis — the incubator-side MENTOR / référent assigned to accompany the
 *                startup. The picker ranks mentors by BEST FIT to the org
 *                (sector / expertise overlap) and flags the top match.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  UserRound, Handshake, Mail, Phone, Globe2, Linkedin, Star, Search, X, Loader2,
  ArrowLeftRight, Award, Trash2, Repeat, Crown,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { organizationsApi, usersApi } from '@/lib/api'
import { MagicCard } from '@/components/magicui/magic-card'
import { Button } from '@/components/ui/button'
import { getInitials } from '@/lib/utils'

type UserDto = any
type OrgLite = {
  id: number; name?: string; sector?: string; description?: string
  createdByUserId?: number | null; porteurUserId?: number | null; mentorUserId?: number | null
}

const norm = (u?: string) => (!u ? '' : /^https?:\/\//.test(u) ? u : `https://${u}`)
const fullName = (u?: UserDto) => (u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email : '')

// Loose keyword tokens for best-fit matching (accent-folded, stop-words dropped).
const STOP = new Set(
  'les des une aux pour dans avec sur startup entreprise societe projet the and for with de la le du en au et un une par sont'.split(' '),
)
function toks(s?: string): string[] {
  return (s ?? '')
    .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w))
}

export function PorteurVisAVis({ org, onChanged }: { org: OrgLite; onChanged: () => void }) {
  const effectivePorteurId = org.porteurUserId ?? org.createdByUserId ?? null
  const isCreatorPorteur = !org.porteurUserId && !!org.createdByUserId

  const [porteur, setPorteur] = useState<UserDto | null>(null)
  const [mentor, setMentor] = useState<UserDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [picker, setPicker] = useState<null | 'porteur' | 'mentor'>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [p, m] = await Promise.allSettled([
      effectivePorteurId ? usersApi.get(effectivePorteurId) : Promise.reject(),
      org.mentorUserId ? usersApi.get(org.mentorUserId) : Promise.reject(),
    ])
    setPorteur(p.status === 'fulfilled' ? p.value.data : null)
    setMentor(m.status === 'fulfilled' ? m.value.data : null)
    setLoading(false)
  }, [effectivePorteurId, org.mentorUserId])

  useEffect(() => { load() }, [load])

  const orgKeywords = useMemo(
    () => new Set([...toks(org.sector), ...toks(org.name), ...toks(org.description)]),
    [org.sector, org.name, org.description],
  )

  return (
    <MagicCard className="p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
        <ArrowLeftRight className="h-4 w-4 text-brand-500" />Porteur &amp; vis-à-vis
      </h2>

      {loading ? (
        <div className="flex h-28 items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <div className="grid items-stretch gap-3 md:grid-cols-[1fr_auto_1fr]">
          {/* Porteur */}
          <PersonCard
            tone="brand"
            roleLabel="Porteur"
            icon={UserRound}
            badge={isCreatorPorteur ? 'Créateur' : undefined}
            person={porteur}
            profile={porteur?.porteurProfile}
            emptyText="Aucun porteur"
            actions={
              <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => setPicker('porteur')}>
                <Repeat className="h-3 w-3" />{porteur ? 'Changer' : 'Assigner'}
              </Button>
            }
          />

          {/* Face-to-face connector */}
          <div className="hidden flex-col items-center justify-center md:flex">
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-muted-foreground">
              <ArrowLeftRight className="h-4 w-4" />
            </span>
          </div>

          {/* Vis-à-vis (mentor) */}
          <PersonCard
            tone="purple"
            roleLabel="Vis-à-vis · Référent"
            icon={Handshake}
            person={mentor}
            profile={mentor?.mentorProfile}
            isMentor
            emptyText="Aucun référent assigné"
            actions={
              <div className="flex gap-1.5">
                {mentor && (
                  <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-rose-600 hover:text-rose-700"
                    onClick={async () => {
                      try { await organizationsApi.assignMentor(org.id, null); toast.success('Référent retiré'); onChanged() }
                      catch (e: any) { toast.error(e.response?.data?.message ?? 'Échec') }
                    }}>
                    <Trash2 className="h-3 w-3" />Retirer
                  </Button>
                )}
                <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => setPicker('mentor')}>
                  <Repeat className="h-3 w-3" />{mentor ? 'Changer' : 'Assigner'}
                </Button>
              </div>
            }
          />
        </div>
      )}

      {picker === 'porteur' && (
        <PickerModal
          title="Assigner le porteur"
          role="PORTEUR"
          currentId={org.porteurUserId ?? null}
          onClose={() => setPicker(null)}
          extraAction={
            org.porteurUserId
              ? {
                  label: 'Réinitialiser au créateur',
                  run: async () => { await organizationsApi.assignPorteur(org.id, null) },
                }
              : undefined
          }
          onPick={async (u) => { await organizationsApi.assignPorteur(org.id, u.id) }}
          afterChange={() => { setPicker(null); onChanged() }}
        />
      )}
      {picker === 'mentor' && (
        <PickerModal
          title="Assigner le vis-à-vis (mentor)"
          role="MENTOR"
          currentId={org.mentorUserId ?? null}
          orgKeywords={orgKeywords}
          onClose={() => setPicker(null)}
          onPick={async (u) => { await organizationsApi.assignMentor(org.id, u.id) }}
          afterChange={() => { setPicker(null); onChanged() }}
        />
      )}
    </MagicCard>
  )
}

// ── One counterpart card ─────────────────────────────────────────────────────
function PersonCard({
  tone, roleLabel, icon: Icon, badge, person, profile, isMentor, emptyText, actions,
}: {
  tone: 'brand' | 'purple'; roleLabel: string; icon: any; badge?: string
  person: UserDto | null; profile: any; isMentor?: boolean; emptyText: string; actions: React.ReactNode
}) {
  const ring = tone === 'brand' ? 'from-brand-500 to-sky-500' : 'from-purple-500 to-fuchsia-500'
  const chip = tone === 'brand' ? 'bg-brand-500/10 text-brand-700 dark:text-brand-300' : 'bg-purple-500/10 text-purple-700 dark:text-purple-300'
  const expertise: string[] = [...(profile?.expertise ?? []), ...(profile?.specializations ?? [])]
  return (
    <div className="flex flex-col rounded-xl border border-border bg-background/50 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${chip}`}>
          <Icon className="h-3 w-3" />{roleLabel}
        </span>
        {badge && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{badge}</span>}
      </div>

      {!person ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-3 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground"><Icon className="h-5 w-5" /></div>
          <p className="text-xs italic text-muted-foreground">{emptyText}</p>
        </div>
      ) : (
        <div className="flex flex-1 items-start gap-3">
          {profile?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatarUrl} alt={fullName(person)} className="h-11 w-11 shrink-0 rounded-full border border-border object-cover" />
          ) : (
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${ring} text-xs font-bold text-white`}>{getInitials(fullName(person))}</div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{fullName(person)}</p>
            <p className="truncate text-xs text-muted-foreground">{profile?.headline || profile?.title || (isMentor ? 'Mentor' : 'Porteur de projet')}</p>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
              {person.email && <a href={`mailto:${person.email}`} className="inline-flex items-center gap-1 hover:text-foreground"><Mail className="h-3 w-3" />{person.email}</a>}
              {profile?.phoneNumber && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{profile.phoneNumber}</span>}
              {profile?.website && <a href={norm(profile.website)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-brand-600"><Globe2 className="h-3 w-3" />Site</a>}
              {profile?.linkedInUrl && <a href={norm(profile.linkedInUrl)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-[#0a66c2]"><Linkedin className="h-3 w-3" />LinkedIn</a>}
              {isMentor && profile?.rating != null && <span className="inline-flex items-center gap-1 text-amber-500"><Star className="h-3 w-3 fill-current" />{Number(profile.rating).toFixed(1)}</span>}
            </div>
            {(profile?.bio) && <p className="mt-1.5 line-clamp-2 text-[11px] text-muted-foreground">{profile.bio}</p>}
            {expertise.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {expertise.slice(0, 6).map((x) => <span key={x} className={`rounded-full px-2 py-0.5 text-[10px] ${chip}`}>{x}</span>)}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-3 flex justify-end">{actions}</div>
    </div>
  )
}

// ── Person picker (with best-fit ranking for mentors) ────────────────────────
function PickerModal({
  title, role, currentId, orgKeywords, onClose, onPick, afterChange, extraAction,
}: {
  title: string; role: 'PORTEUR' | 'MENTOR'; currentId: number | null
  orgKeywords?: Set<string>
  onClose: () => void
  onPick: (u: UserDto) => Promise<void>
  afterChange: () => void
  extraAction?: { label: string; run: () => Promise<void> }
}) {
  const [users, setUsers] = useState<UserDto[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<number | 'extra' | null>(null)

  useEffect(() => {
    usersApi.byRole(role)
      .then((r) => setUsers((r.data ?? []).filter((u: UserDto) => u.active !== false)))
      .catch(() => toast.error('Impossible de charger la liste'))
      .finally(() => setLoading(false))
  }, [role])

  // Best-fit score = keyword overlap between the org and the mentor's profile.
  const scored = useMemo(() => {
    const kw = orgKeywords
    const withScore = users.map((u) => {
      if (!kw || kw.size === 0) return { u, score: 0 }
      const mp = u.mentorProfile ?? {}
      const mtoks = new Set<string>([
        ...toks((mp.expertise ?? []).join(' ')),
        ...toks((mp.specializations ?? []).join(' ')),
        ...toks(mp.title), ...toks(mp.bio),
      ])
      let score = 0
      mtoks.forEach((t) => { if (kw.has(t)) score++ })
      return { u, score }
    })
    withScore.sort((a, b) => b.score - a.score || fullName(a.u).localeCompare(fullName(b.u)))
    return withScore
  }, [users, orgKeywords])

  const filtered = scored.filter(({ u }) =>
    !q || fullName(u).toLowerCase().includes(q.toLowerCase()) || (u.email ?? '').toLowerCase().includes(q.toLowerCase()))
  const bestId = role === 'MENTOR' && scored[0]?.score > 0 ? scored[0].u.id : null

  const choose = async (u: UserDto) => {
    setSaving(u.id)
    try { await onPick(u); toast.success('Assignation enregistrée'); afterChange() }
    catch (e: any) { toast.error(e.response?.data?.message ?? 'Échec de l’assignation'); setSaving(null) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="border-b border-border p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher par nom ou e-mail…"
              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-500" />
          </div>
          {role === 'MENTOR' && orgKeywords && orgKeywords.size > 0 && (
            <p className="mt-1.5 text-[11px] text-muted-foreground">Classés par correspondance avec le secteur / l’expertise de l’organisation.</p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex h-24 items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-center text-xs text-muted-foreground">Aucun {role === 'MENTOR' ? 'mentor' : 'porteur'} trouvé.</p>
          ) : (
            filtered.map(({ u, score }) => {
              const prof = role === 'MENTOR' ? u.mentorProfile : u.porteurProfile
              const isCurrent = u.id === currentId
              const isBest = u.id === bestId
              return (
                <button key={u.id} disabled={saving != null} onClick={() => choose(u)}
                  className={`mb-1 flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors disabled:opacity-60
                    ${isCurrent ? 'border-brand-400 bg-brand-500/5' : 'border-transparent hover:border-border hover:bg-accent/50'}`}>
                  {prof?.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={prof.avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full border border-border object-cover" />
                  ) : (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-purple-600 text-[11px] font-bold text-white">{getInitials(fullName(u))}</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-foreground">{fullName(u)}</span>
                      {isBest && <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-300"><Crown className="h-2.5 w-2.5" />Meilleure correspondance</span>}
                      {isCurrent && <span className="rounded-full bg-brand-500/15 px-1.5 py-0.5 text-[9px] font-bold text-brand-700 dark:text-brand-300">Actuel</span>}
                    </div>
                    <p className="truncate text-[11px] text-muted-foreground">{prof?.headline || prof?.title || u.email}</p>
                    {(prof?.expertise?.length ?? 0) > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {prof.expertise.slice(0, 4).map((x: string) => (
                          <span key={x} className={`rounded-full px-1.5 py-0.5 text-[9px] ${orgKeywords?.has(toks(x)[0] ?? '') ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'bg-muted text-muted-foreground'}`}>{x}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  {role === 'MENTOR' && score > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600"><Award className="h-3 w-3" />{score}</span>
                  )}
                  {saving === u.id && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </button>
              )
            })
          )}
        </div>

        {extraAction && (
          <div className="border-t border-border p-3">
            <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" disabled={saving != null}
              onClick={async () => {
                setSaving('extra')
                try { await extraAction.run(); toast.success('Réinitialisé'); afterChange() }
                catch (e: any) { toast.error(e.response?.data?.message ?? 'Échec'); setSaving(null) }
              }}>
              {saving === 'extra' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Repeat className="h-3.5 w-3.5" />}{extraAction.label}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
