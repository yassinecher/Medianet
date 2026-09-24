/**
 * Landing-page theme builder.
 *
 * Turns the admin's primary / accent hex colors into a full `brand-50…950`
 * palette for BOTH light and dark mode, returned as a CSS string scoped to
 * `.landing-theme` (light) and `.dark .landing-theme` (dark).
 *
 * Why not just shift RGB values: a very light pick (yellow, pastel) gave
 * unreadable `text-brand-600` on white, and a very dark pick (navy, black) gave
 * invisible `dark:text-brand-400` on the dark background. Here every shade keeps
 * the chosen hue/saturation, and the shades used as TEXT are nudged until they
 * reach WCAG AA contrast (4.5:1) against the page background of their mode.
 * Text drawn ON the brand color (`text-brand-contrast`) is white or near-black,
 * whichever reads better.
 */

type RGB = [number, number, number]
type HSL = [number, number, number] // h 0-360, s 0-100, l 0-100

const LIGHT_BG: RGB = [247, 249, 250] // --background light (204 26% 98%)
const DARK_BG: RGB = [7, 13, 19]      // --background dark  (210 45% 5%)
const DARK_TEXT: RGB = [15, 23, 32]
const WHITE: RGB = [255, 255, 255]

export function hexToRgb(hex?: string | null): RGB | null {
  if (!hex) return null
  let h = hex.replace('#', '').trim()
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function rgbToHsl([r, g, b]: RGB): HSL {
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  let h = 0, s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    h = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4
    h /= 6
  }
  return [h * 360, s * 100, l * 100]
}

function hslToRgb([h, s, l]: HSL): RGB {
  const sn = s / 100, ln = l / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = sn * Math.min(ln, 1 - ln)
  const f = (n: number) => ln - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)]
}

