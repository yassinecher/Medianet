import {
  Sparkles, BarChart3, LayoutGrid, LayoutTemplate, Images, GalleryHorizontal, ListChecks,
  Rocket, MessageSquareQuote, HelpCircle, Megaphone,
} from 'lucide-react'

/**
 * Landing page document edited in the back-office. Mirrors programme-service
 * `LandingPageDto` / `LandingBlock` and the front-office renderer
 * (nextjs-frontoffice/src/lib/landingBlocks.ts).
 */

export type BlockType =
  | 'hero' | 'stats' | 'features' | 'media' | 'process'
  | 'programmes' | 'testimonials' | 'faq' | 'cta'

export type BlockBackground = 'default' | 'muted' | 'dark'

export interface LandingBlock {
  id: string
  type: BlockType
  visible?: boolean
  data: Record<string, any>
}

export interface LandingDoc {
  blocks: LandingBlock[]
  logoUrl?: string
  primaryColor?: string
  accentColor?: string
  siteThemeMode?: 'default' | 'same' | 'custom'
  sitePrimaryColor?: string
  siteAccentColor?: string
  footerText?: string
  version?: number
  publishedAt?: string
}

export const ICON_NAMES = [
  'Sparkles', 'Target', 'Users', 'Globe2', 'Award', 'Rocket', 'Heart', 'Brain', 'Star', 'Zap',
  'FileText', 'ClipboardCheck', 'Lightbulb', 'Trophy', 'Search',
]

/** Per-type presentation + the legacy AI section it can be generated from. */
export const BLOCK_TYPES: Record<BlockType, { label: string; icon: any; ai?: string }> = {
  hero:         { label: 'Bannière (hero)',     icon: Sparkles,           ai: 'hero' },
  stats:        { label: 'Chiffres clés',       icon: BarChart3,          ai: 'stats' },
  features:     { label: 'Points forts',        icon: LayoutGrid,         ai: 'features' },
  media:        { label: 'Texte & photos',      icon: LayoutTemplate,     ai: 'about' },
  process:      { label: 'Étapes',              icon: ListChecks,         ai: 'process' },
  programmes:   { label: 'Programmes ouverts',  icon: Rocket },
  testimonials: { label: 'Témoignages',         icon: MessageSquareQuote, ai: 'testimonials' },
  faq:          { label: 'FAQ',                 icon: HelpCircle,         ai: 'faq' },
  cta:          { label: 'Appel à l’action',    icon: Megaphone,          ai: 'cta' },
}

/** One entry of the "Ajouter un bloc" catalog (media has three presets). */
export interface CatalogEntry {
  key: string
  type: BlockType
  label: string
  description: string
  icon: any
  create: () => Record<string, any>
}

