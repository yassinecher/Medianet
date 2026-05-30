'use client'
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Home, Save, Loader2, Plus, Trash2, ChevronUp, ChevronDown, RotateCcw,
  Sparkles, Target, Users, Globe2, Award, Rocket, Heart, Brain, Star, Zap,
  Eye, EyeOff, Palette, MessageSquareQuote, HelpCircle, ListChecks, Info,
  FileText, ClipboardCheck, Lightbulb, ArrowRight, Trophy, Search,
  Monitor, Tablet, Smartphone, Wand2, PanelRightOpen, PanelRightClose,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { landingPageApi, adminAiApi } from '@/lib/api'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { MagicCard } from '@/components/magicui/magic-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ImageUpload } from '@/components/upload/ImageUpload'

interface Stat { label?: string; value?: number; suffix?: string }
interface Feature { title?: string; description?: string; icon?: string; imageUrl?: string }
interface ProcessStep { title?: string; description?: string; icon?: string }
interface Testimonial { quote?: string; authorName?: string; authorRole?: string; photoUrl?: string }
interface Faq { question?: string; answer?: string }

interface LandingPage {
  // Programmes carousel
  programmesTitle?: string
  programmesSubtitle?: string
  programmesLimit?: number
  showProgrammes?: boolean
  // Hero
  heroTitle?: string
  heroSubtitle?: string
  heroBadge?: string
  heroImageUrl?: string
  primaryCtaLabel?: string
  primaryCtaLink?: string
  secondaryCtaLabel?: string
  secondaryCtaLink?: string
  // Sections
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
  // CTA + footer
  ctaTitle?: string
  ctaSubtitle?: string
  ctaButtonLabel?: string
  ctaButtonLink?: string
  footerText?: string
  // Theme + visibility
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
  sectionOrder?: string // CSV of section ids
}

const AVAILABLE_ICONS = [
  'Sparkles', 'Target', 'Users', 'Globe2', 'Award', 'Rocket', 'Heart', 'Brain', 'Star', 'Zap',
  'FileText', 'ClipboardCheck', 'Lightbulb', 'Trophy', 'Search',
]

const SECTION_META: Record<string, { id: string; label: string; icon: any; flag: keyof LandingPage }> = {
  hero:         { id: 'hero',         label: 'Hero',          icon: Sparkles,           flag: 'showHero' },
  stats:        { id: 'stats',        label: 'Chiffres',      icon: Award,              flag: 'showStats' },
  about:        { id: 'about',        label: 'À propos',      icon: Info,               flag: 'showAbout' },
  features:     { id: 'features',     label: 'Fonctionnalités', icon: Target,           flag: 'showFeatures' },
  process:      { id: 'process',      label: 'Processus',     icon: ListChecks,         flag: 'showProcess' },
  programmes:   { id: 'programmes',   label: 'Programmes',    icon: Rocket,             flag: 'showProgrammes' },
  testimonials: { id: 'testimonials', label: 'Témoignages',   icon: MessageSquareQuote, flag: 'showTestimonials' },
  faq:          { id: 'faq',          label: 'FAQ',           icon: HelpCircle,         flag: 'showFaq' },
  cta:          { id: 'cta',          label: 'CTA final',     icon: Rocket,             flag: 'showCta' },
}
const ALL_SECTIONS = ['hero', 'stats', 'about', 'features', 'process', 'programmes', 'testimonials', 'faq', 'cta']

// ── Theme presets (one-click apply primary + accent colors) ───────────────────
// The "default" preset uses empty strings → on save, the backend stores NULL,
// which makes the Tailwind config fallbacks (original blue palette) kick in.
const THEME_PRESETS: Array<{ id: string; label: string; primary: string; accent: string; emoji: string }> = [
  { id: 'default',  label: 'Défaut',   primary: '',        accent: '',        emoji: '⚪' },
  { id: 'sunset',   label: 'Sunset',   primary: '#FF6A00', accent: '#9333EA', emoji: '🌅' },
  { id: 'ocean',    label: 'Ocean',    primary: '#0EA5E9', accent: '#14B8A6', emoji: '🌊' },
  { id: 'forest',   label: 'Forest',   primary: '#16A34A', accent: '#CA8A04', emoji: '🌲' },
  { id: 'royal',    label: 'Royal',    primary: '#7C3AED', accent: '#F59E0B', emoji: '👑' },
  { id: 'tunisia',  label: 'Tunisia',  primary: '#E70013', accent: '#1F2937', emoji: '🇹🇳' },
  { id: 'minimal',  label: 'Minimal',  primary: '#111827', accent: '#6B7280', emoji: '◾' },
  { id: 'rose',     label: 'Rose',     primary: '#E11D48', accent: '#F472B6', emoji: '🌹' },
  { id: 'midnight', label: 'Midnight', primary: '#1E40AF', accent: '#8B5CF6', emoji: '🌌' },
]

// ── Device preview widths ─────────────────────────────────────────────────────
const DEVICE_WIDTHS: Record<string, { label: string; w: number; icon: any }> = {
  desktop: { label: 'Bureau',  w: 1280, icon: Monitor },
  tablet:  { label: 'Tablette', w: 820, icon: Tablet },
  mobile:  { label: 'Mobile',   w: 390, icon: Smartphone },
}

