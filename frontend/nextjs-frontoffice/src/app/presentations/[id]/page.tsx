'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Sparkles, Trophy, Gauge, Eye, Dumbbell, RefreshCw, Loader2,
  Radar as RadarIcon, ListChecks, Target, AlertTriangle, Video, Activity, Volume2, Presentation,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { pitchApi, streamPitchAnalysis, type PitchSubmission } from '@/lib/api'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { VideoPlayer } from '@/components/pitch/VideoPlayer'
import { TranscriptPanel } from '@/components/pitch/TranscriptPanel'
import { HighlightsPanel } from '@/components/pitch/HighlightsPanel'
import { TimelineIntelligence } from '@/components/pitch/TimelineIntelligence'
import { ScoreRadar } from '@/components/pitch/ScoreRadar'
import { CriterionCards } from '@/components/pitch/CriterionCards'
import { AIThinkingPanel } from '@/components/pitch/AIThinkingPanel'
import { CoachingPanel } from '@/components/pitch/CoachingPanel'
import { SpeechHabitsPanel } from '@/components/pitch/SpeechHabitsPanel'
import { FORMAT_LABEL, type PitchAnalysis, type Segment, type Stage } from '@/components/pitch/types'

type Tab = 'insights' | 'criteria' | 'coaching'

