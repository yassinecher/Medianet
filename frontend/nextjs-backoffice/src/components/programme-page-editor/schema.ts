import {
  BarChart3, CheckCircle2, FileText, Handshake, HelpCircle, Images, LayoutGrid, LayoutTemplate,
  Megaphone, MessageSquareQuote, PlayCircle, Route, Scale, Sparkles, Target, Users, GalleryHorizontal,
} from 'lucide-react'
import { BLOCK_CATALOG } from '@/components/landing-editor/schema'
import type { PickerEntry } from '@/components/landing-editor/BlockPicker'

/**
 * Public programme page (« Page publique » builder) — mirrors the front-office
 * renderer (nextjs-frontoffice/src/lib/programmePage.ts) and is stored as
 * `programme.pageJson`.
 *
 * Bound blocks display the programme's own data; their CONTENT is edited here
 * but saved into the programme's fields (description, objectives, gallery…),
 * so the rest of the platform (cards, presentation studio) sees the same data.
 * Free blocks carry their content and reuse the landing-page editors.
 */

export type ProgrammeBlockType =
  | 'about' | 'highlights' | 'audience' | 'objectives' | 'journey' | 'benefits'
  | 'gallery' | 'criteria' | 'partners' | 'apply'
  | 'video' | 'media' | 'features' | 'testimonials' | 'faq' | 'cta'

export interface ProgrammeBlock { id: string; type: ProgrammeBlockType; visible?: boolean; data: Record<string, any> }

export interface ProgrammeHeroSettings {
  style?: 'image' | 'gradient'
  height?: 'compact' | 'tall'
  showFacts?: boolean
  ctaLabel?: string
  secondaryLabel?: string
}

export interface ProgrammePage { version?: number; hero?: ProgrammeHeroSettings; blocks: ProgrammeBlock[] }

/** Programme fields this editor can change (saved with the layout, only when changed). */
export interface PageFields {
  title: string
  tagline: string
  description: string
  logoUrl: string
  bannerImageUrl: string
  location: string
  maxStartups: number
  expertCount: number
  trainingSessionsCount: number
  mentoringHoursPerMonth: number
  objectives: string[]
  benefits: string[]
  galleryUrls: string[]
}

export function fieldsOf(p: Record<string, any>): PageFields {
  return {
    title: p.title ?? p.name ?? '',
    tagline: p.tagline ?? '',
    description: p.description ?? '',
    logoUrl: p.logoUrl ?? '',
    bannerImageUrl: p.bannerImageUrl ?? '',
    location: p.location ?? '',
    maxStartups: p.maxStartups ?? 0,
    expertCount: p.expertCount ?? 0,
    trainingSessionsCount: p.trainingSessionsCount ?? 0,
    mentoringHoursPerMonth: p.mentoringHoursPerMonth ?? 0,
    objectives: p.objectives ?? [],
    benefits: p.benefits ?? [],
    galleryUrls: p.galleryUrls ?? [],
  }
}

export const HERO_ID = '__hero__'

/** Types handled by the landing-page block editor / renderer. */
export const LANDING_TYPES: ReadonlySet<string> = new Set(['media', 'features', 'testimonials', 'faq', 'cta'])

/** Bound blocks: one per page (their data is the programme's). */
export const SINGLE_TYPES: ReadonlySet<string> = new Set([
  'about', 'highlights', 'audience', 'objectives', 'journey', 'benefits', 'gallery', 'criteria', 'partners', 'apply',
])

export const BLOCK_META: Record<ProgrammeBlockType, { label: string; icon: any }> = {
  about:        { label: 'À propos',            icon: FileText },
  highlights:   { label: 'Chiffres clés',       icon: BarChart3 },
  audience:     { label: 'Pour qui ?',          icon: Users },
  objectives:   { label: 'Objectifs',           icon: Target },
  journey:      { label: 'Le parcours',         icon: Route },
  benefits:     { label: 'Avantages',           icon: CheckCircle2 },
  gallery:      { label: 'Retour en images',    icon: Images },
  criteria:     { label: 'Critères de sélection', icon: Scale },
  partners:     { label: 'Partenaires',         icon: Handshake },
  apply:        { label: 'Bandeau « Candidater »', icon: Sparkles },
  video:        { label: 'Vidéo',               icon: PlayCircle },
  media:        { label: 'Texte & photos',      icon: LayoutTemplate },
  features:     { label: 'Points forts',        icon: LayoutGrid },
  testimonials: { label: 'Témoignages',         icon: MessageSquareQuote },
  faq:          { label: 'FAQ',                 icon: HelpCircle },
  cta:          { label: 'Bouton d’action',     icon: Megaphone },
}

export const DEFAULT_APPLY_SUBTITLE =
  'Rejoignez « {programme} » et bénéficiez d’un accompagnement sur mesure pour concrétiser votre startup.'

