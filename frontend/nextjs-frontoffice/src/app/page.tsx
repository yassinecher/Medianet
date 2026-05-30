'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useAuthStore } from '@/store/auth.store'
import {
  ArrowRight, Globe2, Sparkles, Target, Users, Award, Rocket, Heart, Brain, Star, Zap,
  FileText, ClipboardCheck, Lightbulb, Trophy, Search, ChevronDown, Quote, Loader2,
} from 'lucide-react'
import { Particles } from '@/components/magicui/particles'
import { Globe } from '@/components/magicui/globe'
import { AnimatedGradientText } from '@/components/magicui/animated-gradient-text'
import { ShimmerButton } from '@/components/magicui/shimmer-button'
import { NumberTicker } from '@/components/magicui/number-ticker'
import { MagicCard } from '@/components/magicui/magic-card'
import { ProgrammeCard } from '@/components/programmes/ProgrammeCard'
import { Navbar } from '@/components/layout/Navbar'
import { programmesApi, landingPageApi } from '@/lib/api'
import type { Programme } from '@/types'

/** Parse #RRGGBB or #RGB into [r,g,b]. Returns null on invalid input. */
function hexToRgb(hex: string): [number, number, number] | null {
  if (!hex) return null
  let h = hex.replace('#', '').trim()
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (h.length !== 6) return null
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  if ([r, g, b].some(Number.isNaN)) return null
  return [r, g, b]
}

// Map icon string name → Lucide component
const ICONS: Record<string, React.ElementType> = {
  Target, Users, Globe2, Sparkles, Award, Rocket, Heart, Brain, Star, Zap,
  FileText, ClipboardCheck, Lightbulb, Trophy, Search,
}

interface Stat { label?: string; value?: number; suffix?: string }
interface Feature { title?: string; description?: string; icon?: string; imageUrl?: string }
interface ProcessStep { title?: string; description?: string; icon?: string }
interface Testimonial { quote?: string; authorName?: string; authorRole?: string; photoUrl?: string }
interface Faq { question?: string; answer?: string }
interface Landing {
  heroTitle?: string
  heroSubtitle?: string
  heroBadge?: string
  heroImageUrl?: string
  primaryCtaLabel?: string
  primaryCtaLink?: string
  secondaryCtaLabel?: string
  secondaryCtaLink?: string
  stats?: Stat[]
  features?: Feature[]
  aboutBadge?: string
  aboutTitle?: string
  aboutBody?: string
  aboutImageUrl?: string
  processTitle?: string
  processSubtitle?: string
  processSteps?: ProcessStep[]
  testimonialsTitle?: string
  testimonials?: Testimonial[]
  faqTitle?: string
  faqs?: Faq[]
  ctaTitle?: string
  ctaSubtitle?: string
  ctaButtonLabel?: string
  ctaButtonLink?: string
  footerText?: string
  primaryColor?: string
  accentColor?: string
  showHero?: boolean
  showStats?: boolean
  showAbout?: boolean
  showFeatures?: boolean
  showProcess?: boolean
  showTestimonials?: boolean
  showFaq?: boolean
  showCta?: boolean
  showProgrammes?: boolean
  programmesTitle?: string
  programmesSubtitle?: string
  programmesLimit?: number
  sectionOrder?: string
}

const FALLBACK: Landing = {
  heroBadge: "Plateforme d'incubation propulsée par l'IA",
  heroTitle: "Incubez vos idées avec l'intelligence artificielle",
  heroSubtitle: "Medianet Incubateur connecte les porteurs de projets aux meilleures opportunités d'accompagnement à travers une plateforme intelligente.",
  primaryCtaLabel: 'Déposer ma candidature',
  primaryCtaLink: '/register',
  secondaryCtaLabel: 'Explorer les programmes',
  secondaryCtaLink: '/programmes',
  stats: [
    { label: 'Programmes actifs', value: 12, suffix: '+' },
    { label: 'Startups incubées', value: 150, suffix: '+' },
    { label: 'Taux de succès', value: 87, suffix: '%' },
    { label: 'Mentors experts', value: 40, suffix: '+' },
  ],
  features: [],
  ctaTitle: 'Prêt à lancer votre projet ?',
  ctaSubtitle: 'Rejoignez des centaines de startups accompagnées par Medianet',
  ctaButtonLabel: 'Commencer maintenant',
  ctaButtonLink: '/register',
  footerText: '© 2026 Medianet Incubateur. Tous droits réservés.',
}