function luminance([r, g, b]: RGB): number {
  const c = [r, g, b].map((v) => {
    const x = v / 255
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

function contrast(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const triplet = ([r, g, b]: RGB) => `${r} ${g} ${b}`
const toHex = ([r, g, b]: RGB) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
const hslTriplet = ([h, s, l]: HSL) => `${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%`

/** Move lightness in `step` increments until `color` reaches `ratio` against `bg`. */
function ensureContrast(hsl: HSL, bg: RGB, ratio: number, step: number): HSL {
  let [h, s, l] = hsl
  for (let i = 0; i < 60 && contrast(hslToRgb([h, s, l]), bg) < ratio; i++) {
    l = clamp(l + step, 0, 100)
    if (l === 0 || l === 100) break
  }
  return [h, s, l]
}

/** Accent for a mode: kept visible on the page and dark enough for white labels (3:1, bold UI text). */
function accentFor(accent: RGB, mode: 'light' | 'dark'): RGB {
  const [ah, as, al] = rgbToHsl(accent)
  const hsl: HSL = [ah, as, mode === 'light' ? clamp(al, 22, 65) : clamp(al, 40, 75)]
  return hslToRgb(ensureContrast(hsl, WHITE, 3, -2))
}

/**
 * Text color on a brand fill (buttons, badges): WHITE — the Medianet look — unless
 * the fill is so light that white becomes illegible (yellows, pastels), then near-black.
 */
const MIN_WHITE_ON_FILL = 2.2
function onColor(bg: RGB): RGB {
  return contrast(WHITE, bg) >= MIN_WHITE_ON_FILL ? WHITE : DARK_TEXT
}

// Target lightness per shade (500 is the admin's own color, clamped per mode).
const STEPS: Record<number, number> = { 50: 97, 100: 93, 200: 86, 300: 76, 400: 64, 600: 42, 700: 34, 800: 27, 900: 20, 950: 13 }

interface ModeVars { vars: Record<string, string>; primaryHex: string; accentHex: string | null }

function buildMode(primary: RGB, accent: RGB | null, mode: 'light' | 'dark'): ModeVars {
  const bg = mode === 'light' ? LIGHT_BG : DARK_BG
  const [h, s, l] = rgbToHsl(primary)
  // Keep the base visible as a fill/button color on this mode's background:
  // a near-white pick is darkened in light mode, a near-black one lightened in dark mode.
  const baseL = mode === 'light' ? clamp(l, 22, 62) : clamp(l, 42, 72)
  const base: HSL = [h, s, baseL]
  const vars: Record<string, string> = {}

  for (const [k, targetL] of Object.entries(STEPS)) {
    let shade: HSL = [h, Math.min(s, k === '50' || k === '100' ? 90 : 100), targetL]
    // Shades used for TEXT in each mode must stay readable on the page background:
    // light mode uses text-brand-600/700, dark mode uses dark:text-brand-300/400.
    if (mode === 'light' && (k === '600' || k === '700')) shade = ensureContrast(shade, bg, 4.5, -2)
    if (mode === 'dark' && (k === '300' || k === '400')) shade = ensureContrast(shade, bg, 4.5, +2)
    // Dark shades carry WHITE labels (gradient buttons, banners, avatars) in both modes.
    if (Number(k) >= 600) shade = ensureContrast(shade, WHITE, 4.5, -2)
    vars[`--brand-${k}`] = triplet(hslToRgb(shade))
  }
  const baseRgb = hslToRgb(base)
  vars['--brand-500'] = triplet(baseRgb)
  vars['--brand-contrast'] = triplet(onColor(baseRgb))
  // shadcn tokens (bg-primary buttons, focus rings) follow the brand too.
  vars['--primary'] = hslTriplet(base)
  vars['--primary-foreground'] = hslTriplet(rgbToHsl(onColor(baseRgb)))
  vars['--ring'] = hslTriplet(base)

  let accentHex: string | null = null
  if (accent) {
    const a = accentFor(accent, mode)
    vars['--brand-accent'] = triplet(a)
    accentHex = toHex(a)
  }
  return { vars, primaryHex: toHex(baseRgb), accentHex }
}

function modeCss(selector: string, m: ModeVars): string {
  const v = { ...m.vars }
  // Gradient used by the shimmer CTAs + programme cards, and the "brand" Button.
  const to = m.accentHex ?? m.primaryHex
  v['--shimmer-bg'] = `linear-gradient(90deg, ${m.primaryHex} 0%, ${to} 100%)`
  v['--brand-cta'] = m.primaryHex
  v['--brand-cta-accent'] = to
  // Wide banners with WHITE titles (programmes pages): built from the white-safe
  // dark shade + accent, never from the raw (possibly light) base color.
  v['--banner-bg'] = `linear-gradient(90deg, rgb(${m.vars['--brand-600']}) 0%, ${m.accentHex ?? `rgb(${m.vars['--brand-800']})`} 100%)`
  return `${selector}{${Object.entries(v).map(([k, val]) => `${k}:${val}`).join(';')}}`
}

// ── The Medianet default palette ────────────────────────────────────────────
// What the site shows when no custom color is chosen. KEEP IN SYNC with
// globals.css (:root / .dark) and the `brand-accent` fallback in tailwind.config.ts.

/** Medianet cyan (globals.css --brand-500) — shown as the default primary in the editor. */
export const MEDIANET_PRIMARY = '#00A3E0'
/** Medianet gold (logo + default CTA gradient) — shown as the default accent in the editor. */
export const MEDIANET_ACCENT = '#FBB431'

const DEFAULT_BRAND: Record<string, string> = {
  '--brand-50': '240 249 255', '--brand-100': '224 242 254', '--brand-200': '186 230 253',
  '--brand-300': '125 211 252', '--brand-400': '56 189 248', '--brand-500': '0 163 224',
  '--brand-600': '0 132 199', '--brand-700': '3 105 161', '--brand-800': '7 89 133',
  '--brand-900': '12 74 110', '--brand-950': '8 47 73',
}

/**
 * Explicit Medianet defaults for a scoped element. Needed because the site-wide
 * theme (html:root) may carry OTHER colors: an element left without overrides
 * would inherit them instead of showing the default. `initial` makes the
 * gradient/button variables fall back to the components' built-in Medianet
 * gradients (gold → cyan).
 */
function defaultCss(lightSel: string, darkSel: string): string {
  const common: Record<string, string> = {
    ...DEFAULT_BRAND,
    '--brand-contrast': '255 255 255',
    '--shimmer-bg': 'initial', '--brand-cta': 'initial', '--brand-cta-accent': 'initial', '--banner-bg': 'initial',
  }
  const block = (sel: string, vars: Record<string, string>) =>
    `${sel}{${Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';')}}`
  const gold = hexToRgb(MEDIANET_ACCENT)!
  return block(lightSel, { ...common, '--brand-accent': triplet(accentFor(gold, 'light')),
    '--primary': '199 100% 44%', '--primary-foreground': '0 0% 100%', '--ring': '199 100% 44%' })
    + block(darkSel, { ...common, '--brand-accent': triplet(accentFor(gold, 'dark')),
      '--primary': '199 100% 48%', '--primary-foreground': '210 45% 5%', '--ring': '199 100% 48%' })
}

/**
 * Theme CSS for two selectors (light + dark), or '' when no valid custom color
 * is set (the default Medianet palette from globals.css then applies). When only
 * one of the two colors is set, the other one is the Medianet default.
 */
export function buildThemeCss(primaryHex: string | null | undefined, accentHex: string | null | undefined,
                              lightSel: string, darkSel: string): string {
  const primary = hexToRgb(primaryHex)
  const accent = hexToRgb(accentHex)
  if (!primary && !accent) return ''
  const p = primary ?? hexToRgb(MEDIANET_PRIMARY)!
  const a = accent ?? hexToRgb(MEDIANET_ACCENT)!
  return modeCss(lightSel, buildMode(p, a, 'light')) + modeCss(darkSel, buildMode(p, a, 'dark'))
}

/**
 * Landing page wrapper (`.landing-theme`). Always explicit: with no custom
 * colors it RESETS to the Medianet defaults, so the landing (and the editor
 * preview of a « Défaut » draft) never inherits the site-wide colors.
 */
export function buildLandingThemeCss(primaryHex?: string | null, accentHex?: string | null): string {
  return buildThemeCss(primaryHex, accentHex, '.landing-theme', '.dark .landing-theme')
    || defaultCss('.landing-theme', '.dark .landing-theme')
}

export interface SiteThemeSettings {
  primaryColor?: string | null
  accentColor?: string | null
  siteThemeMode?: string | null
  sitePrimaryColor?: string | null
  siteAccentColor?: string | null
}

/**
 * Whole front-office theme, per the admin's "Couleurs du reste du site" choice:
 * default → '' (Medianet palette), same → landing colors, custom → site colors.
 * `html:root` / `html.dark` out-rank globals.css `:root` / `.dark` regardless of
 * stylesheet order; the landing's own `.landing-theme` still overrides it there.
 */
export function buildSiteThemeCss(s: SiteThemeSettings | null | undefined): string {
  if (!s) return ''
  const mode = s.siteThemeMode ?? 'default'
  if (mode === 'same') return buildThemeCss(s.primaryColor, s.accentColor, 'html:root', 'html.dark')
  if (mode === 'custom') return buildThemeCss(s.sitePrimaryColor, s.siteAccentColor, 'html:root', 'html.dark')
  return ''
}
