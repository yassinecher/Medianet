/** Shared types for the pitch analysis workspace. */

export interface Segment { start: number; end: number; text: string }

export type Severity = 'low' | 'medium' | 'high' | 'positive'

export interface Highlight {
  timeSec: number
  topic: string
  severity: Severity
  observation: string
  advice?: string
  scoreImpact?: number
  criterion?: string
  confidence?: number
}

export interface Section {
  name: string
  startSec: number
  endSec: number
  score?: number
  missing?: string[]
}

export interface Dimension { name: string; score: number; comment?: string }

export interface CriterionMapping {
  name: string
  weight?: number
  aiScore?: number
  maxScore?: number
  evidenceFound?: string[]
  evidenceMissing?: string[]
  advice?: string
  recoverablePoints?: number
}

/** A concrete, costed next step — what to do, why, and what it is worth. */
export interface CoachingAction {
  action: string
  /** The observed consequence in THIS pitch that justifies it. */
  why?: string
  /** Which dimension it moves. */
  criterion?: string
  /** Realistic gain on the overall score. */
  impactPoints?: number
  effort?: 'low' | 'medium' | 'high'
  /** Moment illustrating the problem — makes the advice clickable. */
  atSec?: number
  /** Ready-to-say replacement wording, when the action is a rewrite. */
  example?: string
}

export interface Coaching {
  strengths?: string[]
  weaknesses?: string[]
  /** Objects since the coaching rework; older saved analyses hold plain strings. */
  nextActions?: (CoachingAction | string)[]
  estimatedScoreAfter?: number
}

export interface Confidence { score?: number; reasons?: string[]; limits?: string[] }

/** All measured straight from the audio waveform — never AI-inferred. */
export interface Delivery {
  wordsPerMinute?: number | null
  fillerCount?: number | null
  pauseCount?: number | null
  longPauses?: number | null
  longestPauseSec?: number | null
  /** Share of the video that is actual speech (0-1). */
  speakingRatio?: number | null
  /** Average loudness; < -30 LUFS is too quiet to hear comfortably. */
  integratedLoudnessLufs?: number | null
  /** Loudness range: < 3 LU means a flat, monotone voice. */
  loudnessRangeLu?: number | null

  // ── Unconscious tics / confidence markers (word-level) ──────────────────
  /** Hesitation sounds — "euh", "um", "uh" — with the moment of each. */
  fillerSoundCount?: number | null
  fillerSoundsPerMin?: number | null
  fillerMoments?: { word: string; atSec: number }[]
  /** Drawn-out sounds: "aaaa", "sooo" — voiced hold > 0.7s (pauses excluded). */
  elongationCount?: number | null
  elongationsPerMin?: number | null
  elongations?: { word: string; atSec: number; heldSec: number }[]
  /** Stutters / restarts: "the the", "on on". */
  repetitionCount?: number | null
  /** % of words the ASR itself was unsure of → mumbling. */
  lowConfidenceWordPct?: number | null
  /** "I think", "maybe", "sort of" — undermines conviction. */
  hedgeCount?: number | null
  hedgesPerMin?: number | null
  hedgePhrases?: Record<string, number>
  /** Statements delivered as questions ("ok?", "you know?"). */
  tagQuestionCount?: number | null
}

/** How the pitch was delivered — drives which sections are even expected. */
export type PitchFormat = 'DEMO_DAY' | 'COMPETITION' | 'INVESTOR' | 'INTERNAL' | 'NOT_A_PITCH'

export const FORMAT_LABEL: Record<PitchFormat, { label: string; hint: string }> = {
  DEMO_DAY:    { label: 'Demo Day', hint: '1-3 min devant des investisseurs — équipe et financements souvent hors format' },
  COMPETITION: { label: 'Concours', hint: 'Pitch + questions du jury — la tenue en Q&A compte' },
  INVESTOR:    { label: 'Investisseurs', hint: 'Pitch long — équipe et plan de financement attendus' },
  INTERNAL:    { label: 'Point interne', hint: 'Session interne — pas de demande de financement attendue' },
  NOT_A_PITCH: { label: 'Pas un pitch', hint: "Ce n'est pas un pitch de startup — la note est plafonnée" },
}

/** The full analysis blob stored in PitchSubmission.aiAnalysisJson. */
export interface PitchAnalysis {
  overallScore?: number
  /** Detected delivery format — expectations are calibrated to it. */
  pitchFormat?: PitchFormat
  formatReason?: string
  dimensions?: Dimension[]
  highlights?: Highlight[]
  sections?: Section[]
  criteria?: CriterionMapping[]
  coaching?: Coaching
  confidence?: Confidence
  delivery?: Delivery
  visualObservations?: string[]
  globalCommentary?: string
  mediaWarnings?: string[]
  transcript?: string
  autoTranscribed?: boolean
  durationSeconds?: number
}

/** A live stage emitted by the analysis SSE stream. */
export interface Stage {
  step: string
  label: string
  status: 'running' | 'done' | 'warn' | 'error'
  detail?: string
  /** Estimated duration of this step, learned from real past runs (seconds). */
  etaSec?: number
  /** Live countdown, from the heartbeat. */
  elapsedSec?: number
  remainingSec?: number
  percent?: number
}

export const SEVERITY_STYLE: Record<Severity, { dot: string; chip: string; label: string }> = {
  positive: { dot: '#22c55e', chip: 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300', label: 'Point fort' },
  low:      { dot: '#3b82f6', chip: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300',    label: 'Mineur' },
  medium:   { dot: '#f59e0b', chip: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300', label: 'Moyen' },
  high:     { dot: '#ef4444', chip: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',        label: 'Critique' },
}

export const fmtTime = (s: number) => {
  if (!isFinite(s) || s < 0) s = 0
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}
