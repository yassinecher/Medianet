'use client'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowDown, ArrowLeft, Calendar, CheckCircle2, Clock, ExternalLink, MapPin, Sparkles, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDate, cn } from '@/lib/utils'
import type { ProgrammeHeroSettings } from '@/lib/programmePage'
import type { ApplyState } from './ProgrammeSections'
import type { Programme } from '@/types'

const STATUS: Record<string, { label: string; dot: string }> = {
  OPEN: { label: 'Candidatures ouvertes', dot: 'bg-emerald-400' },
  IN_PROGRESS: { label: 'En cours', dot: 'bg-sky-400' },
  EVALUATION: { label: 'Évaluation', dot: 'bg-amber-400' },
  CLOSED: { label: 'Terminé', dot: 'bg-slate-300' },
  DRAFT: { label: 'Brouillon', dot: 'bg-slate-300' },
  ARCHIVED: { label: 'Archivé', dot: 'bg-slate-300' },
  CANCELLED: { label: 'Annulé', dot: 'bg-rose-400' },
}
const APPLIED_LABEL: Record<string, string> = {
  PENDING: 'Candidature soumise', UNDER_EVALUATION: 'En évaluation',
  ACCEPTED: 'Candidature acceptée', REJECTED: 'Candidature refusée',
}

/**
 * Full-bleed programme hero: banner photo (or brand gradient), status chips,
 * logo + title + tagline, call-to-action buttons and a key-facts strip.
 * Text is always white on a darkened background, so any photo stays readable.
 */
export function ProgrammeHero({ programme, settings, apply, journeyAnchor }: {
  programme: Programme
  settings: ProgrammeHeroSettings
  apply: ApplyState
  /** Anchor of the journey section when it is on the page (secondary button). */
  journeyAnchor?: string
}) {
  const photo = settings.style !== 'gradient' ? programme.bannerImageUrl : undefined
  const status = STATUS[programme.status]
  const deadline = programme.candidatureDeadline ?? programme.applicationDeadline
  const days = apply.deadlineDays
  const ctaLabel = settings.ctaLabel?.trim() || 'Rejoindre le programme'
  const secondary = settings.secondaryLabel?.trim()

  const facts = [
    (programme.startDate || programme.endDate) && {
      icon: Calendar, label: 'Dates',
      value: [programme.startDate && formatDate(programme.startDate), programme.endDate && formatDate(programme.endDate)].filter(Boolean).join(' → '),
    },
    (programme.location ?? programme.region) && { icon: MapPin, label: 'Lieu', value: programme.location ?? programme.region },
    apply.show && deadline && {
      icon: Clock, label: 'Candidatures',
      value: `Jusqu’au ${formatDate(deadline)}`,
      extra: days != null && days >= 0 ? (days > 0 ? `J-${days}` : 'Dernier jour') : undefined,
    },
    programme.maxStartups && { icon: Trophy, label: 'Places', value: `${programme.maxStartups} startups sélectionnées` },
  ].filter(Boolean) as { icon: React.ElementType; label: string; value: string; extra?: string }[]

  return (
    <section className={cn('relative isolate flex flex-col overflow-hidden text-white',
      settings.height === 'compact' ? 'min-h-[440px]' : 'min-h-[560px] md:min-h-[660px]')}>
      {/* Background */}
      {photo ? (
        <>
          <img src={photo} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-slate-950 via-slate-950/65 to-slate-950/25" />
        </>
      ) : (
        <>
          <div className="absolute inset-0 -z-20"
            style={{ background: 'var(--banner-bg, linear-gradient(120deg, #0a6f8f 0%, #0a8fb1 40%, #14c8f3 75%, #fbb431 115%))' }} />
          <div className="absolute inset-0 -z-10 opacity-[0.15]"
            style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '30px 30px' }} />
          <div className="absolute -right-24 -top-24 -z-10 h-96 w-96 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-slate-950/70 via-slate-950/20 to-transparent" />
        </>
      )}

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-8 pt-6 sm:px-6 md:pb-10">
        <Link href="/programmes" className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/90 backdrop-blur-sm transition hover:bg-white/20">
          <ArrowLeft className="h-3.5 w-3.5" />Tous les programmes
        </Link>

        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mt-auto pt-16">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {status && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
                <span className={cn('h-2 w-2 rounded-full', status.dot)} />{status.label}
              </span>
            )}
            {programme.type && (
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                {programme.type === 'PRIVATE' ? 'Sur invitation' : 'Programme public'}
              </span>
            )}
            {apply.show && days != null && days >= 0 && (
              <span className={cn('inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold backdrop-blur-sm',
                days <= 7 ? 'bg-rose-500/80' : 'bg-white/15')}>
                <Clock className="h-3.5 w-3.5" />{days > 0 ? `Clôture dans ${days} jour${days > 1 ? 's' : ''}` : 'Dernier jour !'}
              </span>
            )}
          </div>

          <div className="flex items-end gap-4 sm:gap-6">
            {programme.logoUrl && (
              <div className="hidden h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white p-2 shadow-xl sm:flex md:h-24 md:w-24">
                <img src={programme.logoUrl} alt="" className="max-h-full max-w-full object-contain" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-3xl font-black leading-[1.08] tracking-tight drop-shadow-sm sm:text-5xl md:text-6xl">
                {programme.title ?? programme.name}
              </h1>
              {programme.tagline && (
                <p className="mt-3 max-w-2xl text-base font-medium text-white/85 sm:text-lg md:text-xl">{programme.tagline}</p>
              )}
            </div>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            {apply.applied ? (
              <Link href="/candidatures" className="inline-flex items-center gap-1.5 rounded-xl bg-white/20 px-5 py-3 text-sm font-bold backdrop-blur-sm">
                <CheckCircle2 className="h-4 w-4" />{APPLIED_LABEL[apply.applied] ?? 'Déjà candidaté'}
              </Link>
            ) : apply.show && (
              <Button size="lg" onClick={apply.onApply} className="gap-2 bg-white font-bold text-brand-700 shadow-xl hover:bg-white/90">
                {apply.external ? <ExternalLink className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}{ctaLabel}
              </Button>
            )}
            {secondary && journeyAnchor && (
              <a href={`#${journeyAnchor}`}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/30 px-5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/10">
                {secondary}<ArrowDown className="h-4 w-4" />
              </a>
            )}
          </div>

          {settings.showFacts !== false && facts.length > 0 && (
            <div className={cn('mt-8 grid gap-px overflow-hidden rounded-2xl border border-white/15 bg-white/15 backdrop-blur-md',
              facts.length === 1 ? 'grid-cols-1' : facts.length === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4')}>
              {facts.map((f) => (
                <div key={f.label} className="flex items-start gap-3 bg-slate-950/30 px-4 py-3.5">
                  <f.icon className="mt-0.5 h-4 w-4 shrink-0 text-white/70" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-white/60">{f.label}</p>
                    <p className="text-sm font-semibold leading-snug">
                      {f.value}{f.extra && <span className="ml-2 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold">{f.extra}</span>}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </section>
  )
}
