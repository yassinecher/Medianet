'use client'
import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowRight, Globe2, Sparkles, Target, Users, Award, Rocket, Heart, Brain, Star, Zap,
  FileText, ClipboardCheck, Lightbulb, Trophy, Search, ChevronDown, Quote,
} from 'lucide-react'
import { Particles } from '@/components/magicui/particles'
import { Globe } from '@/components/magicui/globe'
import { ShimmerButton } from '@/components/magicui/shimmer-button'
import { NumberTicker } from '@/components/magicui/number-ticker'
import { MagicCard } from '@/components/magicui/magic-card'
import { ProgrammeCard } from '@/components/programmes/ProgrammeCard'
import { HeroSlideshow, MediaContent, PhotoCarousel } from '@/components/landing/LandingMedia'
import { cn } from '@/lib/utils'
import type {
  BlockBackground, CtaData, FaqData, FeaturesData, HeroData, LandingBlock, ProcessData,
  ProgrammesData, StatsData, TestimonialsData,
} from '@/lib/landingBlocks'
import type { Programme } from '@/types'

/** Lucide icon names selectable in the editor. */
const ICONS: Record<string, React.ElementType> = {
  Target, Users, Globe2, Sparkles, Award, Rocket, Heart, Brain, Star, Zap,
  FileText, ClipboardCheck, Lightbulb, Trophy, Search,
}

/** Background used when a block doesn't set one (matches the historical page). */
const DEFAULT_BG: Partial<Record<LandingBlock['type'], BlockBackground>> = {
  stats: 'muted', process: 'muted', programmes: 'muted', faq: 'muted', cta: 'dark',
}

/**
 * "dark" adds Tailwind's `dark` class to the section, so text, cards and
 * dark: variants switch to their dark-mode colors inside it — readable even
 * when the rest of the page is in light mode.
 */
const BG_CLASS: Record<BlockBackground, string> = {
  default: '',
  muted: 'bg-muted/30',
  dark: 'dark bg-slate-950 text-foreground',
}

const has = (v?: string) => !!v && v.trim().length > 0

/** Renders one block; null when it has nothing to show (e.g. an empty list). */
export function BlockView({ block, programmes }: { block: LandingBlock; programmes: Programme[] }) {
  const d = block.data ?? {}
  const content = (() => {
    switch (block.type) {
      case 'hero': return <HeroBlock d={d} />
      case 'stats': return <StatsBlock d={d} />
      case 'features': return <FeaturesBlock d={d} />
      case 'media': return <MediaContent data={d} />
      case 'process': return <ProcessBlock d={d} />
      case 'programmes': return <ProgrammesBlock d={d} programmes={programmes} />
      case 'testimonials': return <TestimonialsBlock d={d} />
      case 'faq': return <FaqBlock d={d} />
      case 'cta': return <CtaBlock d={d} />
      default: return null
    }
  })()
  if (!content) return null
  if (block.type === 'hero') return content // full-bleed, own background
  const bg: BlockBackground = d.background ?? DEFAULT_BG[block.type] ?? 'default'
  return (
    // Vertical rhythm: compact on phones (48px), roomy from md (80px).
    <section className={cn('px-4 py-12 md:py-20', BG_CLASS[bg], block.type === 'stats' && 'border-y border-border py-10 md:py-16')}>
      {content}
    </section>
  )
}

/** Whether a block would render something (used to show an "empty" hint in the editor preview). */
export function blockHasContent(block: LandingBlock, programmes: Programme[]): boolean {
  const d = block.data ?? {}
  switch (block.type) {
    case 'hero': return has(d.title) || has(d.subtitle) || has(d.badge)
    case 'stats': case 'features': case 'process': case 'testimonials': case 'faq':
      return (d.items?.length ?? 0) > 0
    case 'media': return has(d.title) || has(d.body) || has(d.subtitle) || (d.images ?? []).some((i: any) => i?.url)
    case 'programmes': return programmes.length > 0 || (d.images?.length ?? 0) > 0
    case 'cta': return has(d.title) || has(d.buttonLabel)
    default: return false
  }
}

function Heading({ title, subtitle, className }: { title?: string; subtitle?: string; className?: string }) {
  if (!has(title) && !has(subtitle)) return null
  return (
    <div className={cn('mb-8 text-center md:mb-12', className)}>
      {has(title) && <h2 className="text-2xl font-bold text-foreground md:text-3xl">{title}</h2>}
      {has(subtitle) && <p className="mt-2 text-muted-foreground">{subtitle}</p>}
    </div>
  )
}

