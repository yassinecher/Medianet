'use client'
import { motion } from 'framer-motion'
import {
  BookOpen, Calendar, CheckCircle2, Clock, ExternalLink, GraduationCap, Images, Lightbulb, MapPin,
  PlayCircle, Sparkles, Target, Trophy, Users,
} from 'lucide-react'
import { NumberTicker } from '@/components/magicui/number-ticker'
import { BlockView, blockHasContent as landingHasContent } from '@/components/landing/LandingBlocks'
import { PhotoCarousel, PhotoGallery as LandingGallery } from '@/components/landing/LandingMedia'
import { PhotoGallery as PhotoStrip } from '@/components/media/PhotoGallery'
import { LogoImage } from '@/components/media/LogoImage'
import { Button } from '@/components/ui/button'
import { formatDate, cn } from '@/lib/utils'
import {
  DEFAULT_APPLY_SUBTITLE, LANDING_TYPES, safeHref, videoEmbedUrl,
  type ProgrammeBlock, type SectionBackground,
} from '@/lib/programmePage'
import type { Criteria, Partner, Phase, Programme } from '@/types'

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

const has = (v?: string | null) => !!v && v.trim().length > 0
const fadeUp = { initial: { opacity: 0, y: 18 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '-60px' } }

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
    case 'about': return has(p.description) || (d.images ?? []).some((i: any) => i?.url)
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
    default: return LANDING_TYPES.has(b.type) && landingHasContent({ id: b.id, type: b.type as any, data: d }, [])
  }
}

// ── Building blocks ─────────────────────────────────────────────────────────

function Shell({ id, bg, children, className }: { id: string; bg: ResolvedBackground; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={cn('scroll-mt-32 px-4 py-14 sm:px-6 md:py-20', BG[bg], className)}>
      <div className="mx-auto max-w-6xl">{children}</div>
    </section>
  )
}

