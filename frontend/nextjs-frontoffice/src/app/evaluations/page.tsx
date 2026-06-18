'use client'
/**
 * Jury dashboard (logged-in JURY): a detailed overview of the candidatures assigned
 * to me — KPIs (assigned / évaluées / en attente / note moyenne donnée) + two
 * sections (À évaluer / Évaluées with a per-criterion mini-breakdown). Each row
 * links to the evaluation form at /evaluations/[id]. Source =
 * GET /api/candidatures/my-jury-assignments. Distinct from the public
 * /evaluate/[token] page (which needs no account).
 */
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { GraduationCap, CheckCircle2, Clock, Trophy, ArrowRight, Star, ListChecks, Hourglass } from 'lucide-react'
import toast from 'react-hot-toast'
import { juryApi } from '@/lib/api'
import { AppShell } from '@/components/layout/AppShell'
import { MagicCard } from '@/components/magicui/magic-card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore, useUser, useIsJury } from '@/store/auth.store'

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING:          { label: 'En attente',    cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  UNDER_EVALUATION: { label: 'En évaluation', cls: 'bg-sky-500/15 text-sky-700 dark:text-sky-300' },
  ACCEPTED:         { label: 'Acceptée',      cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  REJECTED:         { label: 'Refusée',       cls: 'bg-rose-500/15 text-rose-700 dark:text-rose-300' },
}

function Kpi({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string | number; tone: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${tone}`}><Icon className="h-4 w-4" /></div>
      <p className="mt-2 text-2xl font-extrabold text-foreground tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  )
}

export default function EvaluationsPage() {
  const router = useRouter()
  const user = useUser()
  const isJury = useIsJury()
  const hydrated = useAuthStore((s) => s.isAuthenticated)
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!hydrated) return
    if (!isJury) { setLoading(false); return }
    juryApi.myAssignments()
      .then((r) => setItems(r.data ?? []))
      .catch(() => toast.error('Impossible de charger vos évaluations'))
      .finally(() => setLoading(false))
  }, [hydrated, isJury])

  /** My own submitted evaluation for a candidature (matched by juryId). */
  const myEval = (c: any) =>
    (c.evaluations ?? []).find((e: any) => e.juryId === user?.id) ?? null

  const { pending, done, avgGiven } = useMemo(() => {
    const pending = items.filter((c) => !myEval(c))
    const done = items.filter((c) => !!myEval(c))
    const scores = done.map((c) => myEval(c)?.weightedScore).filter((x: any) => x != null).map(Number)
    const avgGiven = scores.length ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : null
    return { pending, done, avgGiven }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, user?.id])

  if (!loading && !isJury) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md py-20 text-center">
          <GraduationCap className="mx-auto h-10 w-10 text-muted-foreground opacity-40" />
          <h1 className="mt-3 text-lg font-bold text-foreground">Espace juré</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cet espace est réservé aux membres du jury. Vous n&apos;avez pas ce rôle.
          </p>
        </div>
      </AppShell>
    )
  }

  const card = (c: any, i: number) => {
    const ev = myEval(c)
    const submitted = !!ev
    const st = STATUS[c.status] ?? STATUS.PENDING
    const crits = (ev?.criteriaScores ?? []).filter((cs: any) => cs?.criteriaName)
    return (
      <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
        <button type="button" onClick={() => router.push(`/evaluations/${c.id}`)} className="block w-full text-left">
          <MagicCard className="p-5 transition-shadow hover:shadow-md">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="font-semibold text-foreground truncate">
                  {c.projectName || c.companyName || `Candidature #${c.id}`}
                </h3>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {c.companyName && c.projectName && <span>{c.companyName}</span>}
                  {c.porteurName && <span>· {c.porteurName}</span>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {submitted ? (
                  <span className="inline-flex items-center gap-1 text-sm font-bold text-amber-600">
                    <Trophy className="h-4 w-4" />{Number(ev.weightedScore ?? 0).toFixed(1)}<span className="text-xs font-normal text-muted-foreground">/10</span>
                  </span>
                ) : (
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>
                )}
                <span className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  submitted ? 'border border-border text-muted-foreground' : 'bg-gradient-to-r from-brand-600 to-amber-600 text-white'}`}>
                  {submitted ? <><CheckCircle2 className="h-3.5 w-3.5" />Modifier</> : <>Évaluer<ArrowRight className="h-3.5 w-3.5" /></>}
                </span>
              </div>
            </div>

            {/* Per-criterion mini-breakdown of my submitted evaluation */}
            {submitted && crits.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
                {crits.map((cs: any) => (
                  <span key={cs.criteriaId ?? cs.criteriaName}
                    className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {cs.criteriaName}
                    <span className="inline-flex items-center gap-0.5 font-bold text-amber-600"><Star className="h-2.5 w-2.5" />{cs.score}</span>
                  </span>
                ))}
              </div>
            )}
            {submitted && ev?.comment && (
              <p className="mt-2 text-xs text-muted-foreground line-clamp-2 italic">« {ev.comment} »</p>
            )}
          </MagicCard>
        </button>
      </motion.div>
    )
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <GraduationCap className="h-6 w-6 text-amber-500" />Mes évaluations
          </h1>
          <p className="text-muted-foreground">Vos candidatures à évaluer, en un coup d&apos;œil.</p>
        </motion.div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
        ) : (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Kpi icon={ListChecks} label="Assignées" value={items.length} tone="bg-brand-500/15 text-brand-600 dark:text-brand-400" />
              <Kpi icon={CheckCircle2} label="Évaluées" value={done.length} tone="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" />
              <Kpi icon={Hourglass} label="En attente" value={pending.length} tone="bg-amber-500/15 text-amber-600 dark:text-amber-400" />
              <Kpi icon={Trophy} label="Note moyenne donnée" value={avgGiven != null ? `${avgGiven.toFixed(1)}/10` : '—'} tone="bg-purple-500/15 text-purple-600 dark:text-purple-400" />
            </div>

            {items.length === 0 ? (
              <div className="py-16 text-center">
                <Clock className="mx-auto h-9 w-9 text-muted-foreground opacity-30" />
                <p className="mt-3 text-muted-foreground">Aucune candidature ne vous a encore été assignée.</p>
                <p className="text-xs text-muted-foreground">Vous recevrez un email dès qu&apos;une évaluation vous sera confiée.</p>
              </div>
            ) : (
              <>
                {/* À évaluer */}
                <section className="space-y-3">
                  <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <Hourglass className="h-4 w-4 text-amber-500" />À évaluer
                    <span className="text-xs font-normal text-muted-foreground">{pending.length}</span>
                  </h2>
                  {pending.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
                      🎉 Tout est évalué — rien en attente.
                    </p>
                  ) : (
                    <div className="space-y-3">{pending.map((c, i) => card(c, i))}</div>
                  )}
                </section>

                {/* Évaluées */}
                {done.length > 0 && (
                  <section className="space-y-3">
                    <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />Évaluées
                      <span className="text-xs font-normal text-muted-foreground">{done.length}</span>
                    </h2>
                    <div className="space-y-3">{done.map((c, i) => card(c, i))}</div>
                  </section>
                )}
              </>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
