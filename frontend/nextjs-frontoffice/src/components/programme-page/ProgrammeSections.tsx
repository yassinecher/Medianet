'use client'
import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowRight, Award, BookOpen, Brain, Calendar, CheckCircle2, ChevronDown, ClipboardCheck, Clock, ExternalLink,
  FileText, Globe2, GraduationCap, Heart, Images, Lightbulb, MapPin, PlayCircle, Quote, Rocket, Search, Sparkles,
  Star, Target, Trophy, Users, Zap,
} from 'lucide-react'
import { NumberTicker } from '@/components/magicui/number-ticker'
import { PhotoCarousel, PhotoGallery as LandingGallery } from '@/components/landing/LandingMedia'
import { PhotoGallery as PhotoStrip } from '@/components/media/PhotoGallery'
import { LogoImage } from '@/components/media/LogoImage'
import { Button } from '@/components/ui/button'
import { formatDate, cn } from '@/lib/utils'
import {
  DEFAULT_APPLY_SUBTITLE, safeHref, videoEmbedUrl,
  type ProgrammeBlock, type SectionBackground,
} from '@/lib/programmePage'
import type { Criteria, Partner, Phase, Programme } from '@/types'

/**
 * The one layout grid of the programme page: hero, section menu and every
 * section share it, so all content starts on the same left edge. Headings are
 * always left-aligned; narrower text columns (description, FAQ) keep that edge.
 */
export const CONTAINER = 'mx-auto w-full max-w-6xl px-4 sm:px-6'

export interface ApplyState {
  /** Candidatures open AND the visitor may apply (porteur or anonymous). */
  show: boolean
  /** The porteur's own candidature status on this programme, if any. */
  applied: string | null
  external: boolean
  deadlineDays: number | null
  loggedIn: boolean
  onApply: () => void
}

export interface PageCtx {
  programme: Programme
  phases: Phase[]
  /** Active criteria only. */
  criteria: Criteria[]
  partners: Partner[]
  apply: ApplyState
  /** Back-office live preview: empty blocks show a hint instead of vanishing. */
  preview: boolean
}

export type ResolvedBackground = Exclude<SectionBackground, 'auto'>

const BG: Record<ResolvedBackground, string> = {
  default: 'bg-background',
  muted: 'bg-muted/40',
  // `dark` switches every dark: variant inside the section, whatever the site mode.
  dark: 'dark bg-slate-950 text-foreground',
}

const SESSION_TYPE_LABEL: Record<string, string> = {
  CANDIDATURE_SUBMISSION: 'Candidature', PRESELECTION: 'Présélection', PITCH_DAY: 'Pitch Day',
  ONBOARDING: 'Onboarding', INCUBATION: 'Incubation', DEMO_DAY: 'Demo Day', TRAINING_DAY: 'Formation',
}
const SESSION_STATUS_LABEL: Record<string, string> = { UPCOMING: 'À venir', ACTIVE: 'En cours', COMPLETED: 'Terminée' }

/** Icons selectable on « Points forts » cards (same names as the landing editor). */
const ICONS: Record<string, React.ElementType> = {
  Target, Users, Globe2, Sparkles, Award, Rocket, Heart, Brain, Star, Zap,
  FileText, ClipboardCheck, Lightbulb, Trophy, Search,
}

const has = (v?: string | null) => !!v && v.trim().length > 0
const fadeUp = { initial: { opacity: 0, y: 18 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '-60px' } }
type Img = { url?: string; caption?: string }
const imagesOf = (d: any): Img[] => ((d.images ?? []) as Img[]).filter((i) => i?.url)

// ── Data derived from the programme ─────────────────────────────────────────

function highlightItems(p: Programme, d: any) {
  return [
    { icon: Trophy, value: p.maxStartups, label: 'Startups sélectionnées', suffix: '' },
    { icon: GraduationCap, value: p.expertCount, label: 'Experts & mentors', suffix: '' },
    { icon: BookOpen, value: p.trainingSessionsCount, label: 'Sessions de formation', suffix: '' },
    { icon: Clock, value: p.mentoringHoursPerMonth, label: 'Heures de mentorat / mois', suffix: '' },
    ...((d.extra ?? []) as any[]).map((x) => ({ icon: Sparkles, value: Number(x?.value), label: x?.label ?? '', suffix: x?.suffix ?? '' })),
  ].filter((i) => Number(i.value) > 0)
}

