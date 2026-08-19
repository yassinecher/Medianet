'use client'
/**
 * « Communication » — mail-merge to the programme's incubated startups. The
 * admin picks an audience (porteurs and/or their mentors), filters the roster,
 * chooses a template (variables {programme} {org} {porteur} {mentor} are filled
 * per recipient), previews it, and sends. Reuses the notification-service
 * freeform email endpoint (one personalised send per recipient).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Megaphone, Send, Loader2, Users, Handshake, UserRound, Building2, Mail, AlertTriangle, Eye,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { participantsApi, usersApi, notificationsApi } from '@/lib/api'
import { MagicCard } from '@/components/magicui/magic-card'
import { Button } from '@/components/ui/button'

type Any = Record<string, any>

const STATUS_LABEL: Record<string, string> = { ACTIVE: 'Actif', ALUMNI: 'Alumni', WITHDRAWN: 'Retiré' }

type Template = { key: string; label: string; subject: string; body: string }
const TEMPLATES: Template[] = [
  {
    key: 'welcome', label: 'Bienvenue',
    subject: 'Bienvenue dans {programme}',
    body: `Bonjour {porteur},

Toute l'équipe de Medianet est ravie d'accueillir « {org} » dans le programme {programme}.

Votre référent/mentor est {mentor}. N'hésitez pas à le/la solliciter pour vos séances d'accompagnement.

Au plaisir de vous accompagner,
L'équipe Medianet`,
  },
  {
    key: 'session', label: 'Rappel de session',
    subject: 'Rappel — prochaine session de {programme}',
    body: `Bonjour {porteur},

Nous vous rappelons la prochaine session du programme {programme}. Merci de confirmer votre présence pour « {org} ».

À très bientôt,
L'équipe Medianet`,
  },
  {
    key: 'workshop', label: 'Convocation atelier',
    subject: 'Atelier {programme} — « {org} »',
    body: `Bonjour {porteur},

Un atelier est organisé dans le cadre de {programme} pour « {org} ». Votre mentor {mentor} y participera.

Détails à venir. Merci de bloquer le créneau.

L'équipe Medianet`,
  },
  {
    key: 'blank', label: 'Message vierge',
    subject: '',
    body: '',
  },
]

const fill = (tpl: string, vars: Record<string, string>) =>
  tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`)

export function MailingPanel({ programmeId, programmeName }: { programmeId: number; programmeName: string }) {
  const [roster, setRoster] = useState<Any[]>([])
  const [mentorEmail, setMentorEmail] = useState<Map<number, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  const [toPorteurs, setToPorteurs] = useState(true)
  const [toMentors, setToMentors] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [tpl, setTpl] = useState<Template>(TEMPLATES[0])
  const [subject, setSubject] = useState(TEMPLATES[0].subject)
  const [body, setBody] = useState(TEMPLATES[0].body)
  const [showPreview, setShowPreview] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    Promise.allSettled([participantsApi.list(programmeId), usersApi.byRole('MENTOR')])
      .then(([p, m]) => {
        const rows = p.status === 'fulfilled' ? (p.value.data ?? []) : []
        setRoster(rows)
        setSelected(new Set(rows.map((r: Any) => r.id)))
        if (m.status === 'fulfilled') {
          const map = new Map<number, string>()
          ;(m.value.data ?? []).forEach((u: Any) => { if (u.email) map.set(u.id, u.email) })
          setMentorEmail(map)
        }
      })
      .finally(() => setLoading(false))
  }, [programmeId])
  useEffect(() => { load() }, [load])

  const pickTemplate = (t: Template) => { setTpl(t); setSubject(t.subject); setBody(t.body) }

  const visible = useMemo(
    () => roster.filter((r) => statusFilter === 'ALL' || (r.status ?? 'ACTIVE') === statusFilter),
    [roster, statusFilter],
  )
  const toggle = (id: number) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const allVisibleSelected = visible.length > 0 && visible.every((r) => selected.has(r.id))
  const toggleAll = () => setSelected((s) => {
    const n = new Set(s)
    if (allVisibleSelected) visible.forEach((r) => n.delete(r.id))
    else visible.forEach((r) => n.add(r.id))
    return n
  })

  // Build the personalised recipient list (deduped by email+participation).
  const recipients = useMemo(() => {
    const out: { email: string; name: string; vars: Record<string, string> }[] = []
    const seen = new Set<string>()
    for (const r of visible) {
      if (!selected.has(r.id)) continue
      const vars = {
        programme: programmeName || 'le programme',
        org: r.organizationName || 'votre startup',
        porteur: r.porteurName || 'porteur',
        mentor: r.mentorName || 'votre mentor',
      }
      if (toPorteurs && r.porteurEmail) {
        const key = `${r.porteurEmail}|${r.id}`
        if (!seen.has(key)) { seen.add(key); out.push({ email: r.porteurEmail, name: r.porteurName || '', vars }) }
      }
      if (toMentors && r.mentorUserId && mentorEmail.get(r.mentorUserId)) {
        const em = mentorEmail.get(r.mentorUserId)!
        const key = `${em}|${r.id}`
        if (!seen.has(key)) { seen.add(key); out.push({ email: em, name: r.mentorName || '', vars }) }
      }
    }
    return out
  }, [visible, selected, toPorteurs, toMentors, mentorEmail, programmeName])

  const send = async () => {
    if (!subject.trim() || !body.trim()) { toast.error('Sujet et message requis.'); return }
    if (recipients.length === 0) { toast.error('Aucun destinataire.'); return }
    if (!confirm(`Envoyer « ${subject} » à ${recipients.length} destinataire(s) ?`)) return
    setSending(true)
    const results = await Promise.allSettled(recipients.map((rec) =>
      notificationsApi.sendEmail({
        toEmail: rec.email, toName: rec.name,
        subject: fill(subject, rec.vars), body: fill(body, rec.vars), html: false,
      })))
    const ok = results.filter((r) => r.status === 'fulfilled').length
    const ko = results.length - ok
    setSending(false)
    if (ko === 0) toast.success(`${ok} e-mail(s) envoyé(s)`)
    else toast.error(`${ok} envoyé(s), ${ko} échec(s)`)
  }

  // Preview against the first recipient (or generic vars).
  const previewVars = recipients[0]?.vars ?? { programme: programmeName, org: '{org}', porteur: '{porteur}', mentor: '{mentor}' }
  const input = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand-500'

  return (
    <MagicCard className="p-4">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-foreground">
        <Megaphone className="h-4 w-4 text-brand-500" />Communication — mailing des startups
      </h2>
      <p className="mb-3 text-[11px] text-muted-foreground">
        Écrivez aux porteurs et/ou à leurs mentors. Les variables <code className="rounded bg-muted px-1">{'{programme}'}</code> <code className="rounded bg-muted px-1">{'{org}'}</code> <code className="rounded bg-muted px-1">{'{porteur}'}</code> <code className="rounded bg-muted px-1">{'{mentor}'}</code> sont remplacées pour chaque destinataire.
      </p>

      {loading ? (
        <div className="flex h-24 items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Composer */}
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATES.map((t) => (
                <button key={t.key} onClick={() => pickTemplate(t)}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${tpl.key === t.key ? 'border-brand-400 bg-brand-500/10 text-brand-700 dark:text-brand-300' : 'border-border text-muted-foreground hover:bg-accent'}`}>
                  {t.label}
                </button>
              ))}
            </div>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Sujet de l’e-mail" className={input} />
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} placeholder="Votre message…" className={input + ' resize-y font-mono text-[13px]'} />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <button onClick={() => setShowPreview((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-accent">
                <Eye className="h-3.5 w-3.5" />{showPreview ? 'Masquer l’aperçu' : 'Aperçu'}
              </button>
              <Button size="sm" className="gap-1.5" onClick={send} disabled={sending || recipients.length === 0}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Envoyer ({recipients.length})
              </Button>
            </div>

            {showPreview && (
              <div className="rounded-xl border border-border bg-background/60 p-3">
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Aperçu (1er destinataire)</p>
                <p className="text-sm font-semibold text-foreground">{fill(subject, previewVars) || '(sans sujet)'}</p>
                <pre className="mt-1 whitespace-pre-wrap font-sans text-[13px] text-foreground/90">{fill(body, previewVars) || '(message vide)'}</pre>
              </div>
            )}
          </div>

          {/* Audience + roster */}
          <div className="space-y-3">
            <div className="rounded-xl border border-border p-3">
              <p className="mb-2 text-xs font-bold text-foreground">Destinataires</p>
              <label className="mb-1.5 flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={toPorteurs} onChange={(e) => setToPorteurs(e.target.checked)} className="accent-brand-500" />
                <UserRound className="h-3.5 w-3.5 text-muted-foreground" />Porteurs
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={toMentors} onChange={(e) => setToMentors(e.target.checked)} className="accent-brand-500" />
                <Handshake className="h-3.5 w-3.5 text-muted-foreground" />Mentors
              </label>
              <div className="mt-2.5">
                <p className="mb-1 text-[11px] font-semibold text-muted-foreground">Statut</p>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={input}>
                  <option value="ALL">Tous les statuts</option>
                  {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>

            <div className="rounded-xl border border-border">
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <p className="flex items-center gap-1.5 text-xs font-bold text-foreground"><Users className="h-3.5 w-3.5" />Startups ({visible.length})</p>
                <button onClick={toggleAll} className="text-[11px] font-semibold text-brand-600 hover:underline">{allVisibleSelected ? 'Tout désélectionner' : 'Tout sélectionner'}</button>
              </div>
              <div className="max-h-64 overflow-y-auto p-2">
                {visible.length === 0 ? (
                  <p className="p-3 text-center text-[11px] text-muted-foreground">Aucune startup pour ce filtre.</p>
                ) : visible.map((r) => {
                  const on = selected.has(r.id)
                  const noMentorMail = toMentors && (!r.mentorUserId || !mentorEmail.get(r.mentorUserId))
                  const noPorteurMail = toPorteurs && !r.porteurEmail
                  return (
                    <button key={r.id} onClick={() => toggle(r.id)}
                      className={`mb-1 flex w-full items-center gap-2 rounded-lg border p-2 text-left transition-colors ${on ? 'border-brand-400 bg-brand-500/5' : 'border-transparent hover:bg-accent/50'}`}>
                      <input type="checkbox" readOnly checked={on} className="accent-brand-500" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 truncate text-xs font-semibold text-foreground"><Building2 className="h-3 w-3 shrink-0 text-muted-foreground" />{r.organizationName || `#${r.organizationId}`}</span>
                        <span className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span className="inline-flex items-center gap-0.5"><Mail className="h-2.5 w-2.5" />{r.porteurEmail || 'sans e-mail'}</span>
                          {(noMentorMail || noPorteurMail) && <span className="inline-flex items-center gap-0.5 text-rose-500"><AlertTriangle className="h-2.5 w-2.5" />manquant</span>}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </MagicCard>
  )
}
