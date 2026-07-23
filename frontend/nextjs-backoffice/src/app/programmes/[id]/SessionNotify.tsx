'use client'
/**
 * SessionNotify — reusable "notifier les participants d'une session" module.
 *
 * Invitations are meant for a concrete event, so this is used on DAY sessions
 * (journées) only. The review modal lets the admin, before anything is sent:
 *   • adjust the event PLACE + DATE and optionally push them back to the Parcours,
 *   • review recipients grouped per startup (porteur + membres), plus jury,
 *     organisateurs and invités externes — checking/unchecking each one,
 *   • write a DIFFERENT email per recipient type (jury / porteur / membre /
 *     organisateur / invité) with a live preview,
 *   • add the session to Google Agenda (and the email carries the same link).
 *
 * Every send is archived (notification-service records one row per recipient),
 * and the modal's « Historique » tab shows the status of past sends.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Send, Loader2, Users, Gavel, Rocket, Building2, UserPlus, X, CalendarPlus, BellRing, Mail,
  MapPin, Calendar, History, Pencil, CheckCircle2, XCircle, Clock, RefreshCw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { candidaturesApi, organizationsApi, notificationsApi, sessionsApi } from '@/lib/api'
import { formatDate } from '@/lib/utils'

const FRONTOFFICE_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_FRONTOFFICE_URL) || 'http://localhost:3000'

export const SESSION_TYPE_LABEL: Record<string, string> = {
  CANDIDATURE_SUBMISSION: 'Candidature', PRESELECTION: 'Présélection', PITCH_DAY: 'Pitch Day',
  ONBOARDING: 'Onboarding', INCUBATION: 'Incubation', DEMO_DAY: 'Demo Day', TRAINING_DAY: 'Formation',
}

export interface SessionLike {
  id?: number; title?: string; description?: string; startDate?: string; endDate?: string
  location?: string; sessionType?: string; parentSessionId?: number | null; durationKind?: string
  responsibles?: string[]; guests?: string[]; startupIds?: number[]
}
interface JuryAssignment { phaseId?: number | null; juryEmail?: string; juryName?: string }
export interface Cand {
  id: number; projectName?: string; companyName?: string; porteurEmail?: string; porteurName?: string
  organizationId?: number | null; juryAssignments?: JuryAssignment[]
}
export interface Member { email?: string; name?: string }

export type RType = 'jury' | 'porteur' | 'member' | 'organisateur' | 'invite'
export interface Recipient { email: string; name?: string; type: RType; startupId?: number; startupName?: string }

export const TYPE_META: Record<RType, { label: string; icon: any; tone: string }> = {
  jury:         { label: 'Jury', icon: Gavel, tone: 'amber' },
  porteur:      { label: 'Porteur', icon: Rocket, tone: 'sky' },
  member:       { label: 'Membre', icon: Building2, tone: 'emerald' },
  organisateur: { label: 'Organisateur', icon: Users, tone: 'violet' },
  invite:       { label: 'Invité externe', icon: UserPlus, tone: 'rose' },
}
export const TONE_CLS: Record<string, string> = {
  amber: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  sky: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  emerald: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  violet: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
  rose: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const isEmail = (s?: string): s is string => !!s && EMAIL_RE.test(s.trim())
export const norm = (s: string) => s.trim().toLowerCase()
const startupName = (c: Cand) => c.projectName || c.companyName || `Startup #${c.id}`

/** Resolve every recipient (typed, deduped by email, valid addresses only). */
export function gatherRecipients(p: SessionLike, cands: Cand[], orgMembers: Record<number, Member[]>): Recipient[] {
  const pool = (p.startupIds && p.startupIds.length > 0)
    ? cands.filter((c) => p.startupIds!.includes(c.id))
    : cands

  const out: Recipient[] = []
  for (const e of p.responsibles ?? []) if (isEmail(e)) out.push({ email: e.trim(), type: 'organisateur' })
  for (const e of p.guests ?? []) if (isEmail(e)) out.push({ email: e.trim(), type: 'invite' })
  for (const c of pool)
    for (const a of c.juryAssignments ?? [])
      if ((a.phaseId == null || a.phaseId === p.id) && isEmail(a.juryEmail))
        out.push({ email: a.juryEmail!.trim(), name: a.juryName, type: 'jury' })
  for (const c of pool)
    if (isEmail(c.porteurEmail)) out.push({ email: c.porteurEmail!.trim(), name: c.porteurName, type: 'porteur', startupId: c.id, startupName: startupName(c) })
  for (const c of pool)
    if (c.organizationId)
      for (const m of orgMembers[c.organizationId] ?? [])
        if (isEmail(m.email)) out.push({ email: m.email!.trim(), name: m.name, type: 'member', startupId: c.id, startupName: startupName(c) })

  const seen = new Map<string, Recipient>()
  for (const r of out) if (!seen.has(norm(r.email))) seen.set(norm(r.email), r)
  return Array.from(seen.values())
}