/**
 * Live-preview pane with scale-to-fit (like Chrome DevTools responsive mode).
 * The iframe renders at the DEVICE'S NATIVE width (1280/820/390) and we scale
 * it down with CSS transform so it fits whatever column width we have. That's
 * why the public site sees the full desktop layout even when the editor column
 * is only 700px wide.
 */
function PreviewPane({ url, bump, device, userZoom, onReload }: {
  url: string
  bump: number
  device: keyof typeof DEVICE_WIDTHS
  userZoom: number
  onReload: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [fitScale, setFitScale] = useState(1)
  const deviceWidth = DEVICE_WIDTHS[device].w

  // Watch the container width and compute fit-scale = container / device, capped at 1
  useEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current
    const compute = () => {
      const cw = el.clientWidth - 16  // padding margin
      setFitScale(Math.min(1, cw / deviceWidth))
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    return () => ro.disconnect()
  }, [deviceWidth])

  // Effective scale = fit-to-container × user zoom (e.g. 1.5× to zoom in)
  const scale = fitScale * userZoom

  // Container height is whatever we get. We render the iframe at the unscaled
  // height that, after scaling, fills the container vertically.
  const containerHeight = 'calc(100vh - 160px)'
  const iframeHeight = `calc((100vh - 160px) / ${scale || 1})`

  return (
    <div className="sticky top-[68px] space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Eye className="h-3 w-3" />
        Aperçu en direct · {DEVICE_WIDTHS[device].label} ({deviceWidth}px)
        <span className="text-[10px] opacity-70">· {(scale * 100).toFixed(0)}%</span>
        <button type="button" onClick={onReload}
          className="ml-auto inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-0.5 text-[10px] hover:bg-accent transition-colors"
          title="Recharger l'aperçu">
          <RotateCcw className="h-2.5 w-2.5" />Recharger
        </button>
      </div>

      {/* Outer container — fills available column space */}
      <div ref={containerRef}
        className="relative rounded-xl border border-border bg-muted/30 p-2 overflow-hidden"
        style={{ height: containerHeight }}>
        {/* Frame chrome — scrollable when zoomed past 100% fit, hidden otherwise */}
        <div className="relative h-full w-full overflow-auto rounded-lg border border-border bg-card shadow-lg">
          {/* The iframe is rendered at the DEVICE'S native size, then visually
              scaled to fit the container width via CSS transform. */}
          <iframe key={bump} src={url} title="Aperçu"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            style={{
              width: `${deviceWidth}px`,
              height: iframeHeight,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              border: 0,
              display: 'block',
            }} />
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground italic">
        💡 Échelle {Math.round(scale * 100)}% — le rendu reste fidèle à un écran {deviceWidth}px.
        L'aperçu se recharge après chaque enregistrement.
      </p>
    </div>
  )
}

/** Tiny "👁 Voir" button — scrolls the preview iframe to a section. */
function ScrollToPreviewButton({ section, onScroll }: { section: string; onScroll: (s: string) => void }) {
  return (
    <button type="button" onClick={() => onScroll(section)}
      title="Voir cette section dans l'aperçu"
      className="inline-flex items-center gap-1 rounded-md border border-brand-500/30 bg-brand-500/5 px-2 py-1 text-[10px] font-bold text-brand-700 dark:text-brand-300 hover:bg-brand-500/15 transition-colors">
      <Eye className="h-3 w-3" />Voir
    </button>
  )
}

/** Small "✨ Generate" button — opens a tiny prompt for an optional brief, then calls aiSuggest. */
function AiButton({ section, suggest, label = 'IA' }: {
  section: string
  suggest: (section: string, brief?: string) => Promise<void>
  label?: string
}) {
  const [loading, setLoading] = useState(false)
  const onClick = async () => {
    const brief = window.prompt(
      `Brief facultatif pour générer "${section}" (laisser vide = défaut Medianet) :`,
      ''
    )
    if (brief === null) return  // user cancelled
    setLoading(true)
    try { await suggest(section, brief.trim() || undefined) }
    finally { setLoading(false) }
  }
  return (
    <button type="button" onClick={onClick} disabled={loading}
      title={`Générer ${section} avec l'IA`}
      className="inline-flex items-center gap-1 rounded-md border border-purple-500/30 bg-gradient-to-r from-purple-500/10 to-brand-500/10 px-2 py-1 text-[10px] font-bold text-purple-700 dark:text-purple-300 hover:from-purple-500/20 hover:to-brand-500/20 transition-colors disabled:opacity-50">
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
      ✨ {label}
    </button>
  )
}

