'use client'
/**
 * Function-aware phase panels shown inside the Parcours session overlay when a
 * session's « Fonction » is set:
 *   • CANDIDATURE_SUBMISSION → CandidaturePhasePanel (form link + live count)
 *   • PRESELECTION           → PreselectionPhasePanel (candidature list + jury requests)
 *
 * Reuses existing endpoints — no backend change. The no-login token evaluation
 * page + full criteria/note eval form are a later phase.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { FileText, Users, Mail, Plus, ExternalLink, Loader2, ClipboardList, Trophy, CheckCircle2, XCircle, Clock, Save, Wand2, ChevronUp, ChevronDown, ListChecks, Send, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { candidaturesApi, contactsApi, notificationsApi, programmesApi, usersApi, formTemplatesApi } from '@/lib/api'
import { FormBuilder } from '@/components/formbuilder/FormBuilder'
import { FormPreview } from '@/components/formbuilder/FormPreview'
import { parseSchema, type CustomFormSchema } from '@/components/formbuilder/schema'

const TEMPLATE_LABELS: Record<string, string> = {
  STANDARD: 'Standard', MINIMAL: 'Minimaliste', FOODSTART: 'FoodStart',
  TECH: 'Tech / SaaS', AGRITECH: 'Agritech',
}

const FRONTOFFICE_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_FRONTOFFICE_URL) || 'http://localhost:3000'

/** Plain HTML body for the jury evaluation email — a single « Évaluer » button,
 *  no account/registration step. */
function evalEmailHtml(juryName: string, phaseTitle: string | undefined, url: string) {
  const greeting = juryName ? `Bonjour ${juryName},` : 'Bonjour,'
  const ctx = phaseTitle ? ` dans le cadre de « ${phaseTitle} »` : ''
  return `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:auto;color:#0f172a">
  <h2 style="margin:0 0 12px">Demande d'évaluation</h2>
  <p>${greeting}</p>
  <p>Vous êtes invité(e) à évaluer une candidature${ctx}. Aucune inscription n'est nécessaire — cliquez simplement ci-dessous.</p>
  <p style="text-align:center;margin:28px 0">
    <a href="${url}" style="background:#10b981;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block">Évaluer la candidature</a>
  </p>
  <p style="color:#64748b;font-size:12px">Ou copiez ce lien dans votre navigateur :<br>${url}</p>
</div>`
}

interface PhaseSession {
  id: number
  title?: string
  focusCriteriaIds?: number[]
  criterionWeightsJson?: string
  /** Saved candidature-selection (shortlist) this évaluation session works on. */
  evaluationSelectionId?: number | null
}
interface Contact { id: number; name: string; email: string }

/** A person who can be invited to evaluate — anyone in the directory, with roles. */
interface Person { id?: number; name: string; email: string; roles: string[]; source: 'user' | 'contact' }
const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Admin', JURY: 'Jury', PORTEUR: 'Porteur', MEMBER: 'Membre',
  INVESTOR: 'Investisseur', PARTNER: 'Partenaire', COACH: 'Coach', USER: 'Utilisateur',
}
const ROLE_CLS: Record<string, string> = {
  ADMIN: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  JURY: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  INVESTOR: 'bg-purple-500/15 text-purple-700 dark:text-purple-300',
}
interface Criterion { id: number; name: string; weight?: number }

