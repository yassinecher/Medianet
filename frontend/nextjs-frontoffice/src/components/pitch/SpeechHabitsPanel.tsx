'use client'
import { AudioLines, MessageCircleQuestion, Repeat, Volume1, Play } from 'lucide-react'
import { fmtTime, type Delivery } from './types'

/** verdict colour for a "lower is better" metric */
const tone = (v: number | null | undefined, warn: number, bad: number) =>
  v == null ? 'text-muted-foreground'
    : v >= bad ? 'text-red-600 dark:text-red-400'
    : v >= warn ? 'text-amber-600 dark:text-amber-400'
    : 'text-emerald-600 dark:text-emerald-400'

/**
 * The unconscious habits that make a speaker sound unsure — all measured from
 * the audio word-by-word, never guessed. Clicking a tic jumps to that moment.
 */
export function SpeechHabitsPanel({ d, onSeek }: { d: Delivery; onSeek: (t: number) => void }) {
  const has = d.elongationCount != null || d.hedgeCount != null || d.repetitionCount != null
    || d.fillerSoundCount != null
  if (!has) return null

  const hedges = Object.entries(d.hedgePhrases ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 6)

  // Every audible tic on one timeline, so they can be replayed in order.
  const tics = [
    ...(d.fillerMoments ?? []).map((f) => ({ atSec: f.atSec, word: f.word, held: null as number | null })),
    ...(d.elongations ?? []).map((e) => ({ atSec: e.atSec, word: e.word, held: e.heldSec })),
  ].sort((a, b) => a.atSec - b.atSec)

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <AudioLines className="h-4 w-4 text-brand-500" />Tics & assurance
      </p>
      <p className="mb-3 text-[11px] text-muted-foreground">
        Habitudes inconscientes détectées mot à mot dans votre audio.
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <Metric icon={<AudioLines className="h-3 w-3" />} label="Euh / um"
          value={d.fillerSoundCount ?? 0} sub={d.fillerSoundsPerMin != null ? `${d.fillerSoundsPerMin}/min` : undefined}
          cls={tone(d.fillerSoundsPerMin, 1, 3)} hint="sons de remplissage : « euh », « um », « hmm »" />
        <Metric icon={<AudioLines className="h-3 w-3" />} label="Sons étirés"
          value={d.elongationCount ?? 0} sub={d.elongationsPerMin != null ? `${d.elongationsPerMin}/min` : undefined}
          cls={tone(d.elongationsPerMin, 1, 2)} hint="« aaaa », « sooo » — son tenu plus de 0,7s (pauses exclues)" />
        <Metric icon={<MessageCircleQuestion className="h-3 w-3" />} label="Atténuations"
          value={d.hedgeCount ?? 0} sub={d.hedgesPerMin != null ? `${d.hedgesPerMin}/min` : undefined}
          cls={tone(d.hedgesPerMin, 2, 3)} hint="« je pense », « peut-être » — affaiblit la conviction" />
        <Metric icon={<Repeat className="h-3 w-3" />} label="Répétitions"
          value={d.repetitionCount ?? 0} cls={tone(d.repetitionCount, 3, 8)}
          hint="bégaiements / redémarrages (« le le »)" />
        <Metric icon={<Volume1 className="h-3 w-3" />} label="Marmonné"
          value={d.lowConfidenceWordPct != null ? `${d.lowConfidenceWordPct}%` : '—'}
          cls={tone(d.lowConfidenceWordPct, 10, 15)} hint="mots mal articulés (>15% = peu clair)" />
      </div>

      {/* Jump straight to each audible tic */}
      {tics.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Écoutez-les ({tics.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {tics.slice(0, 14).map((t, i) => (
              <button key={i} type="button" onClick={() => onSeek(Math.max(0, t.atSec - 1))}
                title={t.held != null ? `« ${t.word} » tenu ${t.held}s` : `« ${t.word} »`}
                className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5
                           text-[10px] font-medium text-amber-700 transition-colors hover:bg-amber-500/20 dark:text-amber-300">
                <Play className="h-2.5 w-2.5" />{fmtTime(t.atSec)} « {t.word} »
              </button>
            ))}
          </div>
        </div>
      )}

      {hedges.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Formules qui affaiblissent le discours
          </p>
          <div className="flex flex-wrap gap-1.5">
            {hedges.map(([phrase, n]) => (
              <span key={phrase} className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                « {phrase} » ×{n}
              </span>
            ))}
          </div>
        </div>
      )}

      {d.tagQuestionCount != null && d.tagQuestionCount > 0 && (
        <p className="mt-2 rounded-lg bg-amber-500/5 p-1.5 text-[10px] text-amber-700 dark:text-amber-300">
          {d.tagQuestionCount} affirmation(s) tournée(s) en question (« ok ? », « vous voyez ? ») — cela donne un ton
          hésitant : affirmez plutôt vos points.
        </p>
      )}
    </div>
  )
}

function Metric({ icon, label, value, sub, cls, hint }: {
  icon: React.ReactNode; label: string; value: number | string; sub?: string; cls: string; hint: string
}) {
  return (
    <div className="rounded-lg border border-border p-2" title={hint}>
      <p className="flex items-center gap-1 text-[10px] text-muted-foreground">{icon}{label}</p>
      <p className={`text-lg font-black tabular-nums ${cls}`}>{value}</p>
      {sub && <p className="text-[9px] text-muted-foreground">{sub}</p>}
    </div>
  )
}