function galleryUrls(ctx: PageCtx, d: any): string[] {
  const own = ctx.programme.galleryUrls ?? []
  const sessions = d.includeSessions ? ctx.phases.flatMap((ph) => ph.galleryUrls ?? []) : []
  return Array.from(new Set([...own, ...sessions].filter(Boolean)))
}

/** Whether a block has something to show (empty ones are skipped for visitors). */
export function programmeBlockHasContent(b: ProgrammeBlock, ctx: PageCtx): boolean {
  const d = b.data ?? {}
  const p = ctx.programme
  switch (b.type) {
    case 'about': return has(p.description) || imagesOf(d).length > 0
    case 'highlights': return highlightItems(p, d).length > 0
    case 'audience': return (p.sectors?.length ?? 0) > 0 || has(d.text)
    case 'objectives': return (p.objectives?.length ?? 0) > 0
    case 'journey': return ctx.phases.length > 0
    case 'benefits': return (p.benefits?.length ?? 0) > 0
    case 'gallery': return galleryUrls(ctx, d).length > 0
    case 'criteria': return ctx.criteria.length > 0
    case 'partners': return ctx.partners.length > 0
    case 'apply': return (ctx.apply.show && !ctx.apply.applied) || ctx.preview
    case 'video': return !!videoEmbedUrl(d.url)
    case 'media': return has(d.title) || has(d.subtitle) || has(d.body) || imagesOf(d).length > 0
    case 'features': case 'testimonials': case 'faq': return (d.items?.length ?? 0) > 0
    case 'cta': return has(d.title) || has(d.buttonLabel)
    default: return false
  }
}

// ── Building blocks ─────────────────────────────────────────────────────────

function Shell({ id, bg, children, className }: { id: string; bg: ResolvedBackground; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={cn('scroll-mt-32 py-14 md:py-20', BG[bg], className)}>
      <div className={CONTAINER}>{children}</div>
    </section>
  )
}

/** Section heading — always left-aligned on the page grid. */
function Heading({ d, eyebrow, className }: { d: any; eyebrow?: string; className?: string }) {
  const kicker = eyebrow ?? d.eyebrow
  if (!has(d.title) && !has(d.subtitle)) return null
  return (
    <motion.div {...fadeUp} className={cn('mb-8 max-w-3xl md:mb-12', className)}>
      {has(kicker) && (
        <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-brand-600 dark:text-brand-400">
          <span className="h-px w-6 bg-current opacity-60" />{kicker}
        </p>
      )}
      {has(d.title) && <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">{d.title}</h2>}
      {has(d.subtitle) && <p className="mt-3 text-base leading-relaxed text-muted-foreground md:text-lg">{d.subtitle}</p>}
    </motion.div>
  )
}

/** Text next to one photo (or a small carousel); `left` puts the photos first. */
function TextWithMedia({ text, images, left, alt }: { text: React.ReactNode; images: Img[]; left?: boolean; alt?: string }) {
  return (
    <div className="grid items-center gap-10 md:grid-cols-2 lg:gap-14">
      <motion.div {...fadeUp} className={left ? 'md:order-2' : ''}>{text}</motion.div>
      <motion.div {...fadeUp} className={left ? 'md:order-1' : ''}>
        {images.length > 1 ? (
          <PhotoCarousel images={images} aspect="aspect-[4/3]" />
        ) : (
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-border shadow-2xl shadow-brand-500/10">
            <img src={images[0].url} alt={images[0].caption ?? alt ?? ''} loading="lazy" className="h-full w-full object-cover" />
          </div>
        )}
      </motion.div>
    </div>
  )
}

/** Renders one block, or null when it has nothing to show. */
export function ProgrammeBlockView({ block, ctx, bg, anchor }: {
  block: ProgrammeBlock; ctx: PageCtx; bg: ResolvedBackground; anchor: string
}) {
  const d = block.data ?? {}
  const p = ctx.programme
  const body = (() => {
    switch (block.type) {
      case 'about': return <About d={d} p={p} />
      case 'highlights': return <Highlights d={d} p={p} />
      case 'audience': return <Audience d={d} p={p} />
      case 'objectives': return <Objectives d={d} items={p.objectives ?? []} />
      case 'journey': return <Journey d={d} phases={ctx.phases} />
      case 'benefits': return <Benefits d={d} items={p.benefits ?? []} />
      case 'gallery': return <Gallery d={d} urls={galleryUrls(ctx, d)} />
      case 'criteria': return <CriteriaList d={d} criteria={ctx.criteria} />
      case 'partners': return <Partners d={d} partners={ctx.partners} />
      case 'apply': return <Apply d={d} ctx={ctx} />
      case 'video': return <Video d={d} />
      case 'media': return <Media d={d} />
      case 'features': return <Features d={d} />
      case 'testimonials': return <Testimonials d={d} />
      case 'faq': return <Faq d={d} />
      case 'cta': return <Cta d={d} />
      default: return null
    }
  })()
  if (!body) return null
  const compact = block.type === 'apply' || block.type === 'cta'
  return <Shell id={anchor} bg={bg} className={compact ? 'py-10 md:py-14' : undefined}>{body}</Shell>
}

// ── Programme sections ──────────────────────────────────────────────────────

function About({ d, p }: { d: any; p: Programme }) {
  const paragraphs = (p.description ?? '').split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean)
  const images = imagesOf(d)
  const text = (
    <>
      <Heading d={d} className={images.length ? 'md:mb-8' : undefined} />
      <div className="max-w-3xl space-y-4 text-base leading-relaxed text-muted-foreground md:text-[17px]">
        {paragraphs.map((t, i) => (
          <p key={i} className={cn('whitespace-pre-line', i === 0 && 'text-lg leading-relaxed text-foreground/90 md:text-xl')}>{t}</p>
        ))}
      </div>
    </>
  )
  return images.length === 0 ? text : <TextWithMedia text={text} images={images} left={d.imagePosition === 'left'} alt={p.title} />
}

