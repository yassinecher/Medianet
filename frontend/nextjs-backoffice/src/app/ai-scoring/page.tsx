'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Brain, Loader2, Star, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip } from 'recharts'
import { candidaturesApi, programmesApi } from '@/lib/api'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { MagicCard } from '@/components/magicui/magic-card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { statusColor } from '@/lib/utils'
import type { Candidature, Programme } from '@/types'

const statusLabel: Record<string, string> = {
  PENDING: 'Soumise',
  UNDER_EVALUATION: 'En évaluation',
  ACCEPTED: 'Acceptée',
  REJECTED: 'Rejetée',
}

export default function AiScoringPage() {
  const [candidatures, setCandidatures] = useState<Candidature[]>([])
  const [programmes, setProgrammes] = useState<Programme[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Candidature | null>(null)
  const [scoring, setScoring] = useState(false)
  const [progFilter, setProgFilter] = useState('ALL')

  useEffect(() => {
    Promise.all([
      candidaturesApi.all().then((r) => {
        const list = r.data?.content ?? r.data ?? []
        setCandidatures(list)
        if (list.length > 0) setSelected(list[0])
      }),
      programmesApi.list().then((r) => setProgrammes(r.data?.content ?? r.data ?? [])),
    ]).finally(() => setLoading(false))
  }, [])

  const handleScore = async (id: number) => {
    setScoring(true)
    try {
      const res = await candidaturesApi.aiScore(id)
      const updated = res.data
      setCandidatures((prev) => prev.map((c) => c.id === id ? { ...c, ...updated } : c))
      setSelected((prev) => prev?.id === id ? { ...prev, ...updated } : prev)
      toast.success('Score IA calculé')
    } catch { toast.error('Erreur lors du scoring IA') } finally { setScoring(false) }
  }

  const handleScoreAll = async () => {
    const unscored = filtered.filter((c) => c.aiScore == null)
    if (unscored.length === 0) { toast('Toutes les candidatures sont déjà scorées'); return }
    setScoring(true)
    try {
      await Promise.all(unscored.map((c) => candidaturesApi.aiScore(c.id)))
      candidaturesApi.all().then((r) => {
        const list = r.data?.content ?? r.data ?? []
        setCandidatures(list)
        if (selected) setSelected(list.find((c: Candidature) => c.id === selected.id) ?? null)
      })
      toast.success(`${unscored.length} candidature(s) scorées`)
    } catch { toast.error('Erreur partielle lors du scoring') } finally { setScoring(false) }
  }

  const filtered = candidatures.filter((c) => progFilter === 'ALL' || String(c.programmeId) === progFilter)

  const radarData = selected?.scoreBreakdown
    ? Object.entries(selected.scoreBreakdown).map(([k, v]) => ({ subject: k, score: Number(v) }))
    : selected?.aiScore != null
    ? [
        { subject: 'Innovation', score: selected.aiScore * 0.9 },
        { subject: 'Marché', score: selected.aiScore * 1.05 },
        { subject: 'Équipe', score: selected.aiScore * 0.95 },
        { subject: 'Faisabilité', score: selected.aiScore * 1.0 },
        { subject: 'Impact', score: selected.aiScore * 0.85 },
      ]
    : []

  return (
    <AdminLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Brain className="h-6 w-6 text-brand-500" />Évaluation IA
            </h1>
            <p className="text-muted-foreground">Scoring automatique par Ollama</p>
          </div>
          <Button variant="brand" onClick={handleScoreAll} disabled={scoring}>
            {scoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Scorer tout
          </Button>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          {/* Left: candidature list */}
          <div className="space-y-2">
            <select value={progFilter} onChange={(e) => setProgFilter(e.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring mb-2">
              <option value="ALL">Tous les programmes</option>
              {programmes.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
            </select>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)
            ) : filtered.map((c) => (
              <button key={c.id} onClick={() => setSelected(c)} className="w-full text-left">
                <MagicCard className={`p-3 transition-all ${selected?.id === c.id ? 'ring-2 ring-brand-500' : ''}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.projectName ?? `#${c.id}`}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {c.applicant?.firstName} {c.applicant?.lastName}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {c.aiScore != null ? (
                        <span className="flex items-center gap-1 text-amber-500 text-sm font-bold">
                          <Star className="h-3.5 w-3.5" />{c.aiScore.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                      <span className={`text-xs rounded-full px-1.5 py-0.5 ${statusColor(c.status)}`}>
                        {statusLabel[c.status] ?? c.status}
                      </span>
                    </div>
                  </div>
                </MagicCard>
              </button>
            ))}
          </div>

          {/* Right: detail panel */}
          <div>
            {!selected ? (
              <div className="flex h-64 items-center justify-center text-muted-foreground">Sélectionnez une candidature</div>
            ) : (
              <motion.div key={selected.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <MagicCard className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-foreground">{selected.projectName ?? `Candidature #${selected.id}`}</h2>
                      <p className="text-sm text-muted-foreground">
                        {selected.applicant?.firstName} {selected.applicant?.lastName} · {selected.applicant?.email}
                      </p>
                    </div>
                    <Button variant="brand" size="sm" onClick={() => handleScore(selected.id)} disabled={scoring}>
                      {scoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                      {scoring ? 'Calcul...' : 'Recalculer'}
                    </Button>
                  </div>

                  {selected.projectDescription && (
                    <p className="mt-3 text-sm text-muted-foreground">{selected.projectDescription}</p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-4">
                    {selected.sector && (
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Secteur</p>
                        <p className="text-sm font-medium">{selected.sector}</p>
                      </div>
                    )}
                    {selected.teamSize && (
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Équipe</p>
                        <p className="text-sm font-medium">{selected.teamSize} pers.</p>
                      </div>
                    )}
                    {selected.fundingRequired != null && (
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Financement</p>
                        <p className="text-sm font-medium">{selected.fundingRequired.toLocaleString()} DA</p>
                      </div>
                    )}
                    {selected.aiScore != null && (
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Score IA</p>
                        <p className="text-2xl font-bold text-amber-500">{selected.aiScore.toFixed(1)}<span className="text-sm">/10</span></p>
                      </div>
                    )}
                  </div>
                </MagicCard>

                {radarData.length > 0 && (
                  <MagicCard className="p-6">
                    <h3 className="mb-4 font-semibold text-foreground">Analyse multi-critères</h3>
                    <ResponsiveContainer width="100%" height={280}>
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="hsl(var(--border))" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                        <PolarRadiusAxis angle={90} domain={[0, 10]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                        <Radar name="Score" dataKey="score" stroke="#6272f6" fill="#6272f6" fillOpacity={0.3} />
                        <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </MagicCard>
                )}

                {selected.aiComment && (
                  <MagicCard className="p-6">
                    <h3 className="mb-3 font-semibold text-foreground flex items-center gap-2">
                      <Brain className="h-4 w-4 text-brand-500" />Commentaire IA
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{selected.aiComment}</p>
                  </MagicCard>
                )}

                {selected.aiScore == null && !scoring && (
                  <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                    <Brain className="h-5 w-5 mr-2 text-brand-400" />
                    Aucun score IA disponible — cliquez sur "Recalculer"
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