export default function LandingPage() {
  const router = useRouter()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [hydrated, setHydrated] = useState(false)
  const [programmes, setProgrammes] = useState<Programme[]>([])
  const [page, setPage] = useState<Landing>(FALLBACK)
  // ── Edit mode (preview iframe in backoffice) ─────────────────────────
  // When loaded with ?edit=1 we add hover outlines + emit postMessage on click
  // so the backoffice editor can scroll to the matching section card.
  // IMPORTANT: this hook must be declared BEFORE any conditional early return
  // — React requires hooks to run in the same order every render.
  const [editMode, setEditMode] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    setEditMode(params.get('edit') === '1')
  }, [])

  // Listen for "scroll-to-section" messages from the backoffice editor.
  // When the admin clicks the 👁 Voir button on a section card, we receive
  // the section id here and scroll the iframe content to that section.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onMsg = (e: MessageEvent) => {
      const data = e.data
      if (!data || data.type !== 'scroll-to-section' || !data.section) return
      const el = document.querySelector(`[data-section="${data.section}"]`) as HTMLElement | null
      if (!el) return
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      // Flash a brand-colored ring briefly so the admin sees what was hit
      const original = el.style.outline
      el.style.outline = '3px solid rgb(var(--brand-500, 98 114 246))'
      el.style.outlineOffset = '-3px'
      el.style.transition = 'outline 200ms ease'
      setTimeout(() => { el.style.outline = original }, 1500)
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  // Once Zustand has rehydrated from localStorage on the client, decide:
  // logged-in → push to /dashboard, anonymous → keep showing the landing.
  // EXCEPT when in edit mode (backoffice iframe) — we always show the landing
  // so the admin can preview it regardless of whether they're logged in.
  // The `hydrated` flag avoids a flash of landing during initial SSR mismatch.
  useEffect(() => {
    setHydrated(true)
    if (isAuthenticated && !editMode) router.replace('/dashboard')
  }, [isAuthenticated, editMode, router])

  useEffect(() => {
    Promise.allSettled([
      programmesApi.list({ status: 'OPEN', size: 12 })
        .then((r) => setProgrammes(r.data?.content ?? r.data ?? [])),
      landingPageApi.get()
        .then((r) => setPage({ ...FALLBACK, ...(r.data ?? {}) })),
    ])
  }, [])

  // While hydrating OR while we're about to redirect, show a tiny splash so the
  // user doesn't see the marketing landing flash before being sent to /dashboard.
  // Edit mode bypasses this so the admin can always preview from the backoffice.
  if (!hydrated || (isAuthenticated && !editMode)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
      </div>
    )
  }

  const onSectionClick = (sectionId: string) => (e: React.MouseEvent) => {
    if (!editMode) return
    // Don't hijack clicks on interactive elements — links, buttons, inputs.
    // Find the nearest interactive ancestor: if any, let it handle the click.
    const target = e.target as HTMLElement
    const interactive = target.closest('a, button, input, select, textarea, [role="button"]')
    if (interactive) {
      // For links: open in a NEW TAB so the iframe preview stays put.
      const link = interactive.closest('a[href]') as HTMLAnchorElement | null
      if (link) {
        const href = link.getAttribute('href') || ''
        // Internal absolute path → make it absolute against frontoffice origin
        const url = href.startsWith('/') ? window.location.origin + href : href
        e.preventDefault(); e.stopPropagation()
        window.open(url, '_blank', 'noopener,noreferrer')
      }
      return  // let buttons/inputs do their thing normally
    }
    // Empty space click → send the editor a scroll-to-section signal
    e.preventDefault(); e.stopPropagation()
    try { window.parent.postMessage({ type: 'edit-section', section: sectionId }, '*') } catch {}
  }

  const stats        = page.stats        ?? []
  const features     = page.features     ?? []
  const processSteps = page.processSteps ?? []
  const testimonials = page.testimonials ?? []
  const faqs         = page.faqs         ?? []

  // Visibility flags default to true unless explicitly false
  const visible = (flag: keyof Landing) => page[flag] !== false
  // Some sections are auto-hidden when empty even if the flag is on
  const sections: Record<string, JSX.Element | null> = {
    hero:         visible('showHero')         ? renderHero(page) : null,
    stats:        visible('showStats')         && stats.length        > 0 ? renderStats(stats) : null,
    about:        visible('showAbout')         && (page.aboutBody || page.aboutTitle) ? renderAbout(page) : null,
    features:     visible('showFeatures')      && features.length     > 0 ? renderFeatures(features) : null,
    process:      visible('showProcess')       && processSteps.length > 0 ? renderProcess(page, processSteps) : null,
    programmes:   visible('showProgrammes')    && programmes.length   > 0 ? renderProgrammes(programmes, page) : null,
    testimonials: visible('showTestimonials')  && testimonials.length > 0 ? renderTestimonials(page, testimonials) : null,
    faq:          visible('showFaq')           && faqs.length         > 0 ? renderFaq(page, faqs) : null,
    cta:          visible('showCta')           && (page.ctaTitle || page.ctaButtonLabel) ? renderCta(page) : null,
  }

  // Honor the admin's section order (with safety fallbacks for unknown ids)
  const order = (page.sectionOrder ?? 'hero,stats,features,about,process,programmes,testimonials,faq,cta')
    .split(',').map((x) => x.trim()).filter((x) => sections[x] !== undefined)
  // Append any sections the stored order forgot
  for (const k of Object.keys(sections)) if (!order.includes(k)) order.push(k)

  // CSS variable overrides for theme colors — picked up by tailwind utilities below
  // ── Theme injection ────────────────────────────────────────────────
  // Convert the admin's `primaryColor` into a coherent brand-50..950 palette
  // by adjusting lightness. The tailwind config reads --brand-XXX so this
  // changes ALL existing text-brand-*/bg-brand-*/from-brand-* utilities at once.
  const themeStyle: React.CSSProperties = {}
  if (page.primaryColor) {
    const rgb = hexToRgb(page.primaryColor)
    if (rgb) {
      const triplet = (r: number, g: number, b: number) => `${r} ${g} ${b}`
      const adj = (delta: number) => {
        const [r, g, b] = rgb.map((c) => Math.max(0, Math.min(255, Math.round(c + delta))))
        return triplet(r, g, b)
      }
      Object.assign(themeStyle, {
        '--brand-50':  adj(+180),
        '--brand-100': adj(+150),
        '--brand-200': adj(+110),
        '--brand-300': adj(+70),
        '--brand-400': adj(+35),
        '--brand-500': triplet(rgb[0], rgb[1], rgb[2]),
        '--brand-600': adj(-25),
        '--brand-700': adj(-55),
        '--brand-800': adj(-85),
        '--brand-900': adj(-115),
        '--brand-950': adj(-150),
      })
    }
  }

  // Wrap each section with edit-mode click handler + hover ring
  const wrapEditable = (id: string, node: JSX.Element | null) => {
    if (!node) return null
    return (
      <div key={id} data-section={id}
        onClick={onSectionClick(id)}
        className={editMode
          ? 'relative cursor-pointer outline outline-2 outline-transparent hover:outline-brand-500/60 hover:bg-brand-500/[0.03] transition-all'
          : ''}>
        {editMode && (
          <span className="absolute top-2 left-2 z-10 hidden group-hover:inline-flex items-center gap-1 rounded-full bg-brand-500 text-white text-[10px] font-bold px-2 py-0.5 shadow-lg pointer-events-none">
            ✎ {id}
          </span>
        )}
        {node}
      </div>
    )
  }

  return (
    <div className={`min-h-screen bg-background ${editMode ? 'pt-2' : ''}`} style={themeStyle}>
      {editMode && (
        <div className="sticky top-0 z-40 bg-brand-500 text-white text-center text-xs py-1 font-semibold">
          ✎ Mode édition — clique une section pour l'éditer
        </div>
      )}
      <Navbar />

      {order.map((id) => wrapEditable(id, sections[id]))}

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        <p>{page.footerText ?? '© 2026 Medianet Incubateur. Tous droits réservés.'}</p>
      </footer>
    </div>
  )
}

