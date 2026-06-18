'use client'
/**
 * Admin candidature detail — full view + management for one candidature:
 * header with status + accept/reject, the complete submission (CandFields), the
 * jury assignments + submitted evaluations, and a « Revue / Évaluer » button that
 * opens the CandidatureReview modal (Medi AI scoring, admin scoring, jury change).
 * Reached from the candidatures list and the organisation detail page.
 */
import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Loader2, FileText, Trophy, Calendar, Building2, CheckCircle2, XCircle,
  Eye, Users, Clock, Mail, Layers, Send,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { candidaturesApi, programmesApi, notificationsApi } from '@/lib/api'

const FRONTOFFICE_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_FRONTOFFICE_URL) || 'http://localhost:3000'

function evalEmailHtml(juryName: string, sessionName: string, url: string) {
  const greeting = juryName ? `Bonjour ${juryName},` : 'Bonjour,'
  const ctx = sessionName ? ` dans le cadre de « ${sessionName} »` : ''
  return `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:auto;color:#0f172a">
  <h2 style="margin:0 0 12px">Demande d'évaluation</h2><p>${greeting}</p>
  <p>Vous êtes invité(e) à évaluer une candidature${ctx}. Aucune inscription n'est nécessaire — cliquez ci-dessous.</p>
  <p style="text-align:center;margin:28px 0"><a href="${url}" style="background:#10b981;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block">Évaluer la candidature</a></p>
  <p style="color:#64748b;font-size:12px">Ou copiez ce lien :<br>${url}</p></div>`
}
import { AdminLayout } from '@/components/layout/AdminLayout'
import { MagicCard } from '@/components/magicui/magic-card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CandFields } from '../../programmes/[id]/EvaluationDashboard'
import { CandidatureReview } from '../../programmes/[id]/CandidatureReview'
import { statusColor, scoreColor, formatDate } from '@/lib/utils'

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Soumise', UNDER_EVALUATION: 'En évaluation', ACCEPTED: 'Acceptée', REJECTED: 'Refusée',
}