const CAND_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING:      { label: 'En attente',  cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300/40' },
  UNDER_REVIEW: { label: 'En revue',    cls: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-300/40' },
  UNDER_EVALUATION: { label: 'En évaluation', cls: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-300/40' },
  ACCEPTED:     { label: 'Acceptée',    cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300/40' },
  REJECTED:     { label: 'Rejetée',     cls: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-300/40' },
}

// ── Candidature phase ───────────────────────────────────────────────────────

export function CandidaturePhasePanel({ programmeId }: { programmeId: number }) {
  const [stats, setStats] = useState<Record<string, number>>({})
  const [prog, setProg] = useState<any>(null)
  // Inline form editor — the candidature form lives ONLY here (this session).
  const [schema, setSchema] = useState<CustomFormSchema | null>(null)
  const [tmpl, setTmpl] = useState<string>('STANDARD')
  const [savingForm, setSavingForm] = useState(false)
  const [savedTpls, setSavedTpls] = useState<{ id: number; name: string; schemaJson: string }[]>([])
  const [previewOpen, setPreviewOpen] = useState(false)
  // Received candidatures — the clean, manageable list of this session.
  const [cands, setCands] = useState<any[]>([])
  const [loadingCands, setLoadingCands] = useState(true)

  const loadProg = useCallback(() => {
    programmesApi.get(programmeId).then(r => {
      const p = r.data ?? null
      setProg(p)
      setSchema(parseSchema(p?.customFormSchema))
      setTmpl(p?.formTemplate ?? 'STANDARD')
    }).catch(() => {})
  }, [programmeId])

  useEffect(() => {
    candidaturesApi.programmeStats(programmeId).then(r => setStats(r.data ?? {})).catch(() => {})
    candidaturesApi.byProgramme(programmeId)
      .then(r => setCands(r.data ?? []))
      .catch(() => {})
      .finally(() => setLoadingCands(false))
    loadProg()
    formTemplatesApi.list().then(r => setSavedTpls(r.data ?? [])).catch(() => {})
  }, [programmeId, loadProg])

  const total = stats.total ?? Object.values(stats).reduce((a, b) => a + (b || 0), 0)

  const saveForm = async () => {
    setSavingForm(true)
    try {
      await programmesApi.update(programmeId, {
        customFormSchema: schema ? JSON.stringify(schema) : '',
        formTemplate: tmpl || undefined,
      })
      toast.success('Formulaire enregistré')
      loadProg()
    } catch { toast.error('Erreur') } finally { setSavingForm(false) }
  }
  const saveTpl = async () => {
    if (!schema) return
    const name = prompt('Nom du modèle :')?.trim(); if (!name) return
    try {
      await formTemplatesApi.create({ name, schemaJson: JSON.stringify(schema) })
      toast.success('Modèle enregistré')
      formTemplatesApi.list().then(r => setSavedTpls(r.data ?? [])).catch(() => {})
    } catch { toast.error('Erreur') }
  }
  const loadTpl = (id: number) => {
    const t = savedTpls.find(x => x.id === id)
    const s = t && parseSchema(t.schemaJson)
    if (s) { setSchema(s); toast.success(`Modèle « ${t!.name} » chargé`) }
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {prog && (
        <div className={`rounded-xl border p-3 text-xs ${prog.acceptingApplications ? 'border-emerald-300/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-amber-300/50 bg-amber-500/10 text-amber-700 dark:text-amber-300'}`}>
          <p className="font-bold">{prog.acceptingApplications ? '🟢 Candidatures ouvertes' : '🔒 Candidatures fermées'}</p>
          <p className="mt-0.5 opacity-90">
            {prog.candidatureDeadline
              ? `Ouvert pendant la session de candidature — jusqu'au ${new Date(prog.candidatureDeadline).toLocaleDateString('fr-FR')}.`
              : 'Donnez des dates à cette session de candidature pour ouvrir le formulaire.'}
          </p>
        </div>
      )}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <FileText className="h-4 w-4 text-brand-500" />Formulaire de cette session
          </h3>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setPreviewOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent">
              <ExternalLink className="h-3.5 w-3.5" />Aperçu
            </button>
            <button onClick={saveForm} disabled={savingForm}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 text-white px-3 py-1.5 text-xs font-semibold hover:bg-brand-600 disabled:opacity-50">
              {savingForm ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}Enregistrer
            </button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground mb-2">
          Le formulaire est rattaché à cette session — les porteurs ne postulent que pendant sa période.
        </p>

        {/* Mode toggle: preset template vs custom builder */}
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl border border-border bg-muted/30 mb-3">
          <button type="button" onClick={() => setSchema(null)}
            className={`rounded-lg px-2 py-1.5 text-xs font-medium transition-all ${!schema ? 'bg-card text-foreground shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground'}`}>
            <span className="inline-flex items-center justify-center gap-1.5"><FileText className="h-3.5 w-3.5" />Template</span>
          </button>
          <button type="button" onClick={() => setSchema(schema ?? { sections: [{ key: 'section_1', title: 'Présentation du projet', description: '', fields: [{ key: 'project_name', label: 'Nom du projet', type: 'text', required: true }] }] })}
            className={`rounded-lg px-2 py-1.5 text-xs font-medium transition-all ${schema ? 'bg-card text-foreground shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground'}`}>
            <span className="inline-flex items-center justify-center gap-1.5"><Wand2 className="h-3.5 w-3.5" />Personnalisé</span>
          </button>
        </div>

        {!schema ? (
          <select value={tmpl} onChange={(e) => setTmpl(e.target.value)}
            className="w-full h-9 rounded-lg border border-input bg-background px-2 text-sm">
            <option value="STANDARD">Standard — 4 sections</option>
            <option value="MINIMAL">Minimaliste</option>
            <option value="FOODSTART">FoodStart</option>
            <option value="TECH">Tech / SaaS</option>
            <option value="AGRITECH">Agritech</option>
          </select>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <button type="button" onClick={saveTpl}
                className="inline-flex items-center gap-1.5 rounded-md border border-brand-500/40 px-2 py-1 text-[11px] font-semibold text-brand-700 dark:text-brand-300 hover:bg-brand-500/10">
                <Save className="h-3 w-3" />Enregistrer comme modèle
              </button>
              {savedTpls.length > 0 && (
                <select defaultValue="" onChange={(e) => { const v = e.target.value; if (v) loadTpl(Number(v)); e.currentTarget.value = '' }}
                  className="h-7 rounded-md border border-input bg-background px-1.5 text-[11px]">
                  <option value="">Charger un modèle…</option>
                  {savedTpls.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              )}
            </div>
            <FormBuilder value={schema} onChange={setSchema} />
          </>
        )}

      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          ['Reçues', total],
          ['Acceptées', stats.accepted ?? stats.ACCEPTED ?? 0],
          ['En attente', stats.pending ?? stats.PENDING ?? 0],
        ].map(([label, n]) => (
          <div key={label as string} className="rounded-xl border border-border bg-card p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{n as number}</p>
            <p className="text-[11px] text-muted-foreground">{label as string}</p>
          </div>
        ))}
      </div>

      {/* Candidatures reçues — clean list, managed in the Candidatures module */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Users className="h-4 w-4 text-brand-500" />Candidatures reçues
            <span className="text-[11px] font-normal text-muted-foreground">{cands.length}</span>
          </h3>
          <Link href={`/candidatures?programme=${programmeId}`}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-600 dark:text-brand-400 hover:underline">
            <ExternalLink className="h-3 w-3" />Gérer dans le module Candidatures
          </Link>
        </div>
        {loadingCands ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>
        ) : cands.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-border bg-muted/10 p-5 text-center text-xs text-muted-foreground">
            Aucune candidature reçue pour l&apos;instant — elles apparaîtront ici dès la première soumission.
          </div>
        ) : (
          <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
            {[...cands]
              .sort((a, b) => new Date(b.submittedAt ?? b.createdAt ?? 0).getTime() - new Date(a.submittedAt ?? a.createdAt ?? 0).getTime())
              .map((c: any) => {
                const st = CAND_STATUS[c.status] ?? CAND_STATUS.PENDING
                const when = c.submittedAt ?? c.createdAt
                return (
                  <div key={c.id} className="flex items-center gap-2 px-3 py-2 bg-card hover:bg-accent/30 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-foreground truncate">{c.projectName || c.companyName || `Candidature #${c.id}`}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {c.porteurName || c.founderName || ''}{c.porteurEmail ? ` · ${c.porteurEmail}` : ''}
                      </p>
                    </div>
                    {when && (
                      <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:inline">
                        {new Date(when).toLocaleDateString('fr-FR')}
                      </span>
                    )}
                    {c.totalScore != null && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 shrink-0">
                        <Trophy className="h-3 w-3" />{Number(c.totalScore).toFixed(1)}
                      </span>
                    )}
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold shrink-0 ${st.cls}`}>{st.label}</span>
                  </div>
                )
              })}
          </div>
        )}
      </div>

      {/* Form preview — the only place the form is previewed/edited */}
      <FormPreview
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        schema={schema}
        templateName={tmpl}
        templateLabel={TEMPLATE_LABELS[tmpl] ?? tmpl} />
    </div>
  )
}

// ── Présélection phase ──────────────────────────────────────────────────────

export function PreselectionPhasePanel({ programmeId, session, onUpdateSession }: {
  programmeId: number
  session: PhaseSession
  /** Persists a patch on the session (e.g. the chosen evaluation list). */
  onUpdateSession?: (patch: { evaluationSelectionId: number }) => void
}) {
  const [cands, setCands] = useState<any[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [pickSearch, setPickSearch] = useState('')
  const [criteria, setCriteria] = useState<Criterion[]>([])
  const [loading, setLoading] = useState(true)
  const [pickFor, setPickFor] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  // ── Saved selection versions (shortlists) ──
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [versions, setVersions] = useState<{ id: number; name: string; candidatureIds: number[] }[]>([])
  const [activeVersionId, setActiveVersionId] = useState<number | null>(null)
  const [versionName, setVersionName] = useState('')
  const [savingSel, setSavingSel] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [minScore, setMinScore] = useState('')
  const [sortBy, setSortBy] = useState<'none' | 'score' | 'status'>('none')

  const reload = useCallback(async () => {
    try { const r = await candidaturesApi.byProgramme(programmeId); setCands(r.data ?? []) }
    finally { setLoading(false) }
  }, [programmeId])
  const reloadVersions = useCallback(() => {
    candidaturesApi.listSelections(programmeId).then(r => setVersions(r.data ?? [])).catch(() => {})
  }, [programmeId])

  useEffect(() => {
    reload()
    reloadVersions()
    contactsApi.list().then(r => setContacts(r.data ?? [])).catch(() => {})
    usersApi.list().then(r => setUsers(r.data?.content ?? r.data ?? [])).catch(() => {})
    programmesApi.criteria(programmeId).then(r => {
      const all: Criterion[] = r.data ?? []
      const focus = session.focusCriteriaIds ?? []
      setCriteria(focus.length ? all.filter(c => focus.includes(c.id)) : all)
    }).catch(() => {})
  }, [reload, reloadVersions, programmeId, session.focusCriteriaIds])

  const requestEvaluation = async (candId: number, jurys: Contact[]) => {
    if (!jurys.length) return
    setBusy(true)
    try {
      // 1) For emails that already have an account, just add the JURY role
      //    (no re-registration). Unknown emails evaluate via the token link.
      const items = await Promise.all(jurys.map(async (j) => {
        let juryId: number | undefined
        try {
          const u = await usersApi.byEmail(j.email)
          if (u.data?.id) {
            juryId = u.data.id
            try { await usersApi.assignRoles(u.data.id, ['JURY']) } catch { /* role may already be set */ }
          }
        } catch { /* 404 → no account, evaluate via token */ }
        return { juryId, juryEmail: j.email, juryName: j.name }
      }))

      // 2) Create assignments — tag with this (préselection) session so the eval
      //    grid scopes to its criteria; the server generates a per-jury token.
      const res = await candidaturesApi.assignJury(candId, { juryAssignments: items, phaseId: session.id })
      const assignments: { juryEmail?: string; token?: string; phaseId?: number }[] = res.data?.juryAssignments ?? []
      const tokenFor = (email: string) =>
        assignments.find(a => (a.juryEmail || '').toLowerCase() === email.toLowerCase() && (a.phaseId ?? null) === session.id)?.token
        ?? assignments.find(a => (a.juryEmail || '').toLowerCase() === email.toLowerCase())?.token

      // 3) Email each jury a no-login evaluation link (no "create account").
      let sent = 0
      await Promise.all(jurys.map(async (j) => {
        const token = tokenFor(j.email)
        if (!token) return
        try {
          await notificationsApi.sendEmail({
            toEmail: j.email,
            toName: j.name,
            subject: `Évaluation de candidature${session.title ? ` — ${session.title}` : ''}`,
            html: true,
            body: evalEmailHtml(j.name, session.title, `${FRONTOFFICE_URL}/evaluate/${token}`),
          })
          sent++
        } catch { /* a mail failure shouldn't block the assignment */ }
      }))

      toast.success(
        sent === jurys.length
          ? `Évaluation demandée à ${jurys.length} jury`
          : `Jury assigné — ${sent}/${jurys.length} email(s) envoyé(s)`,
      )
      setPickFor(null)
      reload()
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Erreur') }
    finally { setBusy(false) }
  }

  // Per-session criterion weights (override programme weights in the chip display).
  const sessionWeights: Record<string, number> = (() => {
    try { return session.criterionWeightsJson ? JSON.parse(session.criterionWeightsJson) : {} } catch { return {} }
  })()

  /** Best-effort email to the porteur after an accept/reject decision. */
  const notifyPorteur = async (c: any, accepted: boolean, reason?: string) => {
    const to = c.porteurEmail || c.email
    if (!to) return
    const name = c.porteurName || c.founderName || ''
    const proj = c.projectName || c.companyName || 'votre candidature'
    const wrap = (inner: string) =>
      `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:auto;color:#0f172a">${inner}</div>`
    try {
      await notificationsApi.sendEmail({
        toEmail: to, toName: name, html: true,
        subject: accepted ? `🎉 Candidature acceptée — ${proj}` : `Votre candidature — ${proj}`,
        body: accepted
          ? wrap(`<h2 style="margin:0 0 12px">Félicitations !</h2><p>Bonjour ${name},</p><p>Votre candidature « <b>${proj}</b> » a été <b>acceptée</b>. Notre équipe vous contactera très prochainement pour la suite du programme.</p>`)
          : wrap(`<h2 style="margin:0 0 12px">Votre candidature</h2><p>Bonjour ${name},</p><p>Après étude, votre candidature « <b>${proj}</b> » n'a malheureusement pas été retenue cette fois-ci.${reason ? `</p><p><b>Motif :</b> ${reason}` : ''}</p><p>Nous vous encourageons à candidater à nos prochains programmes.</p>`),
      })
    } catch { toast('Décision enregistrée — mais l’email au porteur a échoué.', { icon: '✉️' }) }
  }

  // Admin decision — accept / refuse a candidature, then notify the porteur.
  const decide = async (c: any, action: 'accept' | 'reject') => {
    if (action === 'reject') {
      if (!confirm('Refuser cette candidature ?')) return
      const reason = prompt('Motif du refus (optionnel) :') ?? ''
      try {
        await candidaturesApi.reject(c.id, reason)
        await notifyPorteur(c, false, reason)
        toast.success('Candidature refusée'); reload()
      } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Erreur') }
    } else {
      if (!confirm('Accepter cette candidature ?')) return
      try {
        await candidaturesApi.accept(c.id)
        await notifyPorteur(c, true)
        toast.success('Candidature acceptée'); reload()
      } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Erreur') }
    }
  }

  /** Resend the evaluation link to a jury that hasn't submitted yet. */
  const resendInvite = async (a: any) => {
    if (!a?.token || !a?.juryEmail) { toast.error('Aucun lien d’évaluation pour ce jury.'); return }
    setBusy(true)
    try {
      await notificationsApi.sendEmail({
        toEmail: a.juryEmail, toName: a.juryName || '', html: true,
        subject: `Rappel — évaluation de candidature${session.title ? ` — ${session.title}` : ''}`,
        body: evalEmailHtml(a.juryName || '', session.title, `${FRONTOFFICE_URL}/evaluate/${a.token}`),
      })
      toast.success(`Relance envoyée à ${a.juryName || a.juryEmail}`)
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Échec de l’envoi de la relance') } finally { setBusy(false) }
  }

  // ── Everything below is scoped to THIS evaluation session (session.id) so a
  //    candidature evaluated in several sessions shows only this session's jurys
  //    and score — it is (re)evaluated independently here. ───────────────────
  /** Jury assignments belonging to this session. */
  const sessionAssigns = (c: any): any[] =>
    (c.juryAssignments ?? []).filter((a: any) => (a.phaseId ?? null) === session.id)
  /** This session's evaluation by a given jury (matched by email + session). */
  const sessionEval = (c: any, a: any) =>
    (c.evaluations ?? []).find((ev: any) =>
      (ev.juryEmail || '').toLowerCase() === (a.juryEmail || '').toLowerCase()
      && (ev.phaseId ?? null) === session.id)

  /** Submitted-evaluations count for a candidature, in this session. */
  const submittedOf = (c: any): number =>
    sessionAssigns(c).filter((a: any) => a.status === 'SUBMITTED' || !!sessionEval(c, a)).length

  /** Average weighted score across this session's submitted evaluations (null when none). */
  const avgOf = (c: any): number | null => {
    const xs = (c.evaluations ?? [])
      .filter((ev: any) => (ev.phaseId ?? null) === session.id)
      .map((ev: any) => ev.weightedScore).filter((x: any) => x != null).map(Number)
    return xs.length ? xs.reduce((a: number, b: number) => a + b, 0) / xs.length : null
  }

  // Everyone who can be invited as a jury: all directory users (with their roles)
  // merged with any standalone contacts — so even when no jury was invited yet, the
  // picker always shows people to choose from.
  const pickPeople = useMemo<Person[]>(() => {
    const byEmail = new Map<string, Person>()
    for (const u of users) {
      const email = (u.email || '').toLowerCase(); if (!email) continue
      const name = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email
      byEmail.set(email, { id: u.id, name, email: u.email, roles: u.roles ?? (u.role ? [u.role] : []), source: 'user' })
    }
    for (const ct of contacts) {
      const email = (ct.email || '').toLowerCase(); if (!email || byEmail.has(email)) continue
      byEmail.set(email, { id: ct.id, name: ct.name, email: ct.email, roles: [], source: 'contact' })
    }
    const rank = (p: Person) => (p.roles.includes('JURY') ? 0 : p.roles.includes('INVESTOR') ? 1 : 2)
    return Array.from(byEmail.values()).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
  }, [users, contacts])

  // ── Selection manipulation ────────────────────────────────────────────────
  const selectedSet = new Set(selectedIds)
  const toggleSelect = (id: number) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  const move = (id: number, dir: -1 | 1) =>
    setSelectedIds(prev => {
      const i = prev.indexOf(id); if (i < 0) return prev
      const j = i + dir; if (j < 0 || j >= prev.length) return prev
      const next = [...prev]; const [it] = next.splice(i, 1); next.splice(j, 0, it); return next
    })
  const loadVersion = (vid: number) => {
    const v = versions.find(x => x.id === vid)
    if (!v) return
    setActiveVersionId(v.id); setSelectedIds(v.candidatureIds ?? []); setVersionName(v.name)
  }
  const newVersion = () => { setActiveVersionId(null); setSelectedIds([]); setVersionName('') }
  const saveVersion = async () => {
    const name = versionName.trim() || `Sélection ${versions.length + 1}`
    setSavingSel(true)
    try {
      if (activeVersionId) {
        await candidaturesApi.updateSelection(activeVersionId, { name, candidatureIds: selectedIds })
      } else {
        const r = await candidaturesApi.createSelection(programmeId, { name, candidatureIds: selectedIds })
        setActiveVersionId(r.data?.id ?? null)
      }
      setVersionName(name)
      toast.success(`Version « ${name} » enregistrée`)
      reloadVersions()
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Erreur') } finally { setSavingSel(false) }
  }
  const deleteVersion = async () => {
    if (!activeVersionId) return
    if (!confirm('Supprimer cette version ?')) return
    try { await candidaturesApi.deleteSelection(activeVersionId); toast.success('Version supprimée'); newVersion(); reloadVersions() }
    catch { toast.error('Erreur') }
  }

  // Display order: selected (in saved order) first, then the rest (filtered + sorted).
  const byId = new Map<number, any>(cands.map(c => [c.id, c]))
  const selectedCands = selectedIds.map(id => byId.get(id)).filter(Boolean)
  const restCands = cands
    .filter(c => !selectedSet.has(c.id))
    .filter(c => (!statusFilter || c.status === statusFilter))
    .filter(c => (!minScore || (c.totalScore != null && Number(c.totalScore) >= Number(minScore))))
  if (sortBy === 'score') restCands.sort((a, b) => (b.totalScore ?? -1) - (a.totalScore ?? -1))
  else if (sortBy === 'status') restCands.sort((a, b) => String(a.status).localeCompare(String(b.status)))
  const displayCands = [...selectedCands, ...restCands]

  // The session's OFFICIAL evaluation list (persisted on the phase). When set,
  // the jury works on that saved version only, in its saved order.
  const evalSelId = session.evaluationSelectionId && session.evaluationSelectionId > 0
    ? session.evaluationSelectionId : null
  const evalVersion = evalSelId != null ? versions.find(v => v.id === evalSelId) ?? null : null
  const shownCands = evalVersion
    ? evalVersion.candidatureIds.map(id => byId.get(id)).filter(Boolean)
    : displayCands

  // Bulk decision targets: the eval list when set, else the working selection —
  // already-decided candidatures are skipped.
  const bulkTargets = (evalVersion ? evalVersion.candidatureIds : selectedIds)
    .map(id => byId.get(id)).filter(Boolean)
    .filter((c: any) => c.status !== 'ACCEPTED' && c.status !== 'REJECTED')

  const bulkDecide = async (action: 'accept' | 'reject') => {
    if (!bulkTargets.length) return
    const label = evalVersion ? `la version « ${evalVersion.name} »` : 'la sélection en cours'
    if (!confirm(`${action === 'accept' ? 'Accepter' : 'Refuser'} ${bulkTargets.length} candidature(s) de ${label} ?`)) return
    const reason = action === 'reject' ? (prompt('Motif du refus (optionnel) :') ?? '') : ''
    setBusy(true)
    let ok = 0
    for (const c of bulkTargets) {
      try {
        if (action === 'accept') await candidaturesApi.accept(c.id)
        else await candidaturesApi.reject(c.id, reason)
        await notifyPorteur(c, action === 'accept', reason)
        ok++
      } catch { /* keep going — summary toast below */ }
    }
    setBusy(false)
    toast.success(`${ok}/${bulkTargets.length} candidature(s) ${action === 'accept' ? 'acceptée(s)' : 'refusée(s)'}`)
    reload()
  }

  /** CSV (Excel-friendly: BOM + ';') export of the currently shown list. */
  const exportCsv = () => {
    const head = ['ID', 'Projet', 'Porteur', 'Email', 'Statut', 'Score', 'Évaluations', 'Soumise le']
    const rows = shownCands.map((c: any) => [
      c.id, c.projectName || c.companyName || '', c.porteurName || c.founderName || '',
      c.porteurEmail || '', c.status, avgOf(c)?.toFixed(1) ?? '',
      `${submittedOf(c)}/${sessionAssigns(c).length}`, c.submittedAt ?? c.createdAt ?? '',
    ])
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const csv = '﻿' + [head, ...rows].map(r => r.map(esc).join(';')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `candidatures-programme-${programmeId}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Export téléchargé (CSV — compatible Excel)')
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-3">
      {/* Criteria used by the evaluation */}
      <div className="rounded-xl border border-border bg-muted/20 p-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-1.5">
          <ClipboardList className="h-3 w-3" />Critères d&apos;évaluation
        </p>
        {criteria.length === 0 ? (
          <p className="text-[11px] text-muted-foreground italic">Aucun critère défini — ajoutez-en dans l&apos;onglet « Critères » du programme.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {criteria.map(c => (
              <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-card border border-border px-2 py-0.5 text-[11px] font-semibold">
                {c.name}{(sessionWeights[c.id] ?? c.weight) != null && <span className="text-muted-foreground">· {Math.round((sessionWeights[c.id] ?? c.weight ?? 0) * 100)}%</span>}
              </span>
            ))}
            <span className="text-[10px] text-muted-foreground self-center">+ note finale</span>
          </div>
        )}
      </div>

      {/* Liste officielle que le jury évalue (persistée sur la session) */}
      <div className="rounded-xl border border-brand-500/30 bg-brand-500/5 p-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-1.5">
          <ListChecks className="h-3 w-3" />Liste à évaluer
        </p>
        <select value={evalSelId ?? ''} disabled={!onUpdateSession}
          onChange={(e) => onUpdateSession?.({ evaluationSelectionId: e.target.value ? Number(e.target.value) : -1 })}
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs">
          <option value="">Toutes les candidatures ({cands.length})</option>
          {versions.map(v => <option key={v.id} value={v.id}>{v.name} ({v.candidatureIds?.length ?? 0})</option>)}
        </select>
        <p className="mt-1 text-[10px] text-muted-foreground">
          {evalVersion
            ? `Cette session évalue la version « ${evalVersion.name} » (${evalVersion.candidatureIds?.length ?? 0} candidature(s), dans son ordre).`
            : 'Cette session évalue toutes les candidatures du programme. Enregistrez une version ci-dessous pour restreindre la liste.'}
        </p>
      </div>

      {/* Versions de la liste (shortlists enregistrées) */}
      <div className="rounded-xl border border-border bg-card p-3 space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          <ListChecks className="h-3 w-3" />Versions de la liste
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <select value={activeVersionId ?? ''} onChange={(e) => e.target.value ? loadVersion(Number(e.target.value)) : newVersion()}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs">
            <option value="">Nouvelle version…</option>
            {versions.map(v => <option key={v.id} value={v.id}>{v.name} ({v.candidatureIds?.length ?? 0})</option>)}
          </select>
          <input value={versionName} onChange={(e) => setVersionName(e.target.value)} placeholder="Nom de la version"
            className="h-8 flex-1 min-w-[120px] rounded-md border border-input bg-background px-2 text-xs" />
          <button onClick={saveVersion} disabled={savingSel}
            className="inline-flex items-center gap-1 rounded-md bg-brand-500 text-white px-2.5 py-1.5 text-[11px] font-semibold hover:bg-brand-600 disabled:opacity-50">
            {savingSel ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}{activeVersionId ? 'Mettre à jour' : 'Enregistrer'}
          </button>
          {activeVersionId != null && (
            <button onClick={deleteVersion}
              className="inline-flex items-center gap-1 rounded-md border border-rose-400/50 text-rose-600 px-2 py-1.5 text-[11px] font-semibold hover:bg-rose-500/10">
              <XCircle className="h-3 w-3" />Supprimer
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="text-muted-foreground font-semibold">{selectedIds.length} dans la version</span>
          <span className="text-muted-foreground/40">·</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-7 rounded-md border border-input bg-background px-1.5">
            <option value="">Tous statuts</option>
            <option value="PENDING">En attente</option>
            <option value="UNDER_EVALUATION">En évaluation</option>
            <option value="ACCEPTED">Acceptées</option>
            <option value="REJECTED">Refusées</option>
          </select>
          <input type="number" value={minScore} onChange={(e) => setMinScore(e.target.value)} placeholder="Score min"
            className="h-7 w-20 rounded-md border border-input bg-background px-1.5" />
          <button onClick={() => setSortBy(sortBy === 'score' ? 'none' : 'score')}
            className={`rounded-md border px-2 py-1 ${sortBy === 'score' ? 'border-brand-500 text-brand-600' : 'border-border text-muted-foreground'}`}>Tri score</button>
          <button onClick={() => setSortBy(sortBy === 'status' ? 'none' : 'status')}
            className={`rounded-md border px-2 py-1 ${sortBy === 'status' ? 'border-brand-500 text-brand-600' : 'border-border text-muted-foreground'}`}>Tri statut</button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5"><Users className="h-4 w-4 text-brand-500" />Candidatures</h3>
        <span className="text-[11px] text-muted-foreground">{cands.length}</span>
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={exportCsv} title="Exporter la liste affichée (CSV / Excel)"
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-accent">
            <Download className="h-3 w-3" />Exporter
          </button>
          {bulkTargets.length > 0 && (
            <>
              <button onClick={() => bulkDecide('accept')} disabled={busy}
                className="inline-flex items-center gap-1 rounded-md border border-emerald-400/50 text-emerald-700 dark:text-emerald-300 px-2 py-1 text-[11px] font-semibold hover:bg-emerald-500/10 disabled:opacity-50">
                <CheckCircle2 className="h-3 w-3" />Accepter ({bulkTargets.length})
              </button>
              <button onClick={() => bulkDecide('reject')} disabled={busy}
                className="inline-flex items-center gap-1 rounded-md border border-rose-400/50 text-rose-700 dark:text-rose-300 px-2 py-1 text-[11px] font-semibold hover:bg-rose-500/10 disabled:opacity-50">
                <XCircle className="h-3 w-3" />Refuser ({bulkTargets.length})
              </button>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : cands.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border bg-muted/10 p-6 text-center text-xs text-muted-foreground">
          Aucune candidature reçue pour ce programme.
        </div>
      ) : (
        <div className="space-y-2">
          {shownCands.map((c: any) => {
            const st = CAND_STATUS[c.status] ?? CAND_STATUS.PENDING
            const rank = selectedIds.indexOf(c.id)
            const sel = rank >= 0
            return (
              <div key={c.id} className={`rounded-xl border bg-card p-3 ${sel ? 'border-brand-400 ring-1 ring-brand-400/30' : 'border-border'}`}>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={sel} onChange={() => toggleSelect(c.id)}
                    className="accent-brand-500 h-4 w-4 shrink-0" title="Inclure dans la version" />
                  {sel && (
                    <span className="flex items-center gap-0.5 shrink-0">
                      <span className="w-4 text-center text-[11px] font-bold text-brand-600">{rank + 1}</span>
                      <button onClick={() => move(c.id, -1)} disabled={rank === 0} className="p-0.5 rounded hover:bg-accent disabled:opacity-30" title="Monter"><ChevronUp className="h-3.5 w-3.5" /></button>
                      <button onClick={() => move(c.id, 1)} disabled={rank === selectedIds.length - 1} className="p-0.5 rounded hover:bg-accent disabled:opacity-30" title="Descendre"><ChevronDown className="h-3.5 w-3.5" /></button>
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground truncate">{c.projectName || c.companyName || `Candidature #${c.id}`}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{c.porteurName || c.founderName || ''}{c.porteurEmail ? ` · ${c.porteurEmail}` : ''}</p>
                  </div>
                  {avgOf(c) != null && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600" title="Score moyen dans cette session"><Trophy className="h-3 w-3" />{avgOf(c)!.toFixed(1)}</span>
                  )}
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold shrink-0 ${st.cls}`}>{st.label}</span>
                  <button onClick={() => setPickFor(pickFor === c.id ? null : c.id)}
                    className="inline-flex items-center gap-1 rounded-md border border-brand-500/40 text-brand-700 dark:text-brand-300 px-2 py-1 text-[11px] font-semibold hover:bg-brand-500/10 shrink-0">
                    <Plus className="h-3 w-3" />Jury
                  </button>
                </div>

                {sessionAssigns(c).length > 0 && (
                  <>
                    {/* Évaluation progress (this session): « 2/3 jurys · moy 7.4 » */}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500 transition-all"
                          style={{ width: `${(submittedOf(c) / Math.max(1, sessionAssigns(c).length)) * 100}%` }} />
                      </div>
                      <span className="text-[10px] font-bold text-muted-foreground whitespace-nowrap tabular-nums">
                        {submittedOf(c)}/{sessionAssigns(c).length} jury{sessionAssigns(c).length > 1 ? 's' : ''}
                        {avgOf(c) != null ? ` · moy ${avgOf(c)!.toFixed(1)}` : ''}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {sessionAssigns(c).map((a: any) => {
                        const ev = sessionEval(c, a)
                        const submitted = a.status === 'SUBMITTED' || !!ev
                        return (
                          <span key={a.id ?? a.juryEmail} title={a.juryEmail}
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${submitted ? 'border-emerald-300/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-amber-300/50 bg-amber-500/10 text-amber-700 dark:text-amber-300'}`}>
                            {submitted ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                            <span className="truncate max-w-[120px]">{a.juryName || a.juryEmail}</span>
                            {ev?.weightedScore != null && <span className="font-bold">· {Number(ev.weightedScore).toFixed(1)}</span>}
                            {!submitted && a.token && (
                              <button type="button" disabled={busy} onClick={() => resendInvite(a)}
                                title="Relancer ce jury (renvoyer le lien d’évaluation)"
                                className="ml-0.5 p-0.5 rounded hover:bg-amber-500/25 disabled:opacity-50">
                                <Send className="h-2.5 w-2.5" />
                              </button>
                            )}
                          </span>
                        )
                      })}
                    </div>
                  </>
                )}

                {c.status !== 'ACCEPTED' && c.status !== 'REJECTED' && (
                  <div className="mt-2 flex gap-1.5">
                    <button onClick={() => decide(c, 'accept')}
                      className="inline-flex items-center gap-1 rounded-md border border-emerald-400/50 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 text-[11px] font-semibold hover:bg-emerald-500/10">
                      <CheckCircle2 className="h-3 w-3" />Accepter
                    </button>
                    <button onClick={() => decide(c, 'reject')}
                      className="inline-flex items-center gap-1 rounded-md border border-rose-400/50 text-rose-700 dark:text-rose-300 px-2.5 py-1 text-[11px] font-semibold hover:bg-rose-500/10">
                      <XCircle className="h-3 w-3" />Refuser
                    </button>
                  </div>
                )}

                {pickFor === c.id && (() => {
                  // Already assigned to THIS session → don't offer them again.
                  const assignedEmails = new Set(sessionAssigns(c).map((a: any) => (a.juryEmail || '').toLowerCase()))
                  const q = pickSearch.trim().toLowerCase()
                  const list = pickPeople.filter((p) =>
                    !assignedEmails.has(p.email.toLowerCase()) &&
                    (!q || p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)))
                  return (
                    <div className="mt-2 rounded-lg border border-border bg-muted/20 p-2 space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Demander une évaluation à…</p>
                      <input value={pickSearch} onChange={(e) => setPickSearch(e.target.value)}
                        placeholder="Rechercher une personne…"
                        className="mb-1 w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] outline-none focus:border-brand-500" />
                      {pickPeople.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground italic px-1">Aucune personne dans l&apos;annuaire. Ajoutez des utilisateurs (module Utilisateurs) ou des contacts.</p>
                      ) : list.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground italic px-1">Toutes les personnes correspondantes sont déjà assignées à cette session.</p>
                      ) : (
                        <div className="max-h-56 overflow-y-auto space-y-0.5">
                          {list.map((p) => (
                            <button key={p.email} disabled={busy}
                              onClick={() => requestEvaluation(c.id, [{ id: p.id ?? 0, name: p.name, email: p.email }])}
                              className="w-full flex items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-accent text-left disabled:opacity-50">
                              <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="truncate font-medium">{p.name}</span>
                              <span className="text-[10px] text-muted-foreground truncate">{p.email}</span>
                              <span className="ml-auto flex shrink-0 gap-1">
                                {(p.roles.length ? p.roles : ['USER']).slice(0, 3).map((r) => (
                                  <span key={r} className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${ROLE_CLS[r] ?? 'bg-muted text-muted-foreground'}`}>
                                    {ROLE_LABEL[r] ?? r}
                                  </span>
                                ))}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
