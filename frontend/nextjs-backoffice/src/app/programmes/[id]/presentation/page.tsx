'use client'
import {
  createContext, useCallback, useContext, useEffect, useLayoutEffect,
  useMemo, useRef, useState,
} from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, ArrowRight, Building2, Printer, X, Play, Download,
  Eye, EyeOff, RotateCcw, Palette, Pencil, Move, Facebook, Instagram, Linkedin,
  Type, AlignLeft, BadgePlus, ImagePlus, ExternalLink,
  Bold, Italic, AlignCenter, AlignRight,
  Undo2, Redo2, Plus, Copy, Trash2, Users, Sparkles, Loader2,
  Square, Circle as CircleIcon, Minus, MoveRight, Star, Triangle, FilePlus2,
  ChevronLeft, ChevronRight, Check, ChevronUp, ChevronDown,
  BringToFront, SendToBack, Camera,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { programmesApi, sessionsApi, canvaApi, adminAiApi, notificationsApi, filesApi } from '@/lib/api'
import { ImageUpload } from '@/components/upload/ImageUpload'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Studio de présentation v4 — Canva-like:
 * · plusieurs présentations par programme (assistant de création pas-à-pas
 *   avec sections, contributeurs par rôle et l'IA « Medi »)
 * · fixed 1280×720 canvas · tout bloc est déplaçable, REDIMENSIONNABLE,
 *   masquable (y compris le logo Medianet) · annuler/rétablir (Ctrl+Z / Ctrl+Y)
 * · galerie de formes + images (galeries programme/sessions, upload, recherche)
 * · fond par diapositive · diapositives vierges / dupliquer / supprimer
 * · numérotation automatique · présenter démarre sur la diapo courante
 * · export PPTX fidèle (styles, formes, échelles) + envoi Canva en un clic.
 */

const CW = 1280, CH = 720            // design canvas (px)
interface Session { id: number; title: string; startDate?: string; endDate?: string; color?: string; parentSessionId?: number | null; galleryUrls?: string[] }
const DOTS = ['#00AEEF', '#8DC63F', '#FFCB05', '#ED1C24']
const fmtD = (s?: string) => (s ? new Date(s.substring(0, 10) + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '')
const rid = () => Math.random().toString(36).slice(2, 9)
const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-')

// ── Themes (all speak the Medianet deck language; Nuit is the dark variant) ──
interface Theme {
  name: string; page: string; band: string; fg: string; accent: string
  accentSoft: string; muted: string; card: string
  pptxPage: string; pptxFg: string; pptxAccent: string; pptxMuted: string
}
const THEMES: Record<string, Theme> = {
  blanc: { name: 'Blanc', page: '#FFFFFF', band: '#F4F5F7', fg: '#1F2937', accent: '#0F766E', accentSoft: '#0F766E1A',
    muted: '#6B7280', card: '#F3F4F6', pptxPage: 'FFFFFF', pptxFg: '1F2937', pptxAccent: '0F766E', pptxMuted: '6B7280' },
  emeraude: { name: 'Émeraude', page: '#FBFBF8', band: '#F1F4F2', fg: '#16352C', accent: '#1E5B4F', accentSoft: '#1E5B4F1A',
    muted: '#5B6B66', card: '#EDF2EF', pptxPage: 'FBFBF8', pptxFg: '16352C', pptxAccent: '1E5B4F', pptxMuted: '5B6B66' },
  bleu: { name: 'Medianet', page: '#FAFDFF', band: '#EDF5FA', fg: '#0B3954', accent: '#0077B6', accentSoft: '#0077B61A',
    muted: '#557086', card: '#E8F3FA', pptxPage: 'FAFDFF', pptxFg: '0B3954', pptxAccent: '0077B6', pptxMuted: '557086' },
  soleil: { name: 'Soleil', page: '#FFFDF7', band: '#FBF3E1', fg: '#4A3308', accent: '#D97706', accentSoft: '#D977061A',
    muted: '#8A6D3F', card: '#FAF0DA', pptxPage: 'FFFDF7', pptxFg: '4A3308', pptxAccent: 'D97706', pptxMuted: '8A6D3F' },
  nuit: { name: 'Nuit', page: '#0C1322', band: '#121D33', fg: '#EDF2F7', accent: '#38BDF8', accentSoft: '#38BDF826',
    muted: '#93A5BC', card: '#17233C', pptxPage: '0C1322', pptxFg: 'EDF2F7', pptxAccent: '38BDF8', pptxMuted: '93A5BC' },
}

// Custom blocks the user adds on top of a slide (texts stored in overrides,
// positions/scales in pos — the block record only carries kind/url/color).
type CBKind = 'heading' | 'text' | 'pill' | 'image' | 'rect' | 'circle' | 'line' | 'arrow' | 'star' | 'triangle'
interface CustomBlock { id: string; kind: CBKind; url?: string; w?: number; color?: string }
const CB_DEF: Record<string, string> = {
  heading: 'Nouveau titre', text: 'Votre texte ici — cliquez pour modifier.', pill: 'PASTILLE',
}
const SHAPES: [CBKind, any, string][] = [
  ['rect', Square, 'Rectangle'], ['circle', CircleIcon, 'Cercle'], ['line', Minus, 'Ligne'],
  ['arrow', MoveRight, 'Flèche'], ['star', Star, 'Étoile'], ['triangle', Triangle, 'Triangle'],
]
const SHAPE_PX: Record<string, { w: number; h: number }> = {
  rect: { w: 220, h: 120 }, circle: { w: 140, h: 140 }, line: { w: 260, h: 8 },
  arrow: { w: 260, h: 60 }, star: { w: 140, h: 140 }, triangle: { w: 150, h: 130 },
}

// Per-text style overrides (police, taille, couleur, gras…), keyed like texts.
interface TStyle {
  font?: string; size?: number; color?: string
  bold?: boolean; italic?: boolean; align?: 'left' | 'center' | 'right'
}
/** Fonts safe on every machine — css value ↔ PPTX font face. */
const FONTS: { css: string; pptx: string; label: string }[] = [
  { css: '', pptx: 'Arial', label: 'Par défaut' },
  { css: 'Georgia, "Times New Roman", serif', pptx: 'Georgia', label: 'Serif élégante' },
  { css: '"Segoe UI", Arial, sans-serif', pptx: 'Segoe UI', label: 'Moderne' },
  { css: '"Trebuchet MS", Verdana, sans-serif', pptx: 'Trebuchet MS', label: 'Ronde' },
  { css: '"Courier New", monospace', pptx: 'Courier New', label: 'Machine' },
  { css: '"Comic Sans MS", "Segoe Print", cursive', pptx: 'Comic Sans MS', label: 'Fun' },
]
const styleCss = (st?: TStyle): React.CSSProperties => !st ? {} : {
  ...(st.font ? { fontFamily: st.font } : {}),
  ...(st.size ? { fontSize: st.size } : {}),
  ...(st.color ? { color: st.color } : {}),
  ...(st.bold != null ? { fontWeight: st.bold ? 800 : 400 } : {}),
  ...(st.italic ? { fontStyle: 'italic' } : {}),
  ...(st.align ? { textAlign: st.align, display: 'block' } : {}),
}

interface Contributor { name: string; role: string; photoUrl?: string; team?: string }
/** Extra slide — blank, or a MIRROR of an existing slide's layout (base key). */
interface ExtraSlide { id: string; label: string; base?: string }
/** Per-BLOCK decoration (bordure, fond, rayon) applied to the Movable wrapper. */
interface BlockStyle {
  borderColor?: string; borderWidth?: number
  bg?: string; bgImage?: string
  /** Corner radius in px — 0 = angles droits (comme Canva). */
  radius?: number
}
interface Deck {
  theme: string; overrides: Record<string, string>; hidden: string[]
  /** x/y offset · s = uniform scale · w = box width (reflow, text-safe) ·
   *  sx/sy = stretch (shapes/images only — text is never distorted). */
  pos: Record<string, { x: number; y: number; s?: number; w?: number; sx?: number; sy?: number }>
  custom: Record<string, CustomBlock[]>
  styles: Record<string, TStyle>
  /** Per-slide background override (base = thème). */
  bg: Record<string, string>
  /** Movable keys the user deleted (hidden everywhere, restorable). */
  hiddenBlocks: string[]
  /** Blank slides added by the user. */
  extraSlides: ExtraSlide[]
  /** People shown on the « Contributeurs » slides (name + role + photo + équipe). */
  contributors: Contributor[]
  /** Z-order per block (avancer / reculer). */
  z: Record<string, number>
  /** Per-block decoration (bordure / fond / rayon). */
  blockStyles: Record<string, BlockStyle>
  /** Slide order chosen by the user (keys); missing keys keep natural order. */
  order: string[]
  /** Numérotation: première diapo numérotée (1-based, visible) + numéro initial. */
  pageStart: { from: number; num: number }
}
const EMPTY_DECK: Deck = {
  theme: 'emeraude', overrides: {}, hidden: [], pos: {}, custom: {}, styles: {},
  bg: {}, hiddenBlocks: [], extraSlides: [], contributors: [],
  z: {}, blockStyles: {}, order: [], pageStart: { from: 2, num: 1 },
}

// ── Contexts ─────────────────────────────────────────────────────────────────
const ScaleCtx = createContext(1)
const StudioCtx = createContext<{
  editable: boolean; deck: Deck; T: Theme
  setText: (k: string, v: string) => void
  setPos: (k: string, p: { x: number; y: number; s?: number; w?: number; sx?: number; sy?: number }) => void
  hideBlock: (k: string) => void
  removeBlock: (slideKey: string, id: string) => void
  duplicateCustom: (slideKey: string, id: string) => void
  setBlockColor: (slideKey: string, id: string, color: string) => void
  setActiveKey: (k: string | null) => void
  selectedKey: string | null
  setSelectedKey: (k: string | null) => void
  bumpZ: (k: string, dir: 1 | -1) => void
}>(null as any)

// ── Fixed-size canvas, scaled to its container ───────────────────────────────
function SlideCanvas({ children, fixedScale }: { children: React.ReactNode; fixedScale?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(fixedScale ?? 0)
  useLayoutEffect(() => {
    if (fixedScale) return
    const el = ref.current; if (!el) return
    const upd = () => setScale(el.clientWidth / CW)
    upd()
    const ro = new ResizeObserver(upd); ro.observe(el)
    return () => ro.disconnect()
  }, [fixedScale])
  return (
    <div ref={ref} className="relative w-full overflow-hidden" style={{ aspectRatio: '16 / 9' }}>
      <ScaleCtx.Provider value={scale || 1}>
        <div style={{ width: CW, height: CH, transform: `scale(${scale || 0})`, transformOrigin: 'top left' }}>
          {children}
        </div>
      </ScaleCtx.Provider>
    </div>
  )
}

// ── Editable text ────────────────────────────────────────────────────────────
function Ed({ k, def, className, style, block }: {
  k: string; def: string; className?: string; style?: React.CSSProperties; block?: boolean
}) {
  const { editable, deck, setText, setActiveKey } = useContext(StudioCtx)
  const val = deck.overrides[k] ?? def
  const merged = { ...style, ...styleCss(deck.styles?.[k]) }
  const Tag: any = block ? 'div' : 'span'
  if (!editable) return <Tag className={className} style={merged}>{val}</Tag>
  return (
    <Tag contentEditable suppressContentEditableWarning spellCheck={false}
      onFocus={() => setActiveKey(k)}
      onBlur={(e: any) => setText(k, (e.currentTarget.textContent ?? '').trim() || def)}
      title="Cliquez pour modifier le texte · la barre de style s'affiche en haut"
      className={cn(className, 'cursor-text rounded-md outline-none transition-shadow hover:ring-2 hover:ring-sky-400/40 focus:ring-2 focus:ring-sky-400/80')}
      style={merged}>{val}</Tag>
  )
}

// ── Movable block — click = select · ⠿ drag · ⤡ resize · 👁 hide ─────────────
// Text-safe by default: the corner handle scales PROPORTIONNELLEMENT and the
// side handle changes the box WIDTH (le texte se réorganise, jamais étiré).
// `stretch` (formes / images) enables true horizontal/vertical stretching.
function Movable({ k, children, className, style, corner = 'tl', deletable = true, stretch = false }: {
  k: string; children: React.ReactNode; className?: string; style?: React.CSSProperties
  corner?: 'tl' | 'tr'
  /** Show the hide (delete) button. Custom blocks bring their own real delete. */
  deletable?: boolean
  /** Allow real H/V stretching (shapes & images only — never text). */
  stretch?: boolean
}) {
  const { editable, deck, setPos, hideBlock, selectedKey, setSelectedKey, bumpZ } = useContext(StudioCtx)
  const scale = useContext(ScaleCtx)
  const rootRef = useRef<HTMLDivElement>(null)
  const saved = deck.pos[k] ?? { x: 0, y: 0 }
  const [live, setLive] = useState<{ x: number; y: number; s?: number; w?: number; sx?: number; sy?: number } | null>(null)
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)
  const sizeRef = useRef<{ sx: number; sy: number; os: number; axis: 'u' | 'x' | 'y' | 'w' } | null>(null)
  const cur = live ?? saved
  const scU = cur.s ?? 1
  const scX = scU * (stretch ? (cur.sx ?? 1) : 1)
  const scY = scU * (stretch ? (cur.sy ?? 1) : 1)
  const isSel = editable && selectedKey === k

  if (deck.hiddenBlocks?.includes(k)) return null

  const onDown = (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: saved.x, oy: saved.y }
  }
  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current; if (!d) return
    let nx = d.ox + (e.clientX - d.sx) / scale
    let ny = d.oy + (e.clientY - d.sy) / scale
    // Auto-alignement : aimante le bloc au centre / aux marges (64px) du canvas.
    const el = rootRef.current
    const root = el?.closest('[data-slide-root]') as HTMLElement | null
    if (el && root) {
      const r = el.getBoundingClientRect(); const rr = root.getBoundingClientRect()
      const left = (r.left - rr.left) / scale + (nx - cur.x)
      const top  = (r.top - rr.top) / scale + (ny - cur.y)
      const w = r.width / scale, h = r.height / scale
      for (const target of [CW / 2 - w / 2, 64, CW - 64 - w]) {
        if (Math.abs(left - target) < 8) { nx += target - left; break }
      }
      for (const target of [CH / 2 - h / 2, 64, CH - 64 - h]) {
        if (Math.abs(top - target) < 8) { ny += target - top; break }
      }
    }
    setLive({ ...saved, x: nx, y: ny })
  }
  const onUp = () => {
    const d = dragRef.current; dragRef.current = null
    if (d && live) setPos(k, { ...saved, x: Math.round(live.x), y: Math.round(live.y) })
    setLive(null)
  }
  const startSize = (axis: 'u' | 'x' | 'y' | 'w') => (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    let os: number
    if (axis === 'w') {
      // Base width in design px (mesurée si jamais redimensionné).
      const el = rootRef.current
      os = saved.w ?? (el ? el.getBoundingClientRect().width / scale / (saved.s ?? 1) : 240)
    } else os = axis === 'u' ? (saved.s ?? 1) : axis === 'x' ? (saved.sx ?? 1) : (saved.sy ?? 1)
    sizeRef.current = { sx: e.clientX, sy: e.clientY, os, axis }
  }
  const onSizeMove = (e: React.PointerEvent) => {
    const d = sizeRef.current; if (!d) return
    if (d.axis === 'w') {
      const w = Math.min(CW, Math.max(60, d.os + (e.clientX - d.sx) / scale))
      setLive({ ...saved, w })
      return
    }
    const delta = d.axis === 'x' ? (e.clientX - d.sx) / scale
      : d.axis === 'y' ? (e.clientY - d.sy) / scale
      : ((e.clientX - d.sx) + (e.clientY - d.sy)) / 2 / scale
    const v = Math.min(3, Math.max(0.25, d.os + delta / 180))
    setLive({ ...saved, ...(d.axis === 'u' ? { s: v } : d.axis === 'x' ? { sx: v } : { sy: v }) })
  }
  const onSizeUp = () => {
    const d = sizeRef.current; sizeRef.current = null
    if (d && live) {
      if (d.axis === 'w') setPos(k, { ...saved, w: Math.round(live.w ?? 240) })
      else {
        const v = Math.round(((d.axis === 'u' ? live.s : d.axis === 'x' ? live.sx : live.sy) ?? 1) * 100) / 100
        setPos(k, { ...saved, ...(d.axis === 'u' ? { s: v } : d.axis === 'x' ? { sx: v } : { sy: v }) })
      }
    }
    setLive(null)
  }

  // Per-block decoration (bordure / fond / rayon).
  const bs = deck.blockStyles?.[k]
  const bsCss: React.CSSProperties = bs ? {
    ...(bs.bg ? { background: bs.bg } : {}),
    ...(bs.bgImage ? { backgroundImage: `url(${bs.bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}),
    ...(bs.borderColor || bs.borderWidth ? { border: `${bs.borderWidth ?? 2}px solid ${bs.borderColor ?? '#111827'}` } : {}),
    ...(bs.radius != null ? { borderRadius: bs.radius } : {}),
    ...((bs.bg || bs.bgImage || bs.borderColor || bs.borderWidth) ? { padding: 10 } : {}),
  } : {}

  const handleCls = isSel ? 'flex' : 'hidden group-hover/mv:flex'
  return (
    <div ref={rootRef}
      onClick={(e) => { if (editable) { e.stopPropagation(); setSelectedKey(k) } }}
      className={cn('relative', editable && 'group/mv', isSel && 'outline outline-2 outline-sky-500/80', className)}
      style={{
        ...style, ...bsCss,
        ...(cur.w ? { width: cur.w, maxWidth: 'none' } : {}),
        transform: `translate(${cur.x}px, ${cur.y}px) scale(${scX}, ${scY})`,
        transformOrigin: 'top left',
        zIndex: 10 + (deck.z?.[k] ?? 0),
      }}>
      {editable && (
        <div className={cn('absolute z-30 items-center gap-1', handleCls,
          corner === 'tl' ? '-left-4 -top-4' : '-right-4 -top-4')}>
          <button type="button" title="Glisser pour déplacer ce bloc"
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
            className="flex h-8 w-8 cursor-move touch-none items-center justify-center rounded-lg bg-slate-900/85 text-white shadow-lg">
            <Move className="h-4 w-4" />
          </button>
          <button type="button" title="Avancer (premier plan)" onClick={() => bumpZ(k, 1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-700/90 text-white shadow-lg">
            <BringToFront className="h-4 w-4" />
          </button>
          <button type="button" title="Reculer (arrière-plan)" onClick={() => bumpZ(k, -1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-700/90 text-white shadow-lg">
            <SendToBack className="h-4 w-4" />
          </button>
          {deletable && (
            <button type="button" title="Supprimer ce bloc (restaurable via « Blocs masqués »)"
              onClick={() => hideBlock(k)}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-600/90 text-white shadow-lg">
              <EyeOff className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
      {editable && (
        <>
          {/* ⤡ coin = échelle proportionnelle (jamais de distorsion du texte) */}
          <span title="Redimensionner (proportionnel)"
            onPointerDown={startSize('u')} onPointerMove={onSizeMove} onPointerUp={onSizeUp} onPointerCancel={onSizeUp}
            className={cn('absolute -bottom-2.5 -right-2.5 z-30 h-5 w-5 cursor-nwse-resize touch-none rounded-md border-2 border-white bg-sky-500 shadow', isSel ? 'block' : 'hidden group-hover/mv:block')} />
          {stretch ? (
            <>
              {/* Formes / images : étirement réel autorisé */}
              <span title="Étirer horizontalement"
                onPointerDown={startSize('x')} onPointerMove={onSizeMove} onPointerUp={onSizeUp} onPointerCancel={onSizeUp}
                className={cn('absolute -right-2.5 top-1/2 z-30 h-5 w-3.5 -translate-y-1/2 cursor-ew-resize touch-none rounded-md border-2 border-white bg-emerald-500 shadow', isSel ? 'block' : 'hidden group-hover/mv:block')} />
              <span title="Étirer verticalement"
                onPointerDown={startSize('y')} onPointerMove={onSizeMove} onPointerUp={onSizeUp} onPointerCancel={onSizeUp}
                className={cn('absolute -bottom-2.5 left-1/2 z-30 h-3.5 w-5 -translate-x-1/2 cursor-ns-resize touch-none rounded-md border-2 border-white bg-emerald-500 shadow', isSel ? 'block' : 'hidden group-hover/mv:block')} />
            </>
          ) : (
            /* Texte / cartes : la poignée latérale change la LARGEUR (le contenu
               se réorganise — hauteur automatique, aucun étirement). */
            <span title="Changer la largeur (le texte se réorganise)"
              onPointerDown={startSize('w')} onPointerMove={onSizeMove} onPointerUp={onSizeUp} onPointerCancel={onSizeUp}
              className={cn('absolute -right-2.5 top-1/2 z-30 h-5 w-3.5 -translate-y-1/2 cursor-ew-resize touch-none rounded-md border-2 border-white bg-emerald-500 shadow', isSel ? 'block' : 'hidden group-hover/mv:block')} />
          )}
        </>
      )}
      {children}
    </div>
  )
}

// ── Shapes ───────────────────────────────────────────────────────────────────
function ShapeView({ kind, color }: { kind: CBKind; color: string }) {
  const d = SHAPE_PX[kind] ?? { w: 140, h: 140 }
  if (kind === 'rect') return <div style={{ width: d.w, height: d.h, background: color, borderRadius: 18 }} />
  if (kind === 'circle') return <div style={{ width: d.w, height: d.h, background: color, borderRadius: 999 }} />
  if (kind === 'line') return <div style={{ width: d.w, height: d.h, background: color, borderRadius: 4 }} />
  if (kind === 'arrow') return (
    <svg width={d.w} height={d.h} viewBox={`0 0 ${d.w} ${d.h}`}>
      <line x1="0" y1={d.h / 2} x2={d.w - 26} y2={d.h / 2} stroke={color} strokeWidth="8" strokeLinecap="round" />
      <polygon points={`${d.w},${d.h / 2} ${d.w - 30},${d.h / 2 - 16} ${d.w - 30},${d.h / 2 + 16}`} fill={color} />
    </svg>
  )
  if (kind === 'star') return (
    <svg width={d.w} height={d.h} viewBox="0 0 100 100">
      <polygon fill={color} points="50,4 61,36 95,36 67,56 77,90 50,69 23,90 33,56 5,36 39,36" />
    </svg>
  )
  return (
    <svg width={d.w} height={d.h} viewBox="0 0 100 90">
      <polygon fill={color} points="50,4 96,86 4,86" />
    </svg>
  )
}

// ── Custom blocks added by the user, rendered above the slide layout ─────────
/** Base spot for the i-th custom block (staggered around the canvas center). */
const cbBase = (i: number) => ({ left: 420 + (i % 5) * 26, top: 270 + (i % 5) * 26 })

function CustomBlocksLayer({ slideKey }: { slideKey: string }) {
  const { editable, deck, T, removeBlock, duplicateCustom, setBlockColor, selectedKey } = useContext(StudioCtx)
  const blocks = deck.custom?.[slideKey] ?? []
  if (blocks.length === 0) return null
  return (
    <>
      {blocks.map((b, i) => {
        const isShape = !['heading', 'text', 'pill', 'image'].includes(b.kind)
        const selCls = selectedKey === `cb.${b.id}.mv` ? 'flex' : 'hidden group-hover/mv:flex'
        return (
          <Movable key={b.id} k={`cb.${b.id}.mv`} className="absolute z-20" style={cbBase(i)} deletable={false}
            stretch={isShape || b.kind === 'image'}>
            {editable && (
              <span className={cn('absolute -right-3.5 -top-3.5 z-30 items-center gap-1', selCls)}>
                <button type="button" title="Dupliquer ce bloc" onClick={() => duplicateCustom(slideKey, b.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-700 text-white shadow-lg">
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button type="button" title="Supprimer ce bloc" onClick={() => removeBlock(slideKey, b.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg">
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            )}
            {b.kind === 'heading' && (
              <Ed k={`cb.${b.id}`} def={CB_DEF.heading} block className="font-extrabold" style={{ fontSize: 40, lineHeight: 1.15, color: T.accent }} />
            )}
            {b.kind === 'text' && (
              <Ed k={`cb.${b.id}`} def={CB_DEF.text} block style={{ fontSize: 22, lineHeight: 1.5, color: T.fg, maxWidth: 560 }} />
            )}
            {b.kind === 'pill' && (
              <div className="inline-block rounded-full" style={{ background: T.accent, padding: '12px 28px' }}>
                <Ed k={`cb.${b.id}`} def={CB_DEF.pill} className="font-extrabold uppercase" style={{ fontSize: 17, letterSpacing: 4, color: '#fff' }} />
              </div>
            )}
            {b.kind === 'image' && b.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={b.url} alt="" style={{ width: b.w ?? 340, borderRadius: 20, boxShadow: '0 8px 22px rgb(0 0 0 / .15)' }} />
            )}
            {isShape && (
              <>
                <ShapeView kind={b.kind} color={b.color ?? T.accent} />
                {editable && (
                  <input type="color" value={b.color ?? T.accent} title="Couleur de la forme"
                    onChange={(e) => setBlockColor(slideKey, b.id, e.target.value)}
                    className="absolute -bottom-3 -left-3 z-30 hidden h-6 w-8 cursor-pointer rounded border-2 border-white p-0 shadow group-hover/mv:block" />
                )}
              </>
            )}
          </Movable>
        )
      })}
    </>
  )
}

// ── Medianet 4-dot logo (as in the real decks) ───────────────────────────────
function DotsLogo({ dark }: { dark?: boolean }) {
  return (
    <div className="flex items-center" style={{ gap: 10 }}>
      {DOTS.map((c, i) => (
        <span key={c} style={{ width: 22, height: 22, borderRadius: 999, background: c, clipPath: i === 0 ? 'ellipse(38% 50% at 65% 50%)' : undefined }} />
      ))}
      <span style={{ marginLeft: 6, fontSize: 17, lineHeight: 1.1, color: dark ? '#EDF2F7' : '#1a2b3c' }}>
        Medianet<br /><b>incubator</b>
      </span>
    </div>
  )
}

// ── Sections available to the creation wizard ────────────────────────────────
const SECTION_DEFS: { key: string; label: string }[] = [
  { key: 'cover', label: 'Couverture' },
  { key: 'programme', label: 'Le programme' },
  { key: 'secteurs', label: 'Secteurs' },
  { key: 'parcours', label: 'Le parcours' },
  { key: 'chiffres', label: 'Chiffres clés' },
  { key: 'objectifs', label: 'Objectifs' },
  { key: 'benefices', label: 'Bénéfices participants' },
  { key: 'partenaires', label: 'Partenaires' },
  { key: 'images', label: 'Retour en images' },
  { key: 'contributeurs', label: 'Contributeurs' },
  { key: 'merci', label: 'Merci' },
]
const ROLE_PRESETS = ['Jury', 'Mentor', 'Porteur', 'Coach', 'Organisateur', 'Partenaire']

export default function PresentationStudioPage() {
  const { id } = useParams<{ id: string }>()
  const programmeId = Number(id)
  const listKey = `pres-decks-${programmeId}`
  const legacyKey = `pres-deck-v2-${programmeId}`

  const [programme, setProgramme] = useState<any>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [deckList, setDeckList] = useState<{ id: string; name: string }[]>([{ id: 'principal', name: 'Présentation 1' }])
  const [deckId, setDeckId] = useState('principal')
  const storageKey = `pres-deck-v3-${programmeId}-${deckId}`

  const [deck, setDeck] = useState<Deck>(EMPTY_DECK)
  const [mode, setMode] = useState<'edit' | 'present'>('edit')
  const [cur, setCur] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  /** What the image picker fills: a new block, or the SELECTED block's background. */
  const [pickerFor, setPickerFor] = useState<'insert' | 'block-bg'>('insert')
  const [wizard, setWizard] = useState<null | { mode: 'create' | 'edit'; step?: number }>(null)
  const [presentHint, setPresentHint] = useState(false)

  // Data
  useEffect(() => {
    programmesApi.get(programmeId).then((r) => setProgramme(r.data)).catch(() => {})
    sessionsApi.list(programmeId).then((r) => setSessions(r.data ?? [])).catch(() => {})
    try {
      const raw = localStorage.getItem(listKey)
      if (raw) { const l = JSON.parse(raw); if (Array.isArray(l) && l.length) setDeckList(l) }
    } catch { /* fresh */ }
  }, [programmeId, listKey])

  // Deck (per présentation) + legacy migration
  useEffect(() => {
    try {
      let raw = localStorage.getItem(storageKey)
      if (!raw && deckId === 'principal') raw = localStorage.getItem(legacyKey)
      setDeck(raw ? { ...EMPTY_DECK, ...JSON.parse(raw) } : EMPTY_DECK)
    } catch { setDeck(EMPTY_DECK) }
    undoRef.current = []; redoRef.current = []
    setCur(0); setActiveKey(null)
  }, [storageKey, legacyKey, deckId])

  // ── History (Ctrl+Z / Ctrl+Y over the whole deck) ──────────────────────────
  const undoRef = useRef<Deck[]>([])
  const redoRef = useRef<Deck[]>([])
  const persist = useCallback((d: Deck) => {
    setDeck(d); try { localStorage.setItem(storageKey, JSON.stringify(d)) } catch { /* full */ }
  }, [storageKey])
  const saveDeck = useCallback((d: Deck) => {
    undoRef.current.push(deck)
    if (undoRef.current.length > 60) undoRef.current.shift()
    redoRef.current = []
    persist(d)
  }, [deck, persist])
  const undo = useCallback(() => {
    const prev = undoRef.current.pop()
    if (!prev) return
    redoRef.current.push(deck)
    persist(prev)
  }, [deck, persist])
  const redo = useCallback(() => {
    const nxt = redoRef.current.pop()
    if (!nxt) return
    undoRef.current.push(deck)
    persist(nxt)
  }, [deck, persist])
  useEffect(() => {
    if (mode !== 'edit') return
    const h = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undo() }
      else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [mode, undo, redo])

  const saveDeckList = (l: { id: string; name: string }[]) => {
    setDeckList(l); try { localStorage.setItem(listKey, JSON.stringify(l)) } catch { /* full */ }
  }

  const T = THEMES[deck.theme] ?? THEMES.emeraude
  const p = programme
  const dark = deck.theme === 'nuit'
  const t = useCallback((k: string, def: string) => deck.overrides[k] ?? def, [deck.overrides])

  const ctx = useMemo(() => ({
    editable: mode === 'edit', deck, T,
    setText: (k: string, v: string) => saveDeck({ ...deck, overrides: { ...deck.overrides, [k]: v } }),
    setPos: (k: string, pos: { x: number; y: number; s?: number }) => saveDeck({ ...deck, pos: { ...deck.pos, [k]: pos } }),
    hideBlock: (k: string) => saveDeck({ ...deck, hiddenBlocks: [...(deck.hiddenBlocks ?? []), k] }),
    removeBlock: (slideKey: string, id: string) => saveDeck({
      ...deck, custom: { ...deck.custom, [slideKey]: (deck.custom[slideKey] ?? []).filter((b) => b.id !== id) },
    }),
    setBlockColor: (slideKey: string, id: string, color: string) => saveDeck({
      ...deck, custom: { ...deck.custom, [slideKey]: (deck.custom[slideKey] ?? []).map((b) => b.id === id ? { ...b, color } : b) },
    }),
    duplicateCustom: (slideKey: string, id: string) => {
      const src = (deck.custom[slideKey] ?? []).find((b) => b.id === id)
      if (!src) return
      const nb = { ...src, id: rid() }
      const overrides = { ...deck.overrides }; const pos = { ...deck.pos }; const styles = { ...deck.styles }; const blockStyles = { ...deck.blockStyles }
      if (deck.overrides[`cb.${id}`] != null) overrides[`cb.${nb.id}`] = deck.overrides[`cb.${id}`]
      const oldPos = deck.pos[`cb.${id}.mv`]
      pos[`cb.${nb.id}.mv`] = { ...(oldPos ?? { x: 0, y: 0 }), x: (oldPos?.x ?? 0) + 30, y: (oldPos?.y ?? 0) + 30 }
      if (deck.styles[`cb.${id}`]) styles[`cb.${nb.id}`] = { ...deck.styles[`cb.${id}`] }
      if (deck.blockStyles?.[`cb.${id}.mv`]) blockStyles[`cb.${nb.id}.mv`] = { ...deck.blockStyles[`cb.${id}.mv`] }
      saveDeck({
        ...deck, overrides, pos, styles, blockStyles,
        custom: { ...deck.custom, [slideKey]: [...(deck.custom[slideKey] ?? []), nb] },
      })
    },
    setActiveKey,
    selectedKey,
    setSelectedKey,
    bumpZ: (k: string, dir: 1 | -1) => saveDeck({
      ...deck, z: { ...deck.z, [k]: Math.max(-8, Math.min(20, (deck.z?.[k] ?? 0) + dir)) },
    }),
  }), [mode, deck, T, saveDeck, selectedKey])

  // Per-BLOCK decoration for the selected block (bordure / fond / rayon).
  const setBlockStyle = (patch: Partial<BlockStyle>) => {
    if (!selectedKey) return
    saveDeck({ ...deck, blockStyles: { ...deck.blockStyles, [selectedKey]: { ...deck.blockStyles?.[selectedKey], ...patch } } })
  }
  const clearBlockStyle = () => {
    if (!selectedKey) return
    const blockStyles = { ...deck.blockStyles }; delete blockStyles[selectedKey]
    saveDeck({ ...deck, blockStyles })
  }
  const selBlockStyle: BlockStyle = (selectedKey && deck.blockStyles?.[selectedKey]) || {}

  const setStyle = (patch: Partial<TStyle>) => {
    if (!activeKey) return
    saveDeck({ ...deck, styles: { ...deck.styles, [activeKey]: { ...deck.styles?.[activeKey], ...patch } } })
  }
  const clearStyle = () => {
    if (!activeKey) return
    const styles = { ...deck.styles }; delete styles[activeKey]
    saveDeck({ ...deck, styles })
  }
  const activeStyle: TStyle = (activeKey && deck.styles?.[activeKey]) || {}

  const stats = useMemo(() => p ? [
    { n: p.maxStartups, l: 'startups sélectionnées' },
    { n: p.expertCount, l: 'experts mobilisés' },
    { n: p.trainingSessionsCount, l: 'formations assurées' },
    { n: p.mentoringHoursPerMonth, l: 'h de mentorat / mois' },
  ].filter((s) => s.n) : [], [p])
  const ordered = useMemo(() => sessions.filter((s) => !s.parentSessionId)
    .sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? '')).slice(0, 7), [sessions])
  const galleryPool = useMemo(() => Array.from(new Set([
    ...((p?.galleryUrls as string[] | undefined) ?? []),
    ...sessions.flatMap((s) => s.galleryUrls ?? []),
  ])), [p, sessions])

  // Contributeurs groupés par équipe — une diapositive par équipe.
  const contribGroups = useMemo(() => {
    const groups: { team: string | null; key: string; label: string; list: Contributor[] }[] = []
    const noTeam = (deck.contributors ?? []).filter((c) => !c.team)
    if (noTeam.length) groups.push({ team: null, key: 'contributeurs', label: 'Contributeurs', list: noTeam })
    for (const tm of Array.from(new Set((deck.contributors ?? []).map((c) => c.team).filter(Boolean))) as string[]) {
      groups.push({ team: tm, key: `contributeurs-${slug(tm)}`, label: `Équipe ${tm}`, list: deck.contributors.filter((c) => c.team === tm) })
    }
    return groups
  }, [deck.contributors])

  // ── Slides — Medianet deck layouts on the fixed canvas ─────────────────────
  const allSlides = useMemo(() => {
    if (!p) return []
    const name: string = p.title ?? p.name ?? 'Programme'
    const out: { key: string; label: string; el: React.ReactNode }[] = []

    /** Header band shared by content slides (logo movable + deletable). */
    const Band = () => (
      <div className="flex items-center justify-between" style={{ height: 84, background: T.band, padding: '0 48px' }}>
        <Movable k="band.logo.mv"><DotsLogo dark={dark} /></Movable>
        <Movable k="band.name.mv" corner="tr">
          <Ed k="band.name" def={name} style={{ fontSize: 22, fontWeight: 800, color: T.accent }} />
        </Movable>
      </div>
    )
    const BigTitle = ({ k, pre, def }: { k: string; pre?: string; def: string }) => (
      <Movable k={`${k}.mv`} className="inline-block">
        <div style={{ fontSize: 46, lineHeight: 1.1, color: T.accent }}>
          {pre && <span style={{ fontWeight: 400 }}>{pre} </span>}
          <Ed k={k} def={def} className="font-extrabold" />
        </div>
        <div className="flex overflow-hidden rounded-full" style={{ height: 5, width: 120, marginTop: 12 }}>
          {DOTS.map((c) => <span key={c} className="flex-1" style={{ background: c }} />)}
        </div>
      </Movable>
    )
    const Page = ({ k, children }: { k: string; children: React.ReactNode }) => (
      <div data-slide-root className="relative h-full w-full overflow-hidden" style={{ background: deck.bg?.[k] ?? T.page }}>
        {children}
      </div>
    )

    // 1 · COVER
    out.push({ key: 'cover', label: 'Couverture', el: (
      <Page k="cover">
        {DOTS.map((c, i) => (
          <span key={c} className="absolute rounded-full" style={{ background: c, opacity: dark ? 0.18 : 0.25, filter: 'blur(46px)', width: 150, height: 150, bottom: -70, left: 120 + i * 260 }} />
        ))}
        <Movable k="cover.visual.mv" className="absolute" style={{ right: 0, top: 0 }} corner="tr">
          <div style={{ width: 470, height: CH }}>
            {(p.bannerImageUrl || p.logoUrl) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.bannerImageUrl || p.logoUrl} alt="" className="h-full w-full object-cover" style={{ borderRadius: '48px 0 0 48px' }} />
            ) : (
              <div className="h-full w-full" style={{ background: `linear-gradient(160deg, ${T.accent}, ${T.accent}99)`, borderRadius: '48px 0 0 48px' }}>
                <div className="flex h-full items-center justify-center">
                  <span style={{ fontSize: 120, opacity: 0.25 }}>🚀</span>
                </div>
              </div>
            )}
          </div>
        </Movable>
        <Movable k="cover.logo.mv" className="absolute" style={{ left: 64, top: 48 }}><DotsLogo dark={dark} /></Movable>
        <Movable k="cover.title.mv" className="absolute" style={{ left: 64, top: 200, maxWidth: 660 }}>
          <Ed k="cover.title" def={name} block className="font-extrabold" style={{ fontSize: 72, lineHeight: 1.05, color: T.accent }} />
        </Movable>
        <Movable k="cover.tagline.mv" className="absolute" style={{ left: 64, top: 330, maxWidth: 660 }}>
          <Ed k="cover.tagline" def={p.tagline || 'Le programme d’incubation Medianet'} block
            style={{ fontSize: 22, letterSpacing: 2, color: T.muted }} />
        </Movable>
        <Movable k="cover.pill.mv" className="absolute" style={{ left: 64, top: 420 }}>
          <div className="inline-block rounded-full" style={{ background: T.accent, padding: '14px 34px' }}>
            <Ed k="cover.edition" def={p.startDate ? `Édition ${new Date(p.startDate).getFullYear()}` : 'Nouvelle édition'}
              className="font-extrabold uppercase" style={{ fontSize: 20, letterSpacing: 5, color: '#fff' }} />
          </div>
        </Movable>
        {(p.startDate || p.location) && (
          <Movable k="cover.dates.mv" className="absolute" style={{ left: 64, top: 505 }}>
            <Ed k="cover.dates"
              def={[p.startDate ? `${fmtD(p.startDate)} → ${fmtD(p.endDate)}` : '', p.location ?? ''].filter(Boolean).join('   ·   ')}
              block style={{ fontSize: 15, color: T.muted }} />
          </Movable>
        )}
        <Movable k="cover.socials.mv" className="absolute" style={{ left: 64, top: 610 }}>
          <div className="inline-flex items-center rounded-full" style={{ gap: 14, background: dark ? T.card : '#fff', padding: '10px 22px', boxShadow: '0 4px 14px rgb(0 0 0 / .08)' }}>
            <Facebook style={{ width: 16, height: 16, color: T.fg }} />
            <Instagram style={{ width: 16, height: 16, color: T.fg }} />
            <Linkedin style={{ width: 16, height: 16, color: T.fg }} />
            <Ed k="cover.socials" def="MEDIANET Incubator" style={{ fontSize: 14, fontWeight: 600, color: T.fg }} />
          </div>
        </Movable>
      </Page>
    ) })

    // 2 · LE PROGRAMME
    if (p.description) out.push({ key: 'programme', label: 'Le programme', el: (
      <Page k="programme">
        <Band />
        <div className="flex flex-col items-center" style={{ padding: '52px 90px 0' }}>
          <BigTitle k="programme.title" pre="Programme" def={name} />
          <Movable k="programme.body.mv" className="w-full" style={{ marginTop: 44 }}>
            <div className="rounded-3xl" style={{ background: T.card, padding: '42px 54px' }}>
              <Ed k="programme.body" def={p.description} block
                className="whitespace-pre-wrap text-center" style={{ fontSize: 23, lineHeight: 1.55, color: T.fg }} />
            </div>
          </Movable>
        </div>
      </Page>
    ) })

    // 3 · SECTEURS
    if (p.sectors?.length) out.push({ key: 'secteurs', label: 'Secteurs', el: (
      <Page k="secteurs">
        <Band />
        <div style={{ padding: '52px 90px 0' }}>
          <BigTitle k="secteurs.title" def="Secteurs" />
          <Movable k="secteurs.grid.mv" style={{ marginTop: 44 }}>
            <div className="flex flex-wrap" style={{ gap: 18 }}>
              {p.sectors.map((s: string, i: number) => (
                <Movable key={s} k={`secteurs.${i}.mv`} corner="tr">
                  <div className="flex items-center rounded-2xl" style={{ gap: 12, background: T.card, padding: '20px 30px' }}>
                    <span className="rounded-full" style={{ width: 14, height: 14, background: DOTS[i % DOTS.length] }} />
                    <Ed k={`secteurs.${i}`} def={s} style={{ fontSize: 22, fontWeight: 700, color: T.fg }} />
                  </div>
                </Movable>
              ))}
            </div>
          </Movable>
        </div>
      </Page>
    ) })

    // 4 · PARCOURS
    if (ordered.length) out.push({ key: 'parcours', label: 'Le parcours', el: (
      <Page k="parcours">
        <Band />
        <div style={{ padding: '48px 90px 0' }}>
          <BigTitle k="parcours.title" def="Le parcours" />
          <Movable k="parcours.list.mv" style={{ marginTop: 36 }}>
            <div className="grid" style={{ gap: 14 }}>
              {ordered.map((s, i) => (
                <Movable key={s.id} k={`parcours.${i}.mv`} corner="tr">
                  <div className="flex items-center rounded-2xl" style={{ gap: 20, background: T.card, padding: '14px 26px' }}>
                    <span className="flex items-center justify-center rounded-full font-extrabold"
                      style={{ width: 40, height: 40, background: s.color || T.accent, color: '#fff', fontSize: 17 }}>{i + 1}</span>
                    <Ed k={`parcours.${i}.t`} def={s.title} className="min-w-0 flex-1" style={{ fontSize: 21, fontWeight: 700, color: T.fg }} />
                    <Ed k={`parcours.${i}.d`} def={fmtD(s.startDate)} style={{ fontSize: 15, color: T.muted }} />
                  </div>
                </Movable>
              ))}
            </div>
          </Movable>
        </div>
      </Page>
    ) })

    // 5 · CHIFFRES CLÉS
    if (stats.length) out.push({ key: 'chiffres', label: 'Chiffres clés', el: (
      <Page k="chiffres">
        <Band />
        <div style={{ padding: '52px 90px 0' }}>
          <BigTitle k="chiffres.title" def="Chiffres clés" />
          <Movable k="chiffres.grid.mv" style={{ marginTop: 46 }}>
            <div className="grid grid-cols-2" style={{ gap: 26 }}>
              {stats.map((s, i) => (
                <Movable key={s.l} k={`chiffres.${i}.mv`} corner="tr">
                  <div className="rounded-3xl text-center" style={{ background: T.card, padding: '30px 20px' }}>
                    <Ed k={`chiffres.${i}.n`} def={String(s.n)} block className="font-extrabold" style={{ fontSize: 66, lineHeight: 1, color: T.accent }} />
                    <Ed k={`chiffres.${i}.l`} def={s.l} block className="font-bold uppercase" style={{ fontSize: 15, letterSpacing: 2, marginTop: 10, color: T.fg }} />
                  </div>
                </Movable>
              ))}
            </div>
          </Movable>
        </div>
      </Page>
    ) })

    // 6/7 · OBJECTIFS & BÉNÉFICES (bullets toggle-able)
    for (const [key, defTitle, items] of [
      ['objectifs', 'Objectifs', p.objectives ?? []],
      ['benefices', 'Ce que gagnent les participants', p.benefits ?? []],
    ] as [string, string, string[]][]) {
      const showDots = deck.overrides[`${key}.bullets`] !== 'off'
      if (items.length) out.push({ key, label: defTitle, el: (
        <Page k={key}>
          <Band />
          <div style={{ padding: '52px 90px 0' }}>
            <BigTitle k={`${key}.title`} def={defTitle} />
            <Movable k={`${key}.list.mv`} style={{ marginTop: 40 }}>
              <div className="grid" style={{ gap: 18 }}>
                {items.slice(0, 6).map((o, i) => (
                  <Movable key={i} k={`${key}.${i}.mv`} corner="tr">
                    <div className="flex items-start" style={{ gap: 16 }}>
                      {showDots && <span className="rounded-full" style={{ width: 13, height: 13, marginTop: 10, background: DOTS[i % DOTS.length] }} />}
                      <Ed k={`${key}.${i}`} def={o} className="flex-1" style={{ fontSize: 23, lineHeight: 1.4, color: T.fg }} />
                    </div>
                  </Movable>
                ))}
              </div>
            </Movable>
          </div>
        </Page>
      ) })
    }

    // 8 · PARTENAIRES
    if (p.partners?.length) out.push({ key: 'partenaires', label: 'Partenaires', el: (
      <Page k="partenaires">
        <Band />
        <div style={{ padding: '52px 90px 0' }}>
          <BigTitle k="partenaires.title" def="Partenaires" />
          <Movable k="partenaires.grid.mv" style={{ marginTop: 44 }}>
            <div className="grid grid-cols-4" style={{ gap: 22 }}>
              {p.partners.slice(0, 8).map((pt: any, i: number) => (
                <Movable key={pt.id} k={`partenaires.${i}.mv`} corner="tr">
                  <div className="flex flex-col items-center justify-center rounded-2xl bg-white"
                    style={{ height: 120, padding: 14, boxShadow: '0 6px 18px rgb(0 0 0 / .07)', gap: 8 }}>
                    {pt.logoUrl
                      ? /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={pt.logoUrl} alt={pt.name} style={{ maxHeight: 56, maxWidth: '100%', objectFit: 'contain' }} />
                      : <Building2 style={{ width: 30, height: 30, color: '#94a3b8' }} />}
                    <Ed k={`partenaires.${i}.n`} def={pt.name} className="truncate" style={{ fontSize: 12, fontWeight: 700, color: '#334155', maxWidth: '100%' }} />
                  </div>
                </Movable>
              ))}
            </div>
          </Movable>
        </div>
      </Page>
    ) })

    // 9 · RETOUR EN IMAGES (programme + session galleries)
    if (galleryPool.length) out.push({ key: 'images', label: 'Retour en images', el: (
      <Page k="images">
        <Band />
        <div className="flex" style={{ padding: '52px 64px 0', gap: 40 }}>
          <div style={{ width: 330, flexShrink: 0 }}>
            <BigTitle k="images.title" def="Retour en images" />
          </div>
          <Movable k="images.grid.mv" className="flex-1">
            <div className="grid grid-cols-3" style={{ gap: 14 }}>
              {galleryPool.slice(0, 6).map((u: string, i: number) => (
                <Movable key={`${u}-${i}`} k={`images.${i}.mv`} corner="tr" className={i === 0 ? 'col-span-2' : ''}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt=""
                    style={{ width: '100%', height: i === 0 ? 250 : 165, objectFit: 'cover', borderRadius: 18, boxShadow: '0 6px 16px rgb(0 0 0 / .10)' }} />
                </Movable>
              ))}
            </div>
          </Movable>
        </div>
      </Page>
    ) })

    // 10 · CONTRIBUTEURS — une diapositive par équipe (+ une pour les sans-équipe)
    for (const g of contribGroups) {
      out.push({ key: g.key, label: g.label, el: (
        <Page k={g.key}>
          <Band />
          <div style={{ padding: '52px 90px 0' }}>
            <BigTitle k={`${g.key}.title`} def={g.team ? `Équipe ${g.team}` : 'Ils font le programme'} />
            <Movable k={`${g.key}.grid.mv`} style={{ marginTop: 42 }}>
              <div className="grid grid-cols-3" style={{ gap: 20 }}>
                {g.list.slice(0, 9).map((c, i) => (
                  <Movable key={`${c.name}-${i}`} k={`${g.key}.${i}.mv`} corner="tr">
                    <div className="flex items-center rounded-2xl" style={{ gap: 14, background: T.card, padding: '16px 20px' }}>
                      {c.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.photoUrl} alt={c.name} className="shrink-0 rounded-full object-cover"
                          style={{ width: 46, height: 46 }} />
                      ) : (
                        <span className="flex shrink-0 items-center justify-center rounded-full font-extrabold"
                          style={{ width: 46, height: 46, background: DOTS[i % DOTS.length], color: '#fff', fontSize: 18 }}>
                          {(c.name || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0">
                        <Ed k={`${g.key}.${i}.n`} def={c.name} block className="truncate" style={{ fontSize: 18, fontWeight: 700, color: T.fg }} />
                        <Ed k={`${g.key}.${i}.r`} def={c.role} block className="truncate" style={{ fontSize: 13, fontWeight: 600, color: T.accent }} />
                      </div>
                    </div>
                  </Movable>
                ))}
              </div>
            </Movable>
          </div>
        </Page>
      ) })
    }

    // Extra slides: blank pages, or MIRRORS of an existing slide's layout
    // (duplication — même mise en page, blocs ajoutés indépendants).
    const builtByKey = new Map(out.map((s) => [s.key, s]))
    for (const xs of deck.extraSlides ?? []) {
      const src = xs.base ? builtByKey.get(xs.base) : undefined
      out.push({ key: `xtra-${xs.id}`, label: xs.label || 'Diapositive', el: src ? src.el : (
        <Page k={`xtra-${xs.id}`}>
          <Movable k={`xtra-${xs.id}.logo.mv`} className="absolute" style={{ left: 64, top: 48 }}><DotsLogo dark={dark} /></Movable>
        </Page>
      ) })
    }

    // 11 · MERCI
    out.push({ key: 'merci', label: 'Merci', el: (
      <Page k="merci">
        {DOTS.map((c, i) => (
          <span key={c} className="absolute rounded-full" style={{ background: c, opacity: dark ? 0.16 : 0.22, filter: 'blur(46px)', width: 150, height: 150, bottom: -70, left: 140 + i * 270 }} />
        ))}
        <Movable k="merci.logo.mv" className="absolute" style={{ left: 64, top: 48 }}><DotsLogo dark={dark} /></Movable>
        <div className="flex h-full flex-col items-center justify-center" style={{ gap: 26 }}>
          <Movable k="merci.title.mv">
            <Ed k="merci.title" def="Merci !" block className="text-center font-extrabold" style={{ fontSize: 88, color: T.accent }} />
          </Movable>
          <Movable k="merci.sub.mv">
            <Ed k="merci.sub" def={`${name} — un programme Medianet Incubator`} block className="text-center" style={{ fontSize: 24, color: T.muted }} />
          </Movable>
          <div className="flex overflow-hidden rounded-full" style={{ height: 6, width: 220 }}>
            {DOTS.map((c) => <span key={c} className="flex-1" style={{ background: c }} />)}
          </div>
        </div>
      </Page>
    ) })

    // Ordre des diapositives choisi par l'utilisateur (clés inconnues → ordre naturel).
    if (deck.order?.length) {
      const natural = new Map(out.map((s, i) => [s.key, i]))
      const idx = (k: string) => { const i = deck.order.indexOf(k); return i !== -1 ? i : 400 + (natural.get(k) ?? 0) }
      out.sort((a, b) => idx(a.key) - idx(b.key))
    }

    // Custom blocks above each slide + numéro de page (déplaçable, masquable,
    // départ configurable : « dès la diapo X, commencer à Y »).
    const visible = out.filter((s) => !deck.hidden.includes(s.key))
    const pcfg = deck.pageStart ?? { from: 2, num: 1 }
    return out.map((s) => {
      const visIdx = visible.findIndex((v) => v.key === s.key)
      const pageNo = visIdx + 1
      return {
        ...s,
        el: (
          <>
            {s.el}
            <CustomBlocksLayer slideKey={s.key} />
            {visIdx >= 0 && pageNo >= pcfg.from && (
              <Movable k="pagenum.mv" corner="tr" className="absolute" style={{ right: 28, bottom: 16 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: T.muted }}>{pageNo - pcfg.from + pcfg.num}</span>
              </Movable>
            )}
          </>
        ),
      }
    })
  }, [p, ordered, stats, T, dark, galleryPool, deck, contribGroups])

  const slides = useMemo(() => allSlides.filter((s) => !deck.hidden.includes(s.key)), [allSlides, deck.hidden])
  const safeCur = Math.min(cur, Math.max(0, slides.length - 1))
  const next = useCallback(() => setCur((c) => Math.min(slides.length - 1, c + 1)), [slides.length])
  const prev = useCallback(() => setCur((c) => Math.max(0, c - 1)), [])
  const curKey = slides[safeCur]?.key

  const toggleHidden = (key: string) => {
    const hidden = deck.hidden.includes(key) ? deck.hidden.filter((k) => k !== key) : [...deck.hidden, key]
    if (allSlides.length - hidden.length < 1) return
    saveDeck({ ...deck, hidden }); setCur(0)
  }
  const addExtraSlide = (label = 'Nouvelle diapositive') => {
    const xs = { id: rid(), label }
    saveDeck({ ...deck, extraSlides: [...(deck.extraSlides ?? []), xs] })
    toast.success('Diapositive vierge ajoutée (en fin de présentation)')
  }
  const removeExtraSlide = (xid: string) => {
    const key = `xtra-${xid}`
    const custom = { ...deck.custom }; delete custom[key]
    saveDeck({ ...deck, extraSlides: (deck.extraSlides ?? []).filter((x) => x.id !== xid), custom })
  }
  /** Duplicate: MIRROR of the source layout (same content) + independent copies
   *  of its added blocks. A blank extra slide duplicates as another blank. */
  const duplicateSlide = (srcKey: string, label: string) => {
    const srcExtra = srcKey.startsWith('xtra-') ? deck.extraSlides.find((x) => `xtra-${x.id}` === srcKey) : undefined
    const base = srcExtra ? srcExtra.base : srcKey
    const xs: ExtraSlide = { id: rid(), label: `${label} (copie)`, ...(base ? { base } : {}) }
    const dstKey = `xtra-${xs.id}`
    const overrides = { ...deck.overrides }; const pos = { ...deck.pos }; const styles = { ...deck.styles }
    const copies = (deck.custom[srcKey] ?? []).map((b) => {
      const nb = { ...b, id: rid() }
      if (deck.overrides[`cb.${b.id}`] != null) overrides[`cb.${nb.id}`] = deck.overrides[`cb.${b.id}`]
      if (deck.pos[`cb.${b.id}.mv`]) pos[`cb.${nb.id}.mv`] = { ...deck.pos[`cb.${b.id}.mv`] }
      if (deck.styles[`cb.${b.id}`]) styles[`cb.${nb.id}`] = { ...deck.styles[`cb.${b.id}`] }
      return nb
    })
    saveDeck({
      ...deck, overrides, pos, styles,
      extraSlides: [...(deck.extraSlides ?? []), xs],
      custom: { ...deck.custom, [dstKey]: copies },
      bg: deck.bg?.[srcKey] ? { ...deck.bg, [dstKey]: deck.bg[srcKey] } : deck.bg,
    })
    toast.success('Diapositive dupliquée — en fin de présentation (réordonnez avec ↑ ↓)')
  }
  /** Déplacer une diapositive vers le haut / le bas (ordre libre, comme Canva). */
  const moveSlide = (key: string, dir: -1 | 1) => {
    const keys = allSlides.map((s) => s.key)   // already in current display order
    const i = keys.indexOf(key); const j = i + dir
    if (i < 0 || j < 0 || j >= keys.length) return
    ;[keys[i], keys[j]] = [keys[j], keys[i]]
    saveDeck({ ...deck, order: keys })
  }

  // ── Présentations (plusieurs par programme) ────────────────────────────────
  const switchDeck = (nid: string) => { if (nid !== deckId) setDeckId(nid) }
  const duplicateDeck = () => {
    const nid = rid()
    const cn = deckList.find((d) => d.id === deckId)?.name ?? 'Présentation'
    try { localStorage.setItem(`pres-deck-v3-${programmeId}-${nid}`, JSON.stringify(deck)) } catch { /* full */ }
    saveDeckList([...deckList, { id: nid, name: `${cn} (copie)` }])
    setDeckId(nid)
    toast.success('Présentation dupliquée')
  }
  const deleteDeck = () => {
    if (deckList.length <= 1) { toast.error('Il faut garder au moins une présentation.'); return }
    if (!confirm('Supprimer cette présentation ? (les autres présentations ne sont pas touchées)')) return
    try { localStorage.removeItem(storageKey) } catch { /* ignore */ }
    const rest = deckList.filter((d) => d.id !== deckId)
    saveDeckList(rest)
    setDeckId(rest[0].id)
  }

  // Present mode = REAL full screen; starts on the CURRENT slide.
  const enterPresent = () => {
    setMode('present')
    document.documentElement.requestFullscreen?.().catch(() => { /* refused */ })
  }
  const exitPresent = useCallback(() => {
    setMode('edit')
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
  }, [])
  useEffect(() => {
    if (mode !== 'present') return
    const onFs = () => { if (!document.fullscreenElement) setMode('edit') }
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [mode])
  useEffect(() => {
    if (mode !== 'present') return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') next()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'Escape') exitPresent()
    }
    window.addEventListener('keydown', h)
    // Discreet hint instead of a permanent navigation panel.
    setPresentHint(true)
    const tm = setTimeout(() => setPresentHint(false), 4000)
    return () => { window.removeEventListener('keydown', h); clearTimeout(tm) }
  }, [mode, next, prev, exitPresent])

  // ── Add-a-block ────────────────────────────────────────────────────────────
  const addBlock = (kind: CBKind, url?: string) => {
    const slide = slides[safeCur]
    if (!slide) return
    if (kind === 'image' && !url) { setPickerFor('insert'); setPickerOpen(true); return }
    const id = rid()
    const list = [...(deck.custom[slide.key] ?? []), { id, kind, url }]
    saveDeck({ ...deck, custom: { ...deck.custom, [slide.key]: list } })
  }
  /** Image chosen in the picker → new block OR background of the selected block. */
  const pickImage = (u: string) => {
    if (pickerFor === 'block-bg' && selectedKey) setBlockStyle({ bgImage: u })
    else addBlock('image', u)
    setPickerFor('insert'); setPickerOpen(false)
  }

  // ── Canva: one-click API flow when configured, manual import otherwise ─────
  const waitForCanva = async () => {
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 2000))
      try { if ((await canvaApi.status()).data.connected) return true } catch { /* keep polling */ }
    }
    return false
  }
  const exportCanva = async () => {
    if (!p) return
    setExporting(true)
    try {
      let st = { configured: false, connected: false }
      try { st = (await canvaApi.status()).data } catch { /* backend not redeployed yet */ }
      const { pres, fileName } = await buildPptx()
      if (!st.configured) {
        await pres.writeFile({ fileName })
        window.open('https://www.canva.com/', '_blank', 'noopener,noreferrer')
        toast('Canva API non configurée — .pptx téléchargé : dans Canva, « Créer un design » → « Importer un fichier ».',
          { icon: '🎨', duration: 10000 })
        return
      }
      if (!st.connected) {
        const { url } = (await canvaApi.connectUrl()).data
        window.open(url, 'canva-auth', 'width=620,height=780')
        toast('Autorisez Medianet dans la fenêtre Canva…', { icon: '🔑', duration: 6000 })
        if (!(await waitForCanva())) { toast.error('Connexion Canva non finalisée — réessayez.'); return }
      }
      const blob: Blob = await pres.write({ outputType: 'blob' })
      const title: string = deckList.find((d) => d.id === deckId)?.name ?? (p.title ?? 'Présentation')
      const r = await canvaApi.importDesign(blob, title)
      if (r.data?.editUrl) {
        window.open(r.data.editUrl, '_blank', 'noopener,noreferrer')
        toast.success('Design créé dans votre Canva — il s’ouvre dans un nouvel onglet !')
      } else toast.error('Import Canva sans résultat — utilisez l’export PPTX.')
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Échec Canva — export PPTX puis import manuel.')
    } finally { setExporting(false) }
  }

  // ── PPTX build (shared by the export button and the Canva import) ──────────
  const buildPptx = async () => {
    const PptxGenJS = (await import('pptxgenjs')).default
    const pres: any = new PptxGenJS()
    pres.layout = 'LAYOUT_16x9'
    // Match the on-screen font (system-ui ≈ Segoe UI) so Canva/PowerPoint look the same.
    pres.theme = { headFontFace: 'Segoe UI', bodyFontFace: 'Segoe UI' }
    {
      const W = 10, H = 5.63
      const name: string = p.title ?? p.name ?? 'Programme'
      const hid = (k: string) => (deck.hiddenBlocks ?? []).includes(k)
      const off = (k: string) => ({ dx: ((deck.pos[k]?.x ?? 0) / CW) * W, dy: ((deck.pos[k]?.y ?? 0) / CH) * H })
      const scOf = (k: string) => deck.pos[k]?.s ?? 1
      // Per-text style + block scale → PPTX options (1 canvas px ≈ 0.5625 pt).
      const sty = (k: string, o: Record<string, unknown>) => {
        const st = deck.styles?.[k]
        const sc = scOf(`${k}.mv`)
        const base: Record<string, unknown> = { ...o }
        if (st) {
          const face = FONTS.find((f) => f.css === st.font)?.pptx
          if (st.size) base.fontSize = Math.round(st.size * 0.5625)
          if (st.color) base.color = st.color.replace('#', '')
          if (st.bold != null) base.bold = st.bold
          if (st.italic) base.italic = true
          if (st.align) base.align = st.align
          if (st.font && face) base.fontFace = face
        }
        if (sc !== 1 && typeof base.fontSize === 'number') base.fontSize = Math.max(6, Math.round((base.fontSize as number) * sc))
        return base
      }
      const dots = (s: any, x: number, y: number, r = 0.11) => {
        DOTS.forEach((c, i) => s.addShape(pres.ShapeType.ellipse, { x: x + i * (r * 2 + 0.06), y, w: r * 2, h: r * 2, fill: { color: c.replace('#', '') }, line: { type: 'none' } }))
        // « Medianet incubator » wordmark next to the dots (was missing in exports).
        s.addText([
          { text: 'Medianet', options: { breakLine: true } },
          { text: 'incubator', options: { bold: true } },
        ], { x: x + 4 * (r * 2 + 0.06) + 0.05, y: y - 0.08, w: 1.4, h: r * 2 + 0.16, fontSize: 10, color: T.pptxFg, lineSpacing: 11 })
      }
      const band = (s: any) => {
        s.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.66, fill: { color: T.band.replace('#', '') }, line: { type: 'none' } })
        if (!hid('band.logo.mv')) dots(s, 0.35, 0.2)
        if (!hid('band.name.mv')) s.addText(t('band.name', name), sty('band.name', { x: W - 3.6, y: 0.12, w: 3.3, h: 0.42, align: 'right', fontSize: 14, bold: true, color: T.pptxAccent }))
      }
      const title = (s: any, txt: string, k = '', y = 0.95) =>
        s.addText(txt, sty(k, { x: 0.6, y, w: 8.8, h: 0.6, fontSize: 26, bold: true, color: T.pptxAccent }))
      const fetchData = async (url: string): Promise<string | null> => {
        try { const r = await fetch(url); if (!r.ok) return null; const b = await r.blob()
          return await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.onerror = () => res(null); fr.readAsDataURL(b) })
        } catch { return null }
      }

      let slideNo = 0
      for (const sl of slides) {
        const s = pres.addSlide()
        // Mirror slides (duplication) render their SOURCE layout; their own
        // added blocks stay keyed on the mirror itself.
        const xsrc = sl.key.startsWith('xtra-')
          ? (deck.extraSlides ?? []).find((x) => `xtra-${x.id}` === sl.key)?.base
          : undefined
        const lk = xsrc ?? sl.key
        s.background = { color: (deck.bg?.[lk] ?? T.page).replace('#', '') }
        if (lk === 'cover') {
          if (!hid('cover.logo.mv')) dots(s, 0.4, 0.35, 0.13)
          if (!hid('cover.title.mv')) {
            const o = off('cover.title.mv')
            s.addText(t('cover.title', name), sty('cover.title', { x: 0.5 + o.dx, y: 1.5 + o.dy, w: 6.2, h: 1.4, fontSize: 44, bold: true, color: T.pptxAccent }))
          }
          if (!hid('cover.tagline.mv')) {
            const tg = off('cover.tagline.mv')
            s.addText(t('cover.tagline', p.tagline || 'Le programme d’incubation Medianet'), sty('cover.tagline', { x: 0.5 + tg.dx, y: 2.6 + tg.dy, w: 6, h: 0.5, fontSize: 16, color: T.pptxMuted }))
          }
          if ((p.startDate || p.location) && !hid('cover.dates.mv')) {
            const dOff = off('cover.dates.mv')
            const dateTxt = [p.startDate ? `${fmtD(p.startDate)} → ${fmtD(p.endDate)}` : '', p.location ?? ''].filter(Boolean).join('   ·   ')
            s.addText(t('cover.dates', dateTxt), sty('cover.dates', { x: 0.5 + dOff.dx, y: 3.95 + dOff.dy, w: 6, h: 0.4, fontSize: 12, color: T.pptxMuted }))
          }
          if (!hid('cover.pill.mv')) {
            const po = off('cover.pill.mv')
            s.addShape(pres.ShapeType.roundRect, { x: 0.5 + po.dx, y: 3.6 + po.dy, w: 3.1, h: 0.62, rectRadius: 0.31, fill: { color: T.pptxAccent }, line: { type: 'none' } })
            s.addText(t('cover.edition', p.startDate ? `ÉDITION ${new Date(p.startDate).getFullYear()}` : 'NOUVELLE ÉDITION'),
              sty('cover.edition', { x: 0.5 + po.dx, y: 3.6 + po.dy, w: 3.1, h: 0.62, align: 'center', fontSize: 15, bold: true, color: 'FFFFFF', charSpacing: 3 }))
          }
          const img = p.bannerImageUrl || p.logoUrl
          if (img && !hid('cover.visual.mv')) { const data = await fetchData(img); if (data) s.addImage({ data, x: 6.6, y: 0, w: 3.4, h: H }) }
        } else if (lk === 'programme') {
          band(s); title(s, `Programme ${t('programme.title', name)}`, 'programme.title')
          if (!hid('programme.body.mv')) {
            const o = off('programme.body.mv')
            s.addShape(pres.ShapeType.roundRect, { x: 0.6 + o.dx, y: 1.7 + o.dy, w: 8.8, h: 3.3, rectRadius: 0.19, fill: { color: T.card.replace('#', '') }, line: { type: 'none' } })
            s.addText(t('programme.body', p.description ?? ''), sty('programme.body', { x: 0.9 + o.dx, y: 1.9 + o.dy, w: 8.2, h: 2.9, align: 'center', fontSize: 15, color: T.pptxFg, valign: 'middle' }))
          }
        } else if (lk === 'secteurs') {
          band(s); title(s, t('secteurs.title', 'Secteurs'), 'secteurs.title')
          if (!hid('secteurs.grid.mv')) p.sectors.slice(0, 8).forEach((sec: string, i: number) => {
            if (hid(`secteurs.${i}.mv`)) return
            const col = i % 4, row = Math.floor(i / 4)
            const o = off(`secteurs.${i}.mv`)
            const x = 0.6 + col * 2.3 + o.dx, y = 1.9 + row * 1.0 + o.dy
            s.addShape(pres.ShapeType.roundRect, { x, y, w: 2.1, h: 0.8, rectRadius: 0.125, fill: { color: T.card.replace('#', '') }, line: { type: 'none' } })
            s.addText(t(`secteurs.${i}`, sec), sty(`secteurs.${i}`, { x, y, w: 2.1, h: 0.8, align: 'center', valign: 'middle', fontSize: 13, bold: true, color: T.pptxFg }))
          })
        } else if (lk === 'parcours') {
          band(s); title(s, t('parcours.title', 'Le parcours'), 'parcours.title')
          if (!hid('parcours.list.mv')) ordered.forEach((ses, i) => {
            if (hid(`parcours.${i}.mv`)) return
            const o = off(`parcours.${i}.mv`)
            s.addText(`${i + 1}.  ${t(`parcours.${i}.t`, ses.title)}   —   ${t(`parcours.${i}.d`, fmtD(ses.startDate))}`,
              sty(`parcours.${i}.t`, { x: 0.7 + o.dx, y: 1.75 + i * 0.5 + o.dy, w: 8.6, h: 0.45, fontSize: 14, color: T.pptxFg }))
          })
        } else if (lk === 'chiffres') {
          band(s); title(s, t('chiffres.title', 'Chiffres clés'), 'chiffres.title')
          if (!hid('chiffres.grid.mv')) stats.slice(0, 4).forEach((st2, i) => {
            if (hid(`chiffres.${i}.mv`)) return
            const col = i % 2, row = Math.floor(i / 2)
            const o = off(`chiffres.${i}.mv`)
            const x = 0.7 + col * 4.5 + o.dx, y = 1.75 + row * 1.75 + o.dy
            s.addShape(pres.ShapeType.roundRect, { x, y, w: 4.1, h: 1.55, rectRadius: 0.19, fill: { color: T.card.replace('#', '') }, line: { type: 'none' } })
            s.addText(t(`chiffres.${i}.n`, String(st2.n)), sty(`chiffres.${i}.n`, { x, y: y + 0.1, w: 4.1, h: 0.85, align: 'center', fontSize: 40, bold: true, color: T.pptxAccent }))
            s.addText(t(`chiffres.${i}.l`, st2.l).toUpperCase(), sty(`chiffres.${i}.l`, { x, y: y + 0.97, w: 4.1, h: 0.4, align: 'center', fontSize: 10, bold: true, color: T.pptxFg }))
          })
        } else if (lk === 'objectifs' || lk === 'benefices') {
          const isObj = lk === 'objectifs'
          const bullet = deck.overrides[`${lk}.bullets`] !== 'off' ? '●  ' : ''
          band(s); title(s, t(`${lk}.title`, isObj ? 'Objectifs' : 'Ce que gagnent les participants'), `${lk}.title`)
          if (!hid(`${lk}.list.mv`)) {
            const items = (isObj ? p.objectives : p.benefits).slice(0, 6).map((x: string, i: number) => t(`${lk}.${i}`, x))
            items.forEach((x: string, i: number) => {
              if (hid(`${lk}.${i}.mv`)) return
              const o = off(`${lk}.${i}.mv`)
              s.addText(`${bullet}${x}`, sty(`${lk}.${i}`, { x: 0.7 + o.dx, y: 1.8 + i * 0.55 + o.dy, w: 8.6, h: 0.5, fontSize: 16, color: T.pptxFg }))
            })
          }
        } else if (lk === 'partenaires') {
          band(s); title(s, t('partenaires.title', 'Partenaires'), 'partenaires.title')
          const list = p.partners.slice(0, 8)
          if (!hid('partenaires.grid.mv')) for (let i = 0; i < list.length; i++) {
            if (hid(`partenaires.${i}.mv`)) continue
            const col = i % 4, row = Math.floor(i / 4)
            const o = off(`partenaires.${i}.mv`)
            const x = 0.6 + col * 2.3 + o.dx, y = 1.85 + row * 1.65 + o.dy
            s.addShape(pres.ShapeType.roundRect, { x, y, w: 2.1, h: 1.4, rectRadius: 0.1, fill: { color: 'FFFFFF' }, line: { color: 'E2E8F0', width: 0.75 } })
            const data = list[i].logoUrl ? await fetchData(list[i].logoUrl) : null
            if (data) s.addImage({ data, x: x + 0.4, y: y + 0.15, w: 1.3, h: 0.75 })
            s.addText(t(`partenaires.${i}.n`, list[i].name), sty(`partenaires.${i}.n`, { x, y: y + 0.95, w: 2.1, h: 0.35, align: 'center', fontSize: 9, bold: true, color: '334155' }))
          }
        } else if (lk === 'images') {
          band(s); title(s, t('images.title', 'Retour en images'), 'images.title')
          const urls: string[] = galleryPool.slice(0, 6)
          if (!hid('images.grid.mv')) for (let i = 0; i < urls.length; i++) {
            if (hid(`images.${i}.mv`)) continue
            const data = await fetchData(urls[i]); if (!data) continue
            const col = i % 3, row = Math.floor(i / 3)
            const o = off(`images.${i}.mv`)
            s.addImage({ data, x: 0.6 + col * 3.05 + o.dx, y: 1.75 + row * 1.85 + o.dy, w: 2.85, h: 1.7 })
          }
        } else if (lk.startsWith('contributeurs')) {
          const g = contribGroups.find((x) => x.key === lk)
          band(s); title(s, t(`${lk}.title`, g?.team ? `Équipe ${g.team}` : 'Ils font le programme'), `${lk}.title`)
          if (g && !hid(`${lk}.grid.mv`)) {
            const list = g.list.slice(0, 9)
            for (let i = 0; i < list.length; i++) {
              if (hid(`${lk}.${i}.mv`)) continue
              const c = list[i]
              const col = i % 3, row = Math.floor(i / 3)
              const o = off(`${lk}.${i}.mv`)
              const x = 0.55 + col * 3.1 + o.dx, y = 1.75 + row * 1.15 + o.dy
              s.addShape(pres.ShapeType.roundRect, { x, y, w: 2.9, h: 0.95, rectRadius: 0.125, fill: { color: T.card.replace('#', '') }, line: { type: 'none' } })
              let tx = x + 0.15
              if (c.photoUrl) {
                const data = await fetchData(c.photoUrl)
                if (data) { s.addImage({ data, x: x + 0.12, y: y + 0.14, w: 0.66, h: 0.66, rounding: true }); tx = x + 0.9 }
              }
              s.addText(t(`${lk}.${i}.n`, c.name), sty(`${lk}.${i}.n`, { x: tx, y: y + 0.1, w: 2.9 - (tx - x) - 0.1, h: 0.4, fontSize: 13, bold: true, color: T.pptxFg }))
              s.addText(t(`${lk}.${i}.r`, c.role), sty(`${lk}.${i}.r`, { x: tx, y: y + 0.5, w: 2.9 - (tx - x) - 0.1, h: 0.35, fontSize: 11, bold: true, color: T.pptxAccent }))
            }
          }
        } else if (lk === 'merci') {
          if (!hid('merci.logo.mv')) dots(s, 0.4, 0.35, 0.13)
          if (!hid('merci.title.mv')) s.addText(t('merci.title', 'Merci !'), sty('merci.title', { x: 0.5, y: 1.9, w: 9, h: 1.2, align: 'center', fontSize: 54, bold: true, color: T.pptxAccent }))
          if (!hid('merci.sub.mv')) s.addText(t('merci.sub', `${name} — un programme Medianet Incubator`), sty('merci.sub', { x: 1, y: 3.2, w: 8, h: 0.6, align: 'center', fontSize: 16, color: T.pptxMuted }))
        } else if (lk.startsWith('xtra-')) {
          if (!hid(`${lk}.logo.mv`)) dots(s, 0.4, 0.35, 0.13)
        }

        // Custom blocks added on this slide (same base spots as on screen).
        const customs = deck.custom?.[sl.key] ?? []
        for (let i = 0; i < customs.length; i++) {
          const cb = customs[i]
          const mvKey = `cb.${cb.id}.mv`
          if (hid(mvKey)) continue
          const base = cbBase(i)
          const o = off(mvKey)
          const sc = scOf(mvKey)
          const bx = (base.left / CW) * W + o.dx, by = (base.top / CH) * H + o.dy
          if (cb.kind === 'image' && cb.url) {
            const data = await fetchData(cb.url)
            if (data) { const wIn = ((cb.w ?? 340) / CW) * W * sc; s.addImage({ data, x: bx, y: by, w: wIn, h: wIn * 0.62 }) }
          } else if (cb.kind === 'pill') {
            s.addShape(pres.ShapeType.roundRect, { x: bx, y: by, w: 2.6 * sc, h: 0.55 * sc, rectRadius: 0.27 * sc, fill: { color: T.pptxAccent }, line: { type: 'none' } })
            s.addText(t(`cb.${cb.id}`, CB_DEF.pill), sty(`cb.${cb.id}`, { x: bx, y: by, w: 2.6 * sc, h: 0.55 * sc, align: 'center', fontSize: 13, bold: true, color: 'FFFFFF', charSpacing: 2 }))
          } else if (cb.kind === 'heading' || cb.kind === 'text') {
            const isH = cb.kind === 'heading'
            const bs2 = deck.blockStyles?.[mvKey]
            s.addText(t(`cb.${cb.id}`, isH ? CB_DEF.heading : CB_DEF.text), sty(`cb.${cb.id}`, {
              x: bx, y: by, w: 4.6, h: isH ? 0.7 : 1.2, fontSize: isH ? 26 : 14,
              bold: isH, color: isH ? T.pptxAccent : T.pptxFg,
              ...(bs2?.bg ? { fill: { color: bs2.bg.replace('#', '') } } : {}),
              ...(bs2?.borderColor || bs2?.borderWidth
                ? { line: { color: (bs2.borderColor ?? '#111827').replace('#', ''), width: Math.max(0.5, (bs2.borderWidth ?? 2) * 0.75) } }
                : {}),
            }))
          } else {
            // Shapes
            const col = (cb.color ?? T.accent).replace('#', '')
            const d = SHAPE_PX[cb.kind] ?? { w: 140, h: 140 }
            const wIn = (d.w / CW) * W * sc, hIn = (d.h / CH) * H * sc
            const map: Record<string, string> = { rect: 'roundRect', circle: 'ellipse', line: 'line', arrow: 'rightArrow', star: 'star5', triangle: 'triangle' }
            const shape = (pres.ShapeType as any)[map[cb.kind]] ?? pres.ShapeType.rect
            if (cb.kind === 'line') s.addShape(shape, { x: bx, y: by, w: wIn, h: 0, line: { color: col, width: 3 } })
            else s.addShape(shape, { x: bx, y: by, w: wIn, h: hIn, fill: { color: col }, line: { type: 'none' } })
          }
        }

        // Numéro de page — départ configurable, déplaçable, masquable.
        slideNo += 1
        const pcfg = deck.pageStart ?? { from: 2, num: 1 }
        if (slideNo >= pcfg.from && !hid('pagenum.mv')) {
          const po2 = off('pagenum.mv')
          s.addText(String(slideNo - pcfg.from + pcfg.num),
            { x: W - 0.7 + po2.dx, y: H - 0.42 + po2.dy, w: 0.5, h: 0.3, align: 'right', fontSize: 10, color: T.pptxMuted })
        }
      }

      const deckName = deckList.find((d) => d.id === deckId)?.name ?? 'presentation'
      return { pres, fileName: `${(name + ' - ' + deckName).replace(/[^\w\- ]+/g, '')}.pptx` }
    }
  }

  const exportPptx = async () => {
    if (!p) return
    setExporting(true)
    try {
      const { pres, fileName } = await buildPptx()
      await pres.writeFile({ fileName })
      toast.success('PPTX exporté — modifiable dans PowerPoint, importable dans Canva.')
    } catch (e) { console.error(e); toast.error('Export PPTX impossible') }
    finally { setExporting(false) }
  }

  if (!p) return <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">Génération de la présentation…</div>

  const deckName = deckList.find((d) => d.id === deckId)?.name ?? 'Présentation'

  return (
    <StudioCtx.Provider value={ctx}>
      {/* ══ STUDIO ══ */}
      {mode === 'edit' && (
        <div className="flex h-screen flex-col bg-background print:hidden">
          {/* Row 1 — présentation + actions */}
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-2">
            <Link href={`/programmes/${programmeId}`}>
              <Button variant="ghost" size="icon" title="Retour au programme"><ArrowLeft className="h-4 w-4" /></Button>
            </Link>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-foreground">Studio de présentation</p>
              <p className="truncate text-[11px] text-muted-foreground">{p.title ?? p.name}</p>
            </div>
            {/* Présentations du programme */}
            <div className="ml-2 flex items-center gap-1 rounded-xl border border-border bg-muted/30 p-1">
              <select value={deckId} onChange={(e) => switchDeck(e.target.value)} title="Choisir la présentation"
                className="h-7 max-w-[180px] rounded-lg border-0 bg-transparent px-2 text-xs font-semibold text-foreground focus:outline-none">
                {deckList.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <button onClick={() => setWizard({ mode: 'create' })} title="Nouvelle présentation (assistant pas-à-pas)"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground">
                <Plus className="h-3.5 w-3.5" />
              </button>
              <button onClick={duplicateDeck} title="Dupliquer cette présentation"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground">
                <Copy className="h-3.5 w-3.5" />
              </button>
              <button onClick={deleteDeck} title="Supprimer cette présentation"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-rose-500">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={undo} title="Annuler (Ctrl+Z)"><Undo2 className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={redo} title="Rétablir (Ctrl+Y)"><Redo2 className="h-4 w-4" /></Button>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" title="Réinitialiser cette présentation (textes, positions, blocs)"
              onClick={() => { localStorage.removeItem(storageKey); undoRef.current.push(deck); setDeck(EMPTY_DECK); toast.success('Présentation réinitialisée') }}>
              <RotateCcw className="h-3.5 w-3.5" />Réinitialiser
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.print()} title="Imprimer / PDF">
              <Printer className="h-3.5 w-3.5" />PDF
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={exportPptx} disabled={exporting}
              title="Exporter en PowerPoint (.pptx) — modifiable">
              <Download className="h-3.5 w-3.5" />{exporting ? 'Export…' : 'PPTX'}
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCanva} disabled={exporting}
              title="Créer le design dans votre Canva (API) — ou export + import manuel si non configuré">
              <ExternalLink className="h-3.5 w-3.5" />Canva
            </Button>
            <Button variant="brand" size="sm" className="gap-1.5" onClick={enterPresent} title="Présenter en plein écran — démarre sur la diapositive courante">
              <Play className="h-3.5 w-3.5" />Présenter
            </Button>
          </div>

          {/* Row 2 — outils de la diapositive */}
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card/60 px-4 py-1.5">
            {/* Blocs texte + image */}
            <div className="flex items-center gap-0.5 rounded-xl border border-border bg-muted/30 p-1" title="Ajouter un bloc">
              {([['heading', Type, 'Titre'], ['text', AlignLeft, 'Texte'], ['pill', BadgePlus, 'Pastille'], ['image', ImagePlus, 'Image (galeries / upload)']] as [CBKind, any, string][]).map(([kind, Icon, lbl]) => (
                <button key={kind} onClick={() => addBlock(kind)} title={lbl}
                  className="flex h-7 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                  <Icon className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
            {/* Formes */}
            <div className="flex items-center gap-0.5 rounded-xl border border-border bg-muted/30 p-1" title="Ajouter une forme">
              {SHAPES.map(([kind, Icon, lbl]) => (
                <button key={kind} onClick={() => addBlock(kind)} title={lbl}
                  className="flex h-7 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                  <Icon className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
            {/* Thème */}
            <div className="flex items-center gap-1.5 rounded-xl border border-border bg-muted/30 p-1" title="Thème">
              <Palette className="ml-1 h-3.5 w-3.5 text-muted-foreground" />
              {Object.entries(THEMES).map(([key, th]) => (
                <button key={key} onClick={() => saveDeck({ ...deck, theme: key })} title={th.name}
                  className={`flex h-7 w-9 items-center justify-center rounded-lg border-2 text-[9px] font-extrabold transition-transform hover:scale-105 ${deck.theme === key ? 'border-foreground scale-105' : 'border-border'}`}
                  style={{ background: th.page, color: th.accent }}>Aa</button>
              ))}
            </div>
            {/* Fond de la diapo courante */}
            {curKey && (
              <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/30 p-1" title="Fond de cette diapositive">
                <span className="ml-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Fond</span>
                <button onClick={() => saveDeck({ ...deck, bg: { ...deck.bg, [curKey]: '#FFFFFF' } })} title="Blanc"
                  className="h-6 w-6 rounded-md border border-border bg-white" />
                <input type="color" value={deck.bg?.[curKey] ?? T.page}
                  onChange={(e) => saveDeck({ ...deck, bg: { ...deck.bg, [curKey]: e.target.value } })}
                  title="Couleur libre" className="h-6 w-8 cursor-pointer rounded border border-border bg-transparent p-0.5" />
                {deck.bg?.[curKey] && (
                  <button onClick={() => { const bg = { ...deck.bg }; delete bg[curKey]; saveDeck({ ...deck, bg }) }}
                    className="rounded-md px-1.5 text-[10px] font-semibold text-muted-foreground hover:bg-accent">auto</button>
                )}
              </div>
            )}
            {/* Numérotation des pages : diapo de départ + numéro initial */}
            <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/30 p-1" title="Numérotation : à partir de quelle diapo, et avec quel numéro">
              <span className="ml-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">N°</span>
              <label className="flex items-center gap-0.5 text-[10px] font-semibold text-muted-foreground">
                dès diapo
                <input type="number" min={1} max={40} value={(deck.pageStart ?? { from: 2, num: 1 }).from}
                  onChange={(e) => saveDeck({ ...deck, pageStart: { ...(deck.pageStart ?? { from: 2, num: 1 }), from: Math.max(1, Number(e.target.value) || 1) } })}
                  className="h-6 w-12 rounded-md border border-border bg-background px-1 text-xs text-foreground" />
              </label>
              <label className="flex items-center gap-0.5 text-[10px] font-semibold text-muted-foreground">
                départ
                <input type="number" min={0} max={99} value={(deck.pageStart ?? { from: 2, num: 1 }).num}
                  onChange={(e) => saveDeck({ ...deck, pageStart: { ...(deck.pageStart ?? { from: 2, num: 1 }), num: Number(e.target.value) || 0 } })}
                  className="h-6 w-12 rounded-md border border-border bg-background px-1 text-xs text-foreground" />
              </label>
            </div>
            {/* Puces on/off pour les listes */}
            {(curKey === 'objectifs' || curKey === 'benefices') && (
              <button onClick={() => saveDeck({ ...deck, overrides: { ...deck.overrides, [`${curKey}.bullets`]: deck.overrides[`${curKey}.bullets`] === 'off' ? 'on' : 'off' } })}
                className="rounded-xl border border-border bg-muted/30 px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground hover:bg-accent hover:text-foreground">
                {deck.overrides[`${curKey}.bullets`] === 'off' ? '• Afficher les puces' : '• Masquer les puces'}
              </button>
            )}
            <button onClick={() => setWizard({ mode: 'edit', step: 2 })}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/30 px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
              title="Contributeurs (jurys, mentors, rôles libres) — diapositive dédiée">
              <Users className="h-3.5 w-3.5" />Contributeurs{deck.contributors.length ? ` (${deck.contributors.length})` : ''}
            </button>
            <button onClick={() => setWizard({ mode: 'edit', step: 3 })}
              className="inline-flex items-center gap-1.5 rounded-xl border border-violet-500/40 bg-violet-500/5 px-2.5 py-1.5 text-[11px] font-semibold text-violet-600 hover:bg-violet-500/10 dark:text-violet-300"
              title="Medi (IA) — idées, améliorations de textes, diapositives supplémentaires">
              <Sparkles className="h-3.5 w-3.5" />Medi
            </button>
            {(deck.hiddenBlocks?.length ?? 0) > 0 && (
              <button onClick={() => saveDeck({ ...deck, hiddenBlocks: [] })}
                className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/5 px-2.5 py-1.5 text-[11px] font-semibold text-amber-700 hover:bg-amber-500/10 dark:text-amber-300">
                <Eye className="h-3.5 w-3.5" />Réafficher les blocs masqués ({deck.hiddenBlocks.length})
              </button>
            )}
          </div>

          {/* Block-style bar — bordure / fond / rayon / plan du bloc sélectionné */}
          {selectedKey && (
            <div className="flex flex-wrap items-center gap-2.5 border-b border-border bg-sky-500/5 px-4 py-1.5">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                <Square className="h-3.5 w-3.5" />Bloc sélectionné
              </span>
              <label className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
                Bordure
                <input type="color" value={selBlockStyle.borderColor ?? '#111827'}
                  onChange={(e) => setBlockStyle({ borderColor: e.target.value })}
                  className="h-6 w-8 cursor-pointer rounded border border-border bg-transparent p-0.5" />
                <input type="number" min={0} max={20} value={selBlockStyle.borderWidth ?? ''} placeholder="0"
                  onChange={(e) => setBlockStyle({ borderWidth: e.target.value ? Number(e.target.value) : undefined })}
                  title="Épaisseur (px)" className="h-7 w-14 rounded-lg border border-border bg-background px-2 text-xs text-foreground" />
              </label>
              <label className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
                Fond
                <input type="color" value={selBlockStyle.bg ?? '#ffffff'}
                  onChange={(e) => setBlockStyle({ bg: e.target.value })}
                  className="h-6 w-8 cursor-pointer rounded border border-border bg-transparent p-0.5" />
                {selBlockStyle.bg && (
                  <button onClick={() => setBlockStyle({ bg: undefined })}
                    className="rounded px-1 text-[10px] font-semibold text-muted-foreground hover:bg-accent">×</button>
                )}
              </label>
              <button onClick={() => { setPickerFor('block-bg'); setPickerOpen(true) }}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:bg-accent">
                <ImagePlus className="h-3 w-3" />Image de fond
              </button>
              {selBlockStyle.bgImage && (
                <button onClick={() => setBlockStyle({ bgImage: undefined })}
                  className="rounded-lg border border-border px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:bg-accent">
                  Retirer l&apos;image
                </button>
              )}
              <label className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
                Rayon
                <input type="number" min={0} max={80} value={selBlockStyle.radius ?? ''} placeholder="auto"
                  onChange={(e) => setBlockStyle({ radius: e.target.value === '' ? undefined : Number(e.target.value) })}
                  title="0 = angles droits (comme Canva)" className="h-7 w-14 rounded-lg border border-border bg-background px-2 text-xs text-foreground" />
              </label>
              <button onClick={clearBlockStyle}
                className="rounded-lg border border-border px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:bg-accent">
                Style auto
              </button>
              <button onClick={() => setSelectedKey(null)} title="Désélectionner"
                className="ml-auto rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Text-format bar — police / taille / couleur / gras / alignement */}
          {activeKey && (
            <div className="flex flex-wrap items-center gap-2.5 border-b border-border bg-muted/30 px-4 py-1.5">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                <Type className="h-3.5 w-3.5" />Style du texte
              </span>
              <select value={activeStyle.font ?? ''} onChange={(e) => setStyle({ font: e.target.value || undefined })}
                title="Police" className="h-7 rounded-lg border border-border bg-background px-2 text-xs text-foreground">
                {FONTS.map((f) => <option key={f.label} value={f.css}>{f.label}</option>)}
              </select>
              <label className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
                Taille
                <input type="number" min={8} max={160} value={activeStyle.size ?? ''} placeholder="auto"
                  onChange={(e) => setStyle({ size: e.target.value ? Number(e.target.value) : undefined })}
                  className="h-7 w-16 rounded-lg border border-border bg-background px-2 text-xs text-foreground" />
              </label>
              <div className="flex items-center gap-1">
                {[T.accent, T.fg, T.muted, ...DOTS, '#FFFFFF', '#000000'].map((c) => (
                  <button key={c} type="button" onClick={() => setStyle({ color: c })} title={c}
                    className={`h-5 w-5 rounded-full border ${activeStyle.color === c ? 'ring-2 ring-sky-500' : 'border-border'}`}
                    style={{ background: c }} />
                ))}
                <input type="color" value={activeStyle.color ?? '#333333'} onChange={(e) => setStyle({ color: e.target.value })}
                  title="Couleur personnalisée" className="h-6 w-8 cursor-pointer rounded border border-border bg-transparent p-0.5" />
              </div>
              <div className="flex items-center gap-0.5">
                <button type="button" title="Gras" onClick={() => setStyle({ bold: activeStyle.bold === true ? false : true })}
                  className={`flex h-7 w-7 items-center justify-center rounded-lg border text-foreground ${activeStyle.bold ? 'border-brand-500 bg-brand-500/15' : 'border-border hover:bg-accent'}`}>
                  <Bold className="h-3.5 w-3.5" />
                </button>
                <button type="button" title="Italique" onClick={() => setStyle({ italic: !activeStyle.italic || undefined })}
                  className={`flex h-7 w-7 items-center justify-center rounded-lg border text-foreground ${activeStyle.italic ? 'border-brand-500 bg-brand-500/15' : 'border-border hover:bg-accent'}`}>
                  <Italic className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-0.5">
                {([['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]] as const).map(([a, Icon]) => (
                  <button key={a} type="button" title={`Aligner (${a})`}
                    onClick={() => setStyle({ align: activeStyle.align === a ? undefined : a })}
                    className={`flex h-7 w-7 items-center justify-center rounded-lg border text-foreground ${activeStyle.align === a ? 'border-brand-500 bg-brand-500/15' : 'border-border hover:bg-accent'}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
              <button type="button" onClick={clearStyle}
                className="rounded-lg border border-border px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:bg-accent">
                Style auto
              </button>
              <button type="button" onClick={() => setActiveKey(null)} title="Fermer"
                className="ml-auto rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <div className="flex min-h-0 flex-1">
            {/* Slide list — real miniatures + gestion des diapositives */}
            <div className="w-64 shrink-0 space-y-2 overflow-y-auto border-r border-border bg-card p-2.5">
              {allSlides.map((s) => {
                const hidden = deck.hidden.includes(s.key)
                const visIndex = slides.findIndex((v) => v.key === s.key)
                const isExtra = s.key.startsWith('xtra-')
                return (
                  <div key={s.key} className={`group relative overflow-hidden rounded-lg border transition-colors ${
                    !hidden && visIndex === safeCur ? 'border-brand-500 ring-1 ring-brand-500' : 'border-border'} ${hidden ? 'opacity-40' : ''}`}>
                    <button onClick={() => { if (!hidden) setCur(visIndex) }} className="block w-full">
                      <div className="pointer-events-none"><SlideCanvas>{s.el}</SlideCanvas></div>
                    </button>
                    <div className="flex items-center justify-between gap-1 border-t border-border bg-card px-2 py-1">
                      <span className="min-w-0 truncate text-[10px] font-semibold text-foreground">{hidden ? '·' : `${visIndex + 1} · `}{s.label}</span>
                      <span className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
                        <button onClick={() => moveSlide(s.key, -1)} title="Monter la diapositive"
                          className="rounded p-0.5 text-muted-foreground hover:text-foreground">
                          <ChevronUp className="h-3 w-3" />
                        </button>
                        <button onClick={() => moveSlide(s.key, 1)} title="Descendre la diapositive"
                          className="rounded p-0.5 text-muted-foreground hover:text-foreground">
                          <ChevronDown className="h-3 w-3" />
                        </button>
                        <button onClick={() => duplicateSlide(s.key, s.label)} title="Dupliquer (blocs ajoutés)"
                          className="rounded p-0.5 text-muted-foreground hover:text-foreground">
                          <Copy className="h-3 w-3" />
                        </button>
                        <button onClick={() => toggleHidden(s.key)} title={hidden ? 'Réafficher' : 'Masquer'}
                          className="rounded p-0.5 text-muted-foreground hover:text-foreground">
                          {hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </button>
                        {isExtra && (
                          <button onClick={() => removeExtraSlide(s.key.slice(5))} title="Supprimer cette diapositive"
                            className="rounded p-0.5 text-muted-foreground hover:text-rose-500">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </span>
                    </div>
                  </div>
                )
              })}
              <button onClick={() => addExtraSlide()}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-2 py-3 text-[11px] font-semibold text-muted-foreground hover:bg-accent hover:text-foreground">
                <FilePlus2 className="h-3.5 w-3.5" />Diapositive vierge
              </button>
            </div>

            {/* Canvas — cliquer dans le vide désélectionne */}
            <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-3 overflow-y-auto bg-muted/40 p-6"
              onClick={() => setSelectedKey(null)}>
              {/* Pas de coins arrondis ici : ils masquaient les angles de la diapo
                  et ne correspondaient pas au rendu en présentation. */}
              <div className="w-full max-w-5xl overflow-hidden border border-border shadow-2xl">
                {slides[safeCur] && <SlideCanvas>{slides[safeCur].el}</SlideCanvas>}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Pencil className="h-3.5 w-3.5" />Tout texte est cliquable et éditable
                <span className="text-border">|</span>
                <Move className="h-3.5 w-3.5" />⠿ déplacer · bleu = échelle · vert = largeur · 👁 supprimer
              </div>
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="sm" onClick={prev} disabled={safeCur === 0}><ArrowLeft className="h-4 w-4" /></Button>
                <span className="min-w-[3.5rem] text-center text-xs font-semibold text-muted-foreground tabular-nums">{safeCur + 1} / {slides.length}</span>
                <Button variant="outline" size="sm" onClick={next} disabled={safeCur >= slides.length - 1}><ArrowRight className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>

          {/* Image picker — galeries programme + sessions, upload, recherche, URL */}
          {pickerOpen && (
            <div onClick={() => setPickerOpen(false)} className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
              <div onClick={(e) => e.stopPropagation()}
                className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border-2 border-border bg-card shadow-2xl">
                <div className="flex items-center gap-2 border-b border-border px-5 py-3">
                  <ImagePlus className="h-4 w-4 text-brand-500" />
                  <h2 className="text-sm font-bold text-foreground">Insérer une image</h2>
                  <button onClick={() => setPickerOpen(false)} className="ml-auto rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                  {galleryPool.length > 0 && (
                    <div>
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                        Galeries du programme & des sessions
                      </p>
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {galleryPool.map((u, i) => (
                          <button key={`${u}-${i}`} type="button" onClick={() => pickImage(u)}
                            className="overflow-hidden rounded-xl border border-border transition-transform hover:scale-[1.03] hover:ring-2 hover:ring-brand-500">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={u} alt="" className="h-20 w-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      Téléverser depuis mon PC · rechercher · ou coller une URL
                    </p>
                    <ImageUpload value="" folder="presentation" searchContext="feature"
                      onChange={(u) => { if (u) pickImage(u) }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Assistant de création / édition (sections, contributeurs, Medi) */}
          {wizard && (
            <DeckWizard
              mode={wizard.mode} startStep={wizard.step ?? 0}
              programmeId={programmeId} programme={p}
              initial={wizard.mode === 'edit'
                ? { name: deckName, theme: deck.theme, hidden: deck.hidden, contributors: deck.contributors }
                : { name: `Présentation ${deckList.length + 1}`, theme: 'blanc', hidden: [], contributors: [] }}
              onCancel={() => setWizard(null)}
              onDone={(res) => {
                if (wizard.mode === 'edit') {
                  saveDeck({
                    ...deck, theme: res.theme, hidden: res.hidden, contributors: res.contributors,
                    overrides: { ...deck.overrides, ...res.overrides },
                    extraSlides: [...(deck.extraSlides ?? []), ...res.extraSlides],
                    custom: { ...deck.custom, ...res.extraCustom },
                  })
                  saveDeckList(deckList.map((d) => d.id === deckId ? { ...d, name: res.name } : d))
                } else {
                  const nid = rid()
                  const nd: Deck = {
                    ...EMPTY_DECK, theme: res.theme, hidden: res.hidden, contributors: res.contributors,
                    overrides: res.overrides, extraSlides: res.extraSlides, custom: res.extraCustom,
                  }
                  try { localStorage.setItem(`pres-deck-v3-${programmeId}-${nid}`, JSON.stringify(nd)) } catch { /* full */ }
                  saveDeckList([...deckList, { id: nid, name: res.name }])
                  setDeckId(nid)
                }
                setWizard(null)
                toast.success(wizard.mode === 'edit' ? 'Présentation mise à jour' : 'Présentation créée !')
              }} />
          )}
        </div>
      )}

      {/* ══ PRESENT — sans panneau : ← → / espace / clic (clic droit = retour) ══ */}
      {mode === 'present' && (
        <div className="fixed inset-0 z-50 flex cursor-none items-center justify-center bg-black print:hidden"
          onClick={next} onContextMenu={(e) => { e.preventDefault(); prev() }}>
          <div style={{ width: 'min(100vw, calc(100vh * 16 / 9))' }}>
            {slides[safeCur] && <SlideCanvas>{slides[safeCur].el}</SlideCanvas>}
          </div>
          {presentHint && (
            <div className="pointer-events-none fixed bottom-8 left-1/2 -translate-x-1/2 rounded-xl bg-black/70 px-4 py-2 text-xs font-medium text-white/85 backdrop-blur-md">
              → · espace · clic : suivant&nbsp;&nbsp;|&nbsp;&nbsp;← · clic droit : précédent&nbsp;&nbsp;|&nbsp;&nbsp;Échap : quitter
            </div>
          )}
        </div>
      )}

      {/* ══ PRINT — A4 landscape, one slide per page, fixed scale ══ */}
      <div className="hidden print:block">
        <style>{`@page { size: A4 landscape; margin: 0 }`}</style>
        {slides.map((s) => (
          <section key={s.key} className="break-after-page" style={{ width: 1122, height: 631, overflow: 'hidden' }}>
            <SlideCanvas fixedScale={1122 / CW}>{s.el}</SlideCanvas>
          </section>
        ))}
      </div>
    </StudioCtx.Provider>
  )
}

// ── Assistant de création pas-à-pas (sections · contributeurs · Medi IA) ─────
interface WizardResult {
  name: string; theme: string; hidden: string[]
  contributors: Contributor[]
  overrides: Record<string, string>
  extraSlides: ExtraSlide[]
  extraCustom: Record<string, CustomBlock[]>
}

function DeckWizard({ mode, startStep, programmeId, programme, initial, onCancel, onDone }: {
  mode: 'create' | 'edit'
  startStep: number
  programmeId: number
  programme: any
  initial: { name: string; theme: string; hidden: string[]; contributors: Contributor[] }
  onCancel: () => void
  onDone: (res: WizardResult) => void
}) {
  const programmeName: string = programme?.title ?? programme?.name ?? 'Programme'
  const STEPS = ['Nom & thème', 'Sections', 'Contributeurs', 'Medi (IA)', 'Récapitulatif']
  const [step, setStep] = useState(Math.min(startStep, STEPS.length - 1))
  const [name, setName] = useState(initial.name)
  const [theme, setTheme] = useState(initial.theme)
  const [hidden, setHidden] = useState<string[]>(initial.hidden)
  const [contributors, setContributors] = useState<Contributor[]>(initial.contributors)
  const [cName, setCName] = useState(''); const [cRole, setCRole] = useState('Jury'); const [cTeam, setCTeam] = useState('')
  const teams = Array.from(new Set(contributors.map((c) => c.team).filter(Boolean))) as string[]
  const uploadPhoto = async (i: number, file: File | undefined) => {
    if (!file) return
    try {
      const url = await filesApi.uploadImage(file, 'contributors')
      setContributors((l) => l.map((c, j) => j === i ? { ...c, photoUrl: url } : c))
      toast.success('Photo enregistrée')
    } catch { toast.error('Téléversement impossible (MinIO démarré ?)') }
  }
  const [suggested, setSuggested] = useState<Contributor[]>([])
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [ideas, setIdeas] = useState<string[]>([])
  const [acceptedIdeas, setAcceptedIdeas] = useState<string[]>([])
  const [brief, setBrief] = useState('')
  const [aiBusy, setAiBusy] = useState<string | null>(null)

  // Suggest jurys / mentors from the programme's invitations.
  useEffect(() => {
    notificationsApi.byProgramme(programmeId)
      .then((r) => {
        const seen = new Set<string>()
        const out: Contributor[] = []
        for (const inv of (r.data ?? []) as any[]) {
          const nm = inv.recipientName || inv.recipientEmail
          const role = inv.type === 'JURY' ? 'Jury' : inv.type === 'MENTOR' ? 'Mentor' : null
          if (!nm || !role || seen.has(nm)) continue
          seen.add(nm); out.push({ name: nm, role })
        }
        setSuggested(out.slice(0, 12))
      })
      .catch(() => { /* pas d'invitations — saisie manuelle */ })
  }, [programmeId])

  const toggleSection = (key: string) => {
    if (key === 'cover') return   // la couverture reste
    setHidden((h) => h.includes(key) ? h.filter((k) => k !== key) : [...h, key])
  }
  const addContributor = (c: Contributor) => {
    if (!c.name.trim()) return
    setContributors((l) => l.some((x) => x.name === c.name && x.role === c.role) ? l : [...l, { name: c.name.trim(), role: c.role.trim() || 'Contributeur' }])
  }

  const ask = async (label: string, field: string, aiMode: 'generate' | 'enhance', current: string | undefined, apply: (v: string) => void, wantList = false) => {
    setAiBusy(label)
    try {
      const r = await adminAiApi.fieldSuggest({
        field, mode: aiMode, current,
        context: `Présentation du programme d'incubation « ${programmeName} ». ${programme?.description ?? ''} ${brief ? 'Consigne : ' + brief : ''}`,
        locale: 'fr',
      })
      const vals = r.data?.values?.length ? r.data.values : (r.data?.value ? [r.data.value] : [])
      if (!vals.length) { toast.error(r.data?.error ?? 'Pas de suggestion — service IA ?'); return }
      if (wantList) setIdeas(vals.slice(0, 6))
      else apply(vals[0])
    } catch { toast.error('Medi est indisponible (service IA non démarré ?)') }
    finally { setAiBusy(null) }
  }

  const finish = () => {
    const extraSlides: ExtraSlide[] = []
    const extraCustom: Record<string, CustomBlock[]> = {}
    const ov = { ...overrides }
    for (const idea of acceptedIdeas) {
      const xs = { id: rid(), label: idea.slice(0, 40) }
      const bid = rid()
      extraSlides.push(xs)
      extraCustom[`xtra-${xs.id}`] = [{ id: bid, kind: 'heading' }]
      ov[`cb.${bid}`] = idea
    }
    // Contributeurs slide visibility follows content.
    const hid = hidden.filter((k) => k !== 'contributeurs')
    onDone({
      name: name.trim() || 'Présentation', theme, hidden: contributors.length ? hid : hid,
      contributors, overrides: ov, extraSlides, extraCustom,
    })
  }

  return (
    <div onClick={onCancel} className="fixed inset-0 z-[85] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border-2 border-border bg-card shadow-2xl">
        {/* Header + stepper */}
        <div className="border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-500" />
            <h2 className="text-sm font-bold text-foreground">
              {mode === 'create' ? 'Nouvelle présentation' : 'Modifier la présentation'} — {STEPS[step]}
            </h2>
            <button onClick={onCancel} className="ml-auto rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-brand-500 transition-all duration-300" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {step === 0 && (
            <>
              <label className="block text-[11px] font-semibold text-muted-foreground">Nom de la présentation</label>
              <input value={name} onChange={(e) => setName(e.target.value)} autoFocus
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold" />
              <label className="block text-[11px] font-semibold text-muted-foreground">Thème de base (blanc par défaut — chaque diapo reste colorable)</label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(THEMES).map(([key, th]) => (
                  <button key={key} onClick={() => setTheme(key)}
                    className={`flex h-14 w-24 flex-col items-center justify-center rounded-xl border-2 text-xs font-bold transition-transform hover:scale-105 ${theme === key ? 'border-brand-500 ring-1 ring-brand-500' : 'border-border'}`}
                    style={{ background: th.page, color: th.accent }}>
                    Aa<span className="text-[9px] font-semibold" style={{ color: th.muted }}>{th.name}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <p className="text-xs text-muted-foreground">Choisissez les sections à inclure — tout reste modifiable ensuite.</p>
              <div className="grid grid-cols-2 gap-2">
                {SECTION_DEFS.map((sd) => {
                  const on = !hidden.includes(sd.key)
                  return (
                    <button key={sd.key} onClick={() => toggleSection(sd.key)} disabled={sd.key === 'cover'}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition-colors ${on ? 'border-brand-500 bg-brand-500/10 text-foreground' : 'border-border text-muted-foreground'} ${sd.key === 'cover' ? 'opacity-60' : 'hover:bg-accent'}`}>
                      <span className={`flex h-4 w-4 items-center justify-center rounded border ${on ? 'border-brand-500 bg-brand-500 text-white' : 'border-border'}`}>
                        {on && <Check className="h-3 w-3" />}
                      </span>
                      {sd.label}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-xs text-muted-foreground">
                Les contributeurs apparaissent sur la diapositive « Ils font le programme », groupés par rôle.
              </p>
              {suggested.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Suggestions (invitations du programme)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggested.map((c, i) => (
                      <button key={i} onClick={() => addContributor(c)}
                        className="rounded-full border border-border bg-muted/30 px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-accent">
                        + {c.name} · <span className="text-brand-600 dark:text-brand-400">{c.role}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap items-end gap-2">
                <label className="min-w-[140px] flex-1 text-[11px] font-semibold text-muted-foreground">Nom
                  <input value={cName} onChange={(e) => setCName(e.target.value)} placeholder="Prénom Nom"
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-normal" />
                </label>
                <label className="text-[11px] font-semibold text-muted-foreground">Rôle
                  <div className="mt-1 flex gap-1">
                    <input value={cRole} onChange={(e) => setCRole(e.target.value)} list="role-presets"
                      className="w-28 rounded-lg border border-input bg-background px-3 py-2 text-sm font-normal" />
                    <datalist id="role-presets">{ROLE_PRESETS.map((r) => <option key={r} value={r} />)}</datalist>
                  </div>
                </label>
                <label className="text-[11px] font-semibold text-muted-foreground">Équipe (optionnel)
                  <div className="mt-1 flex gap-1">
                    <input value={cTeam} onChange={(e) => setCTeam(e.target.value)} list="team-presets" placeholder="—"
                      className="w-28 rounded-lg border border-input bg-background px-3 py-2 text-sm font-normal" />
                    <datalist id="team-presets">{teams.map((tm) => <option key={tm} value={tm} />)}</datalist>
                  </div>
                </label>
                <Button variant="outline" size="sm" className="gap-1"
                  onClick={() => { addContributor({ name: cName, role: cRole, team: cTeam.trim() || undefined }); setCName('') }}>
                  <Plus className="h-3.5 w-3.5" />Ajouter
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                💡 Chaque <b>équipe</b> obtient sa propre diapositive. La 📷 ajoute ou <b>remplace</b> la photo.
              </p>
              {contributors.length > 0 ? (
                <ul className="space-y-1.5">
                  {contributors.map((c, i) => (
                    <li key={i} className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
                      {c.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.photoUrl} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                          {(c.name || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                        </span>
                      )}
                      <label title={c.photoUrl ? 'Remplacer la photo' : 'Ajouter une photo'}
                        className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
                        <Camera className="h-3.5 w-3.5" />
                        <input type="file" accept="image/*" className="hidden"
                          onChange={(e) => { uploadPhoto(i, e.target.files?.[0]); e.currentTarget.value = '' }} />
                      </label>
                      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">{c.name}</span>
                      {c.team && <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-600 dark:text-violet-300">{c.team}</span>}
                      <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-bold text-brand-600 dark:text-brand-400">{c.role}</span>
                      <button onClick={() => setContributors((l) => l.filter((_, j) => j !== i))}
                        className="rounded p-0.5 text-muted-foreground hover:text-rose-500"><X className="h-3.5 w-3.5" /></button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
                  Aucun contributeur — la diapositive « Contributeurs » n&apos;apparaîtra pas.
                </p>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <p className="text-xs text-muted-foreground">
                <b>Medi</b> peut proposer des textes et des diapositives supplémentaires. Donnez-lui une consigne (optionnel) puis lancez les suggestions.
              </p>
              <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={2}
                placeholder="Ex. ton institutionnel, insister sur l'accompagnement technique, public : investisseurs…"
                className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Button variant="outline" size="sm" disabled={!!aiBusy} className="gap-1.5"
                  onClick={() => ask('slogan', 'tagline', 'generate', programme?.tagline,
                    (v) => { setOverrides((o) => ({ ...o, 'cover.tagline': v })); toast.success('Slogan appliqué à la couverture') })}>
                  {aiBusy === 'slogan' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}Slogan
                </Button>
                <Button variant="outline" size="sm" disabled={!!aiBusy} className="gap-1.5"
                  onClick={() => ask('description', 'description', 'enhance', programme?.description,
                    (v) => { setOverrides((o) => ({ ...o, 'programme.body': v })); toast.success('Description améliorée') })}>
                  {aiBusy === 'description' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}Améliorer la description
                </Button>
                <Button variant="outline" size="sm" disabled={!!aiBusy} className="gap-1.5"
                  onClick={() => ask('ideas', 'presentation_slide_ideas', 'generate', undefined, () => {}, true)}>
                  {aiBusy === 'ideas' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}Idées de diapositives
                </Button>
              </div>
              {Object.keys(overrides).length > 0 && (
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-3 text-xs text-foreground">
                  {overrides['cover.tagline'] && <p className="mb-1"><b>Slogan :</b> {overrides['cover.tagline']}</p>}
                  {overrides['programme.body'] && <p className="line-clamp-3"><b>Description :</b> {overrides['programme.body']}</p>}
                </div>
              )}
              {ideas.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    Idées — cliquez pour les ajouter comme diapositives
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {ideas.map((idea, i) => {
                      const on = acceptedIdeas.includes(idea)
                      return (
                        <button key={i} onClick={() => setAcceptedIdeas((l) => on ? l.filter((x) => x !== idea) : [...l, idea])}
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${on ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'border-border bg-muted/30 text-foreground hover:bg-accent'}`}>
                          {on ? '✓ ' : '+ '}{idea}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {step === 4 && (
            <div className="space-y-2 text-xs text-foreground">
              <p><b>Nom :</b> {name || 'Présentation'}</p>
              <p><b>Thème :</b> {THEMES[theme]?.name ?? theme}</p>
              <p><b>Sections :</b> {SECTION_DEFS.filter((s) => !hidden.includes(s.key)).map((s) => s.label).join(' · ')}</p>
              <p><b>Contributeurs :</b> {contributors.length ? contributors.map((c) => `${c.name} (${c.role})`).join(', ') : '—'}</p>
              <p><b>Medi :</b> {[
                overrides['cover.tagline'] && 'slogan',
                overrides['programme.body'] && 'description améliorée',
                acceptedIdeas.length && `${acceptedIdeas.length} diapositive(s) supplémentaire(s)`,
              ].filter(Boolean).join(' · ') || 'aucune contribution'}</p>
              <p className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-muted-foreground">
                Tout reste modifiable dans le studio : textes, styles, blocs, formes, images, fonds…
              </p>
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-3">
          <button onClick={() => (step === 0 ? onCancel() : setStep((s) => s - 1))}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-accent">
            {step === 0 ? 'Annuler' : (<><ChevronLeft className="h-3.5 w-3.5" />Précédent</>)}
          </button>
          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep((s) => s + 1)}
              className="inline-flex items-center gap-1 rounded-lg bg-brand-500 px-4 py-1.5 text-xs font-bold text-white hover:bg-brand-600">
              Suivant<ChevronRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button onClick={finish}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-1.5 text-xs font-bold text-white hover:bg-brand-600">
              <Check className="h-3.5 w-3.5" />{mode === 'create' ? 'Créer la présentation' : 'Appliquer'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
