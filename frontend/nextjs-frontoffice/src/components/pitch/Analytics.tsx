'use client'
import { TrendingUp, TrendingDown, Minus, Trophy, Dumbbell, AudioLines, Gauge, Volume2, Target } from 'lucide-react'
import type { PitchStats, TrendPoint } from '@/lib/pitch-analytics'
import { scoreTone, scoreBg } from '@/lib/pitch-analytics'

/** One headline number. `hint` explains what it means on hover. */
export function StatTile({ label, value, sub, tone, icon, hint }: {
  label: string; value: string | number; sub?: string; tone?: string
  icon?: React.ReactNode; hint?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3" title={hint}>
      <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {icon}{label}
      </p>
      <p className={`text-2xl font-black tabular-nums ${tone ?? 'text-foreground'}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  )
}

/**
 * Score progression across attempts — hand-rolled SVG (recharts is backoffice
 * only). Finals are drawn as a distinct marker so a final never reads as just
 * another practice run.
 */
export function ScoreTrend({ trend }: { trend: TrendPoint[] }) {
  if (trend.length < 2) return null
  const W = 560, H = 130, PAD = 26
  const n = trend.length
  const x = (i: number) => PAD + (i * (W - PAD * 2)) / Math.max(1, n - 1)
  const y = (s: number) => H - PAD - (s / 10) * (H - PAD * 2)
  const path = trend.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.score).toFixed(1)}`).join(' ')
  const area = `${path} L${x(n - 1).toFixed(1)},${H - PAD} L${x(0).toFixed(1)},${H - PAD} Z`

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <TrendingUp className="h-3.5 w-3.5 text-brand-500" />Progression des scores
      </p>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-[130px] w-full min-w-[420px]" role="img"
          aria-label={`Progression: ${trend.map((p) => `${p.label} ${p.score}/10`).join(', ')}`}>
          {[0, 5, 10].map((g) => (
            <g key={g}>
              <line x1={PAD} x2={W - PAD} y1={y(g)} y2={y(g)} className="stroke-border" strokeWidth={1} strokeDasharray={g === 0 ? '' : '3 3'} />
              <text x={4} y={y(g) + 3} className="fill-muted-foreground" fontSize={9}>{g}</text>
            </g>
          ))}
          <path d={area} className="fill-brand-500/10" />
          <path d={path} className="stroke-brand-500" strokeWidth={2} fill="none" strokeLinejoin="round" />
          {trend.map((p, i) => (
            <g key={p.id}>
              {p.kind === 'FINAL' ? (
                <rect x={x(i) - 4} y={y(p.score) - 4} width={8} height={8} className="fill-purple-500 stroke-card" strokeWidth={1.5} transform={`rotate(45 ${x(i)} ${y(p.score)})`} />
              ) : (
                <circle cx={x(i)} cy={y(p.score)} r={3.5} className="fill-brand-500 stroke-card" strokeWidth={1.5} />
              )}
              <text x={x(i)} y={H - 8} textAnchor="middle" className="fill-muted-foreground" fontSize={8}>{p.label}</text>
              <text x={x(i)} y={y(p.score) - 8} textAnchor="middle" className="fill-foreground" fontSize={9} fontWeight="bold">{p.score}</text>
            </g>
          ))}
        </svg>
      </div>
      <p className="text-[10px] text-muted-foreground">
        <span className="inline-block h-2 w-2 rounded-full bg-brand-500 align-middle" /> entraînement ·
        <span className="ml-1 inline-block h-2 w-2 rotate-45 bg-purple-500 align-middle" /> pitch final
      </p>
    </div>
  )
}