function HeroBlock({ d }: { d: HeroData }) {
  if (!has(d.title) && !has(d.subtitle) && !has(d.badge)) return null
  const photos = (d.images ?? []).filter(Boolean)
  return (
    // --landing-vh: set by the editor preview (its iframe is as tall as the page, so
    // 100vh would grow with it); visitors get the real viewport height.
    <section className="relative flex min-h-[calc(var(--landing-vh,100vh)_-_4rem)] flex-col items-center justify-center overflow-hidden px-4 text-center">
      <div className="absolute inset-0"><Particles quantity={90} /></div>
      <div className="mesh-gradient absolute inset-0" />
      {photos.length > 0 ? (
        <HeroSlideshow images={photos} />
      ) : (
        <div className="pointer-events-none absolute -right-40 top-1/2 hidden -translate-y-1/2 opacity-40 md:block">
          <Globe />
        </div>
      )}
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="relative z-10 max-w-4xl">
        {has(d.badge) && (
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-1.5 text-sm text-brand-600 dark:text-brand-400">
            <Sparkles className="h-3.5 w-3.5" />{d.badge}
          </div>
        )}
        {has(d.title) && (
          <h1 className="mb-5 text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl md:mb-6 md:text-7xl">{d.title}</h1>
        )}
        {has(d.subtitle) && <p className="mx-auto mb-8 max-w-2xl text-base text-muted-foreground sm:text-lg md:mb-10">{d.subtitle}</p>}
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          {has(d.primaryCtaLabel) && (
            <Link href={d.primaryCtaLink || '/register'}>
              <ShimmerButton className="px-8 py-4 text-base font-semibold">
                {d.primaryCtaLabel} <ArrowRight className="h-4 w-4" />
              </ShimmerButton>
            </Link>
          )}
          {has(d.secondaryCtaLabel) && (
            <Link href={d.secondaryCtaLink || '/programmes'}
              className="rounded-xl border border-border bg-background/80 px-8 py-4 text-base font-medium backdrop-blur transition-colors hover:bg-accent">
              {d.secondaryCtaLabel}
            </Link>
          )}
        </div>
      </motion.div>
    </section>
  )
}

