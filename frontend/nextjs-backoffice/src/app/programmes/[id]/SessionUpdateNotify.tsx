'use client'
/**
 * SessionUpdateNotify — after a CRITICAL change on a session (dates moved,
 * session envoyée à la corbeille…), suggest notifying everyone related to it,
 * then walk the admin through a step-by-step wizard:
 *
 *   1. Destinataires — porteurs, jurys, membres, organisateurs, invités,
 *      uniquement s'ils sont concernés par la session (check/uncheck).
 *   2..n. Un email PAR RÔLE — objet + message éditables, aperçu en direct.
 *   n+1. Récapitulatif — envoi (chaque email est archivé côté notification).
 *
 * Rendered by the session page and by the Gantt after a successful critical
 * update; entirely optional — « Ignorer » just closes the suggestion.
 */
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { BellRing, ChevronLeft, ChevronRight, Loader2, Mail, Send, X, Check, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { candidaturesApi, organizationsApi, notificationsApi } from '@/lib/api'
import {
  gatherRecipients, emailHtml, norm, TYPE_META, TONE_CLS,
  type SessionLike, type Cand, type Member, type RType, type Recipient,
} from './SessionNotify'

export interface UpdateSuggest {
  session: SessionLike
  /** Human description of what changed, e.g. « Dates : 12/03 → 15/03 ». */
  changeSummary: string
}

const HEADING = '🔄 Mise à jour importante'

function updateTemplates(programmeName: string, p: SessionLike, changeSummary: string): Record<RType, { subject: string; intro: string }> {
  const t = p.title ?? 'Session'
  const base = `Bonjour,\n\nLa session « ${t} » du programme ${programmeName} vient d'être mise à jour :\n\n${changeSummary}\n\n`
  return {
    jury:         { subject: `Mise à jour — « ${t} »`, intro: base + `En tant que membre du jury, merci d'en tenir compte pour vos évaluations et votre agenda.` },
    porteur:      { subject: `Votre session « ${t} » a été modifiée`, intro: base + `Merci de vérifier votre agenda et de vous organiser en conséquence.` },
    member:       { subject: `${programmeName} — « ${t} » mise à jour`, intro: base + `Toute l'équipe est invitée à prendre note de ce changement.` },
    organisateur: { subject: `Organisation — « ${t} » mise à jour`, intro: base + `Vous êtes responsable de cette session : merci d'ajuster son déroulé si nécessaire.` },
    invite:       { subject: `Mise à jour — « ${t} »`, intro: base + `Nous vous prions de bien vouloir noter ce changement.` },
  }
}

/** Suggestion dialog + wizard. Render with `suggest != null` to show. */
export function UpdateNotifySuggestion({ programmeId, programmeName, suggest, onClose }: {
  programmeId: number
  programmeName: string
  suggest: UpdateSuggest | null
  onClose: () => void
}) {
  const [wizard, setWizard] = useState(false)
  useEffect(() => { if (!suggest) setWizard(false) }, [suggest])
  if (!suggest || typeof document === 'undefined') return null

  if (wizard) {
    return (
      <UpdateWizard programmeId={programmeId} programmeName={programmeName}
        session={suggest.session} changeSummary={suggest.changeSummary} onClose={onClose} />
    )
  }
  return createPortal(
    <div onClick={onClose} className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-2xl border-2 border-border bg-card shadow-2xl">
        <div className="px-5 py-4">
          <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
            <BellRing className="h-4 w-4 text-brand-500" />Notifier les personnes concernées ?
          </h2>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Une modification importante vient d&apos;être enregistrée sur
            «&nbsp;{suggest.session.title || 'la session'}&nbsp;». Les porteurs, jurys, membres et
            invités liés à cette session ne sont pas encore au courant.
          </p>
          <p className="mt-2 whitespace-pre-wrap rounded-lg border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5 text-[11px] text-amber-700 dark:text-amber-300">
            {suggest.changeSummary}
          </p>
        </div>
        <div className="flex flex-col gap-2 border-t border-border bg-muted/20 px-5 py-3 sm:flex-row sm:justify-end">
          <button onClick={onClose}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-accent">
            Ignorer
          </button>
          <button autoFocus onClick={() => setWizard(true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-500 px-4 py-1.5 text-xs font-bold text-white hover:bg-brand-600">
            <Mail className="h-3.5 w-3.5" />Préparer les emails
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function UpdateWizard({ programmeId, programmeName, session, changeSummary, onClose }: {
  programmeId: number
  programmeName: string
  session: SessionLike
  changeSummary: string
  onClose: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [cands, setCands] = useState<Cand[]>([])
  const [orgMembers, setOrgMembers] = useState<Record<number, Member[]>>({})
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [touched, setTouched] = useState(false)
  const [tpls, setTpls] = useState(() => updateTemplates(programmeName, session, changeSummary))
  const [step, setStep] = useState(0)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState<{ ok: number; ko: number } | null>(null)

  useEffect(() => {
    let cancelled = false
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
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [programmeId])

  const recipients = useMemo(() => gatherRecipients(session, cands, orgMembers), [session, cands, orgMembers])
  useEffect(() => { if (!touched) setSelected(new Set(recipients.map((r) => norm(r.email)))) }, [recipients, touched])

  const chosen = recipients.filter((r) => selected.has(norm(r.email)))
  const roles = useMemo(
    () => (Object.keys(TYPE_META) as RType[]).filter((t) => chosen.some((r) => r.type === t)),
    [chosen])

  // Steps: 0 = destinataires · 1..roles.length = one mail per role · last = récap.
  const total = 1 + roles.length + 1
  const roleAt = (n: number): RType | null => (n >= 1 && n <= roles.length ? roles[n - 1] : null)
  const stepTitle = (n: number) =>
    n === 0 ? 'Destinataires' : n === total - 1 ? 'Récapitulatif & envoi' : `Email — ${TYPE_META[roleAt(n)!].label}s`

  const toggle = (email: string) => { setTouched(true); setSelected((p) => { const n = new Set(p); const k = norm(email); n.has(k) ? n.delete(k) : n.add(k); return n }) }
  const toggleMany = (emails: string[], on: boolean) => { setTouched(true); setSelected((p) => { const n = new Set(p); for (const e of emails) on ? n.add(norm(e)) : n.delete(norm(e)); return n }) }
  const setTpl = (t: RType, patch: Partial<{ subject: string; intro: string }>) => setTpls((p) => ({ ...p, [t]: { ...p[t], ...patch } }))

  const send = async () => {
    const items = roles.map((t) => {
      const recs = chosen.filter((r) => r.type === t)
      if (recs.length === 0) return null
      return {
        type: t, subject: tpls[t].subject,
        body: emailHtml(programmeName, session, tpls[t].intro, HEADING),
        recipients: recs.map((r) => ({ email: r.email, name: r.name })),
      }
    }).filter(Boolean)
    if (items.length === 0) { toast.error('Aucun destinataire sélectionné.'); return }
    setSending(true)
    try {
      const r = await notificationsApi.sessionNotify({
        programmeId, programmeName, phaseId: session.id, phaseName: session.title, items,
      })
      const ok = (r.data ?? []).filter((x: any) => x.status === 'SENT').length
      const ko = (r.data ?? []).filter((x: any) => x.status === 'FAILED').length
      setSent({ ok, ko })
      toast.success(`${ok} email(s) envoyé(s)${ko ? ` · ${ko} échec(s)` : ''}`)
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Échec de l'envoi des emails")
    } finally { setSending(false) }
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const role = roleAt(step)

  return createPortal(
    <div onClick={onClose} className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div onClick={(e) => e.stopPropagation()}
        className="flex h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border-2 border-border bg-card shadow-2xl">
        {/* Header + stepper */}
        <div className="border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <BellRing className="h-4 w-4 text-brand-500" />
            <h2 className="truncate text-sm font-bold text-foreground">
              Notifier la mise à jour — «&nbsp;{session.title || 'Session'}&nbsp;»
            </h2>
            <button onClick={onClose} className="ml-auto rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <div className="mt-2.5 flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-foreground">Étape {step + 1} / {total} · {stepTitle(step)}</span>
            <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[11px] font-semibold text-brand-600 dark:text-brand-400">
              {chosen.length} destinataire(s)
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-brand-500 transition-all duration-300" style={{ width: `${((step + 1) / total) * 100}%` }} />
          </div>
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex flex-1 items-center justify-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {step === 0 && (
              recipients.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center">
                  <AlertTriangle className="h-7 w-7 text-muted-foreground opacity-40" />
                  <p className="text-sm text-muted-foreground">Personne n&apos;est lié à cette session (pas d&apos;email connu).</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Seules les personnes <b>liées à cette session</b> sont listées — décochez celles à ne pas prévenir.
                  </p>
                  {(Object.keys(TYPE_META) as RType[]).map((t) => {
                    const items = recipients.filter((r) => r.type === t)
                    if (items.length === 0) return null
                    const M = TYPE_META[t]
                    const allOn = items.every((r) => selected.has(norm(r.email)))
                    return (
                      <div key={t} className="rounded-xl border border-border">
                        <button type="button" onClick={() => toggleMany(items.map((r) => r.email), !allOn)}
                          className="flex w-full items-center gap-2 rounded-t-xl bg-muted/30 px-3 py-2 text-left">
                          <input type="checkbox" readOnly checked={allOn} className="h-3.5 w-3.5 accent-brand-500" />
                          <M.icon className="h-3.5 w-3.5" />
                          <span className="text-xs font-bold text-foreground">{M.label}s</span>
                          <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${TONE_CLS[M.tone]}`}>{items.length}</span>
                        </button>
                        <ul className="divide-y divide-border">
                          {items.map((r) => (
                            <li key={r.email}>
                              <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-accent/40">
                                <input type="checkbox" checked={selected.has(norm(r.email))} onChange={() => toggle(r.email)} className="h-3.5 w-3.5 accent-brand-500" />
                                <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                                  {r.name ? <span className="font-medium">{r.name} · </span> : null}
                                  <span className="text-muted-foreground">{r.email}</span>
                                </span>
                                {r.startupName && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">{r.startupName}</span>}
                              </label>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              )
            )}

            {role && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Cet email sera envoyé aux <b>{chosen.filter((r) => r.type === role).length} {TYPE_META[role].label.toLowerCase()}(s)</b> sélectionné(s). Personnalisez-le librement.
                </p>
                <label className="block text-[11px] font-semibold text-muted-foreground">Objet</label>
                <input value={tpls[role].subject} onChange={(e) => setTpl(role, { subject: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
                <label className="block text-[11px] font-semibold text-muted-foreground">Message</label>
                <textarea value={tpls[role].intro} onChange={(e) => setTpl(role, { intro: e.target.value })} rows={6}
                  className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm" />
                <label className="block text-[11px] font-semibold text-muted-foreground">Aperçu</label>
                <div className="rounded-lg border border-border bg-[#f4f6f8] p-3">
                  <div dangerouslySetInnerHTML={{ __html: emailHtml(programmeName, session, tpls[role].intro, HEADING) }} />
                </div>
              </div>
            )}

            {step === total - 1 && (
              <div className="space-y-3">
                {sent ? (
                  <div className="flex flex-col items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/5 px-4 py-10 text-center">
                    <Check className="h-8 w-8 text-emerald-500" />
                    <p className="text-sm font-semibold text-foreground">{sent.ok} email(s) envoyé(s){sent.ko ? ` · ${sent.ko} échec(s)` : ''}</p>
                    <p className="text-xs text-muted-foreground">Chaque envoi est archivé — retrouvez-le dans l&apos;historique de notification de la session.</p>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">Un email personnalisé sera envoyé <b>par rôle</b> :</p>
                    {roles.map((t) => {
                      const M = TYPE_META[t]; const n = chosen.filter((r) => r.type === t).length
                      return (
                        <div key={t} className="flex items-center gap-2 rounded-xl border border-border bg-card p-3">
                          <M.icon className="h-4 w-4 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-bold text-foreground">{tpls[t].subject}</p>
                            <p className="truncate text-[11px] text-muted-foreground">{M.label}s · {n} destinataire(s)</p>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${TONE_CLS[M.tone]}`}>{n}</span>
                        </div>
                      )
                    })}
                    <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" />Chaque envoi est archivé côté notifications.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer nav */}
        <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-3">
          <button onClick={() => (step === 0 || sent ? onClose() : setStep((s) => s - 1))}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-accent">
            {step === 0 || sent ? 'Fermer' : (<><ChevronLeft className="h-3.5 w-3.5" />Précédent</>)}
          </button>
          {!sent && (
            step < total - 1 ? (
              <button onClick={() => {
                if (step === 0 && chosen.length === 0) { toast.error('Sélectionnez au moins un destinataire.'); return }
                setStep((s) => s + 1)
              }}
                className="inline-flex items-center gap-1 rounded-lg bg-brand-500 px-4 py-1.5 text-xs font-bold text-white hover:bg-brand-600">
                Suivant<ChevronRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button onClick={send} disabled={sending || chosen.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-1.5 text-xs font-bold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50">
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {sending ? 'Envoi…' : `Envoyer (${chosen.length})`}
              </button>
            )
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