export default function AdminCandidatureDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = Number(Array.isArray(params.id) ? params.id[0] : params.id)

  const [c, setC] = useState<any | null>(null)
  const [criteria, setCriteria] = useState<any[]>([])
  const [phaseNames, setPhaseNames] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [review, setReview] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await candidaturesApi.get(id)
      setC(r.data)
      if (r.data?.programmeId) {
        try { setCriteria((await programmesApi.criteria(r.data.programmeId)).data ?? []) } catch { /* none */ }
        try {
          const phs = (await programmesApi.phases(r.data.programmeId)).data ?? []
          const m: Record<number, string> = {}
          phs.forEach((p: any) => { m[p.id] = p.title ?? p.name ?? `Session #${p.id}` })
          setPhaseNames(m)
        } catch { /* none */ }
      }
    } catch { setError('Candidature introuvable.') }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { if (!isNaN(id)) load() }, [id, load])

  const accept = async () => {
    if (!confirm('Accepter cette candidature ?')) return
    setBusy(true)
    try { await candidaturesApi.accept(id); toast.success('Candidature acceptée'); load() }
    catch { toast.error('Erreur') } finally { setBusy(false) }
  }
  const reject = async () => {
    const reason = window.prompt('Motif du refus (envoyé au porteur) :'); if (reason === null) return
    setBusy(true)
    try { await candidaturesApi.reject(id, reason || 'Non précisé'); toast.success('Candidature refusée'); load() }
    catch { toast.error('Erreur') } finally { setBusy(false) }
  }

  /** Re-send the evaluation link to an assigned jury who hasn't evaluated yet. */
  const resend = async (a: any) => {
    if (!a?.token || !a?.juryEmail) { toast.error('Aucun lien d’évaluation pour ce jury.'); return }
    setBusy(true)
    try {
      const sname = a.phaseId != null ? (phaseNames[a.phaseId] ?? '') : ''
      await notificationsApi.sendEmail({
        toEmail: a.juryEmail, toName: a.juryName || '', html: true,
        subject: `Rappel — évaluation de candidature${sname ? ` — ${sname}` : ''}`,
        body: evalEmailHtml(a.juryName || '', sname, `${FRONTOFFICE_URL}/evaluate/${a.token}`),
      })
      toast.success(`Relance envoyée à ${a.juryName || a.juryEmail}`)
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Échec de l’envoi de la relance') }
    finally { setBusy(false) }
  }

  if (loading) {
    return <AdminLayout><div className="space-y-4"><Skeleton className="h-28 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></div></AdminLayout>
  }
  if (error || !c) {
    return (
      <AdminLayout>
        <div className="py-20 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground opacity-30" />
          <p className="mt-3 text-sm text-muted-foreground">{error ?? 'Candidature introuvable.'}</p>
          <Link href="/candidatures" className="mt-4 inline-block"><Button variant="brand">Candidatures</Button></Link>
        </div>
      </AdminLayout>
    )
  }

  const decided = c.status === 'ACCEPTED' || c.status === 'REJECTED'
  const evals: any[] = c.evaluations ?? []
  const assignments: any[] = c.juryAssignments ?? []
  const evalOf = (a: any) => evals.find((e) =>
    (e.juryEmail || '').toLowerCase() === (a.juryEmail || '').toLowerCase()
    && (e.phaseId ?? null) === (a.phaseId ?? null))

  // Group jurys + evaluations BY SESSION so each evaluation round is shown apart —
  // a candidature evaluated in several sessions has one block per session.
  const sessionLabel = (pid: number | null) => (pid != null ? (phaseNames[pid] ?? `Session #${pid}`) : 'Hors session')
  const sessionKeys: (number | null)[] = Array.from(new Set<number | null>([
    ...assignments.map((a) => (a.phaseId ?? null)),
    ...evals.map((e) => (e.phaseId ?? null)),
  ])).sort((a, b) => (a == null ? 1 : b == null ? -1 : sessionLabel(a).localeCompare(sessionLabel(b))))
  const avgFor = (es: any[]) => {
    const xs = es.map((e) => e.weightedScore).filter((x) => x != null).map(Number)
    return xs.length ? xs.reduce((s, n) => s + n, 0) / xs.length : null
  }

  return (
    <AdminLayout>
      <div className="space-y-5">
        <button onClick={() => router.push('/candidatures')} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Candidatures
        </button>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="h-2 bg-gradient-to-r from-brand-500 via-brand-600 to-emerald-500" />
          <div className="flex flex-wrap items-start justify-between gap-3 p-5">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-foreground">{c.projectName || c.companyName || `Candidature #${c.id}`}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                {c.companyName && c.projectName && <span>{c.companyName}</span>}
                {c.porteurName && <span>· {c.porteurName}</span>}
                {c.porteurEmail && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{c.porteurEmail}</span>}
                {(c.submittedAt || c.createdAt) && <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(c.submittedAt ?? c.createdAt)}</span>}
                {c.programmeId && <Link href={`/programmes/${c.programmeId}`} className="inline-flex items-center gap-1 text-brand-600 hover:underline dark:text-brand-400"><Layers className="h-3 w-3" />{c.programmeName ?? 'Programme'}</Link>}
                {c.organizationId && <Link href={`/organizations/${c.organizationId}`} className="inline-flex items-center gap-1 text-brand-600 hover:underline dark:text-brand-400"><Building2 className="h-3 w-3" />Organisation</Link>}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColor(c.status)}`}>{STATUS_LABEL[c.status] ?? c.status}</span>
                {c.totalScore != null && <span className={`inline-flex items-center gap-1 text-sm font-bold ${scoreColor(Number(c.totalScore))}`}><Trophy className="h-4 w-4" />{Number(c.totalScore).toFixed(1)}/10</span>}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <Button variant="brand" size="sm" onClick={() => setReview(true)} className="gap-1.5"><Eye className="h-3.5 w-3.5" />Revue / Évaluer</Button>
                {!decided && (
                  <>
                    <Button variant="outline" size="sm" onClick={accept} disabled={busy} className="gap-1 text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" />Accepter</Button>
                    <Button variant="outline" size="sm" onClick={reject} disabled={busy} className="gap-1 text-rose-700 dark:text-rose-300"><XCircle className="h-3.5 w-3.5" />Refuser</Button>
                  </>
                )}
              </div>
            </div>
          </div>
          {c.status === 'REJECTED' && c.rejectionReason && (
            <p className="mx-5 mb-4 rounded-lg border border-rose-300/40 bg-rose-500/5 px-3 py-2 text-xs text-rose-700 dark:text-rose-300"><b>Motif :</b> {c.rejectionReason}</p>
          )}
        </motion.div>

        <div className="grid gap-5 lg:grid-cols-3">
          {/* Full submission */}
          <div className="lg:col-span-2"><CandFields c={c} /></div>

          {/* Jurys + evaluations, grouped by evaluation session */}
          <div className="space-y-4">
            {sessionKeys.length === 0 ? (
              <MagicCard className="p-4">
                <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground"><Users className="h-4 w-4 text-brand-500" />Évaluations</h2>
                <p className="text-xs text-muted-foreground italic">Aucun jury assigné ni évaluation. Utilisez « Revue / Évaluer ».</p>
              </MagicCard>
            ) : sessionKeys.map((pid) => {
              const as = assignments.filter((a) => (a.phaseId ?? null) === pid)
              const es = evals.filter((e) => (e.phaseId ?? null) === pid)
              const pending = as.filter((a) => !(a.status === 'SUBMITTED' || !!evalOf(a)))
              const submitted = as.length - pending.length
              const avg = avgFor(es)
              return (
                <MagicCard key={String(pid)} className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="flex items-center gap-2 text-sm font-bold text-foreground"><Layers className="h-4 w-4 text-amber-500" />{sessionLabel(pid)}</h2>
                    <span className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
                      {submitted}/{as.length} jury{avg != null ? ` · moy ${avg.toFixed(1)}` : ''}
                    </span>
                  </div>

                  {/* Submitted evaluations (full detail) */}
                  {es.length > 0 && (
                    <div className="space-y-2">
                      {es.map((e, i) => (
                        <div key={i} className="rounded-lg border border-border bg-background/50 p-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-foreground"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />{e.juryName || e.juryEmail}</span>
                            {e.weightedScore != null && <span className={`text-xs font-bold ${scoreColor(Number(e.weightedScore))}`}>{Number(e.weightedScore).toFixed(1)}/10</span>}
                          </div>
                          {(e.criteriaScores ?? []).length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {e.criteriaScores.map((cs: any, j: number) => (
                                <span key={j} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{cs.criteriaName}<span className="font-bold text-amber-600">{cs.score}</span></span>
                              ))}
                            </div>
                          )}
                          {e.comment && <p className="mt-1 text-[11px] text-muted-foreground">{e.comment}</p>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Pending jurys (assigned, not yet evaluated in this session) */}
                  {pending.map((a) => (
                    <div key={a.id ?? a.juryEmail} className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-background/30 px-2.5 py-1.5">
                      <Clock className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">{a.juryName || a.juryEmail}</span>
                      <span className="text-[10px] text-muted-foreground">En attente</span>
                      {a.token && (
                        <button onClick={() => resend(a)} disabled={busy} title="Renvoyer le lien d’évaluation"
                          className="inline-flex items-center gap-1 rounded-md border border-brand-500/40 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700 hover:bg-brand-500/10 disabled:opacity-50 dark:text-brand-300">
                          <Send className="h-3 w-3" />Renvoyer
                        </button>
                      )}
                    </div>
                  ))}

                  {es.length === 0 && pending.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">Aucune évaluation pour cette session.</p>
                  )}
                </MagicCard>
              )
            })}
          </div>
        </div>
      </div>

      {review && (
        <CandidatureReview
          candidature={c}
          criteria={criteria as any}
          onClose={() => setReview(false)}
          onChanged={load}
        />
      )}
    </AdminLayout>
  )
}
