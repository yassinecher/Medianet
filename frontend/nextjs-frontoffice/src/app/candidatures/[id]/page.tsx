'use client'
/**
 * Candidature detail — the porteur opens one of « Mes candidatures » and sees
 * everything: status, score, the linked organisation + team, and the full
 * submission (all sections + custom answers) via <CandidatureDetails>.
 */
import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, Loader2, FileText, Trophy, Calendar, Layers } from 'lucide-react'
import toast from 'react-hot-toast'
import { candidaturesApi } from '@/lib/api'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CandidatureDetails } from '@/components/candidature/CandidatureDetails'
import { useAuthStore } from '@/store/auth.store'
import { statusColor, scoreColor, formatRelativeDate } from '@/lib/utils'

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Soumise', UNDER_EVALUATION: 'En évaluation', ACCEPTED: 'Acceptée', REJECTED: 'Refusée',
}

export default function CandidatureDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = Number(Array.isArray(params.id) ? params.id[0] : params.id)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => { setHydrated(true) }, [])

  const [cand, setCand] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { const r = await candidaturesApi.get(id); setCand(r.data) }
    catch { setError('Candidature introuvable.') }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => {
    if (hydrated && !isAuthenticated) { router.replace('/login'); return }
    if (hydrated && !isNaN(id)) load()
  }, [hydrated, isAuthenticated, id, load, router])

  if (loading) {
    return <AppShell><div className="mx-auto max-w-3xl space-y-4"><Skeleton className="h-28 rounded-2xl" /><Skeleton className="h-40 rounded-2xl" /><Skeleton className="h-40 rounded-2xl" /></div></AppShell>
  }
  if (error || !cand) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl py-20 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground opacity-30" />
          <p className="mt-3 text-sm text-muted-foreground">{error ?? 'Candidature introuvable.'}</p>
          <Link href="/candidatures" className="mt-4 inline-block"><Button variant="brand">Mes candidatures</Button></Link>
        </div>
      </AppShell>
    )
  }

  const evals = (cand.evaluations ?? []).filter((e: any) => e.weightedScore != null)
  const avg = evals.length ? evals.reduce((a: number, e: any) => a + Number(e.weightedScore), 0) / evals.length : null
  const score = cand.totalScore ?? avg

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-5">
        <Link href="/candidatures" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Mes candidatures
        </Link>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-foreground">{cand.projectName || cand.companyName || `Candidature #${cand.id}`}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {cand.programmeId ? (
                  <Link href={`/programmes/${cand.programmeId}`} className="inline-flex items-center gap-1 rounded-full bg-brand-500/10 px-2 py-0.5 font-medium text-brand-600 hover:bg-brand-500/20 dark:text-brand-400">
                    <Layers className="h-3 w-3" />{cand.programmeName ?? 'Programme'}
                  </Link>
                ) : cand.programmeName && <span>{cand.programmeName}</span>}
                {cand.submittedAt && <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{formatRelativeDate(cand.submittedAt)}</span>}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColor(cand.status)}`}>{STATUS_LABEL[cand.status] ?? cand.status}</span>
              {score != null && (
                <span className={`inline-flex items-center gap-1 text-sm font-bold ${scoreColor(Number(score))}`}>
                  <Trophy className="h-4 w-4" />{Number(score).toFixed(1)}<span className="text-xs font-normal text-muted-foreground">/10</span>
                </span>
              )}
            </div>
          </div>
          {cand.status === 'REJECTED' && cand.rejectionReason && (
            <p className="mt-3 rounded-lg border border-rose-300/40 bg-rose-500/5 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
              <b>Motif :</b> {cand.rejectionReason}
            </p>
          )}
        </motion.div>

        {/* All the details */}
        <CandidatureDetails c={cand} />
      </div>
    </AppShell>
  )
}