/** Default data of each bound block (same as the front-office default layout). */
const BOUND_DEFAULTS: Record<string, () => Record<string, any>> = {
  about: () => ({ eyebrow: 'Le programme', title: 'À propos du programme' }),
  highlights: () => ({ eyebrow: 'En chiffres', title: '' }),
  audience: () => ({ eyebrow: 'Pour qui ?', title: 'Secteurs ciblés' }),
  objectives: () => ({ eyebrow: 'Objectifs', title: 'Ce que vise le programme', layout: 'cards' }),
  journey: () => ({ eyebrow: 'Le parcours', title: 'Étape par étape', showPhotos: true }),
  benefits: () => ({ eyebrow: 'Avantages', title: 'Ce que vous gagnez' }),
  gallery: () => ({ eyebrow: 'En images', title: 'Retour en images', layout: 'grid' }),
  criteria: () => ({ eyebrow: 'Sélection', title: 'Critères de sélection' }),
  partners: () => ({ eyebrow: 'Écosystème', title: 'Nos partenaires' }),
  apply: () => ({ title: 'Prêt à faire décoller votre projet ?', subtitle: DEFAULT_APPLY_SUBTITLE, buttonLabel: 'Rejoindre le programme' }),
}

export function defaultProgrammePage(): ProgrammePage {
  return {
    version: 1,
    hero: { style: 'image', height: 'tall', showFacts: true, ctaLabel: 'Rejoindre le programme', secondaryLabel: 'Découvrir le parcours' },
    blocks: (['about', 'highlights', 'audience', 'objectives', 'journey', 'benefits', 'gallery', 'criteria', 'partners', 'apply'] as const)
      .map((type) => ({ id: type, type, visible: true, data: BOUND_DEFAULTS[type]() })),
  }
}

export function parseProgrammePage(json?: string | null): ProgrammePage {
  if (json) {
    try {
      const p = JSON.parse(json)
      if (p && Array.isArray(p.blocks)) return { ...p, blocks: p.blocks.filter((b: any) => b && b.id && b.type) }
    } catch { /* fall through */ }
  }
  return defaultProgrammePage()
}

export interface ProgrammeCatalogEntry extends PickerEntry { type: ProgrammeBlockType }

const landingEntry = (key: string) => BLOCK_CATALOG.find((e) => e.key === key)!

export const PROGRAMME_CATALOG: ProgrammeCatalogEntry[] = [
  ...(['about', 'highlights', 'audience', 'objectives', 'journey', 'benefits', 'gallery', 'criteria', 'partners', 'apply'] as const).map((type) => ({
    key: type, type, single: true, group: 'Contenu du programme',
    label: BLOCK_META[type].label, icon: BLOCK_META[type].icon, create: BOUND_DEFAULTS[type],
    description: {
      about: 'La description du programme, avec photo(s) optionnelle(s).',
      highlights: 'Startups sélectionnées, experts, sessions, mentorat… en grands chiffres.',
      audience: 'Les secteurs ciblés et un texte « à qui s’adresse le programme ».',
      objectives: 'Les objectifs, en cartes numérotées ou en liste.',
      journey: 'La frise des sessions du parcours (automatique), avec leurs photos.',
      benefits: 'Ce que les startups gagnent à rejoindre le programme.',
      gallery: 'Les photos du programme (et des sessions), en mosaïque ou carrousel.',
      criteria: 'Les critères de sélection et leur poids (automatique).',
      partners: 'Le mur de logos des partenaires du programme (automatique).',
      apply: 'Grand bandeau pour candidater, affiché pendant les candidatures.',
    }[type],
  })),
  { key: 'video', type: 'video', group: 'Sections libres', label: 'Vidéo', icon: PlayCircle,
    description: 'Une vidéo YouTube ou Vimeo (présentation, aftermovie, témoignage…).',
    create: () => ({ eyebrow: 'En vidéo', title: 'Le programme en vidéo', url: '' }) },
  { ...landingEntry('media-text'), type: 'media', group: 'Sections libres' },
  { ...landingEntry('media-carousel'), type: 'media', group: 'Sections libres' },
  { ...landingEntry('media-gallery'), type: 'media', group: 'Sections libres', label: 'Galerie libre', icon: GalleryHorizontal,
    description: 'Une autre mosaïque de photos, avec légendes (ex. une édition précédente).' },
  { ...landingEntry('features'), type: 'features', group: 'Sections libres' },
  { ...landingEntry('testimonials'), type: 'testimonials', group: 'Sections libres',
    create: () => ({ title: 'Ils ont suivi le programme', items: [{ quote: '', authorName: '', authorRole: '' }] }) },
  { ...landingEntry('faq'), type: 'faq', group: 'Sections libres' },
  { ...landingEntry('cta'), type: 'cta', group: 'Sections libres', label: 'Bouton d’action',
    description: 'Bandeau avec un bouton vers un lien (brochure, inscription à un événement…).',
    create: () => ({ background: 'dark', title: 'Envie d’en savoir plus ?', buttonLabel: 'Télécharger la brochure', buttonLink: '' }) },
]

/** Outline title: the block's own title, else its type label. */
export function blockTitle(b: ProgrammeBlock): string {
  const t = (b.data?.title ?? '').toString().trim()
  return t || BLOCK_META[b.type]?.label || b.type
}

export const newBlockId = () => 'b' + Math.random().toString(36).slice(2, 10)
