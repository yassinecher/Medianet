'use client'
/**
 * Programme dashboard → « Invitations » tab.
 *
 * Two areas:
 *  • Invitations: this programme's invitations with live RSVP status
 *    (accepted = "inscrit"), resend / cancel. Stats up top.
 *  • Contacts & Groupes: the managed contact list (address-book + mailing groups)
 *    reused as invitees across activities/sessions.
 *
 * All powered by the existing notification-service.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Users, Mail, Plus, Trash2, Send, X, Loader2, Check, Pencil, UserPlus, Lock, BellRing } from 'lucide-react'
import toast from 'react-hot-toast'
import { notificationsApi, contactsApi, contactGroupsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const SWATCHES = ['#0EA5E9', '#6366F1', '#A855F7', '#EC4899', '#EF4444', '#F97316', '#F59E0B', '#10B981', '#14B8A6', '#64748B']

const STATUS: Record<string, { label: string; cls: string }> = {
  ACCEPTED: { label: 'Inscrit',    cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300/40' },
  DECLINED: { label: 'Décliné',    cls: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-300/40' },
  SENT:     { label: 'En attente', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300/40' },
  PENDING:  { label: 'En attente', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300/40' },
  FAILED:   { label: 'Échec',      cls: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-300/40' },
}

const TYPE_LABEL: Record<string, string> = {
  JURY: 'Jury', PORTEUR: 'Porteur', MEMBER: 'Membre', ORGANISATEUR: 'Organisateur',
  GUEST: 'Invité', MENTOR: 'Mentor', GENERAL: 'Général',
}

/** Every invitation type, in the order they appear in the composer, with a short
 *  purpose line and a sensible default subject/body. RSVP defaults to true for
 *  types that imply a personal commitment (jury, porteur, mentor, organisateur). */
const INVITE_TYPES: { value: string; label: string; blurb: string; rsvp: boolean; icon: string }[] = [
  { value: 'PORTEUR',      label: 'Porteur',      blurb: 'Fondateur convié à rejoindre / candidater', rsvp: true,  icon: '🚀' },
  { value: 'JURY',         label: 'Jury',         blurb: 'Évalue les candidatures du programme',       rsvp: true,  icon: '⚖️' },
  { value: 'MENTOR',       label: 'Mentor',       blurb: 'Accompagne les porteurs',                    rsvp: true,  icon: '🎓' },
  { value: 'ORGANISATEUR', label: 'Organisateur', blurb: 'Co-anime / gère une session',                rsvp: true,  icon: '🗂️' },
  { value: 'MEMBER',       label: 'Membre',       blurb: 'Membre d’une équipe / organisation',         rsvp: false, icon: '👥' },
  { value: 'GUEST',        label: 'Invité',       blurb: 'Observateur, partenaire ou externe',         rsvp: false, icon: '✨' },
  { value: 'GENERAL',      label: 'Général',      blurb: 'Annonce simple — sans réponse attendue',     rsvp: false, icon: '📣' },
]

/** Default subject + message for a type. Supports {{name}} and {{programme}}
 *  placeholders, substituted per-recipient at send time. */
function defaultTemplate(type: string, programme: string): { subject: string; message: string } {
  const p = programme || 'notre programme'
  switch (type) {
    case 'PORTEUR': return {
      subject: `Invitation à rejoindre « ${p} »`,
      message: `Bonjour {{name}},\n\nNous avons le plaisir de vous inviter à rejoindre le programme « {{programme}} ». Cliquez sur le lien ci-dessous pour découvrir le programme et déposer votre candidature.\n\nAu plaisir de vous compter parmi nous,\nL’équipe Medianet` }
    case 'JURY': return {
      subject: `Vous êtes convié·e comme jury — « ${p} »`,
      message: `Bonjour {{name}},\n\nNous serions honorés de vous compter parmi le jury de « {{programme}} ». Votre expertise nous aiderait à évaluer les candidatures. Merci de confirmer votre participation via le lien ci-dessous.\n\nBien à vous,\nL’équipe Medianet` }
    case 'MENTOR': return {
      subject: `Invitation mentor — « ${p} »`,
      message: `Bonjour {{name}},\n\nNous aimerions vous inviter à accompagner les porteurs de « {{programme}} » en tant que mentor. Confirmez votre disponibilité via le lien ci-dessous.\n\nMerci,\nL’équipe Medianet` }
    case 'ORGANISATEUR': return {
      subject: `Organisation — « ${p} »`,
      message: `Bonjour {{name}},\n\nVous êtes convié·e à co-organiser « {{programme}} ». Merci de confirmer via le lien ci-dessous.\n\nL’équipe Medianet` }
    case 'MEMBER': return {
      subject: `Vous faites partie de « ${p} »`,
      message: `Bonjour {{name}},\n\nVous avez été ajouté·e comme membre de « {{programme}} ». Vous pouvez accéder au programme via le lien ci-dessous.\n\nL’équipe Medianet` }
    case 'GUEST': return {
      subject: `Invitation — « ${p} »`,
      message: `Bonjour {{name}},\n\nNous vous invitons à « {{programme}} » en tant qu’invité·e. Retrouvez toutes les informations via le lien ci-dessous.\n\nL’équipe Medianet` }
    default: return {
      subject: `À propos de « ${p} »`,
      message: `Bonjour {{name}},\n\nUne information concernant « {{programme}} ».\n\nL’équipe Medianet` }
  }
}

