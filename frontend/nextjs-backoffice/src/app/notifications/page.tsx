'use client'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell, Plus, Send, Mail, Loader2, Trash2, RefreshCw, Users, Search,
  CheckCircle2, XCircle, Clock, AlertTriangle, Shield, Sparkles, Filter
} from 'lucide-react'
import toast from 'react-hot-toast'
import { notificationsApi, programmesApi } from '@/lib/api'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { MagicCard } from '@/components/magicui/magic-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { formatRelativeDate } from '@/lib/utils'
import type { Programme } from '@/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Invitation {
  id: number
  token: string
  type: 'JURY' | 'MENTOR' | 'PORTEUR' | 'ADMIN' | 'EVENT' | string
  status: 'PENDING' | 'SENT' | 'ACCEPTED' | 'DECLINED' | 'FAILED' | string
  programmeId?: number
  programmeName?: string
  phaseId?: number
  phaseName?: string
  recipientEmail: string
  recipientName?: string
  subject: string
  message?: string
  requiresRsvp?: boolean
  sentByAdminId?: number
  sentByAdminName?: string
  sentAt?: string
  errorMessage?: string
  createdAt?: string
}

interface Stats {
  total?: number
  pending?: number
  sent?: number
  accepted?: number
  declined?: number
  failed?: number
  type_jury?: number
  type_mentor?: number
  type_porteur?: number
  type_event?: number
  [k: string]: number | undefined
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPES = [
  { value: 'JURY',    label: 'Juré',    description: 'Invite à créer un compte Juré',  icon: Shield },
  { value: 'MENTOR',  label: 'Mentor',  description: 'Invite à créer un compte Mentor', icon: Sparkles },
  { value: 'PORTEUR', label: 'Porteur', description: 'Invite à créer un compte Porteur', icon: Users },
  { value: 'EVENT',   label: 'Événement', description: 'Invitation avec RSVP (Accepter / Décliner)', icon: Bell },
] as const

const STATUS_META: Record<string, { label: string; bg: string; icon: any }> = {
  PENDING:  { label: 'En attente', bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',  icon: Clock },
  SENT:     { label: 'Envoyée',    bg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',     icon: Send },
  ACCEPTED: { label: 'Acceptée',   bg: 'bg-green-500/10 text-green-600 dark:text-green-400',  icon: CheckCircle2 },
  DECLINED: { label: 'Refusée',    bg: 'bg-orange-500/10 text-orange-600 dark:text-orange-400', icon: XCircle },
  FAILED:   { label: 'Échec',      bg: 'bg-red-500/10 text-red-600 dark:text-red-400',         icon: AlertTriangle },
}

// ── Default templates per type ────────────────────────────────────────────────

const DEFAULT_TEMPLATES: Record<string, { subject: string; message: string }> = {
  JURY: {
    subject: 'Invitation à rejoindre le jury Medianet Incubateur',
    message: 'Bonjour,\n\nNous serions honorés que vous rejoigniez le jury de notre programme pour évaluer les candidatures et apporter votre expertise.\n\nEn cliquant sur "Créer mon compte", vous accéderez à un formulaire rapide pour finaliser votre inscription.\n\nBien à vous,\nL\'équipe Medianet',
  },
  MENTOR: {
    subject: 'Invitation à devenir Mentor — Medianet Incubateur',
    message: 'Bonjour,\n\nNous avons identifié votre profil comme un excellent atout pour accompagner nos porteurs de projets en tant que Mentor.\n\nFinalisez votre inscription pour commencer à mentorer.\n\nÀ très bientôt,\nL\'équipe Medianet',
  },
  PORTEUR: {
    subject: 'Invitation à candidater — Medianet Incubateur',
    message: 'Bonjour,\n\nNous vous invitons à candidater au programme. Créez votre compte porteur pour soumettre votre projet.\n\nBonne chance,\nL\'équipe Medianet',
  },
  EVENT: {
    subject: 'Invitation — Confirmez votre présence',
    message: 'Bonjour,\n\nVous êtes invité(e) à participer à notre événement. Merci de confirmer votre présence.\n\nÀ très bientôt,\nL\'équipe Medianet',
  },
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [programmes,  setProgrammes]  = useState<Programme[]>([])
  const [stats, setStats] = useState<Stats>({})
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'single' | 'bulk' | 'email'>('single')

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [typeFilter,   setTypeFilter]   = useState<string>('ALL')

  // ── Single-invite form
  const [single, setSingle] = useState({
    recipientEmail: '',
    recipientName: '',
    type: 'JURY',
    programmeId: '',
    subject: DEFAULT_TEMPLATES.JURY.subject,
    message: DEFAULT_TEMPLATES.JURY.message,
    requiresRsvp: false,
  })
  const [sendingSingle, setSendingSingle] = useState(false)

  // ── Bulk-invite form
  const [bulk, setBulk] = useState({
    emails: '',
    type: 'JURY',
    programmeId: '',
    subject: DEFAULT_TEMPLATES.JURY.subject,
    message: DEFAULT_TEMPLATES.JURY.message,
    requiresRsvp: false,
  })
  const [sendingBulk, setSendingBulk] = useState(false)

  // ── Email broadcast form
  const [email, setEmail] = useState({
    toEmails: '',
    subject: '',
    body: '',
    html: false,
  })
  const [sendingEmail, setSendingEmail] = useState(false)

  // ── Effects ─────────────────────────────────────────────────────────────
  const refresh = () => {
    Promise.allSettled([
      notificationsApi.list().then((r) => setInvitations(r.data ?? [])),
      notificationsApi.stats().then((r) => setStats(r.data ?? {})),
    ]).finally(() => setLoading(false))
  }

  useEffect(() => {
    Promise.allSettled([
      notificationsApi.list().then((r) => setInvitations(r.data ?? [])),
      programmesApi.list().then((r) => setProgrammes(r.data?.content ?? r.data ?? [])),
      notificationsApi.stats().then((r) => setStats(r.data ?? {})),
    ]).finally(() => setLoading(false))
  }, [])

  // When user changes invitation type, swap in the default template
  useEffect(() => {
    const tpl = DEFAULT_TEMPLATES[single.type]
    if (tpl) setSingle((s) => ({ ...s, subject: tpl.subject, message: tpl.message, requiresRsvp: single.type === 'EVENT' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [single.type])
  useEffect(() => {
    const tpl = DEFAULT_TEMPLATES[bulk.type]
    if (tpl) setBulk((s) => ({ ...s, subject: tpl.subject, message: tpl.message, requiresRsvp: bulk.type === 'EVENT' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulk.type])

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleSendSingle = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!single.recipientEmail.trim()) { toast.error('Email du destinataire requis'); return }
    if (!single.subject.trim())        { toast.error('Le sujet est requis'); return }
    if (!single.message.trim())        { toast.error('Le message est requis'); return }
    setSendingSingle(true)
    try {
      const programme = programmes.find((p) => String(p.id) === single.programmeId)
      await notificationsApi.create({
        type: single.type,
        recipientEmail: single.recipientEmail.trim(),
        recipientName: single.recipientName.trim() || undefined,
        programmeId: single.programmeId ? Number(single.programmeId) : undefined,
        programmeName: programme?.title ?? programme?.name,
        subject: single.subject,
        message: single.message,
        requiresRsvp: single.requiresRsvp,
      })
      toast.success('Invitation envoyée ✓')
      setSingle((s) => ({ ...s, recipientEmail: '', recipientName: '' }))
      refresh()
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? "Erreur lors de l'envoi")
    } finally { setSendingSingle(false) }
  }

  const handleSendBulk = async (e: React.FormEvent) => {
    e.preventDefault()
    const recipients = bulk.emails.split(/[\n,;]/)
      .map((s) => s.trim()).filter(Boolean)
      .map((email) => ({ email, name: undefined as string | undefined }))
    if (recipients.length === 0) { toast.error('Aucun email saisi'); return }
    if (!bulk.subject.trim() || !bulk.message.trim()) { toast.error('Sujet et message requis'); return }
    setSendingBulk(true)
    try {
      const programme = programmes.find((p) => String(p.id) === bulk.programmeId)
      const res = await notificationsApi.bulk({
        type: bulk.type,
        recipients,
        programmeId: bulk.programmeId ? Number(bulk.programmeId) : undefined,
        programmeName: programme?.title ?? programme?.name,
        subject: bulk.subject,
        message: bulk.message,
        requiresRsvp: bulk.requiresRsvp,
      })
      const sent = (res.data as Invitation[]).filter((i) => i.status === 'SENT').length
      const failed = recipients.length - sent
      toast.success(`${sent} envoyée(s)${failed ? ` · ${failed} échec(s)` : ''}`)
      setBulk((b) => ({ ...b, emails: '' }))
      refresh()
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Erreur lors de l\'envoi groupé')
    } finally { setSendingBulk(false) }
  }

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    const toEmails = email.toEmails.split(/[\n,;]/)
      .map((s) => s.trim()).filter(Boolean)
    if (toEmails.length === 0) { toast.error('Aucun destinataire'); return }
    if (!email.subject.trim() || !email.body.trim()) { toast.error('Sujet et corps requis'); return }
    setSendingEmail(true)
    try {
      await notificationsApi.sendEmail({
        toEmails,
        subject: email.subject,
        body: email.body,
        html: email.html,
      })
      toast.success(`Email envoyé à ${toEmails.length} destinataire(s)`)
      setEmail({ toEmails: '', subject: '', body: '', html: false })
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? "Erreur lors de l'envoi")
    } finally { setSendingEmail(false) }
  }

  const handleResend = async (id: number) => {
    try {
      await notificationsApi.resend(id)
      toast.success('Email renvoyé')
      refresh()
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Erreur')
    }
  }

  const handleCancel = async (id: number, email: string) => {
    if (!confirm(`Annuler l'invitation envoyée à ${email} ?`)) return
    try {
      await notificationsApi.cancel(id)
      setInvitations((prev) => prev.filter((n) => n.id !== id))
      refresh()
      toast.success('Invitation annulée')
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Erreur')
    }
  }

  // ── Filtering ───────────────────────────────────────────────────────────
  const filtered = invitations.filter((inv) => {
    if (statusFilter !== 'ALL' && inv.status !== statusFilter) return false
    if (typeFilter !== 'ALL' && inv.type !== typeFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (![inv.recipientEmail, inv.recipientName, inv.subject, inv.programmeName].some((v) => v?.toLowerCase().includes(q)))
        return false
    }
    return true
  })

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <AdminLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bell className="h-6 w-6 text-brand-500" />Invitations & Notifications
          </h1>
          <p className="text-muted-foreground">Inviter jurés, mentors, porteurs et communiquer avec eux.</p>
        </motion.div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {[
            { label: 'Total',     value: stats.total    ?? 0, color: 'text-foreground',          bg: 'bg-muted/50' },
            { label: 'Envoyées',  value: stats.sent     ?? 0, color: 'text-blue-600 dark:text-blue-400',     bg: 'bg-blue-500/10' },
            { label: 'Acceptées', value: stats.accepted ?? 0, color: 'text-green-600 dark:text-green-400',   bg: 'bg-green-500/10' },
            { label: 'Refusées',  value: stats.declined ?? 0, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500/10' },
            { label: 'Échecs',    value: stats.failed   ?? 0, color: 'text-red-600 dark:text-red-400',       bg: 'bg-red-500/10' },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl border border-border p-3 ${s.bg}`}>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`mt-0.5 text-2xl font-black tabular-nums ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tab selector */}
        <div className="inline-flex p-1 rounded-xl border border-border bg-muted/30">
          {[
            { id: 'single', label: 'Invitation unique',  icon: Plus },
            { id: 'bulk',   label: 'Invitation groupée', icon: Users },
            { id: 'email',  label: 'Email libre',        icon: Mail },
          ].map((t) => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button key={t.id} type="button" onClick={() => setTab(t.id as any)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all
                  ${active ? 'bg-card text-foreground shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground'}`}>
                <Icon className="h-4 w-4" />{t.label}
              </button>
            )
          })}
        </div>

        {/* Forms */}
        <AnimatePresence mode="wait">
          {tab === 'single' && (
            <motion.div key="single" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <MagicCard className="p-6">
                <form onSubmit={handleSendSingle} className="space-y-4">
                  <h2 className="font-semibold text-foreground flex items-center gap-2">
                    <Plus className="h-4 w-4 text-brand-500" />Inviter une personne
                  </h2>

                  {/* Type selector — visual cards */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">Type d'invitation *</label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {TYPES.map((t) => {
                        const Icon = t.icon
                        const selected = single.type === t.value
                        return (
                          <button key={t.value} type="button"
                            onClick={() => setSingle((s) => ({ ...s, type: t.value }))}
                            className={`text-left rounded-xl border-2 p-3 transition-all
                              ${selected ? 'border-brand-500 bg-brand-500/10' : 'border-border bg-card hover:border-brand-400'}`}>
                            <Icon className={`h-4 w-4 mb-1.5 ${selected ? 'text-brand-600' : 'text-muted-foreground'}`} />
                            <p className={`text-sm font-bold ${selected ? 'text-brand-700 dark:text-brand-300' : 'text-foreground'}`}>{t.label}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{t.description}</p>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Email du destinataire *</label>
                      <Input type="email" required placeholder="jane@example.com"
                        value={single.recipientEmail}
                        onChange={(e) => setSingle((s) => ({ ...s, recipientEmail: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Nom (optionnel)</label>
                      <Input placeholder="Jane Doe"
                        value={single.recipientName}
                        onChange={(e) => setSingle((s) => ({ ...s, recipientName: e.target.value }))} />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Programme (optionnel)</label>
                    <select value={single.programmeId}
                      onChange={(e) => setSingle((s) => ({ ...s, programmeId: e.target.value }))}
                      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <option value="">— Aucun —</option>
                      {programmes.map((p) => <option key={p.id} value={String(p.id)}>{p.title ?? p.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Sujet *</label>
                    <Input required value={single.subject}
                      onChange={(e) => setSingle((s) => ({ ...s, subject: e.target.value }))} />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Message *</label>
                    <textarea rows={6} required value={single.message}
                      onChange={(e) => setSingle((s) => ({ ...s, message: e.target.value }))}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
                  </div>

                  {single.type === 'EVENT' && (
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={single.requiresRsvp}
                        onChange={(e) => setSingle((s) => ({ ...s, requiresRsvp: e.target.checked }))}
                        className="h-4 w-4" />
                      <span>Inclure les boutons Accepter / Décliner (RSVP)</span>
                    </label>
                  )}

                  <Button type="submit" variant="brand" disabled={sendingSingle} className="gap-2">
                    {sendingSingle ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {sendingSingle ? 'Envoi...' : 'Envoyer l\'invitation'}
                  </Button>
                </form>
              </MagicCard>
            </motion.div>
          )}

          {tab === 'bulk' && (
            <motion.div key="bulk" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <MagicCard className="p-6">
                <form onSubmit={handleSendBulk} className="space-y-4">
                  <h2 className="font-semibold text-foreground flex items-center gap-2">
                    <Users className="h-4 w-4 text-brand-500" />Invitation groupée
                  </h2>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">Type d'invitation *</label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {TYPES.map((t) => {
                        const Icon = t.icon
                        const selected = bulk.type === t.value
                        return (
                          <button key={t.value} type="button"
                            onClick={() => setBulk((s) => ({ ...s, type: t.value }))}
                            className={`text-left rounded-xl border-2 p-3 transition-all
                              ${selected ? 'border-brand-500 bg-brand-500/10' : 'border-border bg-card hover:border-brand-400'}`}>
                            <Icon className={`h-4 w-4 mb-1.5 ${selected ? 'text-brand-600' : 'text-muted-foreground'}`} />
                            <p className={`text-sm font-bold ${selected ? 'text-brand-700 dark:text-brand-300' : 'text-foreground'}`}>{t.label}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{t.description}</p>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Emails (un par ligne, ou séparés par virgule/point-virgule) *</label>
                    <textarea rows={4} required value={bulk.emails}
                      onChange={(e) => setBulk((s) => ({ ...s, emails: e.target.value }))}
                      placeholder="jane@example.com&#10;john@example.com&#10;..."
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {bulk.emails.split(/[\n,;]/).map((s) => s.trim()).filter(Boolean).length} email(s)
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Programme (optionnel)</label>
                    <select value={bulk.programmeId}
                      onChange={(e) => setBulk((s) => ({ ...s, programmeId: e.target.value }))}
                      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <option value="">— Aucun —</option>
                      {programmes.map((p) => <option key={p.id} value={String(p.id)}>{p.title ?? p.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Sujet *</label>
                    <Input required value={bulk.subject}
                      onChange={(e) => setBulk((s) => ({ ...s, subject: e.target.value }))} />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Message *</label>
                    <textarea rows={5} required value={bulk.message}
                      onChange={(e) => setBulk((s) => ({ ...s, message: e.target.value }))}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
                  </div>

                  <Button type="submit" variant="brand" disabled={sendingBulk} className="gap-2">
                    {sendingBulk ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {sendingBulk ? 'Envoi...' : `Envoyer à ${bulk.emails.split(/[\n,;]/).map((s) => s.trim()).filter(Boolean).length} destinataire(s)`}
                  </Button>
                </form>
              </MagicCard>
            </motion.div>
          )}

          {tab === 'email' && (
            <motion.div key="email" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <MagicCard className="p-6">
                <form onSubmit={handleSendEmail} className="space-y-4">
                  <h2 className="font-semibold text-foreground flex items-center gap-2">
                    <Mail className="h-4 w-4 text-brand-500" />Email libre
                  </h2>
                  <p className="text-xs text-muted-foreground -mt-2">
                    Pour annonces, rappels ou communications hors invitation. N'est pas tracée dans l'historique.
                  </p>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Destinataires (un par ligne, ou séparés par , ;) *</label>
                    <textarea rows={3} required value={email.toEmails}
                      onChange={(e) => setEmail((s) => ({ ...s, toEmails: e.target.value }))}
                      placeholder="jane@example.com&#10;john@example.com"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Sujet *</label>
                    <Input required value={email.subject}
                      onChange={(e) => setEmail((s) => ({ ...s, subject: e.target.value }))} />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Corps du message *</label>
                    <textarea rows={6} required value={email.body}
                      onChange={(e) => setEmail((s) => ({ ...s, body: e.target.value }))}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
                  </div>

                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={email.html}
                      onChange={(e) => setEmail((s) => ({ ...s, html: e.target.checked }))}
                      className="h-4 w-4" />
                    <span>Le corps est du HTML</span>
                  </label>

                  <Button type="submit" variant="brand" disabled={sendingEmail} className="gap-2">
                    {sendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                    {sendingEmail ? 'Envoi...' : 'Envoyer l\'email'}
                  </Button>
                </form>
              </MagicCard>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Invitations history ─────────────────────────────────────────────── */}
        <div>
          <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />Historique
              <span className="text-xs font-normal text-muted-foreground">({filtered.length} / {invitations.length})</span>
            </h2>
            <Button variant="ghost" size="sm" onClick={refresh} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />Actualiser
            </Button>
          </div>

          {/* Filter bar */}
          <div className="mb-3 flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-8 h-9 text-sm" placeholder="Rechercher email, nom, sujet, programme…"
                value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm">
              <option value="ALL">Tous les statuts</option>
              {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm">
              <option value="ALL">Tous les types</option>
              {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {loading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <Mail className="h-8 w-8 mx-auto mb-2 opacity-30" />
              {invitations.length === 0 ? "Aucune invitation envoyée." : 'Aucune invitation correspond aux filtres.'}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((inv, i) => {
                const meta = STATUS_META[inv.status] ?? STATUS_META.PENDING
                const Icon = meta.icon
                const canResend = inv.status === 'FAILED' || inv.status === 'PENDING' || inv.status === 'SENT'
                const canCancel = inv.status !== 'ACCEPTED' && inv.status !== 'DECLINED'
                return (
                  <motion.div key={inv.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                    <MagicCard className="p-3">
                      <div className="flex items-start gap-3">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.bg}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-foreground truncate">
                              {inv.recipientName && <span>{inv.recipientName} · </span>}
                              <span className="text-muted-foreground">{inv.recipientEmail}</span>
                            </p>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.bg}`}>
                              {meta.label}
                            </span>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{inv.type}</span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{inv.subject}</p>
                          <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                            {inv.programmeName && <span>📦 {inv.programmeName}</span>}
                            {inv.sentAt && <span>· Envoyée {formatRelativeDate(inv.sentAt)}</span>}
                            {!inv.sentAt && inv.createdAt && <span>· Créée {formatRelativeDate(inv.createdAt)}</span>}
                          </div>
                          {inv.errorMessage && (
                            <p className="mt-1 text-[10px] text-red-500 italic">⚠ {inv.errorMessage}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {canResend && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleResend(inv.id)} title="Renvoyer">
                              <RefreshCw className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {canCancel && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => handleCancel(inv.id, inv.recipientEmail)} title="Annuler">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </MagicCard>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