export default function PitchWorkspacePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [sub, setSub] = useState<PitchSubmission | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [seekReq, setSeekReq] = useState<{ t: number; nonce: number } | null>(null)
  const [stages, setStages] = useState<Stage[]>([])
  const [running, setRunning] = useState(false)
  const [showThinking, setShowThinking] = useState(false)
  const [tab, setTab] = useState<Tab>('insights')
  const nonce = useRef(0)

  const load = useCallback(async () => {
    try {
      const { data } = await pitchApi.get(Number(id))
      setSub(data)
    } catch { toast.error('Présentation introuvable') }
    finally { setLoading(false) }
  }, [id])
  useEffect(() => { load() }, [load])

  const analysis: PitchAnalysis | null = useMemo(() => {
    try { return sub?.aiAnalysisJson ? JSON.parse(sub.aiAnalysisJson) : null } catch { return null }
  }, [sub])

  const segments: Segment[] = useMemo(() => {
    try { return sub?.segmentsJson ? JSON.parse(sub.segmentsJson) : [] } catch { return [] }
  }, [sub])

  const seek = (t: number) => { nonce.current += 1; setSeekReq({ t, nonce: nonce.current }) }

  /** Run the analysis, streaming the real pipeline stages as they land. */
  const analyze = async () => {
    setRunning(true); setStages([]); setShowThinking(true)
    try {
      let result: any = null
      await streamPitchAnalysis(Number(id), (type, payload) => {
        if (type === 'stage') {
          setStages((prev) => {
            // Replace the running entry of the same step, else append.
            const i = prev.findIndex((p) => p.step === payload.step && p.status === 'running')
            if (i >= 0) { const next = [...prev]; next[i] = payload; return next }
            return [...prev, payload]
          })
        } else if (type === 'progress') {
          // Heartbeat: fold the live countdown into the step still running.
          setStages((prev) => {
            const i = prev.findIndex((p) => p.step === payload.step && p.status === 'running')
            if (i < 0) return prev
            const next = [...prev]
            next[i] = { ...next[i], ...payload, status: 'running' }
            return next
          })
        } else if (type === 'done') result = payload
        else if (type === 'error') toast.error(payload?.error ?? 'Analyse échouée')
      })
      if (result && result.aiEnhanced !== false) {
        // The server already persisted it; only save from here if that failed.
        if (result.saved === false) await pitchApi.saveAnalysis(Number(id), result)
        toast.success('Analyse terminée')
      } else if (result?.error) {
        toast.error(result.error)
      }
      await load()
    } catch (e: any) {
      // The stream can be torn down at close even though the analysis completed
      // and was saved server-side — reload and only complain if nothing landed.
      const saved = await load().then(() => true).catch(() => false)
      const got = saved && (await pitchApi.get(Number(id))).data?.aiAnalysisJson
      if (got) toast.success('Analyse terminée')
      else toast.error(e?.message ?? 'L’analyse a échoué')
    } finally {
      setRunning(false)
      // Defensive: the run is over, so no row may keep spinning/counting down
      // (a stage that never reported its completion would hang the UI forever).
      setStages((prev) => prev.map((s) => s.status === 'running'
        ? { ...s, status: 'done', etaSec: undefined, remainingSec: undefined, percent: undefined }
        : s))
    }
  }

  // Land already analysing when arriving straight from an upload. Read from
  // location rather than useSearchParams(): the latter forces this page under a
  // Suspense boundary at build time for a one-off flag.
  const autoStarted = useRef(false)
  useEffect(() => {
    if (autoStarted.current || loading || !sub || running) return
    if (new URLSearchParams(window.location.search).get('autostart') !== '1') return
    if (!sub.videoUrl || sub.aiAnalysisJson) return
    autoStarted.current = true
    // Drop the flag first, so a refresh never silently re-runs the analysis.
    router.replace(`/presentations/${id}`)
    analyze()
    // analyze/load are stable enough for a once-only guarded run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, sub, running, id, router])

  if (loading) {
    return <AppShell><div className="mx-auto max-w-7xl space-y-4">
      <Skeleton className="h-8 w-64 rounded-lg" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2"><Skeleton className="aspect-video rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    </div></AppShell>
  }
  if (!sub) return null

  const score = sub.aiScore ?? analysis?.overallScore ?? null
  const highlights = analysis?.highlights ?? []
  const duration = sub.durationSeconds ?? analysis?.durationSeconds ?? 0
  const d = analysis?.delivery ?? {}
  // Back goes to the phase this video belongs to, not the top of the hierarchy.
  const backHref = sub.sessionId
    ? `/presentations/programme/${sub.programmeId}/session/${sub.sessionId}`
    : '/presentations'

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-4">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center gap-3">
          <Link href={backHref}><Button variant="ghost" size="icon" aria-label="Retour à la phase"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 truncate text-xl font-bold text-foreground">
              {sub.title || sub.projectName || `Présentation #${sub.id}`}
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                sub.kind === 'TRAINING' ? 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300'
                                        : 'border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300'}`}>
                {sub.kind === 'TRAINING' ? <><Dumbbell className="mr-0.5 inline h-2.5 w-2.5" />Entraînement</> : <><Trophy className="mr-0.5 inline h-2.5 w-2.5" />Pitch final</>}
              </span>
            </h1>
            <p className="truncate text-xs text-muted-foreground">{sub.companyName}</p>
          </div>
          {score != null && (
            <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-purple-600 text-white shadow-lg">
              <span className="text-lg font-black leading-none">{score}</span>
              <span className="text-[9px] opacity-80">/ 10</span>
            </div>
          )}
          <Button onClick={analyze} disabled={running || !sub.videoUrl} variant="brand" className="gap-1.5">
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {analysis ? 'Relancer l’analyse' : 'Analyser'}
          </Button>
        </motion.div>

        {!sub.videoUrl && (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <Video className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Aucune vidéo déposée pour cette présentation.</p>
          </div>
        )}

        {sub.videoUrl && (
          <div className="grid gap-4 lg:grid-cols-5">
            {/* LEFT — player + transcript */}
            <div className="space-y-4 lg:col-span-3">
              <VideoPlayer src={sub.videoUrl} highlights={highlights} currentTime={currentTime}
                onTime={setCurrentTime} seekTo={seekReq} />

              {/* Measured delivery — straight from the waveform, with a verdict.
                  Tone: red = problem, amber = borderline, green = good. */}
              {(d.wordsPerMinute != null || duration > 0) && (
                <div className="flex flex-wrap gap-2">
                  {/* The detected format decides what is even expected of this pitch,
                      so it is shown up front rather than hidden in the reasoning. */}
                  {analysis?.pitchFormat && FORMAT_LABEL[analysis.pitchFormat] && (
                    <Chip icon={<Presentation className="h-3 w-3" />}
                      label={`format : ${FORMAT_LABEL[analysis.pitchFormat].label}`}
                      tone={analysis.pitchFormat === 'NOT_A_PITCH' ? 'bad' : 'neutral'}
                      title={analysis.formatReason || FORMAT_LABEL[analysis.pitchFormat].hint} />
                  )}
                  {duration > 0 && <Chip icon={<Video className="h-3 w-3" />} label={`${duration}s`} />}
                  {d.wordsPerMinute != null && (() => {
                    // Must agree with the scoring rubric: a Demo Day pitch at 180
                    // wpm is energetic and scores well, so flagging it red here
                    // contradicted the 7/10 the AI gave the same delivery.
                    const fast = analysis?.pitchFormat === 'DEMO_DAY' ? 200 : 190
                    const wpm = d.wordsPerMinute
                    const tone = wpm < 100 || wpm > fast ? 'bad'
                      : wpm < 120 || wpm > 170 ? 'warn' : 'good'
                    const title = wpm < 100 ? 'Débit trop lent — l’attention décroche'
                      : wpm > fast ? 'Débit précipité — le jury ne suit plus'
                      : wpm > 170 ? `Débit soutenu, encore acceptable${analysis?.pitchFormat === 'DEMO_DAY' ? ' (normal en Demo Day)' : ''}`
                      : wpm < 120 ? 'Débit posé, un peu lent'
                      : 'Débit idéal (130-160 mots/min)'
                    return <Chip icon={<Gauge className="h-3 w-3" />} label={`${wpm} mots/min`} tone={tone} title={title} />
                  })()}
                  {d.fillerCount != null && (
                    <Chip label={`${d.fillerCount} hésitation(s)`}
                      tone={duration > 0 && d.fillerCount / (duration / 60) > 3 ? 'bad'
                        : duration > 0 && d.fillerCount / (duration / 60) > 1.5 ? 'warn' : 'neutral'}
                      title="Minimum réel — la transcription auto en efface une partie" />
                  )}
                  {d.loudnessRangeLu != null && (
                    <Chip icon={<Activity className="h-3 w-3" />}
                      label={d.loudnessRangeLu < 3 ? 'voix monocorde' : d.loudnessRangeLu < 6 ? 'peu expressive' : 'voix dynamique'}
                      tone={d.loudnessRangeLu < 3 ? 'bad' : d.loudnessRangeLu < 6 ? 'warn' : 'good'}
                      title={`Variation d'intensité ${d.loudnessRangeLu} LU`} />
                  )}
                  {d.integratedLoudnessLufs != null && (
                    <Chip icon={<Volume2 className="h-3 w-3" />}
                      label={d.integratedLoudnessLufs < -30 ? 'voix trop faible' : 'volume correct'}
                      tone={d.integratedLoudnessLufs < -30 ? 'bad' : 'good'}
                      title={`${d.integratedLoudnessLufs} LUFS`} />
                  )}
                  {d.longPauses != null && d.longPauses > 0 && (
                    <Chip label={`${d.longPauses} pause(s) longue(s)`} tone={d.longPauses > 5 ? 'warn' : 'neutral'}
                      title={d.longestPauseSec ? `la plus longue: ${d.longestPauseSec}s` : undefined} />
                  )}
                  {analysis?.autoTranscribed && <Chip icon={<Sparkles className="h-3 w-3" />} label="transcription auto" />}
                </div>
              )}

              {/* Structure sits directly under the player — it was buried below
                  the transcript and users never scrolled far enough to find it. */}
              {analysis?.sections && analysis.sections.length > 0 && (
                <TimelineIntelligence sections={analysis.sections} duration={duration} onSeek={seek} currentTime={currentTime} />
              )}

              {analysis?.delivery && <SpeechHabitsPanel d={analysis.delivery} onSeek={seek} />}

              <TranscriptPanel segments={segments} currentTime={currentTime} onSeek={seek} auto={sub.autoTranscribed} />
            </div>

            {/* RIGHT — AI insight panels */}
            <div className="space-y-4 lg:col-span-2">
              {!analysis && !running && (
                <div className="rounded-2xl border border-dashed border-border p-6 text-center">
                  <Sparkles className="mx-auto mb-2 h-7 w-7 text-brand-500/50" />
                  <p className="text-sm font-medium text-foreground">Pas encore analysé</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Lancez l’analyse : Medi transcrit la vidéo, mesure votre élocution, observe votre présence
                    et rattache chaque remarque aux critères du programme.
                  </p>
                </div>
              )}

              {running && !analysis && (
                <div className="space-y-3">
                  <Skeleton className="h-56 rounded-2xl" /><Skeleton className="h-40 rounded-2xl" />
                </div>
              )}

              {analysis && (
                <>
                  {/* Tabs */}
                  <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
                    {([['insights', 'Analyse', RadarIcon], ['criteria', 'Critères', Target], ['coaching', 'Coaching', ListChecks]] as const)
                      .map(([k, label, Icon]) => (
                      <button key={k} onClick={() => setTab(k as Tab)}
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ${
                          tab === k ? 'bg-brand-500 text-white shadow' : 'text-muted-foreground hover:bg-accent'}`}>
                        <Icon className="h-3.5 w-3.5" />{label}
                      </button>
                    ))}
                  </div>

                  {tab === 'insights' && (
                    <>
                      {analysis.dimensions && analysis.dimensions.length >= 3 && (
                        <div className="rounded-2xl border border-border bg-card p-3">
                          <p className="mb-1 text-sm font-semibold text-foreground">Profil du pitch</p>
                          <ScoreRadar dimensions={analysis.dimensions} />
                        </div>
                      )}
                      {analysis.globalCommentary && (
                        <p className="rounded-2xl border border-border bg-card p-3 text-xs leading-relaxed text-muted-foreground">
                          {analysis.globalCommentary}
                        </p>
                      )}
                      {analysis.visualObservations && analysis.visualObservations.length > 0 && (
                        <div className="rounded-2xl border border-border bg-card p-3">
                          <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                            <Eye className="h-3.5 w-3.5 text-brand-500" />Présence (images de la vidéo)
                          </p>
                          <ul className="space-y-0.5 text-[11px] text-muted-foreground">
                            {analysis.visualObservations.map((v, i) => <li key={i}>• {v}</li>)}
                          </ul>
                          <p className="mt-1 text-[10px] text-muted-foreground/70">
                            Basé sur des images échantillonnées — indicatif, pas un suivi continu des gestes.
                          </p>
                        </div>
                      )}
                      {highlights.length > 0 && (
                        <div>
                          <p className="mb-2 text-sm font-semibold text-foreground">Moments clés ({highlights.length})</p>
                          <HighlightsPanel highlights={highlights} onSeek={seek} activeTime={currentTime} />
                        </div>
                      )}
                    </>
                  )}

                  {tab === 'criteria' && (
                    analysis.criteria && analysis.criteria.length > 0
                      ? <CriterionCards criteria={analysis.criteria} />
                      : <div className="rounded-2xl border border-dashed border-border p-6 text-center">
                          <Target className="mx-auto mb-2 h-7 w-7 text-muted-foreground/40" />
                          <p className="text-xs text-muted-foreground">Aucun critère officiel défini sur ce programme — la notation est générique.</p>
                        </div>
                  )}

                  {tab === 'coaching' && (
                    <CoachingPanel coaching={analysis.coaching} confidence={analysis.confidence}
                      currentScore={score ?? undefined} onSeek={seek} />
                  )}

                  {analysis.mediaWarnings && analysis.mediaWarnings.length > 0 && (
                    <p className="flex items-start gap-1 rounded-xl border border-amber-500/30 bg-amber-500/5 p-2 text-[10px] text-amber-700 dark:text-amber-300">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />{analysis.mediaWarnings.join(' · ')}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {showThinking && (
        <AIThinkingPanel stages={stages} running={running} onClose={() => setShowThinking(false)} />
      )}
    </AppShell>
  )
}

const CHIP_TONE = {
  neutral: 'border-border bg-card text-muted-foreground',
  good:    'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  warn:    'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  bad:     'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',
}

function Chip({ icon, label, tone = 'neutral', title }: {
  icon?: React.ReactNode; label: string; tone?: keyof typeof CHIP_TONE; title?: string
}) {
  return (
    <span title={title}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] ${CHIP_TONE[tone]}`}>
      {icon}{label}
    </span>
  )
}