/** Average per criterion, with the best/worst spread when there is more than one video. */
export function DimensionBars({ stats }: { stats: PitchStats }) {
  if (!stats.dimensions.length) return null
  const ordered = [...stats.dimensions].sort((a, b) => a.avg - b.avg)
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <Target className="h-3.5 w-3.5 text-brand-500" />Moyenne par critère
        <span className="ml-auto text-[10px] font-normal text-muted-foreground">le plus faible en premier</span>
      </p>
      <div className="space-y-1.5">
        {ordered.map((d) => (
          <div key={d.name}>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">{d.name}</span>
              <span className={`font-bold tabular-nums ${scoreTone(d.avg)}`}>
                {d.avg}/10
                {d.n > 1 && <span className="ml-1 font-normal text-muted-foreground">({d.worst}–{d.best})</span>}
              </span>
            </div>
            <div className="relative mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              {/* range across videos, then the average on top */}
              {d.n > 1 && (
                <div className="absolute h-full rounded-full bg-foreground/10"
                  style={{ left: `${(d.worst / 10) * 100}%`, width: `${((d.best - d.worst) / 10) * 100}%` }} />
              )}
              <div className={`absolute h-full rounded-full ${scoreBg(d.avg)}`} style={{ width: `${(d.avg / 10) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const fmtDelta = (n: number) => `${n > 0 ? '+' : ''}${n}`

/** The headline row: volume, scores, progress. Shared by all three levels. */
export function StatsOverview({ stats, scope }: { stats: PitchStats; scope: 'global' | 'programme' | 'session' }) {
  const imp = stats.improvement
  const ImpIcon = imp == null || imp === 0 ? Minus : imp > 0 ? TrendingUp : TrendingDown
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      <StatTile label="Vidéos" value={stats.total}
        sub={`${stats.analyzed} analysée${stats.analyzed > 1 ? 's' : ''}`}
        icon={<Dumbbell className="h-3 w-3" />}
        hint="Toutes les vidéos déposées à ce niveau" />
      <StatTile label="Score moyen" value={stats.avgScore ?? '—'} sub={stats.avgScore != null ? '/ 10' : 'pas encore analysé'}
        tone={scoreTone(stats.avgScore)} icon={<Gauge className="h-3 w-3" />}
        hint="Moyenne sur les vidéos analysées" />
      <StatTile label="Meilleur" value={stats.bestScore ?? '—'} sub={stats.bestScore != null ? '/ 10' : '—'}
        tone={scoreTone(stats.bestScore)} icon={<Trophy className="h-3 w-3" />}
        hint="Votre meilleur score à ce niveau" />
      <StatTile label="Progression"
        value={imp == null ? '—' : fmtDelta(imp)}
        sub={imp == null ? 'il faut 2 entraînements' : 'depuis le 1er essai'}
        tone={imp == null ? undefined : imp > 0 ? 'text-emerald-600 dark:text-emerald-400' : imp < 0 ? 'text-red-600 dark:text-red-400' : undefined}
        icon={<ImpIcon className="h-3 w-3" />}
        hint="Dernier entraînement comparé au premier" />
      <StatTile label="Tics / min"
        value={stats.delivery.fillerSoundsPerMin ?? '—'}
        sub={stats.delivery.fillerSoundsPerMin != null ? '« euh », « um »' : 'non mesuré'}
        tone={stats.delivery.fillerSoundsPerMin == null ? undefined
          : stats.delivery.fillerSoundsPerMin >= 3 ? 'text-red-600 dark:text-red-400'
          : stats.delivery.fillerSoundsPerMin >= 1 ? 'text-amber-600 dark:text-amber-400'
          : 'text-emerald-600 dark:text-emerald-400'}
        icon={<AudioLines className="h-3 w-3" />}
        hint={scope === 'session' ? 'Moyenne sur cette phase' : 'Moyenne sur toutes vos vidéos analysées'} />
    </div>
  )
}

/** Measured delivery averages — only rendered when something was actually measured. */
export function DeliveryAverages({ stats }: { stats: PitchStats }) {
  const d = stats.delivery
  const has = d.wordsPerMinute != null || d.speakingRatio != null || d.hedgesPerMin != null || d.loudnessLufs != null
  if (!has) return null
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <Volume2 className="h-3.5 w-3.5 text-brand-500" />Élocution moyenne
        <span className="ml-auto text-[10px] font-normal text-muted-foreground">mesuré, jamais estimé</span>
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {d.wordsPerMinute != null && (
          <Mini label="Débit" value={`${d.wordsPerMinute}`} unit="mots/min"
            tone={d.wordsPerMinute > 170 || d.wordsPerMinute < 100 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}
            hint="130–160 mots/min est le rythme confortable" />
        )}
        {d.speakingRatio != null && (
          <Mini label="Parole effective" value={`${Math.round(d.speakingRatio * 100)}`} unit="%"
            tone={d.speakingRatio < 0.75 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}
            hint="Le reste est du silence — sous 75% le débit est haché" />
        )}
        {d.hedgesPerMin != null && (
          <Mini label="Atténuations" value={`${d.hedgesPerMin}`} unit="/min"
            tone={d.hedgesPerMin >= 3 ? 'text-red-600 dark:text-red-400' : d.hedgesPerMin >= 2 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}
            hint="« je pense », « peut-être » — affaiblit la conviction" />
        )}
        {d.loudnessLufs != null && (
          <Mini label="Volume" value={`${d.loudnessLufs}`} unit="LUFS"
            tone={d.loudnessLufs < -30 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}
            hint="Sous -30 LUFS la voix est trop faible" />
        )}
      </div>
    </div>
  )
}

function Mini({ label, value, unit, tone, hint }: { label: string; value: string; unit: string; tone: string; hint: string }) {
  return (
    <div className="rounded-lg border border-border p-2" title={hint}>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`text-base font-black tabular-nums ${tone}`}>{value}<span className="ml-0.5 text-[9px] font-normal text-muted-foreground">{unit}</span></p>
    </div>
  )
}

/** The one thing to work on next — derived from the weakest measured criterion. */
export function FocusCallout({ stats }: { stats: PitchStats }) {
  if (!stats.weakest || stats.analyzed === 0) return null
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">Priorité</p>
      <p className="text-sm text-foreground">
        Votre point le plus faible est <strong>{stats.weakest.name}</strong> ({stats.weakest.avg}/10
        {stats.weakest.n > 1 && <> sur {stats.weakest.n} vidéos</>}).
        {stats.strongest && stats.strongest.name !== stats.weakest.name && (
          <> Votre force : <strong>{stats.strongest.name}</strong> ({stats.strongest.avg}/10).</>
        )}
      </p>
    </div>
  )
}
