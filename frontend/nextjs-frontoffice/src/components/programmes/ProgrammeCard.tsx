import Link from 'next/link'
import { Calendar, Users, ArrowRight, Trophy, MapPin, Timer } from 'lucide-react'
import { MagicCard } from '@/components/magicui/magic-card'
import { cn, formatDate, statusColor } from '@/lib/utils'
import type { Programme } from '@/types'

const statusLabel: Record<string, string> = {
  DRAFT: 'Brouillon', OPEN: 'Ouvert', CLOSED: 'Fermé', ARCHIVED: 'Archivé',
  IN_PROGRESS: 'En cours', EVALUATION: 'Évaluation', CANCELLED: 'Annulé',
}

/** Days until the candidature deadline (synced with the Candidature session). */
function daysLeft(programme: Programme): number | null {
  const raw = (programme as any).candidatureDeadline ?? programme.applicationDeadline
  if (!raw) return null
  const d = new Date(raw + 'T23:59:59')
  if (isNaN(d.getTime())) return null
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000)
}

export function ProgrammeCard({ programme }: { programme: Programme }) {
  const title = programme.title ?? programme.name ?? ''
  const accepting = (programme as any).acceptingApplications
  const left = daysLeft(programme)
  // Countdown chip: urgent (≤7j) = amber pulse, open = emerald, closed = muted.
  const countdown = accepting && left != null && left >= 0
    ? { label: left === 0 ? 'Dernier jour !' : `Clôture dans ${left} j`, urgent: left <= 7 }
    : accepting === false && left != null
      ? { label: 'Candidatures fermées', urgent: false }
      : null

  return (
    <Link href={`/programmes/${programme.id}`} className="group block h-full">
      <MagicCard className="h-full overflow-hidden transition-shadow group-hover:shadow-lg">
        {/* Banner */}
        {programme.bannerImageUrl ? (
          <div className="relative h-36 overflow-hidden">
            <img src={programme.bannerImageUrl} alt={title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            {programme.logoUrl && (
              <div className="absolute bottom-3 left-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/90 shadow p-1">
                <img src={programme.logoUrl} alt="" className="max-h-full max-w-full object-contain" />
              </div>
            )}
            <span className={cn('absolute right-3 top-3 rounded-full px-2 py-0.5 text-xs font-semibold', statusColor(programme.status))}>
              {statusLabel[programme.status]}
            </span>
          </div>
        ) : (
          <div className="relative h-20 bg-gradient-to-br from-brand-600 to-purple-600 dark:from-brand-800 dark:to-purple-900">
            <div className="absolute inset-0 opacity-10"
              style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '20px 20px' }} />
            {programme.logoUrl && (
              <div className="absolute bottom-2 left-4 flex h-9 w-9 items-center justify-center rounded-lg bg-white/90 p-1">
                <img src={programme.logoUrl} alt="" className="max-h-full max-w-full object-contain" />
              </div>
            )}
            <span className={cn('absolute right-3 top-3 rounded-full px-2 py-0.5 text-xs font-semibold', statusColor(programme.status))}>
              {statusLabel[programme.status]}
            </span>
          </div>
        )}

        <div className="flex flex-col gap-3 p-5">
          {/* Title + tagline */}
          <div>
            <h3 className="font-bold text-foreground text-base leading-tight group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
              {title}
            </h3>
            {programme.tagline && (
              <p className="mt-0.5 text-xs text-brand-600 dark:text-brand-400 font-medium">{programme.tagline}</p>
            )}
          </div>

          {/* Description */}
          {programme.description && (
            <p className="line-clamp-2 text-sm text-muted-foreground leading-relaxed">{programme.description}</p>
          )}

          {/* Sectors */}
          {programme.sectors && programme.sectors.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {programme.sectors.slice(0, 3).map((s) => (
                <span key={s} className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-medium text-brand-700 dark:text-brand-300">
                  {s}
                </span>
              ))}
              {programme.sectors.length > 3 && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                  +{programme.sectors.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Candidature countdown — deadline is auto-synced with the session */}
          {countdown && (
            <span className={cn(
              'inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold border',
              countdown.label === 'Candidatures fermées'
                ? 'bg-muted text-muted-foreground border-border'
                : countdown.urgent
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-400/50 animate-pulse'
                  : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-400/40',
            )}>
              <Timer className="h-3 w-3" />{countdown.label}
            </span>
          )}

          {/* Meta */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {(programme.location ?? programme.region) && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />{programme.location ?? programme.region}
              </span>
            )}
            {programme.applicationDeadline && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />Clôture {formatDate(programme.applicationDeadline)}
              </span>
            )}
            {programme.maxStartups && (
              <span className="flex items-center gap-1">
                <Trophy className="h-3 w-3 text-amber-500" />{programme.maxStartups} lauréats
              </span>
            )}
            {!programme.maxStartups && (programme.maxApplications ?? programme.maxParticipants) && (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />{programme.maxApplications ?? programme.maxParticipants} places
              </span>
            )}
          </div>

          {/* CTA */}
          <div className="mt-auto border-t border-border pt-3">
            <span className="flex items-center gap-1 text-xs font-semibold text-brand-600 dark:text-brand-400 group-hover:gap-2 transition-all">
              Voir le programme <ArrowRight className="h-3 w-3" />
            </span>
          </div>
        </div>
      </MagicCard>
    </Link>
  )
}
