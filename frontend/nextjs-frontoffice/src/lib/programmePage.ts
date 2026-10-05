/**
 * Public programme page layout (« Page publique » builder): hero options + an
 * ordered list of typed blocks, stored as `programme.pageJson`. Mirrors the
 * back-office editor (nextjs-backoffice/src/components/programme-page-editor/schema.ts).
 *
 * Two kinds of blocks:
 *  - bound blocks show the programme's own data (description, objectives,
 *    sessions, gallery…) — the JSON only keeps their titles and options;
 *  - free blocks (media, features, testimonials, faq, cta, video) carry their
 *    content and reuse the landing-page renderers.
 * Every type except the bound singletons may appear several times.
 */

export type ProgrammeBlockType =
  | 'about' | 'highlights' | 'audience' | 'objectives' | 'journey' | 'benefits'
  | 'gallery' | 'criteria' | 'partners' | 'apply'
  | 'video' | 'media' | 'features' | 'testimonials' | 'faq' | 'cta'

/** 'auto' alternates plain / tinted sections down the page. */
export type SectionBackground = 'auto' | 'default' | 'muted' | 'dark'

export interface ProgrammeBlock {
  id: string
  type: ProgrammeBlockType
  visible?: boolean
  data: any
}

export interface ProgrammeHeroSettings {
  /** 'image' = banner photo full-bleed (falls back to gradient without one). */
  style?: 'image' | 'gradient'
  height?: 'compact' | 'tall'
  /** Key-facts strip (dates, place, deadline, places) under the title. */
  showFacts?: boolean
  ctaLabel?: string
  /** Second button (scrolls to the journey); empty = hidden. */
  secondaryLabel?: string
}

export interface ProgrammePage {
  version?: number
  hero?: ProgrammeHeroSettings
  blocks: ProgrammeBlock[]
}

/** Id of the hero in the editor preview (it isn't a block). */
export const HERO_ID = '__hero__'

/** Blocks rendered by the landing-page renderer (same data shape). */
export const LANDING_TYPES: ReadonlySet<ProgrammeBlockType> = new Set(['media', 'features', 'testimonials', 'faq', 'cta'])

/** Short labels for the sticky in-page navigation. */
export const NAV_LABEL: Record<ProgrammeBlockType, string> = {
  about: 'À propos', highlights: 'Chiffres', audience: 'Pour qui ?', objectives: 'Objectifs',
  journey: 'Parcours', benefits: 'Avantages', gallery: 'Galerie', criteria: 'Critères',
  partners: 'Partenaires', apply: 'Candidater', video: 'Vidéo', media: 'Section',
  features: 'Points forts', testimonials: 'Témoignages', faq: 'FAQ', cta: 'Action',
}

export const DEFAULT_APPLY_SUBTITLE =
  'Rejoignez « {programme} » et bénéficiez d’un accompagnement sur mesure pour concrétiser votre startup.'

/** Layout used until an admin customises the page (same sections as before). */
export function defaultProgrammePage(): ProgrammePage {
  return {
    version: 1,
    hero: { style: 'image', height: 'tall', showFacts: true, ctaLabel: 'Rejoindre le programme', secondaryLabel: 'Découvrir le parcours' },
    blocks: [
      { id: 'about', type: 'about', visible: true, data: { eyebrow: 'Le programme', title: 'À propos du programme' } },
      { id: 'highlights', type: 'highlights', visible: true, data: { eyebrow: 'En chiffres', title: '' } },
      { id: 'audience', type: 'audience', visible: true, data: { eyebrow: 'Pour qui ?', title: 'Secteurs ciblés' } },
      { id: 'objectives', type: 'objectives', visible: true, data: { eyebrow: 'Objectifs', title: 'Ce que vise le programme', layout: 'cards' } },
      { id: 'journey', type: 'journey', visible: true, data: { eyebrow: 'Le parcours', title: 'Étape par étape', showPhotos: true } },
      { id: 'benefits', type: 'benefits', visible: true, data: { eyebrow: 'Avantages', title: 'Ce que vous gagnez' } },
      { id: 'gallery', type: 'gallery', visible: true, data: { eyebrow: 'En images', title: 'Retour en images', layout: 'grid' } },
      { id: 'criteria', type: 'criteria', visible: true, data: { eyebrow: 'Sélection', title: 'Critères de sélection' } },
      { id: 'partners', type: 'partners', visible: true, data: { eyebrow: 'Écosystème', title: 'Nos partenaires' } },
      { id: 'apply', type: 'apply', visible: true, data: { title: 'Prêt à faire décoller votre projet ?', subtitle: DEFAULT_APPLY_SUBTITLE, buttonLabel: 'Rejoindre le programme' } },
    ],
  }
}

/** The saved layout, or the default one when absent / unreadable. */
export function parseProgrammePage(json?: string | null): ProgrammePage {
  if (json) {
    try {
      const p = JSON.parse(json)
      if (p && Array.isArray(p.blocks)) return { ...p, blocks: p.blocks.filter((b: any) => b && b.id && b.type) }
    } catch { /* fall through */ }
  }
  return defaultProgrammePage()
}

/** Only http(s), mailto/tel and site-relative links are rendered as hrefs. */
export function safeHref(href?: string, fallback = '#'): string {
  const h = (href ?? '').trim()
  if (!h) return fallback
  if (h.startsWith('/') && !h.startsWith('//')) return h
  if (/^(https?:|mailto:|tel:)/i.test(h)) return h
  if (h.startsWith('#')) return h
  return fallback
}

/** YouTube / Vimeo link → privacy-friendly embed URL (null for anything else). */
export function videoEmbedUrl(url?: string): string | null {
  const u = (url ?? '').trim()
  if (!u) return null
  const yt = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0`
  const vm = u.match(/vimeo\.com\/(?:video\/)?(\d{6,12})/)
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`
  return null
}
