'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { candidaturesApi } from '@/lib/api'
import { AppShell } from '@/components/layout/AppShell'
import { MagicCard } from '@/components/magicui/magic-card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatRelativeDate, statusColor, scoreColor } from '@/lib/utils'
import type { Candidature } from '@/types'

const statusLabel: Record<string, string> = {
  PENDING: 'Soumise',
  UNDER_EVALUATION: 'En évaluation',
  ACCEPTED: 'Acceptée',
  REJECTED: 'Refusée',
}

export default function CandidaturesPage() {
  const [candidatures, setCandidatures] = useState<Candidature[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    candidaturesApi.myList()
      .then((r) => setCandidatures(r.data?.content ?? r.data ?? []))
      .catch(() => toast.error('Impossible de charger vos candidatures'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Mes Candidatures</h1>
            <p className="text-muted-foreground">{candidatures.length} candidature(s)</p>
          </div>
          <Link href="/programmes">
            <Button className="bg-gradient-to-r from-brand-600 to-purple-600 text-white">
              <Plus className="h-4 w-4" />Nouvelle candidature
            </Button>
          </Link>
        </motion.div>

        {loading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
        ) : (
          <div className="space-y-3">
            {candidatures.map((c, i) => (
              <motion.div key={c.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                <MagicCard className="p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-foreground">{c.projectName}</h3>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {c.programmeName && <span>{c.programmeName}</span>}
                        {c.submittedAt && <span>· {formatRelativeDate(c.submittedAt)}</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColor(c.status)}`}>
                        {statusLabel[c.status]}
                      </span>
                      {c.evaluation?.weightedScore !== undefined && (
                        <span className={`text-xs font-medium ${scoreColor(c.evaluation.weightedScore)}`}>
                          Score: {c.evaluation.weightedScore.toFixed(1)}/10
                        </span>
                      )}
                    </div>
                  </div>
                </MagicCard>
              </motion.div>
            ))}
            {candidatures.length === 0 && (
              <div className="py-16 text-center">
                <p className="text-muted-foreground">Vous n'avez pas encore de candidature.</p>
                <Link href="/programmes">
                  <Button className="mt-4 bg-gradient-to-r from-brand-600 to-purple-600 text-white">
                    Explorer les programmes
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}