// ── Section render helpers ──────────────────────────────────────────────────

function renderHero(page: Landing) {
  return (
    <section className="relative flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center overflow-hidden px-4 text-center">
        <div className="absolute inset-0"><Particles quantity={90} color="#6272f6" /></div>
        <div className="mesh-gradient absolute inset-0" />
        {page.heroImageUrl ? (
          <div className="absolute inset-0 opacity-20 dark:opacity-25 pointer-events-none"
            style={{ backgroundImage: `url(${page.heroImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
        ) : (
          <div className="absolute -right-40 top-1/2 -translate-y-1/2 opacity-20 md:opacity-40 pointer-events-none">
            <Globe />
          </div>
        )}

        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="relative z-10 max-w-4xl">
          {page.heroBadge && (
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-1.5 text-sm text-brand-600 dark:text-brand-400">
              <Sparkles className="h-3.5 w-3.5" />
              {page.heroBadge}
            </div>
          )}
          <h1 className="mb-6 text-5xl font-bold leading-tight tracking-tight text-foreground md:text-7xl">
            {page.heroTitle}
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground">
            {page.heroSubtitle}
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            {page.primaryCtaLabel && (
              <Link href={page.primaryCtaLink ?? '/register'}>
                <ShimmerButton className="px-8 py-4 text-base font-semibold">
                  {page.primaryCtaLabel} <ArrowRight className="h-4 w-4" />
                </ShimmerButton>
              </Link>
            )}
            {page.secondaryCtaLabel && (
              <Link href={page.secondaryCtaLink ?? '/programmes'}
                className="rounded-xl border border-border bg-background/80 px-8 py-4 text-base font-medium backdrop-blur hover:bg-accent transition-colors">
                {page.secondaryCtaLabel}
              </Link>
            )}
          </div>
        </motion.div>
      </section>
  )
}

function renderStats(stats: Stat[]) {
  return (
    <section className="border-y border-border bg-card/50 py-16">
      <div className="mx-auto max-w-5xl px-4">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {stats.map((s, i) => (
            <motion.div key={`${s.label}-${i}`} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="text-center">
              <p className="text-4xl font-bold text-brand-600 dark:text-brand-400">
                <NumberTicker value={s.value ?? 0} suffix={s.suffix} />
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function renderAbout(page: Landing) {
  return (
    <section className="py-20 px-4">
      <div className="mx-auto max-w-5xl grid md:grid-cols-2 gap-10 items-center">
        <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
          {page.aboutBadge && (
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-xs text-brand-600 dark:text-brand-400">
              {page.aboutBadge}
            </div>
          )}
          {page.aboutTitle && <h2 className="mb-4 text-3xl md:text-4xl font-bold text-foreground">{page.aboutTitle}</h2>}
          {page.aboutBody && <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{page.aboutBody}</p>}
        </motion.div>
        {page.aboutImageUrl ? (
          <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-border shadow-xl">
            <img src={page.aboutImageUrl} alt={page.aboutTitle ?? ''} className="h-full w-full object-cover" />
          </motion.div>
        ) : (
          <div className="hidden md:block aspect-[4/3] rounded-2xl bg-gradient-to-br from-brand-500/20 via-purple-500/20 to-transparent border border-border" />
        )}
      </div>
    </section>
  )
}

function renderFeatures(features: Feature[]) {
  return (
    <section className="py-20 px-4">
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold text-foreground">Tout ce dont vous avez besoin</h2>
          <p className="mt-2 text-muted-foreground">Un écosystème complet pour chaque acteur de l'incubation</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => {
            const Icon = ICONS[f.icon ?? 'Sparkles'] ?? Sparkles
            return (
              <motion.div key={`${f.title}-${i}`} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <MagicCard className="h-full p-6">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/10 overflow-hidden">
                    {f.imageUrl ? (
                      <img src={f.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Icon className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                    )}
                  </div>
                  <h3 className="mb-2 font-semibold text-foreground">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.description}</p>
                </MagicCard>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function renderProcess(page: Landing, steps: ProcessStep[]) {
  return (
    <section className="py-20 px-4 bg-muted/30">
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 text-center">
          {page.processTitle && <h2 className="text-3xl font-bold text-foreground">{page.processTitle}</h2>}
          {page.processSubtitle && <p className="mt-2 text-muted-foreground">{page.processSubtitle}</p>}
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 relative">
          {/* Connecting line — visible on md+ */}
          <div className="hidden lg:block absolute top-6 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-500/30 to-transparent" />
          {steps.map((s, i) => {
            const Icon = ICONS[s.icon ?? 'FileText'] ?? FileText
            return (
              <motion.div key={`step-${i}`} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="relative text-center">
                <div className="relative mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-purple-600 shadow-lg shadow-brand-500/30 ring-4 ring-background">
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="mb-2 font-semibold text-foreground">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.description}</p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function renderTestimonials(page: Landing, testimonials: Testimonial[]) {
  return (
    <section className="py-20 px-4">
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold text-foreground">{page.testimonialsTitle ?? 'Ils nous font confiance'}</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <motion.div key={`testimonial-${i}`} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
              <MagicCard className="h-full p-6 flex flex-col">
                <Quote className="h-6 w-6 text-brand-500/60 mb-3" />
                <p className="text-sm leading-relaxed text-foreground italic flex-1">« {t.quote} »</p>
                <div className="mt-4 flex items-center gap-3 border-t border-border pt-4">
                  {t.photoUrl ? (
                    <img src={t.photoUrl} alt={t.authorName ?? ''} className="h-9 w-9 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-purple-600 text-xs font-bold text-white">
                      {(t.authorName ?? '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{t.authorName}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{t.authorRole}</p>
                  </div>
                </div>
              </MagicCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function renderFaq(page: Landing, faqs: Faq[]) {
  return (
    <section className="py-20 px-4 bg-muted/30">
      <div className="mx-auto max-w-3xl">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-bold text-foreground">{page.faqTitle ?? 'Questions fréquentes'}</h2>
        </div>
        <div className="space-y-2">
          {faqs.map((f, i) => <FaqItem key={`faq-${i}`} q={f.question ?? ''} a={f.answer ?? ''} />)}
        </div>
      </div>
    </section>
  )
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-accent/30 transition-colors">
        <span className="text-sm font-semibold text-foreground">{q}</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      <motion.div initial={false} animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }} className="overflow-hidden">
        <p className="px-5 pb-4 text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{a}</p>
      </motion.div>
    </div>
  )
}

function renderCta(page: Landing) {
  return (
    <section className="py-20 px-4 text-center bg-slate-950 dark:bg-slate-950">
      <div className="mx-auto max-w-2xl">
        {page.ctaTitle && <h2 className="text-3xl font-bold text-white">{page.ctaTitle}</h2>}
        {page.ctaSubtitle && <p className="mt-3 text-slate-400">{page.ctaSubtitle}</p>}
        {page.ctaButtonLabel && (
          <div className="mt-8 flex justify-center gap-4">
            <Link href={page.ctaButtonLink ?? '/register'}>
              <ShimmerButton className="px-8 py-4 font-semibold">{page.ctaButtonLabel}</ShimmerButton>
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}

function renderProgrammes(programmes: Programme[], page?: Landing) {
  const limit = page?.programmesLimit ?? 6
  const shown = programmes.slice(0, limit)
  return (
    <section className="py-20 px-4 bg-muted/30">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-foreground">{page?.programmesTitle ?? 'Programmes ouverts'}</h2>
            <p className="text-muted-foreground">{page?.programmesSubtitle ?? 'Candidatez dès maintenant'}</p>
          </div>
          <Link href="/programmes" className="flex items-center gap-1 text-sm font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700">
            Voir tout <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((p) => <ProgrammeCard key={p.id} programme={p} />)}
        </div>
      </div>
    </section>
  )
}