function Highlights({ d, p }: { d: any; p: Programme }) {
  const items = highlightItems(p, d)
  return (
    <>
      <Heading d={d} />
      <div className={cn('grid grid-cols-2 gap-3 sm:gap-4', items.length >= 4 ? 'lg:grid-cols-4' : items.length === 3 ? 'lg:grid-cols-3' : '')}>
        {items.map((s, i) => (
          <motion.div key={i} {...fadeUp} transition={{ delay: i * 0.06 }}
            className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-brand-500/10 blur-2xl" />
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-accent text-white shadow-md shadow-brand-500/20">
              <s.icon className="h-5 w-5" />
            </span>
            <p className="mt-4 text-3xl font-black tracking-tight text-foreground tabular-nums sm:text-4xl">
              <NumberTicker value={Number(s.value)} />{s.suffix}
            </p>
            <p className="mt-1 text-sm leading-snug text-muted-foreground">{s.label}</p>
          </motion.div>
        ))}
      </div>
    </>
  )
}

function Audience({ d, p }: { d: any; p: Programme }) {
  const sectors = p.sectors ?? []
  return (
    <>
      <Heading d={d} />
      {has(d.text) && <p className="-mt-4 mb-8 max-w-3xl whitespace-pre-line text-base leading-relaxed text-muted-foreground md:text-lg">{d.text}</p>}
      {sectors.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sectors.map((s, i) => (
            <motion.div key={s} {...fadeUp} transition={{ delay: i * 0.04 }}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-brand-400/60">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
                <Lightbulb className="h-5 w-5" />
              </span>
              <span className="font-semibold leading-tight text-foreground">{s}</span>
            </motion.div>
          ))}
        </div>
      )}
    </>
  )
}

function Objectives({ d, items }: { d: any; items: string[] }) {
  if (d.layout === 'list') {
    return (
      <>
        <Heading d={d} />
        <ul className="grid gap-3 md:grid-cols-2">
          {items.map((o, i) => (
            <motion.li key={i} {...fadeUp} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
              <Target className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" />
              <span className="leading-relaxed text-foreground">{o}</span>
            </motion.li>
          ))}
        </ul>
      </>
    )
  }
  return (
    <>
      <Heading d={d} />
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((o, i) => (
          <motion.div key={i} {...fadeUp} transition={{ delay: i * 0.05 }}
            className="group flex gap-5 rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
            <span className="bg-gradient-to-br from-brand-500 to-brand-accent bg-clip-text text-3xl font-black leading-none text-transparent tabular-nums">
              {String(i + 1).padStart(2, '0')}
            </span>
            <p className="leading-relaxed text-foreground">{o}</p>
          </motion.div>
        ))}
      </div>
    </>
  )
}