function Heading({ d, center = false, className }: { d: any; center?: boolean; className?: string }) {
  if (!has(d.title) && !has(d.subtitle)) return null
  return (
    <motion.div {...fadeUp} className={cn('mb-8 md:mb-12', center ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl', className)}>
      {has(d.eyebrow) && (
        <p className={cn('mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-brand-600 dark:text-brand-400', center && 'justify-center')}>
          <span className="h-px w-6 bg-current opacity-60" />{d.eyebrow}
        </p>
      )}
      {has(d.title) && <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">{d.title}</h2>}
      {has(d.subtitle) && <p className="mt-3 text-base leading-relaxed text-muted-foreground md:text-lg">{d.subtitle}</p>}
    </motion.div>
  )
}

/** Renders one block, or null when it has nothing to show. */
export function ProgrammeBlockView({ block, ctx, bg, anchor }: {
  block: ProgrammeBlock; ctx: PageCtx; bg: ResolvedBackground; anchor: string
}) {
  const d = block.data ?? {}
  const p = ctx.programme
  switch (block.type) {
    case 'about': return <Shell id={anchor} bg={bg}><About d={d} p={p} /></Shell>
    case 'highlights': return <Shell id={anchor} bg={bg}><Highlights d={d} p={p} /></Shell>
    case 'audience': return <Shell id={anchor} bg={bg}><Audience d={d} p={p} /></Shell>
    case 'objectives': return <Shell id={anchor} bg={bg}><Objectives d={d} items={p.objectives ?? []} /></Shell>
    case 'journey': return <Shell id={anchor} bg={bg}><Journey d={d} phases={ctx.phases} /></Shell>
    case 'benefits': return <Shell id={anchor} bg={bg}><Benefits d={d} items={p.benefits ?? []} /></Shell>
    case 'gallery': return <Shell id={anchor} bg={bg}><Gallery d={d} urls={galleryUrls(ctx, d)} /></Shell>
    case 'criteria': return <Shell id={anchor} bg={bg}><CriteriaList d={d} criteria={ctx.criteria} /></Shell>
    case 'partners': return <Shell id={anchor} bg={bg}><Partners d={d} partners={ctx.partners} /></Shell>
    case 'apply': return <Shell id={anchor} bg={bg} className="py-10 md:py-14"><Apply d={d} ctx={ctx} /></Shell>
    case 'video': return <Shell id={anchor} bg={bg}><Video d={d} /></Shell>
    default: {
      if (!LANDING_TYPES.has(block.type)) return null
      // Same renderer as the home page; links are filtered like everywhere on this page.
      const data = {
        ...d, background: bg,
        ...(d.ctaLink !== undefined && { ctaLink: safeHref(d.ctaLink, '/programmes') }),
        ...(d.buttonLink !== undefined && { buttonLink: safeHref(d.buttonLink, '/register') }),
      }
      return (
        <div id={anchor} className="scroll-mt-32">
          <BlockView block={{ id: block.id, type: block.type as any, data }} programmes={[]} />
        </div>
      )
    }
  }
}

// ── Sections ────────────────────────────────────────────────────────────────

function About({ d, p }: { d: any; p: Programme }) {
  const paragraphs = (p.description ?? '').split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean)
  const images = ((d.images ?? []) as { url?: string; caption?: string }[]).filter((i) => i?.url)
  const prose = (
    <div className="space-y-4 text-base leading-relaxed text-muted-foreground md:text-[17px]">
      {paragraphs.map((text, i) => (
        <p key={i} className={cn('whitespace-pre-line', i === 0 && 'text-lg leading-relaxed text-foreground/90 md:text-xl')}>{text}</p>
      ))}
    </div>
  )
  if (images.length === 0) {
    return <div className="mx-auto max-w-3xl"><Heading d={d} />{prose}</div>
  }
  const left = d.imagePosition === 'left'
  return (
    <div className="grid items-center gap-10 md:grid-cols-2 lg:gap-14">
      <motion.div {...fadeUp} className={left ? 'md:order-2' : ''}><Heading d={d} className="md:mb-8" />{prose}</motion.div>
      <motion.div {...fadeUp} className={left ? 'md:order-1' : ''}>
        {images.length > 1 ? (
          <PhotoCarousel images={images} aspect="aspect-[4/3]" />
        ) : (
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-border shadow-2xl shadow-brand-500/10">
            <img src={images[0].url} alt={images[0].caption ?? p.title ?? ''} loading="lazy" className="h-full w-full object-cover" />
          </div>
        )}
      </motion.div>
    </div>
  )
}

function Highlights({ d, p }: { d: any; p: Programme }) {
  const items = highlightItems(p, d)
  return (
    <>
      <Heading d={d} center />
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
      <div className="mx-auto max-w-3xl">
        <Heading d={d} />
        <ul className="space-y-3">
          {items.map((o, i) => (
            <motion.li key={i} {...fadeUp} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
              <Target className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" />
              <span className="leading-relaxed text-foreground">{o}</span>
            </motion.li>
          ))}
        </ul>
      </div>
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
    <div className="mx-auto max-w-4xl">
      <Heading d={d} />
      <ol className="relative">
        {phases.map((ph, i) => {
          const status = ph.status ?? (ph.isActive ? 'ACTIVE' : 'UPCOMING')
          const done = status === 'COMPLETED'
          const active = status === 'ACTIVE'
          const last = i === phases.length - 1
          return (
            <motion.li key={ph.id} {...fadeUp} className="relative flex gap-4 pb-6 last:pb-0 sm:gap-6">
              <div className="relative flex flex-col items-center">
                <span className={cn('relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ring-4 ring-background',
                  done ? 'bg-emerald-500 text-white' : active ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/30' : 'border-2 border-brand-300 bg-background text-brand-600 dark:border-brand-700 dark:text-brand-400')}>
                  {active && <span className="absolute inset-0 animate-ping rounded-full bg-brand-500/30" />}
                  {done ? <CheckCircle2 className="h-5 w-5" /> : <span className="relative">{i + 1}</span>}
                </span>
                {!last && <span className={cn('mt-1 w-0.5 flex-1 rounded-full', done || active ? 'bg-gradient-to-b from-brand-400 to-border' : 'bg-border')} />}
              </div>
              <div className={cn('mb-1 flex-1 rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md',
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
                {ph.description && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{ph.description}</p>}
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
    </div>
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
      <Heading d={d} center />
      <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
        {partners.map((pt, i) => (
          <motion.div key={pt.id} {...fadeUp} transition={{ delay: i * 0.04 }} title={pt.name}
            className="group flex w-36 flex-col items-center gap-2 sm:w-44">
            <div className="flex h-20 w-full items-center justify-center rounded-2xl border border-border bg-white p-4 shadow-sm transition-all group-hover:-translate-y-0.5 group-hover:shadow-md sm:h-24">
              <LogoImage src={pt.logoUrl} alt={pt.name} iconClassName="h-7 w-7"
                className="max-h-full max-w-full object-contain opacity-80 grayscale transition group-hover:opacity-100 group-hover:grayscale-0" />
            </div>
            <span className="line-clamp-1 text-center text-xs font-medium text-muted-foreground">{pt.name}</span>
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
    <div className="mx-auto max-w-4xl">
      <Heading d={d} center />
      <motion.div {...fadeUp} className="overflow-hidden rounded-3xl border border-border bg-black shadow-2xl shadow-brand-500/10">
        <div className="relative aspect-video">
          <iframe src={src} title={d.title || 'Vidéo du programme'} loading="lazy"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 h-full w-full border-0" />
        </div>
      </motion.div>
      {has(d.caption) && (
        <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-sm text-muted-foreground">
          <PlayCircle className="h-4 w-4 text-brand-500" />{d.caption}
        </p>
      )}
    </div>
  )
}