export default function LandingPageEditor() {
  const [page, setPage] = useState<LandingPage>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  // Live preview controls
  const [previewOpen, setPreviewOpen] = useState(true)
  const [device, setDevice] = useState<keyof typeof DEVICE_WIDTHS>('desktop')
  const [previewBump, setPreviewBump] = useState(0)  // increment to force iframe reload
  const [userZoom, setUserZoom] = useState(1)        // user-controlled zoom on top of fit-scale
  const [autoSaveOn, setAutoSaveOn] = useState(true) // live preview = auto-save
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'pending' | 'saving' | 'saved'>('idle')
  // ?edit=1 tells the frontoffice it's running inside the editor → enables click-to-edit overlay
  const previewUrl = (process.env.NEXT_PUBLIC_FRONTOFFICE_URL ?? 'http://localhost:3000') + `?edit=1&_=${previewBump}`

  useEffect(() => {
    landingPageApi.get()
      .then((r) => setPage(r.data ?? {}))
      .catch(() => toast.error('Impossible de charger la page'))
      .finally(() => setLoading(false))
  }, [])

  const set = <K extends keyof LandingPage>(k: K, v: LandingPage[K]) => setPage((p) => ({ ...p, [k]: v }))

  // ── Stats ────────────────────────────────────────────────────────────
  const addStat = () => set('stats', [...(page.stats ?? []), { label: 'Nouveau', value: 0, suffix: '+' }])
  const removeStat = (i: number) => set('stats', (page.stats ?? []).filter((_, idx) => idx !== i))
  const updateStat = (i: number, patch: Partial<Stat>) => set('stats',
    (page.stats ?? []).map((s, idx) => idx === i ? { ...s, ...patch } : s)
  )
  const moveStat = (i: number, dir: -1 | 1) => {
    const next = [...(page.stats ?? [])]
    const tgt = i + dir
    if (tgt < 0 || tgt >= next.length) return
    ;[next[i], next[tgt]] = [next[tgt], next[i]]
    set('stats', next)
  }

  // ── Features ─────────────────────────────────────────────────────────
  const addFeature = () => set('features', [...(page.features ?? []), { title: 'Nouvelle fonctionnalité', description: '', icon: 'Sparkles' }])
  const removeFeature = (i: number) => set('features', (page.features ?? []).filter((_, idx) => idx !== i))
  const updateFeature = (i: number, patch: Partial<Feature>) => set('features',
    (page.features ?? []).map((f, idx) => idx === i ? { ...f, ...patch } : f)
  )
  const moveFeature = (i: number, dir: -1 | 1) => {
    const next = [...(page.features ?? [])]
    const tgt = i + dir
    if (tgt < 0 || tgt >= next.length) return
    ;[next[i], next[tgt]] = [next[tgt], next[i]]
    set('features', next)
  }

  // ── Generic list helpers (DRY for the 3 new collections) ────────────────
  function listOps<K extends 'processSteps' | 'testimonials' | 'faqs', T>(key: K, factory: () => T) {
    const arr = (page[key] as unknown as T[]) ?? []
    return {
      arr,
      add:    () => set(key, [...arr, factory()] as any),
      remove: (i: number) => set(key, arr.filter((_, idx) => idx !== i) as any),
      update: (i: number, patch: Partial<T>) => set(key,
        arr.map((s, idx) => idx === i ? { ...(s as any), ...patch } : s) as any
      ),
      move:   (i: number, dir: -1 | 1) => {
        const next = [...arr]
        const tgt = i + dir
        if (tgt < 0 || tgt >= next.length) return
        ;[next[i], next[tgt]] = [next[tgt], next[i]]
        set(key, next as any)
      },
    }
  }
  const steps        = listOps<'processSteps', ProcessStep>('processSteps', () =>
    ({ title: 'Nouvelle étape', description: '', icon: 'FileText' }))
  const testimonials = listOps<'testimonials', Testimonial>('testimonials', () =>
    ({ quote: '', authorName: '', authorRole: '', photoUrl: '' }))
  const faqs         = listOps<'faqs', Faq>('faqs', () =>
    ({ question: '', answer: '' }))

  // ── Section ordering ────────────────────────────────────────────────────
  const sectionOrder: string[] = (() => {
    const stored = (page.sectionOrder ?? '').split(',').map((x) => x.trim()).filter((x) => ALL_SECTIONS.includes(x))
    // Append any sections that the stored order forgot (e.g. after upgrades)
    for (const s of ALL_SECTIONS) if (!stored.includes(s)) stored.push(s)
    return stored
  })()
  const moveSection = (id: string, dir: -1 | 1) => {
    const idx = sectionOrder.indexOf(id)
    const tgt = idx + dir
    if (idx < 0 || tgt < 0 || tgt >= sectionOrder.length) return
    const next = [...sectionOrder]
    ;[next[idx], next[tgt]] = [next[tgt], next[idx]]
    set('sectionOrder', next.join(','))
  }
  const toggleSection = (flag: keyof LandingPage) => set(flag, !page[flag] as any)

  const handleSave = async () => {
    setSaving(true)
    try {
      const r = await landingPageApi.update(page)
      setPage(r.data ?? page)
      setPreviewBump((n) => n + 1)  // force iframe refresh
      toast.success('Page d\'accueil mise à jour')
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Erreur')
    } finally { setSaving(false) }
  }

  const handleReset = async () => {
    if (!confirm('Restaurer les valeurs par défaut ? Toutes les personnalisations seront perdues.')) return
    try {
      const r = await landingPageApi.reset()
      setPage(r.data ?? {})
      setPreviewBump((n) => n + 1)
      toast.success('Page réinitialisée')
    } catch { toast.error('Erreur') }
  }

  // ── Debounced auto-save → live preview ──────────────────────────────────
  // After 1.2s of inactivity since the last edit, push to the server and
  // reload the iframe. Skips the initial load and respects autoSaveOn toggle.
  const skipNextAutoSaveRef = useRef(true)
  useEffect(() => {
    if (loading) return
    if (skipNextAutoSaveRef.current) { skipNextAutoSaveRef.current = false; return }
    if (!autoSaveOn) return
    setAutoSaveStatus('pending')
    const t = setTimeout(async () => {
      setAutoSaveStatus('saving')
      try {
        await landingPageApi.update(page)
        setPreviewBump((n) => n + 1)
        setAutoSaveStatus('saved')
        setTimeout(() => setAutoSaveStatus('idle'), 1500)
      } catch {
        setAutoSaveStatus('idle')
      }
    }, 1200)
    return () => clearTimeout(t)
  // We deliberately depend on `page` only — that's the user-edited state
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  // ── Click-to-edit: iframe posts {type:'edit-section', section} → scroll editor ──
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const data = e.data
      if (!data || data.type !== 'edit-section' || !data.section) return
      const el = document.querySelector(`[data-edit-section="${data.section}"]`) as HTMLElement | null
      if (!el) return
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      // Flash animation
      el.classList.add('ring-2', 'ring-brand-500', 'ring-offset-2')
      setTimeout(() => el.classList.remove('ring-2', 'ring-brand-500', 'ring-offset-2'), 1500)
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  /** Tell the preview iframe to scroll to a given section. */
  const scrollPreviewTo = (sectionId: string) => {
    const iframe = document.querySelector('iframe[title="Aperçu"]') as HTMLIFrameElement | null
    if (!iframe?.contentWindow) {
      toast.error('Aperçu non disponible — active-le d\'abord')
      return
    }
    iframe.contentWindow.postMessage({ type: 'scroll-to-section', section: sectionId }, '*')
  }

  /** Apply a theme preset (just sets primaryColor + accentColor in local state). */
  const applyTheme = (themeId: string) => {
    const t = THEME_PRESETS.find((x) => x.id === themeId)
    if (!t) return
    setPage((p) => ({ ...p, primaryColor: t.primary, accentColor: t.accent }))
    toast.success(`Thème « ${t.label} » appliqué — n'oublie pas d'enregistrer`)
  }

  /** Call the AI to generate content for one section, then merge into the page. */
  const aiSuggest = async (section: string, brief?: string) => {
    const toastId = toast.loading(`✨ Génération de "${section}"…`)
    try {
      const r = await adminAiApi.landingSuggest({ section, brief, locale: 'fr' })
      if (r.data?.error) {
        toast.error(r.data.error, { id: toastId })
        return
      }
      setPage((p) => ({ ...p, ...r.data }))
      toast.success('Contenu généré — relis et enregistre', { id: toastId })
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Échec de la génération IA', { id: toastId })
    }
  }

  if (loading) return (
    <AdminLayout>
      <div className="space-y-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}</div>
    </AdminLayout>
  )

  return (
    <AdminLayout>
      {/* ── Top toolbar: themes + preview controls + save (sticky) ───────── */}
      <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 mb-4 border-b border-border bg-background/95 backdrop-blur px-4 sm:px-6 py-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Home className="h-4 w-4 text-brand-500" />
            <span className="font-bold text-sm text-foreground">Éditeur de page d'accueil</span>
          </div>

          {/* Theme presets */}
          <div className="flex items-center gap-1 ml-auto rounded-lg border border-border bg-card p-1">
            <span className="px-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Thèmes</span>
            {THEME_PRESETS.map((t) => {
              const isDefault = !t.primary && !t.accent
              return (
                <button key={t.id} type="button" onClick={() => applyTheme(t.id)} title={t.label}
                  className={`group flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent transition-colors ${
                    isDefault ? 'border border-dashed border-border bg-card' : ''
                  }`}
                  style={isDefault ? undefined
                                   : { background: `linear-gradient(135deg, ${t.primary} 50%, ${t.accent} 50%)` }}>
                  <span className={`text-[10px] transition-opacity ${isDefault ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    {t.emoji}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Device toggle */}
          <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5">
            {Object.entries(DEVICE_WIDTHS).map(([k, d]) => {
              const Icon = d.icon
              return (
                <button key={k} type="button" onClick={() => setDevice(k as any)} title={d.label}
                  className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${device === k ? 'bg-brand-500/15 text-brand-600 dark:text-brand-400' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}>
                  <Icon className="h-3.5 w-3.5" />
                </button>
              )
            })}
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5">
            <button type="button" onClick={() => setUserZoom((z) => Math.max(0.25, +(z - 0.1).toFixed(2)))}
              title="Zoom arrière" className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
              <span className="text-base font-bold leading-none">−</span>
            </button>
            <button type="button" onClick={() => setUserZoom(1)}
              title="Réinitialiser le zoom" className="min-w-[42px] px-1.5 text-[10px] font-bold text-foreground tabular-nums hover:bg-accent rounded">
              {Math.round(userZoom * 100)}%
            </button>
            <button type="button" onClick={() => setUserZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))}
              title="Zoom avant" className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
              <span className="text-base font-bold leading-none">+</span>
            </button>
          </div>

          {/* Preview pane toggle */}
          <Button variant="outline" size="sm" onClick={() => setPreviewOpen((v) => !v)} className="gap-1.5"
            title={previewOpen ? 'Masquer l\'aperçu' : 'Afficher l\'aperçu'}>
            {previewOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{previewOpen ? 'Masquer' : 'Aperçu'}</span>
          </Button>

          {/* Auto-save status */}
          <button type="button" onClick={() => setAutoSaveOn((v) => !v)}
            title={autoSaveOn ? 'Désactiver la sauvegarde auto' : 'Activer la sauvegarde auto'}
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-bold transition-colors ${
              autoSaveOn
                ? autoSaveStatus === 'pending' ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                : autoSaveStatus === 'saving' ? 'border-brand-500/40 bg-brand-500/10 text-brand-700 dark:text-brand-300'
                : autoSaveStatus === 'saved'  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                :                                'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400'
                : 'border-border bg-card text-muted-foreground'
            }`}>
            {autoSaveStatus === 'saving' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            {!autoSaveOn ? 'AUTO OFF' :
              autoSaveStatus === 'pending' ? 'modifications…' :
              autoSaveStatus === 'saving'  ? 'enregistrement…' :
              autoSaveStatus === 'saved'   ? 'enregistré ✓' :
                                              'auto-save'}
          </button>

          {/* Reset */}
          <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Réinitialiser</span>
          </Button>
        </div>
      </div>

      <div className={previewOpen ? 'grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]' : ''}>
        {/* ── LEFT: form ─────────────────────────────────────────────── */}
        <div className="space-y-6 min-w-0">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-muted-foreground text-sm">Personnalisez ce que les visiteurs voient sur <code className="text-xs">/</code>.</p>
          </div>
          <div className="flex gap-2">
            <a href={process.env.NEXT_PUBLIC_FRONTOFFICE_URL ?? 'http://localhost:3000'} target="_blank" rel="noopener noreferrer"
              className="inline-flex h-9 items-center justify-center rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium hover:bg-accent transition-colors">
              Aperçu →
            </a>
          </div>
        </motion.div>

        {/* ── Sections control panel: visibility + reorder + theme ──── */}
        <MagicCard className="p-6 space-y-4">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Palette className="h-4 w-4 text-brand-500" />Sections &amp; thème
          </h2>
          <p className="text-xs text-muted-foreground -mt-2">
            Activez / désactivez chaque section et réorganisez l'ordre d'affichage. Les sections désactivées sont masquées sur la page publique.
          </p>

          {/* Theme colors */}
          <div className="grid sm:grid-cols-2 gap-4 rounded-xl border border-border bg-muted/20 p-3">
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase block mb-1">Couleur primaire</label>
              <div className="flex gap-2">
                <input type="color" value={page.primaryColor ?? '#FF6A00'}
                  onChange={(e) => set('primaryColor', e.target.value)}
                  className="h-10 w-12 rounded-lg border border-input cursor-pointer" />
                <Input value={page.primaryColor ?? ''} placeholder="#FF6A00"
                  onChange={(e) => set('primaryColor', e.target.value)} className="font-mono" />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase block mb-1">Couleur accent (dégradé)</label>
              <div className="flex gap-2">
                <input type="color" value={page.accentColor ?? '#9333EA'}
                  onChange={(e) => set('accentColor', e.target.value)}
                  className="h-10 w-12 rounded-lg border border-input cursor-pointer" />
                <Input value={page.accentColor ?? ''} placeholder="#9333EA"
                  onChange={(e) => set('accentColor', e.target.value)} className="font-mono" />
              </div>
            </div>
          </div>

          {/* Section list with toggle + reorder */}
          <div className="space-y-1.5">
            {sectionOrder.map((id, i) => {
              const meta = SECTION_META[id]
              if (!meta) return null
              const Icon = meta.icon
              const visible = page[meta.flag] !== false  // default true if undefined
              return (
                <div key={id} className={`flex items-center gap-2 rounded-xl border bg-card p-2 transition-colors ${visible ? 'border-border' : 'border-dashed border-muted-foreground/30 opacity-60'}`}>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">#{i + 1}</span>
                  <Icon className="h-4 w-4 text-brand-500 shrink-0" />
                  <span className="flex-1 text-sm font-semibold text-foreground">{meta.label}</span>
                  <button type="button" onClick={() => moveSection(id, -1)} disabled={i === 0} title="Monter"
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:border-brand-400 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <button type="button" onClick={() => moveSection(id, 1)} disabled={i === sectionOrder.length - 1} title="Descendre"
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:border-brand-400 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                    <ChevronDown className="h-3 w-3" />
                  </button>
                  <button type="button" onClick={() => toggleSection(meta.flag)} title={visible ? 'Masquer' : 'Afficher'}
                    className={`flex h-7 w-7 items-center justify-center rounded-md border transition-colors ${visible
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20'
                      : 'border-border bg-background text-muted-foreground hover:border-brand-400'}`}>
                    {visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  </button>
                </div>
              )
            })}
          </div>
        </MagicCard>

        {/* ── Hero ────────────────────────────────────────────────────── */}
        <MagicCard className="p-6 space-y-4 scroll-mt-20 transition-shadow" data-edit-section="hero">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-500" />Section Hero
            <span className="ml-auto flex gap-1.5">
              <ScrollToPreviewButton section="hero" onScroll={scrollPreviewTo} />
              <AiButton section="hero" suggest={aiSuggest} />
            </span>
          </h2>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Badge (au-dessus du titre)</label>
            <Input value={page.heroBadge ?? ''} placeholder="Plateforme d'incubation propulsée par l'IA"
              onChange={(e) => set('heroBadge', e.target.value)} />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Titre principal</label>
            <Input value={page.heroTitle ?? ''} placeholder="Incubez vos idées avec l'intelligence artificielle"
              onChange={(e) => set('heroTitle', e.target.value)} />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Sous-titre</label>
            <textarea rows={2} value={page.heroSubtitle ?? ''}
              onChange={(e) => set('heroSubtitle', e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none" />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">CTA principal — Libellé</label>
              <Input value={page.primaryCtaLabel ?? ''} onChange={(e) => set('primaryCtaLabel', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">CTA principal — Lien</label>
              <Input value={page.primaryCtaLink ?? ''} onChange={(e) => set('primaryCtaLink', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">CTA secondaire — Libellé</label>
              <Input value={page.secondaryCtaLabel ?? ''} onChange={(e) => set('secondaryCtaLabel', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">CTA secondaire — Lien</label>
              <Input value={page.secondaryCtaLink ?? ''} onChange={(e) => set('secondaryCtaLink', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Image héros (optionnelle — apparaît en arrière-plan)</label>
            <ImageUpload value={page.heroImageUrl} folder="hero" previewHeight={120}
              onChange={(url) => set('heroImageUrl', url)} />
          </div>
        </MagicCard>

        {/* ── Stats ───────────────────────────────────────────────────── */}
        <MagicCard className="p-6 space-y-4 scroll-mt-20 transition-shadow" data-edit-section="stats">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Award className="h-4 w-4 text-brand-500" />Chiffres clés
            </h2>
            <div className="flex items-center gap-1.5">
              <ScrollToPreviewButton section="stats" onScroll={scrollPreviewTo} />
              <AiButton section="stats" suggest={aiSuggest} />
              <Button type="button" variant="outline" size="sm" onClick={addStat} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />Ajouter
              </Button>
            </div>
          </div>
          {(page.stats ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Aucune statistique. Ajoutez-en pour les afficher en bandeau animé.</p>
          ) : (
            <div className="space-y-2">
              {(page.stats ?? []).map((s, i) => (
                <div key={i} className="grid grid-cols-12 gap-3 items-end rounded-xl border border-border bg-muted/20 p-3">
                  <div className="col-span-12 sm:col-span-5">
                    <label className="text-[10px] font-medium text-muted-foreground uppercase block mb-1">Libellé</label>
                    <Input value={s.label ?? ''} onChange={(e) => updateStat(i, { label: e.target.value })} />
                  </div>
                  <div className="col-span-5 sm:col-span-3">
                    <label className="text-[10px] font-medium text-muted-foreground uppercase block mb-1">Valeur</label>
                    <Input type="number" value={s.value ?? ''}
                      onChange={(e) => updateStat(i, { value: e.target.value ? Number(e.target.value) : 0 })} />
                  </div>
                  <div className="col-span-3 sm:col-span-2">
                    <label className="text-[10px] font-medium text-muted-foreground uppercase block mb-1">Suffixe</label>
                    <Input value={s.suffix ?? ''} placeholder="+" onChange={(e) => updateStat(i, { suffix: e.target.value })} />
                  </div>
                  <div className="col-span-4 sm:col-span-2 flex items-center justify-end gap-1">
                    <button type="button" onClick={() => moveStat(i, -1)} disabled={i === 0} title="Monter"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:border-brand-400 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => moveStat(i, 1)} disabled={i === (page.stats ?? []).length - 1} title="Descendre"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:border-brand-400 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => removeStat(i)} title="Supprimer"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:border-destructive hover:text-destructive hover:bg-destructive/5 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </MagicCard>

        {/* ── Features ────────────────────────────────────────────────── */}
        <MagicCard className="p-6 space-y-4 scroll-mt-20 transition-shadow" data-edit-section="features">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Target className="h-4 w-4 text-brand-500" />Fonctionnalités mises en avant
            </h2>
            <div className="flex items-center gap-1.5">
              <ScrollToPreviewButton section="features" onScroll={scrollPreviewTo} />
              <AiButton section="features" suggest={aiSuggest} />
              <Button type="button" variant="outline" size="sm" onClick={addFeature} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />Ajouter
              </Button>
            </div>
          </div>
          {(page.features ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Aucune fonctionnalité.</p>
          ) : (
            <div className="space-y-3">
              {(page.features ?? []).map((f, i) => (
                <div key={i} className="rounded-xl border border-border bg-muted/20 p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-bold text-brand-700 dark:text-brand-300">#{i + 1}</span>
                    <div className="flex-1" />
                    <button type="button" onClick={() => moveFeature(i, -1)} disabled={i === 0} title="Monter"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:border-brand-400 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => moveFeature(i, 1)} disabled={i === (page.features ?? []).length - 1} title="Descendre"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:border-brand-400 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => removeFeature(i)} title="Supprimer"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:border-destructive hover:text-destructive hover:bg-destructive/5 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground uppercase">Titre</label>
                      <Input value={f.title ?? ''} onChange={(e) => updateFeature(i, { title: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground uppercase">Icône</label>
                      <select value={f.icon ?? 'Sparkles'} onChange={(e) => updateFeature(i, { icon: e.target.value })}
                        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm">
                        {AVAILABLE_ICONS.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground uppercase">Description</label>
                    <textarea rows={2} value={f.description ?? ''}
                      onChange={(e) => updateFeature(i, { description: e.target.value })}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground uppercase mb-1 block">Image (remplace l'icône)</label>
                    <ImageUpload value={f.imageUrl} folder="features" previewHeight={60} compact
                      onChange={(url) => updateFeature(i, { imageUrl: url })} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </MagicCard>

        {/* ── About ─────────────────────────────────────────────────── */}
        <MagicCard className="p-6 space-y-4 scroll-mt-20 transition-shadow" data-edit-section="about">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Info className="h-4 w-4 text-brand-500" />Section « À propos »
            <span className="ml-auto flex gap-1.5">
              <ScrollToPreviewButton section="about" onScroll={scrollPreviewTo} />
              <AiButton section="about" suggest={aiSuggest} />
            </span>
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Badge (au-dessus du titre)</label>
              <Input value={page.aboutBadge ?? ''} placeholder="Notre mission"
                onChange={(e) => set('aboutBadge', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Titre</label>
              <Input value={page.aboutTitle ?? ''} placeholder="Accélérer l'innovation tunisienne"
                onChange={(e) => set('aboutTitle', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Corps du texte</label>
            <textarea rows={5} value={page.aboutBody ?? ''}
              onChange={(e) => set('aboutBody', e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-y" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Image (affichée à droite du texte)</label>
            <ImageUpload value={page.aboutImageUrl} folder="about" previewHeight={140}
              onChange={(url) => set('aboutImageUrl', url)} />
          </div>
        </MagicCard>

        {/* ── Process / Timeline ────────────────────────────────────── */}
        <MagicCard className="p-6 space-y-4 scroll-mt-20 transition-shadow" data-edit-section="process">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-brand-500" />Étapes du processus
            </h2>
            <div className="flex items-center gap-1.5">
              <ScrollToPreviewButton section="process" onScroll={scrollPreviewTo} />
              <AiButton section="process" suggest={aiSuggest} />
              <Button type="button" variant="outline" size="sm" onClick={steps.add} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />Ajouter
              </Button>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Titre de la section</label>
              <Input value={page.processTitle ?? ''} placeholder="Comment ça marche"
                onChange={(e) => set('processTitle', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Sous-titre</label>
              <Input value={page.processSubtitle ?? ''} placeholder="4 étapes simples"
                onChange={(e) => set('processSubtitle', e.target.value)} />
            </div>
          </div>
          {steps.arr.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Aucune étape. Ajoutez-en pour décrire le parcours candidat.</p>
          ) : (
            <div className="space-y-3">
              {steps.arr.map((s, i) => (
                <div key={i} className="rounded-xl border border-border bg-muted/20 p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-bold text-brand-700 dark:text-brand-300">Étape {i + 1}</span>
                    <div className="flex-1" />
                    <button type="button" onClick={() => steps.move(i, -1)} disabled={i === 0}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:border-brand-400 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => steps.move(i, 1)} disabled={i === steps.arr.length - 1}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:border-brand-400 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => steps.remove(i)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:border-destructive hover:text-destructive hover:bg-destructive/5 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-medium text-muted-foreground uppercase">Titre</label>
                      <Input value={s.title ?? ''} onChange={(e) => steps.update(i, { title: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground uppercase">Icône</label>
                      <select value={s.icon ?? 'FileText'} onChange={(e) => steps.update(i, { icon: e.target.value })}
                        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm">
                        {AVAILABLE_ICONS.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground uppercase">Description</label>
                    <textarea rows={2} value={s.description ?? ''}
                      onChange={(e) => steps.update(i, { description: e.target.value })}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </MagicCard>

        {/* ── Testimonials ──────────────────────────────────────────── */}
        <MagicCard className="p-6 space-y-4 scroll-mt-20 transition-shadow" data-edit-section="testimonials">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <MessageSquareQuote className="h-4 w-4 text-brand-500" />Témoignages
            </h2>
            <div className="flex items-center gap-1.5">
              <ScrollToPreviewButton section="testimonials" onScroll={scrollPreviewTo} />
              <AiButton section="testimonials" suggest={aiSuggest} />
              <Button type="button" variant="outline" size="sm" onClick={testimonials.add} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />Ajouter
              </Button>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Titre de la section</label>
            <Input value={page.testimonialsTitle ?? ''} placeholder="Ils nous font confiance"
              onChange={(e) => set('testimonialsTitle', e.target.value)} />
          </div>
          {testimonials.arr.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Aucun témoignage. Ajoutez-en pour gagner la confiance des visiteurs.</p>
          ) : (
            <div className="space-y-3">
              {testimonials.arr.map((t, i) => (
                <div key={i} className="rounded-xl border border-border bg-muted/20 p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-bold text-brand-700 dark:text-brand-300">#{i + 1}</span>
                    <div className="flex-1" />
                    <button type="button" onClick={() => testimonials.move(i, -1)} disabled={i === 0}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:border-brand-400 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => testimonials.move(i, 1)} disabled={i === testimonials.arr.length - 1}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:border-brand-400 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => testimonials.remove(i)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:border-destructive hover:text-destructive hover:bg-destructive/5 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground uppercase">Citation</label>
                    <textarea rows={3} value={t.quote ?? ''}
                      onChange={(e) => testimonials.update(i, { quote: e.target.value })}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none" />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground uppercase">Nom</label>
                      <Input value={t.authorName ?? ''} placeholder="Asma B."
                        onChange={(e) => testimonials.update(i, { authorName: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground uppercase">Rôle</label>
                      <Input value={t.authorRole ?? ''} placeholder="Cofondatrice, FoodStart"
                        onChange={(e) => testimonials.update(i, { authorRole: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground uppercase mb-1 block">Photo (optionnelle)</label>
                    <ImageUpload value={t.photoUrl} folder="testimonials" previewHeight={50} compact
                      onChange={(url) => testimonials.update(i, { photoUrl: url })} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </MagicCard>

        {/* ── FAQ ───────────────────────────────────────────────────── */}
        <MagicCard className="p-6 space-y-4 scroll-mt-20 transition-shadow" data-edit-section="faq">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-brand-500" />Questions fréquentes
            </h2>
            <div className="flex items-center gap-1.5">
              <ScrollToPreviewButton section="faq" onScroll={scrollPreviewTo} />
              <AiButton section="faq" suggest={aiSuggest} />
              <Button type="button" variant="outline" size="sm" onClick={faqs.add} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />Ajouter
              </Button>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Titre de la section</label>
            <Input value={page.faqTitle ?? ''} placeholder="Questions fréquentes"
              onChange={(e) => set('faqTitle', e.target.value)} />
          </div>
          {faqs.arr.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Aucune question. Anticipez les hésitations des candidats.</p>
          ) : (
            <div className="space-y-3">
              {faqs.arr.map((f, i) => (
                <div key={i} className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-bold text-brand-700 dark:text-brand-300">Q{i + 1}</span>
                    <div className="flex-1" />
                    <button type="button" onClick={() => faqs.move(i, -1)} disabled={i === 0}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:border-brand-400 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => faqs.move(i, 1)} disabled={i === faqs.arr.length - 1}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:border-brand-400 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => faqs.remove(i)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:border-destructive hover:text-destructive hover:bg-destructive/5 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground uppercase">Question</label>
                    <Input value={f.question ?? ''} onChange={(e) => faqs.update(i, { question: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground uppercase">Réponse</label>
                    <textarea rows={3} value={f.answer ?? ''}
                      onChange={(e) => faqs.update(i, { answer: e.target.value })}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </MagicCard>

        {/* ── Programmes section ────────────────────────────────────── */}
        <MagicCard className="p-6 space-y-4 scroll-mt-20 transition-shadow" data-edit-section="programmes">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Rocket className="h-4 w-4 text-brand-500" />Section « Programmes ouverts »
            <span className="ml-auto flex items-center gap-1.5">
              <ScrollToPreviewButton section="programmes" onScroll={scrollPreviewTo} />
              <span className="text-[10px] font-normal text-muted-foreground">
                Dynamique
              </span>
            </span>
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Titre</label>
              <Input value={page.programmesTitle ?? ''} placeholder="Programmes ouverts"
                onChange={(e) => set('programmesTitle', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Sous-titre</label>
              <Input value={page.programmesSubtitle ?? ''} placeholder="Candidatez dès maintenant"
                onChange={(e) => set('programmesSubtitle', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Nombre max de programmes à afficher ({page.programmesLimit ?? 6})
            </label>
            <input type="range" min={1} max={12} step={1}
              value={page.programmesLimit ?? 6}
              onChange={(e) => set('programmesLimit', Number(e.target.value))}
              className="w-full accent-brand-500" />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>1</span><span>6 (défaut)</span><span>12</span>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground italic">
            💡 Les cartes elles-mêmes sont générées automatiquement depuis les programmes ouverts.
            Pour changer leur contenu, va dans <strong>Programmes</strong> dans la barre latérale.
          </p>
        </MagicCard>

        {/* ── CTA band ──────────────────────────────────────────────── */}
        <MagicCard className="p-6 space-y-4 scroll-mt-20 transition-shadow" data-edit-section="cta">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Rocket className="h-4 w-4 text-brand-500" />Bandeau d'appel à l'action (bas de page)
            <span className="ml-auto flex gap-1.5">
              <ScrollToPreviewButton section="cta" onScroll={scrollPreviewTo} />
              <AiButton section="cta" suggest={aiSuggest} />
            </span>
          </h2>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Titre</label>
            <Input value={page.ctaTitle ?? ''} onChange={(e) => set('ctaTitle', e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Sous-titre</label>
            <Input value={page.ctaSubtitle ?? ''} onChange={(e) => set('ctaSubtitle', e.target.value)} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Libellé du bouton</label>
              <Input value={page.ctaButtonLabel ?? ''} onChange={(e) => set('ctaButtonLabel', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Lien du bouton</label>
              <Input value={page.ctaButtonLink ?? ''} onChange={(e) => set('ctaButtonLink', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Texte du pied de page</label>
            <Input value={page.footerText ?? ''} onChange={(e) => set('footerText', e.target.value)} />
          </div>
        </MagicCard>

        </div>
        {/* ── RIGHT: live preview pane ─────────────────────────────── */}
        {previewOpen && (
          <div className="hidden lg:block">
            <PreviewPane
              url={previewUrl}
              bump={previewBump}
              device={device}
              userZoom={userZoom}
              onReload={() => setPreviewBump((n) => n + 1)}
            />
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