/** Google Calendar "add event" link (all-day, end-exclusive). */
export function gcalUrl(programmeName: string, p: SessionLike): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${programmeName} — ${p.title ?? 'Session'}`,
    details: p.description ?? '',
    location: p.location ?? '',
  })
  let dates = ''
  if (p.startDate) {
    const fmt = (d: string) => d.slice(0, 10).replace(/-/g, '')
    const end = new Date((p.endDate || p.startDate) + 'T00:00:00'); end.setDate(end.getDate() + 1)
    dates = `&dates=${fmt(p.startDate)}/${end.toISOString().slice(0, 10).replace(/-/g, '')}`
  }
  return `https://calendar.google.com/calendar/render?${params.toString()}${dates}`
}

export function whenText(p: SessionLike) {
  if (!p.startDate) return 'prochainement'
  return p.endDate && p.endDate !== p.startDate
    ? `du ${formatDate(p.startDate)} au ${formatDate(p.endDate)}`
    : `le ${formatDate(p.startDate)}`
}

function defaultTemplates(programmeName: string, p: SessionLike): Record<RType, { subject: string; intro: string }> {
  const t = p.title ?? 'Session'; const when = whenText(p)
  return {
    jury:         { subject: `Évaluation — « ${t} »`, intro: `Bonjour,\n\nEn tant que membre du jury, vous êtes attendu(e) pour la session « ${t} » qui aura lieu ${when}. Merci de préparer vos évaluations.` },
    porteur:      { subject: `Votre session « ${t} » approche`, intro: `Bonjour,\n\nVotre startup est attendue à la session « ${t} » ${when}. Merci de confirmer votre présence.` },
    member:       { subject: `${programmeName} — session « ${t} »`, intro: `Bonjour,\n\nLa session « ${t} » de votre programme aura lieu ${when}. Toute l'équipe est la bienvenue.` },
    organisateur: { subject: `Organisation — session « ${t} »`, intro: `Bonjour,\n\nVous êtes responsable de la session « ${t} » prévue ${when}. Merci de préparer son déroulé.` },
    invite:       { subject: `Invitation — « ${t} »`, intro: `Bonjour,\n\nVous êtes convié(e) à la session « ${t} » ${when}. Nous serions ravis de votre présence.` },
  }
}

export function emailHtml(programmeName: string, p: SessionLike, intro: string, heading = '📅 Une session approche') {
  const when = whenText(p)
  const typeLabel = SESSION_TYPE_LABEL[p.sessionType ?? ''] ?? 'Session'
  const rows = ([
    ['Programme', programmeName],
    ['Session', `${p.title ?? typeLabel} (${typeLabel})`],
    ['Date', when],
    p.location ? ['Lieu', p.location] : null,
  ].filter(Boolean) as [string, string][])
  const gcal = gcalUrl(programmeName, p)
  return `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:auto;color:#0f172a">
  <div style="background:linear-gradient(135deg,#1a73e8,#0d47a1);padding:24px 28px;border-radius:14px 14px 0 0">
    <h2 style="margin:0;color:#fff;font-size:19px">${heading}</h2>
    <p style="margin:6px 0 0;color:rgba(255,255,255,.85);font-size:13px">Medianet Incubateur</p>
  </div>
  <div style="border:1px solid #e8ecef;border-top:none;border-radius:0 0 14px 14px;padding:24px 28px">
    <p style="font-size:15px;line-height:1.6;margin:0 0 18px;white-space:pre-wrap">${intro}</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px">
      ${rows.map(([k, v]) => `<tr>
        <td style="padding:6px 10px;color:#64748b;width:120px;vertical-align:top">${k}</td>
        <td style="padding:6px 10px;font-weight:600">${v}</td></tr>`).join('')}
    </table>
    ${p.description ? `<p style="font-size:14px;line-height:1.6;color:#334155;margin:0 0 20px">${p.description}</p>` : ''}
    <p style="text-align:center;margin:24px 0 8px">
      <a href="${gcal}" style="background:#fff;color:#1a73e8;border:1px solid #1a73e8;padding:11px 22px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block;margin:0 6px 8px">📅 Ajouter à Google Agenda</a>
      <a href="${FRONTOFFICE_URL}" style="background:#1a73e8;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block;margin:0 6px 8px">Accéder à la plateforme</a>
    </p>
  </div>
</div>`
}

