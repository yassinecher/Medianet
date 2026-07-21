'use client'
import { useEffect, useMemo, useState } from 'react'
import {
  Presentation, Video, Sparkles, Trophy, CheckCircle2, Clock, ExternalLink,
  ThumbsUp, ThumbsDown, Lightbulb, RefreshCw, Calendar, ChevronDown, ChevronRight,
  Dumbbell, Gauge, Eye, FileText, Loader2, AlertTriangle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { pitchApi, sessionsApi, type PitchSubmissionDto } from '@/lib/api'
import { MagicCard } from '@/components/magicui/magic-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/utils'

const TYPE_LABEL: Record<string, string> = {
  PITCH_DAY: 'Journée de pitch', DEMO_DAY: 'Demo Day', CANDIDATURE_SUBMISSION: 'Candidatures',
  PRESELECTION: 'Présélection', ONBOARDING: 'Onboarding', INCUBATION: 'Incubation', TRAINING_DAY: 'Formation',
}
const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground border-border',
  SUBMITTED: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30',
  PROCESSING: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30',
  ANALYZED: 'bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/30',
  FAILED: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30',
}
const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Brouillon', SUBMITTED: 'Soumis', PROCESSING: 'Analyse en cours', ANALYZED: 'Analysé', FAILED: 'Échec',
}

interface Session {
  id: number
  title: string
  sessionType?: string
  startDate?: string
  collectPitchVideos?: boolean
  pitchDeadline?: string
  maxTrainingVideos?: number
}

