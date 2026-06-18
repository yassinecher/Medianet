'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Search, Brain, Star, Eye, Layers } from 'lucide-react'
import toast from 'react-hot-toast'
import { candidaturesApi, programmesApi } from '@/lib/api'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { MagicCard } from '@/components/magicui/magic-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, statusColor } from '@/lib/utils'
import type { Candidature, Programme } from '@/types'

const statusLabel: Record<string, string> = {
  PENDING: 'Soumise',
  UNDER_EVALUATION: 'En évaluation',
  ACCEPTED: 'Acceptée',
  REJECTED: 'Rejetée',
}

const statusOptions = ['ALL', 'PENDING', 'UNDER_EVALUATION', 'ACCEPTED', 'REJECTED']

export default function CandidaturesPage() {
  const [candidatures, setCandidatures] = useState<Candidature[]>([])
  const [programmes, setProgrammes] = useState<Programme[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [progFilter, setProgFilter] = useState('ALL')
  const [scoring, setScoring] = useState<number | null>(null)
  const [evaluating, setEvaluating] = useState<number | null>(null)

  useEffect(() => {
    Promise.all([
      candidaturesApi.all().then((r) => setCandidatures(r.data?.content ?? r.data ?? [])),
      programmesApi.list().then((r) => setProgrammes(r.data?.content ?? r.data ?? [])),
    ]).finally(() => setLoading(false))
  }, [])

  const handleAiScore = async (id: number) => {
    setScoring(id)
    try {
      const r = await candidaturesApi.mediScore(id)
      const ws = r.data?.weightedScore
      setCandidatures((prev) => prev.map((c) => c.id === id ? { ...c, aiScore: ws != null ? Number(ws) : c.aiScore } : c))
      toast.success(ws != null ? `Évaluation Medi : ${Number(ws).toFixed(1)}/10` : 'Évaluation Medi terminée')
    } catch { toast.error("Échec de l'évaluation Medi") } finally { setScoring(null) }
  }

  const handleAccept = async (id: number) => {
    setEvaluating(id)
    try {
      await candidaturesApi.accept(id)
      setCandidatures((prev) => prev.map((c) => c.id === id ? { ...c, status: 'ACCEPTED' } : c))
      toast.success('Candidature acceptée')
    } catch { toast.error("Erreur lors de l'acceptation") } finally { setEvaluating(null) }
  }

  const handleReject = async (id: number) => {
    const reason = window.prompt('Motif du refus (sera envoyé au porteur) :')
    if (reason === null) return
    setEvaluating(id)
    try {
      await candidaturesApi.reject(id, reason || 'Non précisé')
      setCandidatures((prev) => prev.map((c) => c.id === id ? { ...c, status: 'REJECTED' } : c))
      toast.success('Candidature refusée')
    } catch { toast.error('Erreur lors du refus') } finally { setEvaluating(null) }
  }

  const filtered = candidatures.filter((c) => {
    const matchSearch = !search || c.projectName?.toLowerCase().includes(search.toLowerCase()) ||
      c.applicant?.firstName?.toLowerCase().includes(search.toLowerCase()) ||
      c.applicant?.lastName?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'ALL' || c.status === statusFilter
    const matchProg = progFilter === 'ALL' || String(c.programmeId) === progFilter
    return matchSearch && matchStatus && matchProg
  })

  return (
    <AdminLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Candidatures</h1>
            <p className="text-muted-foreground">{filtered.length} candidature(s)</p>
          </div>
        </motion.div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Rechercher candidature ou porteur..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {statusOptions.map((s) => <option key={s} value={s}>{s === 'ALL' ? 'Tous les statuts' : statusLabel[s]}</option>)}
          </select>
          <select value={progFilter} onChange={(e) => setProgFilter(e.target.value)}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <option value="ALL">Tous les programmes</option>
            {programmes.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
        ) : (
          <div className="space-y-3">
            {filtered.length === 0 && (
              <div className="py-16 text-center text-muted-foreground">Aucune candidature trouvée</div>
            )}
            {filtered.map((c, i) => (
              <motion.div key={c.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                <MagicCard className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-foreground truncate">{c.projectName ?? `Candidature #${c.id}`}</h3>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${statusColor(c.status)}`}>
                          {statusLabel[c.status] ?? c.status}
                        </span>
                        {c.aiScore != null && (
                          <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                            <Star className="h-3 w-3" />{c.aiScore.toFixed(1)}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                        {c.programmeId && (
                          <Link href={`/programmes/${c.programmeId}`} onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 rounded-full bg-brand-500/10 px-2 py-0.5 font-medium text-brand-600 hover:bg-brand-500/20 dark:text-brand-400">
                            <Layers className="h-3 w-3" />{c.programmeName ?? programmes.find((p) => p.id === c.programmeId)?.name ?? `Programme #${c.programmeId}`}
                          </Link>
                        )}
                        {c.applicant && <span>{c.applicant.firstName} {c.applicant.lastName}</span>}
                        {c.applicant?.email && <span>· {c.applicant.email}</span>}
                        <span>· {formatDate(c.submittedAt ?? c.createdAt)}</span>
                        {c.sector && <span>· {c.sector}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                      <Link href={`/candidatures/${c.id}`}>
                        <Button variant="outline" size="sm" className="text-xs gap-1"><Eye className="h-3.5 w-3.5" />Détails</Button>
                      </Link>
                      <Button variant="ghost" size="sm" className="text-xs gap-1"
                        onClick={() => handleAiScore(c.id)} disabled={scoring === c.id}>
                        <Brain className="h-3.5 w-3.5" />
                        {scoring === c.id ? 'Scoring...' : 'IA Score'}
                      </Button>
                      {!['ACCEPTED','REJECTED'].includes(c.status) && (
                        <>
                          <Button variant="ghost" size="sm" className="text-xs text-green-600 hover:text-green-600 gap-1"
                            onClick={() => handleAccept(c.id)} disabled={evaluating === c.id}>
                            Accepter
                          </Button>
                          <Button variant="ghost" size="sm" className="text-xs text-destructive hover:text-destructive gap-1"
                            onClick={() => handleReject(c.id)} disabled={evaluating === c.id}>
                            Rejeter
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  {c.projectDescription && (
                    <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{c.projectDescription}</p>
                  )}
                </MagicCard>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