export function SessionNotifyButton({
  programmeId, programmeName, session, cands: candsProp, orgMembers: orgMembersProp,
  onSessionPatched, className, label = 'Notifier', compact = false,
}: {
  programmeId: number
  programmeName: string
  session: SessionLike
  cands?: Cand[]
  orgMembers?: Record<number, Member[]>
  onSessionPatched?: (patch: { location?: string; startDate?: string; endDate?: string }) => void
  className?: string
  label?: string
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        title="Notifier les participants de cette journée"
        className={className ?? 'inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-brand-500/40 bg-brand-500/5 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-500/10 dark:text-brand-300'}>
        <BellRing className={compact ? 'h-4 w-4' : 'h-3.5 w-3.5'} />{!compact && label}
      </button>
      {open && (
        <NotifyModal programmeId={programmeId} programmeName={programmeName} session={session}
          cands={candsProp} orgMembers={orgMembersProp} onSessionPatched={onSessionPatched} onClose={() => setOpen(false)} />
      )}
    </>
  )
}

function NotifyModal({
  programmeId, programmeName, session, cands: candsProp, orgMembers: orgMembersProp, onSessionPatched, onClose,
}: {
  programmeId: number
  programmeName: string
  session: SessionLike
  cands?: Cand[]
  orgMembers?: Record<number, Member[]>
  onSessionPatched?: (patch: { location?: string; startDate?: string; endDate?: string }) => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<'compose' | 'history'>('compose')
  const [cands, setCands] = useState<Cand[]>(candsProp ?? [])
  const [orgMembers, setOrgMembers] = useState<Record<number, Member[]>>(orgMembersProp ?? {})
  const [loading, setLoading] = useState(!candsProp)
  const [sending, setSending] = useState(false)

  // Editable event place + date (prefilled from the session).
  const [place, setPlace] = useState(session.location ?? '')
  const [date, setDate] = useState(session.startDate ? session.startDate.slice(0, 10) : '')

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [touched, setTouched] = useState(false)
  const [tpls, setTpls] = useState(() => defaultTemplates(programmeName, session))
  const [activeType, setActiveType] = useState<RType>('jury')

  // History (archived sends for this session).
  const [history, setHistory] = useState<any[]>([])
  const loadHistory = useCallback(() => {
    if (!session.id) return
    notificationsApi.byPhase(session.id).then((r) => setHistory(r.data ?? [])).catch(() => {})
  }, [session.id])

  useEffect(() => {
    if (candsProp) { loadHistory(); return }
    let cancelled = false
    setLoading(true)
    candidaturesApi.byProgramme(programmeId)
      .then(async (r) => {
        if (cancelled) return
        const list: Cand[] = r.data ?? []
        setCands(list)
        const orgIds = Array.from(new Set(list.map((c) => c.organizationId).filter((x): x is number => !!x)))
        const res = await Promise.allSettled(orgIds.map((id) => organizationsApi.get(id)))
        if (cancelled) return
        const map: Record<number, Member[]> = {}
        res.forEach((x, i) => { if (x.status === 'fulfilled') map[orgIds[i]] = x.value.data?.members ?? [] })
        setOrgMembers(map)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) { setLoading(false); loadHistory() } })
    return () => { cancelled = true }
  }, [programmeId, candsProp, loadHistory])

  // Effective session reflecting the edited place/date — used by preview + gcal + email.
  const effSession = useMemo<SessionLike>(() => ({
    ...session, location: place || undefined, startDate: date || session.startDate, endDate: date || session.endDate,
  }), [session, place, date])

  const recipients = useMemo(() => gatherRecipients(session, cands, orgMembers), [session, cands, orgMembers])

  useEffect(() => {
    if (!touched) setSelected(new Set(recipients.map((r) => norm(r.email))))
  }, [recipients, touched])

  const presentTypes = useMemo(
    () => (Object.keys(TYPE_META) as RType[]).filter((t) => recipients.some((r) => r.type === t)),
    [recipients])
  useEffect(() => { if (presentTypes.length && !presentTypes.includes(activeType)) setActiveType(presentTypes[0]) }, [presentTypes, activeType])

  const startups = useMemo(() => {
    const m = new Map<number, { id: number; name: string; porteurs: Recipient[]; members: Recipient[] }>()
    for (const r of recipients) {
      if ((r.type === 'porteur' || r.type === 'member') && r.startupId != null) {
        if (!m.has(r.startupId)) m.set(r.startupId, { id: r.startupId, name: r.startupName || `#${r.startupId}`, porteurs: [], members: [] })
        const e = m.get(r.startupId)!; (r.type === 'porteur' ? e.porteurs : e.members).push(r)
      }
    }
    return Array.from(m.values())
  }, [recipients])
  const flat = (t: RType) => recipients.filter((r) => r.type === t)

  const toggle = (email: string) => { setTouched(true); setSelected((p) => { const n = new Set(p); const k = norm(email); n.has(k) ? n.delete(k) : n.add(k); return n }) }
  const toggleMany = (emails: string[], on: boolean) => { setTouched(true); setSelected((p) => { const n = new Set(p); for (const e of emails) on ? n.add(norm(e)) : n.delete(norm(e)); return n }) }

  const chosen = recipients.filter((r) => selected.has(norm(r.email)))
  const setTpl = (t: RType, patch: Partial<{ subject: string; intro: string }>) => setTpls((p) => ({ ...p, [t]: { ...p[t], ...patch } }))

  const send = async () => {
    if (chosen.length === 0) { toast.error('Sélectionnez au moins un destinataire.'); return }
    // Offer to push the edited place/date back to the Parcours session.
    const placeChanged = (place || '') !== (session.location || '')
    const dateChanged = (date || '') !== (session.startDate ? session.startDate.slice(0, 10) : '')
    if (session.id && (placeChanged || dateChanged)) {
      if (confirm('Mettre à jour la session du Parcours avec ce lieu / cette date ?')) {
        try {
          await sessionsApi.update(programmeId, session.id, {
            location: place || null,
            ...(dateChanged ? { startDate: date || null, endDate: date || null } : {}),
          })
          onSessionPatched?.({ location: place || undefined, startDate: date || undefined, endDate: date || undefined })
          toast.success('Parcours mis à jour')
        } catch { toast.error('Mise à jour du Parcours impossible') }
      }
    }
    // One tailored email per recipient type.
    const items = presentTypes.map((t) => {
      const recs = chosen.filter((r) => r.type === t)
      if (recs.length === 0) return null
      return { type: t, subject: tpls[t].subject, body: emailHtml(programmeName, effSession, tpls[t].intro),
        recipients: recs.map((r) => ({ email: r.email, name: r.name })) }
    }).filter(Boolean)
    if (items.length === 0) { toast.error('Aucun destinataire sélectionné.'); return }

    setSending(true)
    try {
      const r = await notificationsApi.sessionNotify({
        programmeId, programmeName, phaseId: session.id, phaseName: session.title, items,
      })
      const sent = (r.data ?? []).filter((x: any) => x.status === 'SENT').length
      const failed = (r.data ?? []).filter((x: any) => x.status === 'FAILED').length
      toast.success(`${sent} email(s) envoyé(s)${failed ? ` · ${failed} échec(s)` : ''}`)
      loadHistory(); setTab('history')
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Échec de l'envoi des emails")
    } finally { setSending(false) }
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div onClick={onClose} className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div onClick={(e) => e.stopPropagation()}
        className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border-2 border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-border px-5 py-3 shrink-0">
          <BellRing className="h-4 w-4 text-brand-500" />
          <h2 className="truncate text-sm font-bold text-foreground">Notifier — « {session.title || 'Journée'} »</h2>
          <div className="ml-3 inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
            {([['compose', 'Composer', Pencil], ['history', 'Historique', History]] as const).map(([k, lbl, Icon]) => (
              <button key={k} onClick={() => { if (k === 'history') loadHistory(); setTab(k) }}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors ${tab === k ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                <Icon className="h-3 w-3" />{lbl}{k === 'history' && history.length > 0 ? ` (${history.length})` : ''}
              </button>
            ))}
          </div>
          <a href={gcalUrl(programmeName, effSession)} target="_blank" rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-accent">
            <CalendarPlus className="h-3.5 w-3.5 text-brand-500" />Google Agenda
          </a>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : tab === 'history' ? (
          <HistoryList history={history} onRefresh={loadHistory} />
        ) : (
          <div className="grid flex-1 grid-cols-1 gap-0 overflow-hidden lg:grid-cols-2">
            {/* LEFT — recipients */}
            <div className="flex flex-col overflow-hidden border-b border-border lg:border-b-0 lg:border-r">
              <div className="flex items-center justify-between px-5 py-2.5 text-xs font-semibold text-muted-foreground">
                <span>Destinataires — vérifiez avant l'envoi</span>
                <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-brand-600 dark:text-brand-400">{chosen.length} / {recipients.length}</span>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto px-5 pb-4">
                {recipients.length === 0 && (
                  <p className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
                    Aucun destinataire avec une adresse email pour cette journée.
                  </p>
                )}
                {/* Startups → porteur + membres */}
                {startups.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-muted-foreground">Startups</p>
                    {startups.map((s) => {
                      const all = [...s.porteurs, ...s.members]
                      const allOn = all.every((r) => selected.has(norm(r.email)))
                      return (
                        <div key={s.id} className="rounded-xl border border-border">
                          <button type="button" onClick={() => toggleMany(all.map((r) => r.email), !allOn)}
                            className="flex w-full items-center gap-2 rounded-t-xl bg-muted/30 px-3 py-2 text-left">
                            <input type="checkbox" readOnly checked={allOn} className="h-3.5 w-3.5 accent-brand-500" />
                            <Rocket className="h-3.5 w-3.5 text-sky-600" />
                            <span className="truncate text-xs font-bold text-foreground">{s.name}</span>
                            <span className="ml-auto text-[10px] text-muted-foreground">{all.length}</span>
                          </button>
                          <ul className="divide-y divide-border">
                            {all.map((r) => <RecipientRow key={r.email} r={r} checked={selected.has(norm(r.email))} onToggle={() => toggle(r.email)} showType />)}
                          </ul>
                        </div>
                      )
                    })}
                  </div>
                )}
                {/* Jury / Organisateurs / Invités */}
                {(['jury', 'organisateur', 'invite'] as RType[]).map((t) => {
                  const items = flat(t); if (items.length === 0) return null
                  const M = TYPE_META[t]; const allOn = items.every((r) => selected.has(norm(r.email)))
                  return (
                    <div key={t} className="rounded-xl border border-border">
                      <button type="button" onClick={() => toggleMany(items.map((r) => r.email), !allOn)}
                        className="flex w-full items-center gap-2 rounded-t-xl bg-muted/30 px-3 py-2 text-left">
                        <input type="checkbox" readOnly checked={allOn} className="h-3.5 w-3.5 accent-brand-500" />
                        <M.icon className={`h-3.5 w-3.5 ${TONE_CLS[M.tone].split(' ').slice(1).join(' ')}`} />
                        <span className="text-xs font-bold text-foreground">{M.label}s</span>
                        <span className="ml-auto text-[10px] text-muted-foreground">{items.length}</span>
                      </button>
                      <ul className="divide-y divide-border">
                        {items.map((r) => <RecipientRow key={r.email} r={r} checked={selected.has(norm(r.email))} onToggle={() => toggle(r.email)} />)}
                      </ul>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* RIGHT — event settings + per-type templates + preview */}
            <div className="flex flex-col overflow-y-auto px-5 py-3">
              {/* Event place + date */}
              <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl border border-border bg-muted/20 p-3">
                <div className="col-span-2 flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />Lieu & date de l'événement
                </div>
                <label className="flex flex-col gap-1 text-[10px] font-semibold text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />Lieu</span>
                  <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Salle, adresse, en ligne…"
                    className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm font-normal text-foreground" />
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-semibold text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />Date</span>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                    className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm font-normal text-foreground" />
                </label>
              </div>

              {/* Per-type template tabs */}
              <div className="mb-2 flex flex-wrap gap-1">
                {presentTypes.map((t) => {
                  const M = TYPE_META[t]; const n = chosen.filter((r) => r.type === t).length
                  return (
                    <button key={t} onClick={() => setActiveType(t)}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold transition-all ${activeType === t ? TONE_CLS[M.tone] + ' ring-1 ring-current' : 'bg-muted/40 text-muted-foreground hover:text-foreground'}`}>
                      <M.icon className="h-3 w-3" />{M.label} ({n})
                    </button>
                  )
                })}
              </div>

              {presentTypes.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
                  Sélectionnez des destinataires pour composer leur email.
                </p>
              ) : (
                <>
                  <label className="mb-1 text-[11px] font-semibold text-muted-foreground">Objet ({TYPE_META[activeType].label})</label>
                  <input value={tpls[activeType].subject} onChange={(e) => setTpl(activeType, { subject: e.target.value })}
                    className="mb-3 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
                  <label className="mb-1 text-[11px] font-semibold text-muted-foreground">Message d'introduction</label>
                  <textarea value={tpls[activeType].intro} onChange={(e) => setTpl(activeType, { intro: e.target.value })} rows={4}
                    className="mb-3 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm" />
                  <label className="mb-1 text-[11px] font-semibold text-muted-foreground">Aperçu — {TYPE_META[activeType].label}</label>
                  <div className="flex-1 overflow-y-auto rounded-lg border border-border bg-[#f4f6f8] p-3">
                    <div dangerouslySetInnerHTML={{ __html: emailHtml(programmeName, effSession, tpls[activeType].intro) }} />
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        {tab === 'compose' && !loading && (
          <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3 shrink-0">
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Mail className="h-3.5 w-3.5" />Un email tailored par type · chaque envoi est archivé.
            </p>
            <div className="flex gap-2">
              <button onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-accent">Annuler</button>
              <button onClick={send} disabled={sending || chosen.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-brand-500 bg-brand-500 px-4 py-1.5 text-xs font-bold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50">
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {sending ? 'Envoi…' : `Envoyer (${chosen.length})`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

function RecipientRow({ r, checked, onToggle, showType }: { r: Recipient; checked: boolean; onToggle: () => void; showType?: boolean }) {
  const M = TYPE_META[r.type]
  return (
    <li>
      <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-accent/40">
        <input type="checkbox" checked={checked} onChange={onToggle} className="h-3.5 w-3.5 accent-brand-500" />
        <span className="min-w-0 flex-1 truncate text-xs text-foreground">
          {r.name ? <span className="font-medium">{r.name} · </span> : null}
          <span className="text-muted-foreground">{r.email}</span>
        </span>
        {showType && <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${TONE_CLS[M.tone]}`}>{M.label}</span>}
      </label>
    </li>
  )
}

const HIST_STATUS: Record<string, { label: string; icon: any; cls: string }> = {
  SENT:   { label: 'Envoyé', icon: CheckCircle2, cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  FAILED: { label: 'Échec', icon: XCircle, cls: 'bg-rose-500/15 text-rose-700 dark:text-rose-300' },
  PENDING:{ label: 'En attente', icon: Clock, cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
}
const TYPE_LABEL_BY_INVITATION: Record<string, string> = {
  JURY: 'Jury', PORTEUR: 'Porteur', MEMBER: 'Membre', ORGANISATEUR: 'Organisateur', GUEST: 'Invité', GENERAL: 'Général', MENTOR: 'Mentor',
}

function HistoryList({ history, onRefresh }: { history: any[]; onRefresh: () => void }) {
  return (
    <div className="flex-1 overflow-y-auto px-5 py-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground">Historique des envois pour cette journée</p>
        <button onClick={onRefresh} className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-accent">
          <RefreshCw className="h-3 w-3" />Rafraîchir
        </button>
      </div>
      {history.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border bg-muted/10 p-8 text-center text-sm text-muted-foreground">
          Aucun email envoyé pour cette journée pour l'instant.
        </div>
      ) : (
        <div className="space-y-1.5">
          {history.map((h) => {
            const st = HIST_STATUS[h.status] ?? HIST_STATUS.PENDING
            return (
              <div key={h.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5">
                <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-foreground">{h.recipientName || h.recipientEmail}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{h.subject}</p>
                </div>
                <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">{TYPE_LABEL_BY_INVITATION[h.type] ?? h.type}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">{h.sentAt ? formatDate(h.sentAt) : ''}</span>
                <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${st.cls}`} title={h.errorMessage || ''}>
                  <st.icon className="h-3 w-3" />{st.label}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
