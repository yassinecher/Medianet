'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Users, Brain, Loader2, CheckCircle2, Link2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { candidaturesApi } from '@/lib/api'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { MagicCard } from '@/components/magicui/magic-card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { Candidature } from '@/types'

interface MatchResult {
  mentorId: number
  mentorName: string
  mentorEmail: string
  score: number
  commonSkills: string[]
  explanation: string
}

export default function AiMatchingPage() {
  const [candidatures, setCandidatures] = useState<Candidature[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Candidature | null>(null)
  const [matches, setMatches] = useState<MatchResult[]>([])
  const [matching, setMatching] = useState(false)

  useEffect(() => {
    candidaturesApi.all()
      .then((r) => {
        const list: Candidature[] = r.data?.content ?? r.data ?? []
        const accepted = list.filter((c) => c.status === 'ACCEPTED')
        setCandidatures(accepted)
        if (accepted.length > 0) setSelected(accepted[0])
      })
      .finally(() => setLoading(false))
  }, [])

  const handleMatch = async (candidatureId: number) => {
    setMatching(true)
    setMatches([])
    try {
      const res = await candidaturesApi.aiMatch(candidatureId)
      const result = res.data
      setMatches(Array.isArray(result) ? result : result?.matches ?? [])
      toast.success('Matching IA terminé')
    } catch {
      toast.error('Erreur lors du matching IA')
    } finally {
      setMatching(false)
    }
  }

  const scoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-500'
    if (score >= 0.6) return 'text-amber-500'
    return 'text-muted-foreground'
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-brand-500" />Matching IA Mentors
          </h1>
          <p className="text-muted-foreground">Associez automatiquement les candidatures acceptées à des mentors</p>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          {/* Candidature list (ACCEPTED only) */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Candidatures acceptées</p>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)
            ) : candidatures.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Aucune candidature acceptée
              </div>
            ) : candidatures.map((c) => (
              <button key={c.id} onClick={() => { setSelected(c); setMatches([]) }} className="w-full text-left">
                <MagicCard className={`p-3 transition-all ${selected?.id === c.id ? 'ring-2 ring-brand-500' : ''}`}>
                  <p className="text-sm font-medium truncate">{c.projectName ?? `#${c.id}`}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {c.applicant?.firstName} {c.applicant?.lastName}
                  </p>
                  {c.sector && <p className="text-xs text-brand-500 mt-0.5">{c.sector}</p>}
                </MagicCard>
              </button>
            ))}
          </div>

          {/* Match panel */}
          <div>
            {!selected ? (
              <div className="flex h-64 items-center justify-center text-muted-foreground">
                Sélectionnez une candidature
              </div>
            ) : (
              <motion.div key={selected.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <MagicCard className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-bold text-foreground">{selected.projectName ?? `#${selected.id}`}</h2>
                      <p className="text-sm text-muted-foreground">
                        {selected.applicant?.firstName} {selected.applicant?.lastName}
                        {selected.sector && ` · ${selected.sector}`}
                      </p>
                    </div>
                    <Button variant="brand" onClick={() => handleMatch(selected.id)} disabled={matching}>
                      {matching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                      {matching ? 'Matching...' : 'Lancer le matching'}
                    </Button>
                  </div>
                  {selected.projectDescription && (
                    <p className="mt-3 text-sm text-muted-foreground line-clamp-3">{selected.projectDescription}</p>
                  )}
                </MagicCard>

                {matching && (
                  <div className="flex items-center justify-center gap-3 py-12 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
                    <span>Analyse en cours par Ollama...</span>
                  </div>
                )}

                {matches.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-muted-foreground">{matches.length} mentor(s) correspondant(s)</p>
                    {matches.map((m, i) => (
                      <motion.div key={m.mentorId} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                        <MagicCard className="p-4">
                          <div className="flex items-start gap-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-brand-600 font-bold text-sm">
                              {m.mentorName?.charAt(0) ?? 'M'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-semibold text-foreground">{m.mentorName}</p>
                                <span className={`text-lg font-bold ${scoreColor(m.score)}`}>
                                  {Math.round(m.score * 100)}%
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground">{m.mentorEmail}</p>
                              {m.commonSkills?.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {m.commonSkills.map((skill) => (
                                    <span key={skill} className="rounded-full bg-brand-500/10 px-2 py-0.5 text-xs text-brand-600 dark:text-brand-400">
                                      {skill}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {m.explanation && (
                                <p className="mt-2 text-xs text-muted-foreground">{m.explanation}</p>
                              )}
                            </div>
                            <Button variant="ghost" size="icon" className="shrink-0" title="Assigner">
                              <Link2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </MagicCard>
                      </motion.div>
                    ))}
                  </div>
                )}

                {!matching && matches.length === 0 && (
                  <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-5 w-5 text-brand-400" />
                    Cliquez sur "Lancer le matching" pour trouver les mentors adaptés
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