function Journey({ d, phases }: { d: any; phases: Phase[] }) {
  return (
    <>
      <Heading d={d} />
      <ol className="relative">
        {phases.map((ph, i) => {
          const status = ph.status ?? (ph.isActive ? 'ACTIVE' : 'UPCOMING')
          const done = status === 'COMPLETED'
          const active = status === 'ACTIVE'
          const last = i === phases.length - 1
          return (
            <motion.li key={ph.id} {...fadeUp} className="relative flex gap-4 pb-5 last:pb-0 sm:gap-6">
              <div className="relative flex flex-col items-center">
                <span className={cn('relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ring-4 ring-background',
                  done ? 'bg-emerald-500 text-white' : active ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/30' : 'border-2 border-brand-300 bg-background text-brand-600 dark:border-brand-700 dark:text-brand-400')}>
                  {active && <span className="absolute inset-0 animate-ping rounded-full bg-brand-500/30" />}
                  {done ? <CheckCircle2 className="h-5 w-5" /> : <span className="relative">{i + 1}</span>}
                </span>
                {!last && <span className={cn('-mb-5 mt-1 w-0.5 flex-1 rounded-full', done || active ? 'bg-gradient-to-b from-brand-400 to-border' : 'bg-border')} />}
              </div>
              <div className={cn('flex-1 rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md',
                active ? 'border-brand-400/60 ring-1 ring-brand-500/20' : 'border-border')}>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold text-foreground sm:text-lg">{ph.title ?? ph.name}</h3>
                  {ph.sessionType && SESSION_TYPE_LABEL[ph.sessionType] && (
                    <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:text-brand-300">
                      {SESSION_TYPE_LABEL[ph.sessionType]}
                    </span>
                  )}
                  {status !== 'UPCOMING' && (
                    <span className={cn('ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold',
                      active ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400')}>
                      {active && <span className="h-1.5 w-1.5 rounded-full bg-current" />}{SESSION_STATUS_LABEL[status] ?? status}
                    </span>
                  )}
                </div>
                {ph.description && <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{ph.description}</p>}
                {(ph.startDate || ph.endDate || ph.location) && (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {(ph.startDate || ph.endDate) && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted/70 px-2 py-1">
                        <Calendar className="h-3.5 w-3.5 text-brand-500" />
                        {ph.startDate ? formatDate(ph.startDate) : ''}{ph.startDate && ph.endDate && ' → '}{ph.endDate ? formatDate(ph.endDate) : ''}
                      </span>
                    )}
                    {ph.location && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted/70 px-2 py-1">
                        <MapPin className="h-3.5 w-3.5 text-brand-500" />{ph.location}
                      </span>
                    )}
                  </div>
                )}
                {d.showPhotos !== false && (ph.galleryUrls?.length ?? 0) > 0 && (
                  <div className="mt-4 border-t border-border/60 pt-3">
                    <p className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                      <Images className="h-3 w-3 text-brand-500" />Photos de la session
                    </p>
                    <PhotoStrip images={ph.galleryUrls} variant="strip" />
                  </div>
                )}
              </div>
            </motion.li>
          )
        })}
      </ol>
    </>
  )
}

function Benefits({ d, items }: { d: any; items: string[] }) {
  return (
    <>
      <Heading d={d} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((b, i) => (
          <motion.div key={i} {...fadeUp} transition={{ delay: i * 0.04 }}
            className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <span className="pt-1.5 text-sm leading-relaxed text-foreground">{b}</span>
          </motion.div>
        ))}
      </div>
    </>
  )
}

function Gallery({ d, urls }: { d: any; urls: string[] }) {
  const images = urls.map((url) => ({ url }))
  return (
    <>
      <Heading d={d} />
      {d.layout === 'carousel'
        ? <PhotoCarousel images={images} aspect="aspect-[16/9] md:aspect-[21/9]" />
        : <LandingGallery images={images} mosaic />}
    </>
  )
}

function CriteriaList({ d, criteria }: { d: any; criteria: Criteria[] }) {
  const sorted = [...criteria].sort((a, b) => a.criterionOrder - b.criterionOrder)
  return (
    <>
      <Heading d={d} />
      <div className="grid gap-4 md:grid-cols-2">
        {sorted.map((c, i) => {
          const pct = Math.round((c.weight ?? 0) * 100)
          return (
            <motion.div key={c.id} {...fadeUp} transition={{ delay: i * 0.04 }} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold text-foreground">{c.name}</h3>
                <span className="shrink-0 rounded-full bg-brand-500/10 px-2.5 py-0.5 text-sm font-bold text-brand-700 tabular-nums dark:text-brand-300">{pct}%</span>
              </div>
              {c.description && <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{c.description}</p>}
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
                <motion.div initial={{ width: 0 }} whileInView={{ width: `${pct}%` }} viewport={{ once: true }} transition={{ duration: 0.8 }}
                  className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-accent" />
              </div>
            </motion.div>
          )
        })}
      </div>
    </>
  )
}

function Partners({ d, partners }: { d: any; partners: Partner[] }) {
  return (
    <>
      <Heading d={d} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
        {partners.map((pt, i) => (
          <motion.div key={pt.id} {...fadeUp} transition={{ delay: i * 0.04 }} title={pt.name} className="group flex flex-col gap-2">
            <div className="flex h-20 items-center justify-center rounded-2xl border border-border bg-white p-4 shadow-sm transition-all group-hover:-translate-y-0.5 group-hover:shadow-md sm:h-24">
              <LogoImage src={pt.logoUrl} alt={pt.name} iconClassName="h-7 w-7"
                className="max-h-full max-w-full object-contain opacity-80 grayscale transition group-hover:opacity-100 group-hover:grayscale-0" />
            </div>
            <span className="line-clamp-1 text-xs font-medium text-muted-foreground">{pt.name}</span>
          </motion.div>
        ))}
      </div>
    </>
  )
}

function Apply({ d, ctx }: { d: any; ctx: PageCtx }) {
  const { apply, programme } = ctx
  const open = apply.show && !apply.applied
  if (!open) {
    return ctx.preview ? (
      <div className="flex items-center justify-center gap-2 rounded-3xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        <Users className="h-4 w-4" />Bandeau « Candidater » : visible quand les candidatures sont ouvertes.
      </div>
    ) : null
  }
  const subtitle = (has(d.subtitle) ? d.subtitle : DEFAULT_APPLY_SUBTITLE).split('{programme}').join(programme.title ?? programme.name ?? '')
  return (
    <motion.div {...fadeUp}
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-600 to-brand-accent px-6 py-12 text-center text-white shadow-2xl shadow-brand-500/20 sm:px-12">
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '28px 28px' }} />
      <div className="absolute -left-16 -top-16 h-56 w-56 rounded-full bg-white/20 blur-3xl" />
      <div className="relative mx-auto max-w-2xl">
        {has(d.title) && <h2 className="text-2xl font-black tracking-tight sm:text-4xl">{d.title}</h2>}
        {has(subtitle) && <p className="mt-3 text-sm text-white/90 sm:text-base">{subtitle}</p>}
        {apply.deadlineDays != null && apply.deadlineDays >= 0 && (
          <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur-sm">
            <Clock className="h-3.5 w-3.5" />
            {apply.deadlineDays > 0 ? `Clôture dans ${apply.deadlineDays} jour${apply.deadlineDays > 1 ? 's' : ''}` : 'Dernier jour !'}
          </p>
        )}
        <div className="mt-7 flex justify-center">
          <Button size="lg" onClick={apply.onApply} className="gap-2 bg-white font-bold text-brand-700 shadow-lg hover:bg-white/90">
            {apply.external ? <ExternalLink className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            {has(d.buttonLabel) ? d.buttonLabel : 'Rejoindre le programme'}
          </Button>
        </div>
        {!apply.loggedIn && <p className="mt-3 text-xs text-white/80">Un compte porteur de projet est nécessaire pour postuler.</p>}
      </div>
    </motion.div>
  )
}

