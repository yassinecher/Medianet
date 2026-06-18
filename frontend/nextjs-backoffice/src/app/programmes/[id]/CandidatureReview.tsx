'use client'
/**
 * CandidatureReview — a back-office modal that shows a candidature with the SAME
 * jury-style layout (details on the left, scoring on the right) so an admin or
 * investor can review it like a juré. It adds:
 *   • AI scoring (POST /api/ai/score/{id}) — per-criterion + recommendation + commentary;
 *   • jury management — list assignments, change/remove a jury, assign a new one;
 *   • the read-only view of every jury's submitted scores + comments.
 * Admins don't submit scores here (evaluation is the jury's job) — this is a review.
 */
import { useEffect, useState } from 'react'
import {
  X, Sparkles, Loader2, Trophy, Users, Plus, Mail, Trash2, CheckCircle2, Clock,
  ClipboardList, MessageSquare, Star, Send,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { candidaturesApi, contactsApi, usersApi, notificationsApi } from '@/lib/api'
import { CandFields } from './EvaluationDashboard'
import { statusColor, scoreColor } from '@/lib/utils'

const FRONTOFFICE_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_FRONTOFFICE_URL) || 'http://localhost:3000'

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'En attente', UNDER_EVALUATION: 'En évaluation', UNDER_REVIEW: 'En revue',
  ACCEPTED: 'Acceptée', REJECTED: 'Refusée',
}
const REC = {
  ACCEPT: { label: 'Recommandé', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  REVIEW: { label: 'À revoir', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  REJECT: { label: 'Non recommandé', cls: 'bg-rose-500/15 text-rose-700 dark:text-rose-300' },
} as const

function evalEmailHtml(juryName: string, phaseTitle: string | undefined, url: string) {
  const greeting = juryName ? `Bonjour ${juryName},` : 'Bonjour,'
  const ctx = phaseTitle ? ` dans le cadre de « ${phaseTitle} »` : ''
  return `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:auto;color:#0f172a">
  <h2 style="margin:0 0 12px">Demande d'évaluation</h2><p>${greeting}</p>
  <p>Vous êtes invité(e) à évaluer une candidature${ctx}. Aucune inscription n'est nécessaire — cliquez ci-dessous.</p>
  <p style="text-align:center;margin:28px 0"><a href="${url}" style="background:#10b981;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block">Évaluer la candidature</a></p>
  <p style="color:#64748b;font-size:12px">Ou copiez ce lien :<br>${url}</p></div>`
}

interface Contact { id: number; name: string; email: string }

export function CandidatureReview({ candidature, criteria = [], phaseId, phaseTitle, onClose, onChanged }: {
  candidature: any
  criteria?: { id: number; name: string; weight?: number }[]
  phaseId?: number
  phaseTitle?: string
  onClose: () => void
  onChanged?: () => void
}) {
  const [c, setC] = useState<any>(candidature)
  const [ai, setAi] = useState<any | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [pickOpen, setPickOpen] = useState(false)
  // Admin's own scoring (like a jury)
  const [myScores, setMyScores] = useState<Record<number, number>>({})
  const [myComment, setMyComment] = useState('')
  const [mySaving, setMySaving] = useState(false)

  useEffect(() => { setC(candidature) }, [candidature])
  useEffect(() => { contactsApi.list().then(r => setContacts(r.data ?? [])).catch(() => {}) }, [])

  const runAi = async () => {
    setAiLoading(true)
    try {
      const r = await candidaturesApi.mediScore(c.id)
      if (r.data?.aiEnhanced === false) toast.error(r.data?.error ?? "L'évaluation Medi a échoué")
      setAi(r.data)
    }
    catch (e: any) { toast.error(e?.response?.data?.error ?? e?.response?.data?.message ?? "Échec de l'évaluation Medi") }
    finally { setAiLoading(false) }
  }

  // Prefill the admin's sliders from Medi (match criterion by name).
  const applyAiToMine = () => {
    const aic: any[] = ai?.criteria ?? []
    if (!aic.length) return
    const norm = (s: string) => (s ?? '').toLowerCase().trim()
    setMyScores((prev) => {
      const next = { ...prev }
      for (const cr of criteria) {
        const hit = aic.find((x) => norm(x.name) === norm(cr.name))
        if (hit && hit.score != null) next[cr.id] = Math.round(Number(hit.score))
      }
      return next
    })
    toast.success('Notes Medi appliquées')
  }

  // Submit the admin's own evaluation (admin scores like a jury).
  const submitMyEval = async () => {
    setMySaving(true)
    try {
      const r = await candidaturesApi.evaluate(c.id, {
        phaseId,
        comment: myComment,
        criteriaScores: criteria.map((cr) => ({ criteriaId: cr.id, criteriaName: cr.name, score: myScores[cr.id] ?? 0, weight: cr.weight ?? 0 })),
      })
      setC(r.data); onChanged?.()
      toast.success('Votre évaluation a été enregistrée')
    } catch (e: any) { toast.error(e?.response?.data?.message ?? "Échec de l'enregistrement") }
    finally { setMySaving(false) }
  }

  const removeJury = async (a: any) => {
    if (!confirm(`Retirer ${a.juryName || a.juryEmail} de l'évaluation ?`)) return
    setBusy(true)
    try { const r = await candidaturesApi.removeJury(c.id, a.id); setC(r.data); onChanged?.(); toast.success('Jury retiré') }
    catch (e: any) { toast.error(e?.response?.data?.message ?? 'Erreur') }
    finally { setBusy(false) }
  }

  /** Re-send the evaluation link to an assigned jury who hasn't evaluated yet. */
  const resendJury = async (a: any) => {
    if (!a?.token || !a?.juryEmail) { toast.error('Aucun lien d’évaluation pour ce jury.'); return }
    setBusy(true)
    try {
      await notificationsApi.sendEmail({
        toEmail: a.juryEmail, toName: a.juryName || '', html: true,
        subject: `Rappel — évaluation de candidature${phaseTitle ? ` — ${phaseTitle}` : ''}`,
        body: evalEmailHtml(a.juryName || '', phaseTitle, `${FRONTOFFICE_URL}/evaluate/${a.token}`),
      })
      toast.success(`Relance envoyée à ${a.juryName || a.juryEmail}`)
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Échec de l’envoi de la relance') }
    finally { setBusy(false) }
  }

  const assignJury = async (ct: Contact) => {
    setBusy(true)
    try {
      let juryId: number | undefined
      try {
        const u = await usersApi.byEmail(ct.email)
        if (u.data?.id) { juryId = u.data.id; try { await usersApi.assignRoles(u.data.id, ['JURY']) } catch { /* maybe already */ } }
      } catch { /* no account → token */ }
      const res = await candidaturesApi.assignJury(c.id, { juryAssignments: [{ juryId, juryEmail: ct.email, juryName: ct.name }], phaseId })
      const token = (res.data?.juryAssignments ?? []).find((a: any) => (a.juryEmail || '').toLowerCase() === ct.email.toLowerCase())?.token
      if (token) {
        try {
          await notificationsApi.sendEmail({
            toEmail: ct.email, toName: ct.name, html: true,
            subject: `Évaluation de candidature${phaseTitle ? ` — ${phaseTitle}` : ''}`,
            body: evalEmailHtml(ct.name, phaseTitle, `${FRONTOFFICE_URL}/evaluate/${token}`),
          })
        } catch { /* mail best-effort */ }
      }
      setC(res.data); setPickOpen(false); onChanged?.()
      toast.success(`Évaluation demandée à ${ct.name}`)
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Erreur') }
    finally { setBusy(false) }
  }

  const assignments: any[] = c.juryAssignments ?? []
  const evals: any[] = c.evaluations ?? []
  const evalOf = (a: any) => evals.find((e) =>
    (e.juryEmail || '').toLowerCase() === (a.juryEmail || '').toLowerCase()
    && (e.phaseId ?? null) === (a.phaseId ?? null))
  const score = c.totalScore
  const aiCrits: any[] = ai?.criteria ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand-500">Revue de candidature</p>
            <h2 className="truncate text-lg font-bold text-foreground">{c.projectName || c.companyName || `Candidature #${c.id}`}</h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {c.companyName && c.projectName && <span>{c.companyName}</span>}
              {c.porteurName && <span>· {c.porteurName}</span>}
              {c.status && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusColor(c.status)}`}>{STATUS_LABEL[c.status] ?? c.status}</span>}
              {score != null && <span className={`inline-flex items-center gap-1 font-bold ${scoreColor(Number(score))}`}><Trophy className="h-3 w-3" />{Number(score).toFixed(1)}/10</span>}
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        {/* Body: details (left) + review (right) */}
        <div className="grid flex-1 gap-4 overflow-y-auto p-4 lg:grid-cols-2">
          <div className="min-w-0"><CandFields c={c} /></div>

          <div className="min-w-0 space-y-4">
            {/* AI scoring */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-bold text-foreground"><Sparkles className="h-4 w-4 text-purple-500" />Évaluation IA</h3>
                <button onClick={runAi} disabled={aiLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-brand-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
                  {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {ai ? 'Relancer' : "Lancer l'évaluation IA"}
                </button>
              </div>
              {!ai && !aiLoading && <p className="text-xs text-muted-foreground">Obtenez une notation IA indicative (rule-based + commentaire) pour orienter le jury.</p>}
              {aiLoading && <p className="text-xs text-muted-foreground">Analyse en cours…</p>}
              {ai && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${(REC as any)[ai.recommendation]?.cls ?? 'bg-muted text-muted-foreground'}`}>
                      {(REC as any)[ai.recommendation]?.label ?? ai.recommendation}
                    </span>
                    <span className={`inline-flex items-center gap-1 text-sm font-extrabold ${scoreColor(Number(ai.weightedScore ?? 0))}`}>
                      <Star className="h-3.5 w-3.5" />{Number(ai.weightedScore ?? 0).toFixed(1)}/10
                    </span>
                    {!ai.aiEnhanced && <span className="text-[10px] text-muted-foreground">(commentaire IA indisponible)</span>}
                  </div>
                  {aiCrits.length > 0 && (
                    <div className="space-y-1">
                      {aiCrits.map((cr: any, i: number) => (
                        <div key={i} className="rounded-lg bg-muted/30 px-2.5 py-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-foreground">{cr.name}</span>
                            {cr.score != null && <span className={`text-xs font-bold ${scoreColor(Number(cr.score))}`}>{Number(cr.score).toFixed(1)}/10</span>}
                          </div>
                          {cr.comment && <p className="mt-0.5 text-[11px] text-muted-foreground">{cr.comment}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                  {ai.globalCommentary && (
                    <div className="rounded-lg border border-purple-300/30 bg-purple-500/5 p-2.5 text-xs text-foreground">
                      <p className="mb-0.5 font-semibold text-purple-700 dark:text-purple-300">Synthèse IA</p>
                      {ai.globalCommentary}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Admin's own evaluation (scores like a jury) */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-bold text-foreground"><Star className="h-4 w-4 text-amber-500" />Mon évaluation</h3>
                {ai && (ai.criteria ?? []).length > 0 && (
                  <button onClick={applyAiToMine} className="inline-flex items-center gap-1 rounded-md border border-purple-400/50 px-2 py-1 text-[11px] font-semibold text-purple-700 hover:bg-purple-500/10 dark:text-purple-300">
                    <Sparkles className="h-3 w-3" />Utiliser les notes IA
                  </button>
                )}
              </div>
              {criteria.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Aucun critère défini pour ce programme — ajoutez-en dans l&apos;onglet « Critères ».</p>
              ) : (
                <div className="space-y-2">
                  {criteria.map((cr) => (
                    <div key={cr.id}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-foreground">{cr.name}{cr.weight != null && cr.weight > 0 && <span className="ml-1 text-[10px] text-muted-foreground">({Math.round(cr.weight * 100)}%)</span>}</span>
                        <span className="text-xs font-bold text-brand-600">{myScores[cr.id] ?? 0}/10</span>
                      </div>
                      <input type="range" min={0} max={10} step={1} value={myScores[cr.id] ?? 0}
                        onChange={(e) => setMyScores((s) => ({ ...s, [cr.id]: Number(e.target.value) }))}
                        className="w-full accent-brand-500" />
                    </div>
                  ))}
                  <textarea value={myComment} onChange={(e) => setMyComment(e.target.value)} rows={2}
                    placeholder="Commentaire / appréciation globale…"
                    className="w-full rounded-lg border border-input bg-background p-2 text-xs outline-none focus:border-brand-500" />
                  <button onClick={submitMyEval} disabled={mySaving}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-60">
                    {mySaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}Enregistrer mon évaluation
                  </button>
                </div>
              )}
            </div>

            {/* Jury management */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-bold text-foreground"><Users className="h-4 w-4 text-brand-500" />Jurys</h3>
                <button onClick={() => setPickOpen((v) => !v)} disabled={busy}
                  className="inline-flex items-center gap-1 rounded-md border border-brand-500/40 px-2 py-1 text-[11px] font-semibold text-brand-700 hover:bg-brand-500/10 dark:text-brand-300">
                  <Plus className="h-3 w-3" />Assigner / changer
                </button>
              </div>
              {assignments.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Aucun jury assigné.</p>
              ) : (
                <div className="space-y-1.5">
                  {assignments.map((a) => {
                    const ev = evalOf(a)
                    const submitted = a.status === 'SUBMITTED' || !!ev
                    return (
                      <div key={a.id ?? a.juryEmail} className="flex items-center gap-2 rounded-lg border border-border bg-background/50 px-2.5 py-1.5">
                        {submitted ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> : <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-foreground truncate">{a.juryName || a.juryEmail}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{a.juryEmail}</p>
                        </div>
                        {ev?.weightedScore != null && <span className={`text-xs font-bold ${scoreColor(Number(ev.weightedScore))}`}>{Number(ev.weightedScore).toFixed(1)}</span>}
                        {!submitted && a.token && (
                          <button onClick={() => resendJury(a)} disabled={busy} title="Renvoyer le lien d’évaluation"
                            className="rounded p-1 text-muted-foreground hover:bg-brand-500/10 hover:text-brand-600 disabled:opacity-50"><Send className="h-3.5 w-3.5" /></button>
                        )}
                        <button onClick={() => removeJury(a)} disabled={busy} title="Retirer ce jury"
                          className="rounded p-1 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    )
                  })}
                </div>
              )}
              {pickOpen && (
                <div className="mt-2 rounded-lg border border-border bg-muted/20 p-2 space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Demander une évaluation à…</p>
                  {contacts.length === 0 && <p className="px-1 text-[11px] italic text-muted-foreground">Aucun contact. Ajoutez-en dans l&apos;onglet « Invitations ».</p>}
                  {contacts.map((ct) => (
                    <button key={ct.id} disabled={busy} onClick={() => assignJury(ct)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs hover:bg-accent disabled:opacity-50">
                      <Mail className="h-3 w-3 shrink-0 text-muted-foreground" /><span className="truncate">{ct.name}</span>
                      <span className="truncate text-[10px] text-muted-foreground">{ct.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Submitted evaluations (read-only) */}
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground"><ClipboardList className="h-4 w-4 text-brand-500" />Évaluations du jury</h3>
              {evals.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Aucune évaluation soumise.</p>
              ) : (
                <div className="space-y-2">
                  {evals.map((e, i) => (
                    <div key={i} className="rounded-lg border border-border bg-background/50 p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-foreground">{e.juryName || e.juryEmail}</span>
                        {e.weightedScore != null && <span className={`text-xs font-bold ${scoreColor(Number(e.weightedScore))}`}>{Number(e.weightedScore).toFixed(1)}/10</span>}
                      </div>
                      {(e.criteriaScores ?? []).length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {e.criteriaScores.map((cs: any, j: number) => (
                            <span key={j} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                              {cs.criteriaName}<span className="font-bold text-amber-600">{cs.score}</span>
                            </span>
                          ))}
                        </div>
                      )}
                      {e.comment && (
                        <p className="mt-1 flex items-start gap-1 text-[11px] text-muted-foreground">
                          <MessageSquare className="mt-0.5 h-3 w-3 shrink-0" />{e.comment}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