function StatsBlock({ d }: { d: StatsData }) {
  const items = d.items ?? []
  if (items.length === 0) return null
  return (
    <div className="mx-auto max-w-5xl">
      <Heading title={d.title} subtitle={d.subtitle} className="mb-8 md:mb-10" />
      <div className={cn('grid grid-cols-2 gap-8', items.length >= 4 ? 'md:grid-cols-4' : items.length === 3 ? 'md:grid-cols-3' : '')}>
        {items.map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="text-center">
            <p className="text-3xl font-bold text-brand-600 dark:text-brand-400 md:text-4xl">
              <NumberTicker value={Number(s.value) || 0} suffix={s.suffix} />
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function FeaturesBlock({ d }: { d: FeaturesData }) {
  const items = d.items ?? []
  if (items.length === 0) return null
  return (
    <div className="mx-auto max-w-5xl">
      <Heading title={d.title} subtitle={d.subtitle} />
      <div className={cn('grid gap-4 sm:grid-cols-2', items.length % 3 === 0 ? 'lg:grid-cols-3' : 'lg:grid-cols-4')}>
        {items.map((f, i) => {
          const Icon = ICONS[f.icon ?? 'Sparkles'] ?? Sparkles
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
              <MagicCard className="h-full p-6">
                <div className="mb-3 flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-brand-500/10">
                  {f.imageUrl
                    ? <img src={f.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                    : <Icon className="h-5 w-5 text-brand-600 dark:text-brand-400" />}
                </div>
                <h3 className="mb-2 font-semibold text-foreground">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.description}</p>
              </MagicCard>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

function ProcessBlock({ d }: { d: ProcessData }) {
  const items = d.items ?? []
  if (items.length === 0) return null
  // Same card structure for every step so steps with and without photos line up.
  const withPhotos = items.some((s) => s.imageUrl)
  return (
    <div className="mx-auto max-w-5xl">
      <Heading title={d.title} subtitle={d.subtitle} />
      <div className={cn('relative grid gap-6 md:grid-cols-2', items.length % 3 === 0 ? 'lg:grid-cols-3' : 'lg:grid-cols-4')}>
        {!withPhotos && (
          <div className="absolute left-0 right-0 top-6 hidden h-px bg-gradient-to-r from-transparent via-brand-500/30 to-transparent lg:block" />
        )}
        {items.map((s, i) => {
          const Icon = ICONS[s.icon ?? 'FileText'] ?? FileText
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="relative text-center">
              {withPhotos && (
                <div className="mb-4 aspect-[4/3] overflow-hidden rounded-xl border border-border bg-gradient-to-br from-brand-500/15 via-brand-accent/10 to-transparent shadow-md">
                  {s.imageUrl && <img src={s.imageUrl} alt={s.title ?? ''} loading="lazy" className="h-full w-full object-cover" />}
                </div>
              )}
              <div className={cn('relative mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-brand-accent shadow-lg shadow-brand-500/30 ring-4 ring-background', withPhotos && '-mt-10')}>
                <Icon className="h-5 w-5 text-white" />
              </div>
              <h3 className="mb-2 font-semibold text-foreground">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.description}</p>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

function ProgrammesBlock({ d, programmes }: { d: ProgrammesData; programmes: Programme[] }) {
  const shown = programmes.slice(0, d.limit ?? 6)
  const images = (d.images ?? []).filter(Boolean)
  if (shown.length === 0 && images.length === 0) return null
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex items-center justify-between gap-4 md:mb-10">
        <div>
          {has(d.title) && <h2 className="text-2xl font-bold text-foreground md:text-3xl">{d.title}</h2>}
          {has(d.subtitle) && <p className="text-muted-foreground">{d.subtitle}</p>}
        </div>
        <Link href="/programmes" className="flex shrink-0 items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
          Voir tout <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      {images.length > 0 && (
        <PhotoCarousel className="mb-8" aspect="aspect-[16/9] md:aspect-[21/8]" images={images.map((url) => ({ url }))} />
      )}
      {shown.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((p) => <ProgrammeCard key={p.id} programme={p} />)}
        </div>
      )}
    </div>
  )
}

function TestimonialsBlock({ d }: { d: TestimonialsData }) {
  const items = d.items ?? []
  if (items.length === 0) return null
  return (
    <div className="mx-auto max-w-5xl">
      <Heading title={d.title} subtitle={d.subtitle} />
      <div className={cn('grid gap-4', items.length === 1 ? 'mx-auto max-w-xl' : items.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3')}>
        {items.map((t, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
            <MagicCard className="flex h-full flex-col p-6">
              <Quote className="mb-3 h-6 w-6 text-brand-500/60" />
              <p className="flex-1 text-sm italic leading-relaxed text-foreground">« {t.quote} »</p>
              <div className="mt-4 flex items-center gap-3 border-t border-border pt-4">
                {t.photoUrl ? (
                  <img src={t.photoUrl} alt={t.authorName ?? ''} loading="lazy" className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-brand-accent text-xs font-bold text-white">
                    {(t.authorName ?? '?').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{t.authorName}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{t.authorRole}</p>
                </div>
              </div>
            </MagicCard>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function FaqBlock({ d }: { d: FaqData }) {
  const items = d.items ?? []
  if (items.length === 0) return null
  return (
    <div className="mx-auto max-w-3xl">
      <Heading title={d.title} subtitle={d.subtitle} className="mb-8 md:mb-10" />
      <div className="space-y-2">
        {items.map((f, i) => <FaqItem key={i} q={f.question ?? ''} a={f.answer ?? ''} />)}
      </div>
    </div>
  )
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-accent/30">
        <span className="text-sm font-semibold text-foreground">{q}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      <motion.div initial={false} animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }} className="overflow-hidden">
        <p className="whitespace-pre-line px-5 pb-4 text-sm leading-relaxed text-muted-foreground">{a}</p>
      </motion.div>
    </div>
  )
}

function CtaBlock({ d }: { d: CtaData }) {
  if (!has(d.title) && !has(d.buttonLabel)) return null
  return (
    <div className="mx-auto max-w-2xl text-center">
      {has(d.title) && <h2 className="text-2xl font-bold text-foreground md:text-3xl">{d.title}</h2>}
      {has(d.subtitle) && <p className="mt-3 text-muted-foreground">{d.subtitle}</p>}
      {has(d.buttonLabel) && (
        <div className="mt-6 flex justify-center gap-4 md:mt-8">
          <Link href={d.buttonLink || '/register'}>
            <ShimmerButton className="px-8 py-4 font-semibold">{d.buttonLabel}</ShimmerButton>
          </Link>
        </div>
      )}
    </div>
  )
}