function Video({ d }: { d: any }) {
  const src = videoEmbedUrl(d.url)
  if (!src) return null
  return (
    <>
      <Heading d={d} />
      <motion.div {...fadeUp} className="overflow-hidden rounded-3xl border border-border bg-black shadow-2xl shadow-brand-500/10">
        <div className="relative aspect-video">
          <iframe src={src} title={d.title || 'Vidéo du programme'} loading="lazy"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 h-full w-full border-0" />
        </div>
      </motion.div>
      {has(d.caption) && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
          <PlayCircle className="h-4 w-4 text-brand-500" />{d.caption}
        </p>
      )}
    </>
  )
}

// ── Free sections (same data as the home-page blocks, drawn on this grid) ───

function CtaLink({ label, href, fallback }: { label?: string; href?: string; fallback: string }) {
  if (!has(label)) return null
  return (
    <Link href={safeHref(href, fallback)}
      className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-brand-contrast shadow-lg shadow-brand-500/25 transition hover:bg-brand-600">
      {label}<ArrowRight className="h-4 w-4" />
    </Link>
  )
}

function Media({ d }: { d: any }) {
  const images = imagesOf(d)
  const bodyText = has(d.body) && <p className="max-w-3xl whitespace-pre-line text-base leading-relaxed text-muted-foreground md:text-[17px]">{d.body}</p>
  const cta = <CtaLink label={d.ctaLabel} href={d.ctaLink} fallback="/programmes" />
  if (d.layout === 'gallery' || d.layout === 'carousel') {
    return (
      <>
        <Heading d={d} eyebrow={d.badge} />
        {bodyText && <div className="-mt-4 mb-8">{bodyText}</div>}
        {d.layout === 'carousel'
          ? <PhotoCarousel images={images} aspect="aspect-[16/9] md:aspect-[21/9]" />
          : <LandingGallery images={images} mosaic />}
        {cta}
      </>
    )
  }
  const text = <><Heading d={d} eyebrow={d.badge} className="md:mb-6" />{bodyText}{cta}</>
  return images.length === 0 ? text : <TextWithMedia text={text} images={images} left={d.imagePosition === 'left'} alt={d.title} />
}

