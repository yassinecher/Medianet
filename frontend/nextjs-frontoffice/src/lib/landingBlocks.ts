/**
 * Landing page document: an ordered list of typed blocks + site settings.
 * Mirrors programme-service `LandingPageDto` / `LandingBlock` (and the editor's
 * copy in the back-office). A block type may appear any number of times.
 */

export type BlockType =
  | 'hero' | 'stats' | 'features' | 'media' | 'process'
  | 'programmes' | 'testimonials' | 'faq' | 'cta'

export type BlockBackground = 'default' | 'muted' | 'dark'

export interface LandingImage { url?: string; caption?: string }

export interface HeroData {
  badge?: string; title?: string; subtitle?: string
  primaryCtaLabel?: string; primaryCtaLink?: string
  secondaryCtaLabel?: string; secondaryCtaLink?: string
  /** Background photos (cross-faded when several). */
  images?: string[]
}
interface Section { background?: BlockBackground; title?: string; subtitle?: string }
export interface StatsData extends Section { items?: { label?: string; value?: number; suffix?: string }[] }
export interface FeaturesData extends Section { items?: { title?: string; description?: string; icon?: string; imageUrl?: string }[] }
export interface ProcessData extends Section { items?: { title?: string; description?: string; icon?: string; imageUrl?: string }[] }
export interface MediaData extends Section {
  layout?: 'text-image' | 'gallery' | 'carousel'
  badge?: string; body?: string
  imagePosition?: 'left' | 'right'
  ctaLabel?: string; ctaLink?: string
  images?: LandingImage[]
}
export interface ProgrammesData extends Section { limit?: number; images?: string[] }
export interface TestimonialsData extends Section { items?: { quote?: string; authorName?: string; authorRole?: string; photoUrl?: string }[] }
export interface FaqData extends Section { items?: { question?: string; answer?: string }[] }
export interface CtaData extends Section { buttonLabel?: string; buttonLink?: string }

export interface LandingBlock {
  id: string
  type: BlockType
  visible?: boolean
  data: any
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
}

/** Shown only if the API can't be reached — no invented figures. */
export const FALLBACK_DOC: LandingDoc = {
  blocks: [
    { id: 'hero', type: 'hero', visible: true, data: {
      badge: "Plateforme d'incubation",
      title: 'Incubez vos idées avec Medianet',
      subtitle: "Medianet Incubateur accompagne les porteurs de projets, de l'idée à la startup.",
      primaryCtaLabel: 'Déposer ma candidature', primaryCtaLink: '/register',
      secondaryCtaLabel: 'Explorer les programmes', secondaryCtaLink: '/programmes',
    } },
    { id: 'programmes', type: 'programmes', visible: true, data: { background: 'muted', title: 'Programmes ouverts', subtitle: 'Candidatez dès maintenant', limit: 6 } },
    { id: 'cta', type: 'cta', visible: true, data: { background: 'dark', title: 'Prêt à lancer votre projet ?', buttonLabel: 'Commencer maintenant', buttonLink: '/register' } },
  ],
  footerText: '© 2026 Medianet Incubateur. Tous droits réservés.',
}

/**
 * Whether a postMessage comes from the back-office editor that embeds this page
 * as its live preview. Only that origin may push draft content into the page.
 */
export function isEditorOrigin(origin: string): boolean {
  if (!origin || typeof window === 'undefined') return false
  const env = process.env.NEXT_PUBLIC_BACKOFFICE_URL
  try {
    if (env && new URL(env).origin === origin) return true
    const o = new URL(origin)
    const self = window.location
    if (o.protocol !== self.protocol) return false
    const local = (h: string) => h === 'localhost' || h === '127.0.0.1'
    if (local(o.hostname) && local(self.hostname)) return true // dev: any local port
    // Mirror of the back-office's frontofficeBase() host mapping.
    const candidates = [
      self.host.replace(/incubator(?=\.)/, 'incubatoradmin'), // medianetincubator.… → medianetincubatoradmin.…
      self.host.replace('frontoffice', 'backoffice'),
      self.host.replace(/(^|\.)app\./, '$1admin.'),
    ]
    return candidates.some((c) => c !== self.host && c === o.host)
  } catch {
    return false
  }
}
