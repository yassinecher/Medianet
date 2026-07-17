'use client'
/**
 * ParticipantsPanel — programme « Participants » tab.
 *
 *  (2) Lists everyone associated with the programme. When a Candidature session
 *      exists, people are grouped per organisation (members + porteurs) plus all
 *      jury members involved.
 *  (3) « Ajouter des personnes » — pick registered platform users OR add people
 *      by email (not yet registered), building an invitation selection.
 *  (4) The invitation email template is shown with its available placeholders and
 *      a live preview; each invite carries a tracking link to follow the programme.
 *
 * Sending reuses notification-service `sessionNotify` (one archived row per
 * recipient), so invited people also appear in the Invitations archive.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Users, Building2, Rocket, Gavel, Loader2, Send, Plus, Check, Search, Mail,
  UserPlus, ExternalLink, CheckCircle2, X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { candidaturesApi, organizationsApi, usersApi, notificationsApi } from '@/lib/api'
import { MagicCard } from '@/components/magicui/magic-card'

const FRONTOFFICE_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_FRONTOFFICE_URL) || 'http://localhost:3000'

type Role = 'porteur' | 'member' | 'jury' | 'invite'
const ROLE_META: Record<Role, { label: string; icon: any; cls: string }> = {
  porteur: { label: 'Porteur', icon: Rocket, cls: 'bg-sky-500/10 text-sky-700 dark:text-sky-300' },
  member:  { label: 'Membre', icon: Building2, cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
  jury:    { label: 'Jury', icon: Gavel, cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-300' },
  invite:  { label: 'Invité', icon: UserPlus, cls: 'bg-violet-500/10 text-violet-700 dark:text-violet-300' },
}

interface Person { email: string; name?: string; role: Role; orgId?: number; orgName?: string; registered?: boolean }
interface Cand { id: number; projectName?: string; companyName?: string; porteurEmail?: string; porteurName?: string; organizationId?: number | null; juryAssignments?: { juryEmail?: string; juryName?: string }[] }
interface Member { email?: string; name?: string; role?: string }
interface Org { id: number; name?: string; members?: Member[] }
interface User { id: number; email?: string; firstName?: string; lastName?: string; role?: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const isEmail = (s?: string): s is string => !!s && EMAIL_RE.test(s.trim())
const norm = (s: string) => s.trim().toLowerCase()

const DEFAULT_SUBJECT = 'Votre participation au programme {{programme}}'
const DEFAULT_BODY =
  `Bonjour {{nom}},\n\nVous participez au programme « {{programme}} » en tant que {{role}}.\n` +
  `Suivez son avancement, accédez aux mises à jour et aux informations qui vous concernent ` +
  `directement depuis votre espace : {{lien}}\n\nÀ très bientôt,\nL'équipe Medianet Incubateur`

const PLACEHOLDERS = [
  { token: '{{nom}}', desc: 'Nom du destinataire' },
  { token: '{{programme}}', desc: 'Nom du programme' },
  { token: '{{role}}', desc: 'Rôle (Porteur, Jury, …)' },
  { token: '{{lien}}', desc: 'Lien de suivi du programme' },
]

function fill(tpl: string, v: { nom: string; programme: string; role: string; lien: string }) {
  return tpl
    .replace(/\{\{\s*nom\s*\}\}/gi, v.nom)
    .replace(/\{\{\s*programme\s*\}\}/gi, v.programme)
    .replace(/\{\{\s*role\s*\}\}/gi, v.role)
    .replace(/\{\{\s*lien\s*\}\}/gi, v.lien)
}

function inviteHtml(bodyFilled: string, lien: string) {
  return `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:auto;color:#0f172a">
  <div style="background:linear-gradient(135deg,#1a73e8,#0d47a1);padding:24px 28px;border-radius:14px 14px 0 0">
    <h2 style="margin:0;color:#fff;font-size:19px">Medianet Incubateur</h2>
  </div>
  <div style="border:1px solid #e8ecef;border-top:none;border-radius:0 0 14px 14px;padding:24px 28px">
    <div style="font-size:15px;line-height:1.7;white-space:pre-wrap">${bodyFilled}</div>
    <p style="text-align:center;margin:26px 0 8px">
      <a href="${lien}" style="background:#1a73e8;color:#fff;padding:12px 26px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block">Suivre le programme</a>
    </p>
  </div>
</div>`
}

export function ParticipantsPanel({ programmeId, programmeName, phases }: {
  programmeId: number
  programmeName: string
  phases: { sessionType?: string }[]
}) {
  const [cands, setCands] = useState<Cand[]>([])
  const [orgs, setOrgs] = useState<Record<number, Org>>({})
  const [users, setUsers] = useState<User[]>([])
  const [invited, setInvited] = useState<Set<string>>(new Set())   // emails already invited (archive)
  const [loading, setLoading] = useState(true)

  const [selected, setSelected] = useState<Map<string, Person>>(new Map())
  const [userSearch, setUserSearch] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newName, setNewName] = useState('')
  const [subject, setSubject] = useState(DEFAULT_SUBJECT)
  const [body, setBody] = useState(DEFAULT_BODY)
  const [sending, setSending] = useState(false)

  const hasCandidatureSession = useMemo(
    () => (phases ?? []).some((p) => p.sessionType === 'CANDIDATURE_SUBMISSION'), [phases])
  const trackingLink = `${FRONTOFFICE_URL}/programmes/${programmeId}`

  const reloadInvited = useCallback(() => {
    notificationsApi.byProgramme(programmeId)
      .then((r) => setInvited(new Set((r.data ?? []).map((i: any) => norm(i.recipientEmail || '')))))
      .catch(() => {})
  }, [programmeId])

  useEffect(() => {
    let cancelled = false
    Promise.allSettled([
      candidaturesApi.byProgramme(programmeId),
      usersApi.list(),
      notificationsApi.byProgramme(programmeId),
    ]).then(async ([c, u, inv]) => {
      if (cancelled) return
      const list: Cand[] = c.status === 'fulfilled' ? (c.value.data ?? []) : []
      setCands(list)
      if (u.status === 'fulfilled') setUsers(u.value.data?.content ?? u.value.data ?? [])
      if (inv.status === 'fulfilled') setInvited(new Set((inv.value.data ?? []).map((i: any) => norm(i.recipientEmail || ''))))
      const orgIds = Array.from(new Set(list.map((x) => x.organizationId).filter((x): x is number => !!x)))
      const res = await Promise.allSettled(orgIds.map((id) => organizationsApi.get(id)))
      if (cancelled) return
      const map: Record<number, Org> = {}
      res.forEach((x, i) => { if (x.status === 'fulfilled') map[orgIds[i]] = x.value.data })
      setOrgs(map)
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [programmeId])

  const registeredEmails = useMemo(() => new Set(users.map((u) => norm(u.email || ''))), [users])

  // ── (2) Associated people ──────────────────────────────────────────────────
  const orgGroups = useMemo(() => {
    const m = new Map<number, { id: number; name: string; people: Person[] }>()
    for (const c of cands) {
      if (!c.organizationId) continue
      const org = orgs[c.organizationId]
      const name = org?.name || c.companyName || c.projectName || `Organisation #${c.organizationId}`
      if (!m.has(c.organizationId)) m.set(c.organizationId, { id: c.organizationId, name, people: [] })
      const g = m.get(c.organizationId)!
      if (isEmail(c.porteurEmail)) g.people.push({ email: c.porteurEmail!.trim(), name: c.porteurName, role: 'porteur', orgId: c.organizationId, orgName: name })
      for (const mem of org?.members ?? []) if (isEmail(mem.email)) g.people.push({ email: mem.email!.trim(), name: mem.name, role: 'member', orgId: c.organizationId, orgName: name })
    }
    // Dedupe people within each org by email.
    for (const g of m.values()) {
      const seen = new Map<string, Person>()
      for (const p of g.people) if (!seen.has(norm(p.email))) seen.set(norm(p.email), p)
      g.people = Array.from(seen.values())
    }
    return Array.from(m.values())
  }, [cands, orgs])

  const jurys = useMemo(() => {
    const seen = new Map<string, Person>()
    for (const c of cands)
      for (const a of c.juryAssignments ?? [])
        if (isEmail(a.juryEmail) && !seen.has(norm(a.juryEmail!))) seen.set(norm(a.juryEmail!), { email: a.juryEmail!.trim(), name: a.juryName, role: 'jury' })
    return Array.from(seen.values())
  }, [cands])

  const associatedCount = orgGroups.reduce((n, g) => n + g.people.length, 0) + jurys.length

  // ── Selection helpers (parts 2/3 feed part 4) ───────────────────────────────
  const isSel = (email: string) => selected.has(norm(email))
  const toggle = (p: Person) => setSelected((prev) => {
    const n = new Map(prev); const k = norm(p.email)
    n.has(k) ? n.delete(k) : n.set(k, { ...p, registered: registeredEmails.has(k) })
    return n
  })
  const addAllAssociated = () => setSelected((prev) => {
    const n = new Map(prev)
    for (const g of orgGroups) for (const p of g.people) n.set(norm(p.email), { ...p, registered: registeredEmails.has(norm(p.email)) })
    for (const p of jurys) n.set(norm(p.email), { ...p, registered: registeredEmails.has(norm(p.email)) })
    return n
  })

  const userResults = useMemo(() => {
    const q = userSearch.trim().toLowerCase()
    return users
      .filter((u) => isEmail(u.email))
      .filter((u) => !q || `${u.firstName ?? ''} ${u.lastName ?? ''} ${u.email}`.toLowerCase().includes(q))
      .slice(0, 40)
  }, [users, userSearch])

  const addUser = (u: User) => {
    const role: Role = (u.role || '').toUpperCase() === 'JURY' ? 'jury' : (u.role || '').toUpperCase() === 'PORTEUR' ? 'porteur' : 'invite'
    setSelected((prev) => new Map(prev).set(norm(u.email!), {
      email: u.email!.trim(), name: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email, role, registered: true,
    }))
  }
  const addByEmail = () => {
    if (!isEmail(newEmail)) { toast.error('Adresse email invalide'); return }
    setSelected((prev) => new Map(prev).set(norm(newEmail), {
      email: newEmail.trim(), name: newName.trim() || undefined, role: 'invite', registered: registeredEmails.has(norm(newEmail)),
    }))
    setNewEmail(''); setNewName('')
  }

  const chosen = Array.from(selected.values())
  const previewPerson = chosen[0] ?? { email: 'exemple@medianet.tn', name: 'Sara', role: 'invite' as Role }
  const previewBody = fill(body, {
    nom: previewPerson.name || previewPerson.email, programme: programmeName,
    role: ROLE_META[previewPerson.role].label, lien: trackingLink,
  })

  const send = async () => {
    if (chosen.length === 0) { toast.error('Sélectionnez au moins une personne.'); return }
    setSending(true)
    try {
      const items = chosen.map((p) => {
        const v = { nom: p.name || p.email, programme: programmeName, role: ROLE_META[p.role].label, lien: trackingLink }
        return {
          type: p.role,
          subject: fill(subject, v),
          body: inviteHtml(fill(body, v), trackingLink),
          recipients: [{ email: p.email, name: p.name }],
        }
      })
      const r = await notificationsApi.sessionNotify({ programmeId, programmeName, phaseId: null, phaseName: programmeName, items })
      const sent = (r.data ?? []).filter((x: any) => x.status === 'SENT').length
      const failed = (r.data ?? []).filter((x: any) => x.status === 'FAILED').length
      toast.success(`${sent} invitation(s) envoyée(s)${failed ? ` · ${failed} échec(s)` : ''}`)
      setSelected(new Map())
      reloadInvited()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Échec de l'envoi")
    } finally { setSending(false) }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* ── LEFT: associated people (2) + add (3) ── */}
      <div className="space-y-4 lg:col-span-2">
        <MagicCard className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-semibold text-foreground">
              <Users className="h-4 w-4 text-brand-500" />Personnes associées
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{associatedCount}</span>
            </h3>
            {associatedCount > 0 && (
              <button onClick={addAllAssociated} className="inline-flex items-center gap-1 rounded-md border border-brand-500/40 px-2.5 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-500/10 dark:text-brand-300">
                <Plus className="h-3.5 w-3.5" />Tout sélectionner
              </button>
            )}
          </div>

          {!hasCandidatureSession && (
            <p className="mb-3 rounded-lg border border-amber-300/40 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
              Aucune session « Candidature » — l'affichage par organisation s'active dès qu'une session de candidature existe.
            </p>
          )}

          {associatedCount === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
              Personne n'est encore associé à ce programme.
            </p>
          ) : (
            <div className="space-y-3">
              {orgGroups.map((g) => (
                <div key={g.id} className="rounded-xl border border-border">
                  <div className="flex items-center gap-2 rounded-t-xl bg-muted/30 px-3 py-2">
                    <Building2 className="h-3.5 w-3.5 text-emerald-600" />
                    <Link href={`/organizations/${g.id}`} className="truncate text-xs font-bold text-foreground hover:text-brand-600 hover:underline dark:hover:text-brand-400">{g.name}</Link>
                    <span className="ml-auto text-[10px] text-muted-foreground">{g.people.length}</span>
                  </div>
                  <ul className="divide-y divide-border">
                    {g.people.map((p) => <PersonRow key={p.email} p={p} registered={registeredEmails.has(norm(p.email))} invited={invited.has(norm(p.email))} selected={isSel(p.email)} onToggle={() => toggle(p)} />)}
                  </ul>
                </div>
              ))}
              {jurys.length > 0 && (
                <div className="rounded-xl border border-border">
                  <div className="flex items-center gap-2 rounded-t-xl bg-muted/30 px-3 py-2">
                    <Gavel className="h-3.5 w-3.5 text-amber-600" />
                    <span className="text-xs font-bold text-foreground">Jury du programme</span>
                    <span className="ml-auto text-[10px] text-muted-foreground">{jurys.length}</span>
                  </div>
                  <ul className="divide-y divide-border">
                    {jurys.map((p) => <PersonRow key={p.email} p={p} registered={registeredEmails.has(norm(p.email))} invited={invited.has(norm(p.email))} selected={isSel(p.email)} onToggle={() => toggle(p)} />)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </MagicCard>

        {/* (3) Add new people */}
        <MagicCard className="p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
            <UserPlus className="h-4 w-4 text-brand-500" />Ajouter des personnes
          </h3>

          {/* By email (registered or not) */}
          <div className="mb-4 flex flex-wrap items-end gap-2">
            <div className="min-w-[180px] flex-1">
              <label className="text-[10px] font-semibold text-muted-foreground">Email</label>
              <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="personne@email.com"
                onKeyDown={(e) => { if (e.key === 'Enter') addByEmail() }}
                className="mt-0.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div className="min-w-[140px] flex-1">
              <label className="text-[10px] font-semibold text-muted-foreground">Nom (optionnel)</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nom"
                onKeyDown={(e) => { if (e.key === 'Enter') addByEmail() }}
                className="mt-0.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <button onClick={addByEmail} className="inline-flex items-center gap-1.5 rounded-lg border border-brand-500 bg-brand-500 px-3 py-2 text-xs font-bold text-white hover:bg-brand-600">
              <Plus className="h-3.5 w-3.5" />Ajouter
            </button>
          </div>

          {/* Registered users */}
          <label className="text-[10px] font-semibold text-muted-foreground">Comptes existants sur la plateforme</label>
          <div className="relative mt-0.5 mb-2">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Rechercher un utilisateur…"
              className="w-full rounded-lg border border-input bg-background pl-8 pr-3 py-2 text-sm" />
          </div>
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {userResults.length === 0 && <p className="px-1 text-[11px] italic text-muted-foreground">Aucun utilisateur.</p>}
            {userResults.map((u) => {
              const sel = isSel(u.email!)
              return (
                <button key={u.id} onClick={() => addUser(u)}
                  className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors ${sel ? 'border-brand-500 bg-brand-500/10' : 'border-border hover:bg-accent/40'}`}>
                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded ${sel ? 'bg-brand-500 text-white' : 'border border-border'}`}>{sel && <Check className="h-3 w-3" />}</span>
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium text-foreground">{`${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email}</span>
                    <span className="text-muted-foreground"> · {u.email}</span>
                  </span>
                  {u.role && <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">{u.role}</span>}
                  <span className="shrink-0 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600">Inscrit</span>
                </button>
              )
            })}
          </div>
        </MagicCard>
      </div>

      {/* ── RIGHT: invitation template + preview + send (4) ── */}
      <div className="space-y-4">
        <MagicCard className="p-5">
          <h3 className="mb-1 flex items-center gap-2 font-semibold text-foreground">
            <Mail className="h-4 w-4 text-brand-500" />Email d'invitation
          </h3>
          <p className="mb-3 text-[11px] text-muted-foreground">
            {selected.size} destinataire(s) sélectionné(s) · lien de suivi inclus
          </p>

          <label className="text-[10px] font-semibold text-muted-foreground">Objet</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)}
            className="mb-2 mt-0.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          <label className="text-[10px] font-semibold text-muted-foreground">Message</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={7}
            className="mb-2 mt-0.5 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-xs" />

          {/* Placeholders */}
          <div className="mb-3 rounded-lg border border-border bg-muted/20 p-2">
            <p className="mb-1 text-[10px] font-bold text-muted-foreground">Variables disponibles</p>
            <div className="flex flex-wrap gap-1">
              {PLACEHOLDERS.map((ph) => (
                <button key={ph.token} title={ph.desc} onClick={() => setBody((b) => b + ph.token)}
                  className="rounded-full bg-brand-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-brand-700 hover:bg-brand-500/20 dark:text-brand-300">
                  {ph.token}
                </button>
              ))}
            </div>
            <p className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <ExternalLink className="h-3 w-3" /><span className="font-mono">{trackingLink}</span>
            </p>
          </div>

          <label className="text-[10px] font-semibold text-muted-foreground">Aperçu {chosen[0] ? `(${previewPerson.name || previewPerson.email})` : '(exemple)'}</label>
          <div className="mt-0.5 max-h-72 overflow-y-auto rounded-lg border border-border bg-[#f4f6f8] p-2">
            <div dangerouslySetInnerHTML={{ __html: inviteHtml(previewBody, trackingLink) }} />
          </div>

          <button onClick={send} disabled={sending || selected.size === 0}
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-brand-500 bg-brand-500 px-4 py-2 text-sm font-bold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? 'Envoi…' : `Envoyer (${selected.size})`}
          </button>
        </MagicCard>

        {selected.size > 0 && (
          <MagicCard className="p-4">
            <p className="mb-2 text-[11px] font-bold text-muted-foreground">Sélection</p>
            <div className="space-y-1">
              {chosen.map((p) => {
                const M = ROLE_META[p.role]
                return (
                  <div key={p.email} className="flex items-center gap-2 text-xs">
                    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${M.cls}`}><M.icon className="h-2.5 w-2.5" />{M.label}</span>
                    <span className="min-w-0 flex-1 truncate text-foreground">{p.name || p.email}</span>
                    <button onClick={() => toggle(p)} className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                  </div>
                )
              })}
            </div>
          </MagicCard>
        )}
      </div>
    </div>
  )
}

function PersonRow({ p, registered, invited, selected, onToggle }: {
  p: Person; registered: boolean; invited: boolean; selected: boolean; onToggle: () => void
}) {
  const M = ROLE_META[p.role]
  return (
    <li>
      <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-accent/40">
        <input type="checkbox" checked={selected} onChange={onToggle} className="h-3.5 w-3.5 accent-brand-500" />
        <M.icon className={`h-3.5 w-3.5 ${M.cls.split(' ').slice(1).join(' ')}`} />
        <span className="min-w-0 flex-1 truncate text-xs">
          {p.name ? <span className="font-medium text-foreground">{p.name} · </span> : null}
          <span className="text-muted-foreground">{p.email}</span>
        </span>
        {invited && <span className="shrink-0 inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600" title="Déjà invité"><CheckCircle2 className="h-2.5 w-2.5" />Invité</span>}
        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${registered ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>{registered ? 'Inscrit' : 'Hors plateforme'}</span>
      </label>
    </li>
  )
}