/** Render a saved AI pitch analysis (parsed from aiAnalysisJson). */
export function PitchAnalysis({ json, score }: { json?: string | null; score?: number | null }) {
  const data = useMemo(() => { try { return json ? JSON.parse(json) : null } catch { return null } }, [json])
  if (!data) return null
  const dims: any[] = data.dimensions ?? []
  const d = data.delivery ?? {}
  const visual: string[] = data.visualObservations ?? []
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 text-white">
          <span className="text-lg font-black leading-none">{score ?? data.overallScore ?? '—'}</span>
          <span className="text-[9px] opacity-80">/ 10</span>
        </div>
        {data.globalCommentary && <p className="text-xs text-muted-foreground">{data.globalCommentary}</p>}
      </div>

      {/* Delivery metrics (from the audio) */}
      {(d.wordsPerMinute != null || d.fillerCount != null || d.longPauses != null) && (
        <div className="flex flex-wrap gap-2 text-[11px]">
          {d.wordsPerMinute != null && <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5"><Gauge className="h-3 w-3" />{d.wordsPerMinute} mots/min</span>}
          {d.fillerCount != null && <span className="rounded-full bg-muted px-2 py-0.5">{d.fillerCount} mot(s) de remplissage</span>}
          {d.longPauses != null && <span className="rounded-full bg-muted px-2 py-0.5">{d.longPauses} pause(s) longue(s)</span>}
        </div>
      )}

      {dims.length > 0 && (
        <div className="grid gap-1.5 sm:grid-cols-2">
          {dims.map((dm, i) => (
            <div key={i} className="rounded-lg border border-border p-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">{dm.name}</span>
                <span className="text-xs font-bold tabular-nums text-brand-600 dark:text-brand-400">{dm.score}/10</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-brand-500" style={{ width: `${(Number(dm.score) / 10) * 100}%` }} />
              </div>
              {dm.comment && <p className="mt-1 text-[11px] text-muted-foreground">{dm.comment}</p>}
            </div>
          ))}
        </div>
      )}

      {visual.length > 0 && (
        <div className="rounded-lg border border-border p-2">
          <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-foreground"><Eye className="h-3 w-3" />Présence & langage corporel (vidéo)</p>
          <ul className="space-y-0.5 text-[11px] text-muted-foreground">{visual.map((v, i) => <li key={i}>• {v}</li>)}</ul>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-3">
        {Array.isArray(data.strengths) && data.strengths.length > 0 && (
          <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-2">
            <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-green-700 dark:text-green-300"><ThumbsUp className="h-3 w-3" />Points forts</p>
            <ul className="space-y-0.5 text-[11px] text-muted-foreground">{data.strengths.map((s: string, i: number) => <li key={i}>• {s}</li>)}</ul>
          </div>
        )}
        {Array.isArray(data.weaknesses) && data.weaknesses.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2">
            <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300"><ThumbsDown className="h-3 w-3" />Points faibles</p>
            <ul className="space-y-0.5 text-[11px] text-muted-foreground">{data.weaknesses.map((s: string, i: number) => <li key={i}>• {s}</li>)}</ul>
          </div>
        )}
        {Array.isArray(data.advice) && data.advice.length > 0 && (
          <div className="rounded-lg border border-brand-500/30 bg-brand-500/5 p-2">
            <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-brand-700 dark:text-brand-300"><Lightbulb className="h-3 w-3" />Conseils</p>
            <ul className="space-y-0.5 text-[11px] text-muted-foreground">{data.advice.map((s: string, i: number) => <li key={i}>→ {s}</li>)}</ul>
          </div>
        )}
      </div>
    </div>
  )
}

function SubmissionRow({ sub }: { sub: PitchSubmissionDto }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-lg border border-border">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-3 py-2 text-left">
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${sub.kind === 'TRAINING' ? 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300' : 'border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300'}`}>
          {sub.kind === 'TRAINING' ? 'Entraînement' : 'Final'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{sub.companyName || sub.projectName || sub.title || `Présentation #${sub.id}`}</p>
          <p className="truncate text-xs text-muted-foreground">{sub.porteurName ?? `Porteur #${sub.porteurId}`}{sub.updatedAt && <> · {formatDate(sub.updatedAt)}</>}</p>
        </div>
        {sub.aiScore != null && <span className="flex items-center gap-1 text-sm font-bold text-brand-600 dark:text-brand-400"><Trophy className="h-3.5 w-3.5" />{sub.aiScore}/10</span>}
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${STATUS_BADGE[sub.status]}`}>
          {sub.status === 'ANALYZED' ? <CheckCircle2 className="mr-0.5 inline h-2.5 w-2.5" /> : sub.status === 'PROCESSING' ? <Loader2 className="mr-0.5 inline h-2.5 w-2.5 animate-spin" /> : sub.status === 'FAILED' ? <AlertTriangle className="mr-0.5 inline h-2.5 w-2.5" /> : <Clock className="mr-0.5 inline h-2.5 w-2.5" />}
          {STATUS_LABEL[sub.status]}
        </span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-border px-3 py-3">
          {sub.videoUrl && (
            <a href={sub.videoUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-1.5"><Video className="h-3.5 w-3.5" />Voir la vidéo<ExternalLink className="h-3 w-3" /></Button>
            </a>
          )}
          {sub.transcript && (
            <details className="text-xs">
              <summary className="cursor-pointer font-medium text-muted-foreground flex items-center gap-1">
                <FileText className="inline h-3 w-3" />Transcription
                {sub.autoTranscribed && <span className="rounded-full bg-brand-500/10 px-1.5 py-0.5 text-[9px] font-bold text-brand-600 dark:text-brand-400">auto</span>}
                {sub.durationSeconds ? <span className="text-muted-foreground/70">· {sub.durationSeconds}s</span> : null}
              </summary>
              <p className="mt-1 whitespace-pre-wrap rounded-lg bg-muted/40 p-2 text-muted-foreground">{sub.transcript}</p>
            </details>
          )}
          {sub.status === 'ANALYZED' && sub.aiAnalysisJson ? (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground"><Sparkles className="h-3.5 w-3.5 text-brand-500" />Analyse IA du pitch</p>
              <PitchAnalysis json={sub.aiAnalysisJson} score={sub.aiScore} />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {sub.status === 'PROCESSING' ? "Analyse automatique en cours (transcription + vidéo)…"
                : sub.status === 'FAILED' ? "L'analyse a échoué."
                : sub.videoUrl ? "En attente de l'analyse IA (lancée par le porteur)."
                : 'Aucune vidéo déposée.'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export function ProgrammePresentations({ programmeId, sessions, onSessionsChanged }: {
  programmeId: number
  sessions: Session[]
  onSessionsChanged?: () => void
}) {
  const [subs, setSubs] = useState<PitchSubmissionDto[]>([])
  const [loading, setLoading] = useState(true)
  const [savingSession, setSavingSession] = useState<number | null>(null)

  const load = () => {
    setLoading(true)
    pitchApi.list(programmeId)
      .then((r) => setSubs(r.data ?? []))
      .catch(() => toast.error('Impossible de charger les présentations'))
      .finally(() => setLoading(false))
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [programmeId])

  const toggle = async (s: Session, value: boolean) => {
    setSavingSession(s.id)
    try {
      await sessionsApi.update(programmeId, s.id, { collectPitchVideos: value })
      toast.success(value ? 'Analyse vidéo IA activée pour cette session' : 'Analyse vidéo désactivée')
      onSessionsChanged?.()
    } catch (e: any) { toast.error(e.response?.data?.message ?? 'Erreur') }
    finally { setSavingSession(null) }
  }
  const setDeadline = async (s: Session, date: string) => {
    setSavingSession(s.id)
    try {
      await sessionsApi.update(programmeId, s.id, { pitchDeadline: date || '1970-01-01' })
      toast.success('Date limite mise à jour')
      onSessionsChanged?.()
    } catch (e: any) { toast.error(e.response?.data?.message ?? 'Erreur') }
    finally { setSavingSession(null) }
  }
  const setMaxTraining = async (s: Session, value: string) => {
    const n = parseInt(value, 10)
    setSavingSession(s.id)
    try {
      // <=0 / empty clears the override → back to the service default (3).
      await sessionsApi.update(programmeId, s.id, { maxTrainingVideos: Number.isFinite(n) ? n : 0 })
      toast.success('Nombre maximum d’entraînements mis à jour')
      onSessionsChanged?.()
    } catch (e: any) { toast.error(e.response?.data?.message ?? 'Erreur') }
    finally { setSavingSession(null) }
  }

  const subsBySession = (sid: number) => subs.filter((x) => x.sessionId === sid)
  const enabledCount = sessions.filter((s) => s.collectPitchVideos).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Presentation className="h-4 w-4 text-brand-500" />Analyse vidéo IA des pitchs
          </h3>
          <p className="text-xs text-muted-foreground">
            Cochez « Analyse vidéo IA » sur n&apos;importe quelle session (le type de session ne décide pas).
            Les porteurs pourront alors déposer des vidéos d&apos;entraînement et leur pitch final ;
            l&apos;IA transcrit automatiquement et analyse le contenu, le rythme et la présence.
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />Actualiser
        </Button>
      </div>

      {sessions.length === 0 ? (
        <MagicCard className="p-8 text-center">
          <Presentation className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Ce programme n&apos;a pas encore de session. Créez-en une dans l&apos;onglet Sessions.</p>
        </MagicCard>
      ) : (
        <>
          {enabledCount === 0 && (
            <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
              Aucune session n&apos;a l&apos;analyse vidéo activée. Cochez-en une ci-dessous pour ouvrir le dépôt de pitchs.
            </p>
          )}
          {sessions.map((s) => {
            const list = subsBySession(s.id)
            const analyzed = list.filter((x) => x.status === 'ANALYZED')
            const avg = analyzed.length ? Math.round((analyzed.reduce((n, x) => n + (x.aiScore ?? 0), 0) / analyzed.length) * 10) / 10 : null
            const enabled = !!s.collectPitchVideos
            return (
              <MagicCard key={s.id} className={`p-4 ${!enabled ? 'opacity-80' : ''}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg text-white ${enabled ? 'bg-gradient-to-br from-brand-500 to-purple-600' : 'bg-muted-foreground/40'}`}>
                      <Presentation className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground flex items-center gap-2">
                        {s.title}
                        {s.sessionType && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{TYPE_LABEL[s.sessionType] ?? s.sessionType}</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.startDate ? formatDate(s.startDate) : 'Date à définir'}
                        {enabled && <> · {list.length} soumission(s)</>}
                        {avg != null && <> · score moyen <span className="font-semibold text-brand-600 dark:text-brand-400">{avg}/10</span></>}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                      <input type="checkbox" checked={enabled} disabled={savingSession === s.id}
                        onChange={(e) => toggle(s, e.target.checked)} className="accent-brand-500 h-4 w-4" />
                      Analyse vidéo IA
                    </label>
                    {enabled && (
                      <>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <Input type="date" value={s.pitchDeadline?.slice(0, 10) ?? ''} disabled={savingSession === s.id}
                            onChange={(e) => setDeadline(s, e.target.value)} className="h-8 w-36 text-xs" title="Date limite de dépôt" />
                        </div>
                        <div className="flex items-center gap-1" title="Nombre maximum de vidéos d'entraînement analysables par porteur">
                          <Dumbbell className="h-3.5 w-3.5 text-muted-foreground" />
                          <Input type="number" min={1} max={20} step={1}
                            value={s.maxTrainingVideos ?? 3} disabled={savingSession === s.id}
                            onChange={(e) => setMaxTraining(s, e.target.value)}
                            className="h-8 w-16 text-xs" title="Max entraînements / porteur" />
                          <span className="text-[10px] text-muted-foreground">entraîn. max</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {enabled && (
                  loading ? (
                    <div className="mt-3 space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
                  ) : list.length === 0 ? (
                    <p className="mt-3 rounded-lg bg-muted/40 px-3 py-4 text-center text-xs text-muted-foreground">Aucune présentation déposée pour cette session.</p>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {['TRAINING', 'FINAL'].map((kind) => {
                        const group = list.filter((x) => x.kind === kind)
                        if (group.length === 0) return null
                        return (
                          <div key={kind}>
                            <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {kind === 'TRAINING' ? <><Dumbbell className="h-3 w-3" />Entraînement ({group.length})</> : <><Trophy className="h-3 w-3" />Pitch final</>}
                            </p>
                            <div className="space-y-2">{group.map((sub) => <SubmissionRow key={sub.id} sub={sub} />)}</div>
                          </div>
                        )
                      })}
                    </div>
                  )
                )}
              </MagicCard>
            )
          })}
        </>
      )}
    </div>
  )
}