function Features({ d }: { d: any }) {
  const items = (d.items ?? []) as { title?: string; description?: string; icon?: string; imageUrl?: string }[]
  return (
    <>
      <Heading d={d} />
      <div className={cn('grid gap-4 sm:grid-cols-2', items.length % 3 === 0 ? 'lg:grid-cols-3' : items.length >= 4 ? 'lg:grid-cols-4' : '')}>
        {items.map((f, i) => {
          const Icon = ICONS[f.icon ?? 'Sparkles'] ?? Sparkles
          return (
            <motion.div key={i} {...fadeUp} transition={{ delay: i * 0.05 }} className="h-full rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="mb-4 flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-brand-500/10">
                {f.imageUrl
                  ? <img src={f.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                  : <Icon className="h-5 w-5 text-brand-600 dark:text-brand-400" />}
              </div>
              <h3 className="mb-1.5 font-semibold text-foreground">{f.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{f.description}</p>
            </motion.div>
          )
        })}
      </div>
    </>
  )
}

function Testimonials({ d }: { d: any }) {
  const items = (d.items ?? []) as { quote?: string; authorName?: string; authorRole?: string; photoUrl?: string }[]
  return (
    <>
      <Heading d={d} />
      <div className={cn('grid gap-4', items.length === 1 ? 'max-w-3xl' : items.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-3')}>
        {items.map((t, i) => (
          <motion.figure key={i} {...fadeUp} transition={{ delay: i * 0.05 }}
            className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-sm">
            <Quote className="mb-3 h-6 w-6 text-brand-500/60" />
            <blockquote className="flex-1 leading-relaxed text-foreground">« {t.quote} »</blockquote>
            <figcaption className="mt-5 flex items-center gap-3 border-t border-border pt-4">
              {t.photoUrl ? (
                <img src={t.photoUrl} alt={t.authorName ?? ''} loading="lazy" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-brand-accent text-sm font-bold text-white">
                  {(t.authorName ?? '?').charAt(0).toUpperCase()}
                </span>
              )}
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-foreground">{t.authorName}</span>
                <span className="block truncate text-xs text-muted-foreground">{t.authorRole}</span>
              </span>
            </figcaption>
          </motion.figure>
        ))}
      </div>
    </>
  )
}

function Faq({ d }: { d: any }) {
  const items = (d.items ?? []) as { question?: string; answer?: string }[]
  return (
    <>
      <Heading d={d} />
      <div className="max-w-4xl space-y-2">
        {items.map((f, i) => <FaqItem key={i} q={f.question ?? ''} a={f.answer ?? ''} />)}
      </div>
    </>
  )
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-accent/30">
        <span className="font-semibold text-foreground">{q}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      <motion.div initial={false} animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }} className="overflow-hidden">
        <p className="whitespace-pre-line px-5 pb-4 text-sm leading-relaxed text-muted-foreground">{a}</p>
      </motion.div>
    </div>
  )
}

function Cta({ d }: { d: any }) {
  return (
    <motion.div {...fadeUp}
      className="flex flex-col gap-6 rounded-3xl border border-border bg-card p-8 shadow-sm md:flex-row md:items-center md:justify-between md:p-10">
      <div className="max-w-2xl">
        {has(d.title) && <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">{d.title}</h2>}
        {has(d.subtitle) && <p className="mt-2 text-muted-foreground">{d.subtitle}</p>}
      </div>
      {has(d.buttonLabel) && (
        <Link href={safeHref(d.buttonLink, '/register')}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-500 px-6 py-3 text-sm font-semibold text-brand-contrast shadow-lg shadow-brand-500/25 transition hover:bg-brand-600">
          {d.buttonLabel}<ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </motion.div>
  )
}