export const BLOCK_CATALOG: CatalogEntry[] = [
  { key: 'hero', type: 'hero', label: 'Bannière (hero)', icon: Sparkles,
    description: 'Grand titre d’accueil avec boutons et photos d’arrière-plan défilantes.',
    create: () => ({ title: 'Votre titre accrocheur', subtitle: 'Une phrase qui explique votre proposition.', primaryCtaLabel: 'Déposer ma candidature', primaryCtaLink: '/register', images: [] }) },
  { key: 'media-text', type: 'media', label: 'Texte + photo', icon: LayoutTemplate,
    description: 'Un paragraphe à côté d’une photo (plusieurs photos = mini-carrousel).',
    create: () => ({ layout: 'text-image', imagePosition: 'right', title: 'Nouvelle section', body: '', images: [] }) },
  { key: 'media-gallery', type: 'media', label: 'Galerie photos', icon: Images,
    description: 'Mosaïque de photos, agrandissables au clic.',
    create: () => ({ layout: 'gallery', title: 'Retour en images', images: [] }) },
  { key: 'media-carousel', type: 'media', label: 'Carrousel photos', icon: GalleryHorizontal,
    description: 'Photos défilantes avec flèches et légendes.',
    create: () => ({ layout: 'carousel', title: 'En images', images: [] }) },
  { key: 'stats', type: 'stats', label: 'Chiffres clés', icon: BarChart3,
    description: 'Compteurs animés (programmes, startups, taux de réussite…).',
    create: () => ({ background: 'muted', items: [{ label: 'Startups incubées', value: 100, suffix: '+' }] }) },
  { key: 'features', type: 'features', label: 'Points forts', icon: LayoutGrid,
    description: 'Cartes avec icône ou photo, titre et description.',
    create: () => ({ title: 'Pourquoi nous choisir', items: [{ icon: 'Sparkles', title: 'Nouveau point fort', description: '' }] }) },
  { key: 'process', type: 'process', label: 'Étapes', icon: ListChecks,
    description: 'Parcours en étapes numérotées, avec photo optionnelle.',
    create: () => ({ background: 'muted', title: 'Comment ça marche', items: [{ icon: 'FileText', title: '1. Première étape', description: '' }] }) },
  { key: 'programmes', type: 'programmes', label: 'Programmes ouverts', icon: Rocket,
    description: 'Cartes des programmes ouverts (automatique) + carrousel photo optionnel.',
    create: () => ({ background: 'muted', title: 'Programmes ouverts', subtitle: 'Candidatez dès maintenant', limit: 6, images: [] }) },
  { key: 'testimonials', type: 'testimonials', label: 'Témoignages', icon: MessageSquareQuote,
    description: 'Citations de porteurs de projets ou partenaires, avec photo.',
    create: () => ({ title: 'Ils nous font confiance', items: [{ quote: '', authorName: '', authorRole: '' }] }) },
  { key: 'faq', type: 'faq', label: 'FAQ', icon: HelpCircle,
    description: 'Questions / réponses dépliables.',
    create: () => ({ background: 'muted', title: 'Questions fréquentes', items: [{ question: '', answer: '' }] }) },
  { key: 'cta', type: 'cta', label: 'Appel à l’action', icon: Megaphone,
    description: 'Bandeau avec titre et bouton (ex. « Commencer maintenant »).',
    create: () => ({ background: 'dark', title: 'Prêt à lancer votre projet ?', buttonLabel: 'Commencer maintenant', buttonLink: '/register' }) },
]

export const newBlockId = () => 'b' + Math.random().toString(36).slice(2, 10)

/** Deep copy with a fresh id (used by "Dupliquer"). */
export function cloneBlock(b: LandingBlock): LandingBlock {
  return { ...structuredClone(b), id: newBlockId() }
}

/** Name shown in the outline: the block's own title when it has one. */
export function blockTitle(b: LandingBlock): string {
  const t = (b.data?.title ?? '').toString().trim()
  return t || BLOCK_TYPES[b.type]?.label || b.type
}

export function mediaLayoutLabel(layout?: string) {
  return layout === 'gallery' ? 'Galerie' : layout === 'carousel' ? 'Carrousel' : 'Texte + photo'
}

/**
 * The admin-ai "landing-suggest" endpoint answers with the legacy flat fields
 * (heroTitle, faqs, …); map them onto the data of the block being edited.
 */
export function mapAiSuggestion(type: BlockType, r: Record<string, any>): Record<string, any> {
  const pick = (map: Record<string, string>) =>
    Object.fromEntries(Object.entries(map).filter(([k]) => r[k] !== undefined).map(([k, v]) => [v, r[k]]))
  switch (type) {
    case 'hero': return pick({ heroBadge: 'badge', heroTitle: 'title', heroSubtitle: 'subtitle',
      primaryCtaLabel: 'primaryCtaLabel', secondaryCtaLabel: 'secondaryCtaLabel' })
    case 'stats': return pick({ stats: 'items' })
    case 'features': return pick({ features: 'items' })
    case 'media': return pick({ aboutBadge: 'badge', aboutTitle: 'title', aboutBody: 'body' })
    case 'process': return pick({ processTitle: 'title', processSubtitle: 'subtitle', processSteps: 'items' })
    case 'testimonials': return pick({ testimonialsTitle: 'title', testimonials: 'items' })
    case 'faq': return pick({ faqTitle: 'title', faqs: 'items' })
    case 'cta': return pick({ ctaTitle: 'title', ctaSubtitle: 'subtitle', ctaButtonLabel: 'buttonLabel' })
    default: return {}
  }
}