interface Contact { id: number; name: string; email: string; organization?: string; tag?: string }
interface Group { id: number; name: string; color?: string; contactIds: number[] }
interface Recipient { email: string; name: string }

export function InvitationsPanel({ programmeId, programmeName = 'Programme', programmeType }: {
  programmeId: number
  programmeName?: string
  programmeType?: string
}) {
  const [tab, setTab] = useState<'invitations' | 'contacts'>('invitations')
  const [invites, setInvites] = useState<any[]>([])
  const [stats, setStats]     = useState<Record<string, number>>({})
  const [contacts, setContacts] = useState<Contact[]>([])
  const [groups, setGroups]     = useState<Group[]>([])
  const [composing, setComposing] = useState(false)

  const reload = useCallback(async () => {
    try { const r = await notificationsApi.byProgramme(programmeId); setInvites(r.data ?? []) } catch { /* */ }
    try { const r = await notificationsApi.programmeStats(programmeId); setStats(r.data ?? {}) } catch { /* */ }
  }, [programmeId])
  const reloadContacts = useCallback(async () => {
    try { const r = await contactsApi.list(); setContacts(r.data ?? []) } catch { /* */ }
  }, [])
  const reloadGroups = useCallback(async () => {
    try { const r = await contactGroupsApi.list(); setGroups(r.data ?? []) } catch { /* */ }
  }, [])
  useEffect(() => { reload(); reloadContacts(); reloadGroups() }, [reload, reloadContacts, reloadGroups])

  const resend = async (id: number) => { try { await notificationsApi.resend(id); reload() } catch { toast.error('Erreur') } }
  const cancel = async (id: number) => { if (!confirm('Annuler cette invitation ?')) return; try { await notificationsApi.cancel(id); reload() } catch { toast.error('Erreur') } }

  const isPrivate = programmeType === 'PRIVATE'

  return (
    <div className="space-y-4">
      {/* Private programmes rely on invitations for access — make that explicit. */}
      {isPrivate && (
        <div className="flex items-start gap-2 rounded-xl border border-violet-500/30 bg-violet-500/5 p-3">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
          <p className="text-[12px] text-violet-800 dark:text-violet-200">
            <b>Programme privé.</b> Il n’apparaît pas dans le catalogue public : seules les personnes que vous invitez
            ici peuvent le voir et le rejoindre. Invitez des porteurs pour leur en ouvrir l’accès.
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          ['Total', stats.total ?? 0, 'text-foreground'],
          ['Inscrits', stats.accepted ?? 0, 'text-emerald-600'],
          ['En attente', stats.sent ?? 0, 'text-amber-600'],
          ['Déclinés', stats.declined ?? 0, 'text-rose-600'],
        ].map(([label, n, cls]) => (
          <div key={label as string} className="rounded-xl border border-border bg-card p-3">
            <p className={`text-2xl font-bold ${cls}`}>{n as number}</p>
            <p className="text-[11px] text-muted-foreground">{label as string}</p>
          </div>
        ))}
      </div>

      {/* Sub-tabs + compose CTA */}
      <div className="flex items-center gap-1 border-b border-border">
        {(['invitations', 'contacts'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t === 'invitations' ? `Invitations (${invites.length})` : `Contacts & groupes (${contacts.length})`}
          </button>
        ))}
        {tab === 'invitations' && (
          <Button size="sm" variant={composing ? 'outline' : 'brand'} className="ml-auto gap-1.5"
            onClick={() => setComposing(v => !v)}>
            {composing ? <X className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
            {composing ? 'Fermer' : 'Inviter'}
          </Button>
        )}
      </div>

      {tab === 'invitations' ? (
        <div className="space-y-2">
          {composing && (
            <Composer
              programmeId={programmeId} programmeName={programmeName}
              contacts={contacts} groups={groups}
              onSent={() => { setComposing(false); reload() }}
              onCancel={() => setComposing(false)} />
          )}
          {invites.length === 0 && !composing && (
            <div className="rounded-xl border-2 border-dashed border-border bg-muted/10 p-8 text-center text-sm text-muted-foreground">
              Aucune invitation pour ce programme.{' '}
              <button onClick={() => setComposing(true)} className="font-medium text-brand-600 hover:underline dark:text-brand-400">
                Invitez des participants
              </button>{' '}ou conviez-les depuis une activité du Parcours.
            </div>
          )}
          {invites.map(i => {
            const m = STATUS[i.status] ?? STATUS.PENDING
            const ctx = [i.phaseName, i.activityName].filter(Boolean).join(' · ')
            return (
              <div key={i.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{i.recipientName || i.recipientEmail}</p>
                  {i.subject && <p className="text-[11px] text-foreground/70 truncate">{i.subject}</p>}
                  <p className="text-[11px] text-muted-foreground truncate">
                    {i.recipientEmail}{ctx && ` · ${ctx}`}{i.sentAt && ` · ${new Date(i.sentAt).toLocaleDateString('fr-FR')}`}
                  </p>
                </div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground shrink-0">{TYPE_LABEL[i.type] ?? i.type}</span>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold shrink-0 ${m.cls}`}>{m.label}</span>
                {i.status !== 'ACCEPTED' && i.status !== 'DECLINED' && (
                  <button onClick={() => resend(i.id)} title="Renvoyer" className="text-muted-foreground hover:text-foreground shrink-0"><Send className="h-4 w-4" /></button>
                )}
                <button onClick={() => cancel(i.id)} title="Annuler" className="text-muted-foreground hover:text-destructive shrink-0"><Trash2 className="h-4 w-4" /></button>
              </div>
            )
          })}
        </div>
      ) : (
        <ContactsManager
          contacts={contacts} groups={groups}
          onContactsChanged={reloadContacts} onGroupsChanged={reloadGroups} />
      )}
    </div>
  )
}

// ── Invitation composer ─────────────────────────────────────────────────────

function Composer({ programmeId, programmeName, contacts, groups, onSent, onCancel }: {
  programmeId: number
  programmeName: string
  contacts: Contact[]
  groups: Group[]
  onSent: () => void
  onCancel: () => void
}) {
  const [type, setType] = useState('PORTEUR')
  const tpl = useMemo(() => defaultTemplate(type, programmeName), [type, programmeName])
  const [subject, setSubject] = useState(tpl.subject)
  const [message, setMessage] = useState(tpl.message)
  const [edited, setEdited] = useState(false)      // did the user hand-edit subject/message?
  const [rsvp, setRsvp] = useState(true)
  const [rsvpTouched, setRsvpTouched] = useState(false)
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [emailIn, setEmailIn] = useState('')
  const [nameIn, setNameIn] = useState('')
  const [showBook, setShowBook] = useState(false)
  const [sending, setSending] = useState(false)

  // When the type changes, refresh the untouched template + default RSVP.
  const pickType = (t: string) => {
    setType(t)
    const meta = INVITE_TYPES.find(x => x.value === t)
    if (!edited) { const d = defaultTemplate(t, programmeName); setSubject(d.subject); setMessage(d.message) }
    if (!rsvpTouched && meta) setRsvp(meta.rsvp)
  }

  const addRecipient = (email: string, name: string) => {
    const e = email.trim().toLowerCase()
    if (!e || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { toast.error('Email invalide'); return false }
    setRecipients(rs => rs.some(r => r.email.toLowerCase() === e) ? rs : [...rs, { email: e, name: name.trim() }])
    return true
  }
  const addManual = () => { if (addRecipient(emailIn, nameIn)) { setEmailIn(''); setNameIn('') } }
  const addContact = (c: Contact) => addRecipient(c.email, c.name)
  const addGroup = (g: Group) => {
    const members = contacts.filter(c => (g.contactIds ?? []).includes(c.id))
    if (members.length === 0) { toast.error('Groupe vide'); return }
    let added = 0
    setRecipients(rs => {
      const seen = new Set(rs.map(r => r.email.toLowerCase()))
      const next = [...rs]
      for (const c of members) {
        const e = c.email.toLowerCase()
        if (!seen.has(e)) { seen.add(e); next.push({ email: c.email.toLowerCase(), name: c.name }); added++ }
      }
      return next
    })
    toast.success(`${added} destinataire(s) ajouté(s)`)
  }
  const removeRecipient = (email: string) => setRecipients(rs => rs.filter(r => r.email !== email))

  const fill = (t: string, r: Recipient) =>
    t.replace(/\{\{\s*name\s*\}\}/gi, r.name || r.email.split('@')[0])
     .replace(/\{\{\s*programme\s*\}\}/gi, programmeName)

  const send = async () => {
    if (recipients.length === 0) { toast.error('Ajoutez au moins un destinataire'); return }
    if (!subject.trim() || !message.trim()) { toast.error('Objet et message requis'); return }
    setSending(true)
    // One tracked invitation per recipient → personal {{name}} + individual resend/cancel.
    const results = await Promise.allSettled(recipients.map(r =>
      notificationsApi.create({
        type, programmeId, programmeName,
        recipientEmail: r.email, recipientName: r.name || undefined,
        subject: fill(subject, r), message: fill(message, r),
        requiresRsvp: rsvp,
      })))
    setSending(false)
    const ok = results.filter(x => x.status === 'fulfilled').length
    const failed = results.length - ok
    if (ok) toast.success(`${ok} invitation(s) envoyée(s)${failed ? ` · ${failed} échec(s)` : ''}`)
    if (ok === 0) toast.error('Aucune invitation envoyée')
    if (ok) onSent()
  }

  return (
    <div className="rounded-xl border-2 border-brand-500/40 bg-brand-500/5 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <BellRing className="h-4 w-4 text-brand-500" />
        <h3 className="text-sm font-bold text-foreground">Nouvelle invitation</h3>
      </div>

      {/* Type */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Type d’invitation</label>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {INVITE_TYPES.map(t => {
            const on = type === t.value
            return (
              <button key={t.value} type="button" onClick={() => pickType(t.value)}
                title={t.blurb}
                className={`rounded-lg border p-2 text-left transition-colors ${on ? 'border-brand-500 bg-brand-500/10' : 'border-border hover:border-brand-400'}`}>
                <p className="text-xs font-semibold text-foreground">{t.icon} {t.label}</p>
                <p className="text-[10px] leading-tight text-muted-foreground line-clamp-2">{t.blurb}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Recipients */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-muted-foreground">Destinataires ({recipients.length})</label>
        {recipients.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {recipients.map(r => (
              <span key={r.email} className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[11px]">
                <span className="font-medium">{r.name || r.email}</span>
                {r.name && <span className="text-muted-foreground">· {r.email}</span>}
                <button onClick={() => removeRecipient(r.email)} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
        )}
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[1fr_1fr_auto]">
          <Input value={emailIn} onChange={e => setEmailIn(e.target.value)} placeholder="email@exemple.com" className="h-8 text-sm"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addManual() } }} />
          <Input value={nameIn} onChange={e => setNameIn(e.target.value)} placeholder="Nom (optionnel)" className="h-8 text-sm"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addManual() } }} />
          <Button size="sm" variant="outline" onClick={addManual} className="h-8 gap-1"><Plus className="h-3.5 w-3.5" />Ajouter</Button>
        </div>
        <button type="button" onClick={() => setShowBook(v => !v)}
          className="text-[11px] font-medium text-brand-600 hover:underline dark:text-brand-400">
          {showBook ? 'Masquer' : 'Choisir depuis les contacts / groupes'}
        </button>
        {showBook && (
          <div className="grid gap-2 rounded-lg border border-border bg-card p-2 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Contacts</p>
              <div className="max-h-36 space-y-0.5 overflow-y-auto">
                {contacts.map(c => (
                  <button key={c.id} onClick={() => addContact(c)}
                    className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs hover:bg-accent">
                    <Plus className="h-3 w-3 text-muted-foreground" /><span className="truncate">{c.name}</span>
                    <span className="truncate text-[10px] text-muted-foreground">{c.email}</span>
                  </button>
                ))}
                {contacts.length === 0 && <p className="px-1 text-[11px] italic text-muted-foreground">Aucun contact.</p>}
              </div>
            </div>
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Groupes</p>
              <div className="max-h-36 space-y-0.5 overflow-y-auto">
                {groups.map(g => (
                  <button key={g.id} onClick={() => addGroup(g)}
                    className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs hover:bg-accent">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: g.color || '#10B981' }} />
                    <span className="truncate">{g.name}</span>
                    <span className="text-[10px] text-muted-foreground">{(g.contactIds ?? []).length}</span>
                  </button>
                ))}
                {groups.length === 0 && <p className="px-1 text-[11px] italic text-muted-foreground">Aucun groupe.</p>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Subject + message */}
      <div className="space-y-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Objet</label>
          <Input value={subject} onChange={e => { setSubject(e.target.value); setEdited(true) }} className="h-8 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Message</label>
          <textarea value={message} onChange={e => { setMessage(e.target.value); setEdited(true) }} rows={7}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm leading-relaxed" />
          <p className="mt-1 text-[10px] text-muted-foreground">
            Variables : <code className="rounded bg-muted px-1">{'{{name}}'}</code> (nom du destinataire) ·{' '}
            <code className="rounded bg-muted px-1">{'{{programme}}'}</code> (nom du programme).
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-foreground">
          <input type="checkbox" checked={rsvp} onChange={e => { setRsvp(e.target.checked); setRsvpTouched(true) }}
            className="h-3.5 w-3.5 rounded border-border" />
          Inclure les liens <b>Accepter / Décliner</b> dans l’email (RSVP)
        </label>
      </div>

      <div className="flex justify-end gap-2 border-t border-border pt-3">
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={sending}>Annuler</Button>
        <Button size="sm" variant="brand" onClick={send} disabled={sending || recipients.length === 0} className="gap-1.5">
          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Envoyer {recipients.length > 0 && `(${recipients.length})`}
        </Button>
      </div>
    </div>
  )
}

// ── Contacts & groups management ────────────────────────────────────────────

function ContactsManager({ contacts, groups, onContactsChanged, onGroupsChanged }: {
  contacts: Contact[]
  groups: Group[]
  onContactsChanged: () => void
  onGroupsChanged: () => void
}) {
  const [form, setForm] = useState<{ id?: number; name: string; email: string; organization: string; tag: string }>({ name: '', email: '', organization: '', tag: '' })
  const [groupForm, setGroupForm] = useState<{ id?: number; name: string; color: string; contactIds: number[] } | null>(null)
  const [busy, setBusy] = useState(false)

  const saveContact = async () => {
    if (!form.name.trim() || !form.email.trim()) { toast.error('Nom et email requis'); return }
    setBusy(true)
    try {
      if (form.id) await contactsApi.update(form.id, form)
      else await contactsApi.create(form)
      setForm({ name: '', email: '', organization: '', tag: '' })
      onContactsChanged()
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Erreur') }
    finally { setBusy(false) }
  }
  const delContact = async (id: number) => { if (!confirm('Supprimer ce contact ?')) return; try { await contactsApi.delete(id); onContactsChanged() } catch { toast.error('Erreur') } }

  const saveGroup = async () => {
    if (!groupForm || !groupForm.name.trim()) { toast.error('Nom du groupe requis'); return }
    setBusy(true)
    try {
      if (groupForm.id) await contactGroupsApi.update(groupForm.id, groupForm)
      else await contactGroupsApi.create(groupForm)
      setGroupForm(null)
      onGroupsChanged()
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Erreur') }
    finally { setBusy(false) }
  }
  const delGroup = async (id: number) => { if (!confirm('Supprimer ce groupe ?')) return; try { await contactGroupsApi.delete(id); onGroupsChanged() } catch { toast.error('Erreur') } }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Contacts */}
      <div className="rounded-xl border border-border bg-card p-3 space-y-3">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5"><Users className="h-4 w-4 text-brand-500" />Contacts</h3>
        {/* add/edit form */}
        <div className="grid grid-cols-2 gap-2">
          <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nom" className="h-8 text-sm" />
          <Input value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Email" className="h-8 text-sm" />
          <Input value={form.organization} onChange={(e) => setForm(f => ({ ...f, organization: e.target.value }))} placeholder="Organisation" className="h-8 text-sm" />
          <Input value={form.tag} onChange={(e) => setForm(f => ({ ...f, tag: e.target.value }))} placeholder="Étiquette" className="h-8 text-sm" />
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={saveContact} disabled={busy} className="gap-1">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}{form.id ? 'Enregistrer' : 'Ajouter'}
          </Button>
          {form.id && <Button size="sm" variant="ghost" onClick={() => setForm({ name: '', email: '', organization: '', tag: '' })}>Annuler</Button>}
        </div>
        <div className="space-y-1 max-h-72 overflow-y-auto">
          {contacts.map(c => (
            <div key={c.id} className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{c.name} {c.tag && <span className="text-[10px] text-muted-foreground">· {c.tag}</span>}</p>
                <p className="text-[11px] text-muted-foreground truncate">{c.email}{c.organization && ` · ${c.organization}`}</p>
              </div>
              <button onClick={() => setForm({ id: c.id, name: c.name, email: c.email, organization: c.organization ?? '', tag: c.tag ?? '' })} className="text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
              <button onClick={() => delContact(c.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          {contacts.length === 0 && <p className="text-[11px] text-muted-foreground italic px-1">Aucun contact pour l&apos;instant.</p>}
        </div>
      </div>

      {/* Groups */}
      <div className="rounded-xl border border-border bg-card p-3 space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5"><Mail className="h-4 w-4 text-brand-500" />Groupes / listes</h3>
          <Button size="sm" variant="outline" className="ml-auto gap-1 h-7" onClick={() => setGroupForm({ name: '', color: SWATCHES[1], contactIds: [] })}>
            <Plus className="h-3.5 w-3.5" />Groupe
          </Button>
        </div>

        {groupForm && (
          <div className="rounded-lg border-2 border-brand-500/40 bg-brand-500/5 p-2 space-y-2">
            <div className="flex items-center gap-2">
              <Input value={groupForm.name} onChange={(e) => setGroupForm(g => g && ({ ...g, name: e.target.value }))} placeholder="Nom du groupe" className="h-8 text-sm flex-1" />
              <div className="flex gap-0.5">
                {SWATCHES.slice(0, 6).map(s => (
                  <button key={s} onClick={() => setGroupForm(g => g && ({ ...g, color: s }))}
                    className={`h-5 w-5 rounded-full ${groupForm.color === s ? 'ring-2 ring-offset-1 ring-foreground/50' : ''}`} style={{ background: s }} />
                ))}
              </div>
            </div>
            <div className="max-h-32 overflow-y-auto space-y-0.5">
              {contacts.map(c => {
                const on = groupForm.contactIds.includes(c.id)
                return (
                  <button key={c.id} onClick={() => setGroupForm(g => g && ({ ...g, contactIds: on ? g.contactIds.filter(x => x !== c.id) : [...g.contactIds, c.id] }))}
                    className="w-full flex items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-accent text-left">
                    <span className={`h-3.5 w-3.5 rounded border flex items-center justify-center ${on ? 'bg-brand-500 border-brand-500 text-white' : 'border-border'}`}>{on && <Check className="h-2.5 w-2.5" />}</span>
                    <span className="truncate">{c.name}</span><span className="text-[10px] text-muted-foreground truncate">{c.email}</span>
                  </button>
                )
              })}
              {contacts.length === 0 && <p className="text-[11px] text-muted-foreground italic px-1">Ajoutez d&apos;abord des contacts.</p>}
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={saveGroup} disabled={busy}>{groupForm.id ? 'Enregistrer' : 'Créer'}</Button>
              <Button size="sm" variant="ghost" onClick={() => setGroupForm(null)}>Annuler</Button>
            </div>
          </div>
        )}

        <div className="space-y-1 max-h-72 overflow-y-auto">
          {groups.map(g => (
            <div key={g.id} className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5 text-sm">
              <span className="h-3 w-3 rounded-full shrink-0" style={{ background: g.color || '#10B981' }} />
              <span className="font-semibold truncate flex-1">{g.name}</span>
              <span className="text-[11px] text-muted-foreground">{(g.contactIds ?? []).length} membre{(g.contactIds ?? []).length > 1 ? 's' : ''}</span>
              <button onClick={() => setGroupForm({ id: g.id, name: g.name, color: g.color ?? SWATCHES[1], contactIds: g.contactIds ?? [] })} className="text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
              <button onClick={() => delGroup(g.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          {groups.length === 0 && <p className="text-[11px] text-muted-foreground italic px-1">Aucun groupe.</p>}
        </div>
      </div>
    </div>
  )
}
