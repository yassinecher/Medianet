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
import { useCallback, useEffect, useState } from 'react'
import { Users, Mail, Plus, Trash2, Send, X, Loader2, Check, Pencil } from 'lucide-react'
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

interface Contact { id: number; name: string; email: string; organization?: string; tag?: string }
interface Group { id: number; name: string; color?: string; contactIds: number[] }

export function InvitationsPanel({ programmeId }: { programmeId: number }) {
  const [tab, setTab] = useState<'invitations' | 'contacts'>('invitations')
  const [invites, setInvites] = useState<any[]>([])
  const [stats, setStats]     = useState<Record<string, number>>({})
  const [contacts, setContacts] = useState<Contact[]>([])
  const [groups, setGroups]     = useState<Group[]>([])

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

  return (
    <div className="space-y-4">
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

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-border">
        {(['invitations', 'contacts'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t === 'invitations' ? `Invitations (${invites.length})` : `Contacts & groupes (${contacts.length})`}
          </button>
        ))}
      </div>

      {tab === 'invitations' ? (
        <div className="space-y-2">
          {invites.length === 0 && (
            <div className="rounded-xl border-2 border-dashed border-border bg-muted/10 p-8 text-center text-sm text-muted-foreground">
              Aucune invitation pour ce programme. Invitez des participants depuis une activité du Parcours.
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
