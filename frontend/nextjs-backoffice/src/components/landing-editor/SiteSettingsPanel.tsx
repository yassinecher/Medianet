'use client'
import { RotateCcw } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ImageUpload } from '@/components/upload/ImageUpload'
import { cn } from '@/lib/utils'
import { Group, Segmented, TextField } from './fields'
import type { LandingDoc } from './schema'

/**
 * The site's own palette when no color is chosen — mirrors MEDIANET_PRIMARY /
 * MEDIANET_ACCENT in the front-office (lib/landingTheme.ts): Medianet cyan + gold.
 */
const MEDIANET_PRIMARY = '#00A3E0'
const MEDIANET_ACCENT = '#FBB431'

/** One-click color pairs (empty = back to the Medianet palette). */
const THEME_PRESETS = [
  { id: 'default',  label: 'Défaut Medianet (cyan + or)', primary: '', accent: '' },
  { id: 'sunset',   label: 'Sunset',   primary: '#FF6A00', accent: '#9333EA' },
  { id: 'ocean',    label: 'Ocean',    primary: '#0EA5E9', accent: '#14B8A6' },
  { id: 'forest',   label: 'Forest',   primary: '#16A34A', accent: '#CA8A04' },
  { id: 'royal',    label: 'Royal',    primary: '#7C3AED', accent: '#F59E0B' },
  { id: 'tunisia',  label: 'Tunisia',  primary: '#E70013', accent: '#1F2937' },
  { id: 'minimal',  label: 'Minimal',  primary: '#111827', accent: '#6B7280' },
  { id: 'rose',     label: 'Rose',     primary: '#E11D48', accent: '#F472B6' },
  { id: 'midnight', label: 'Midnight', primary: '#1E40AF', accent: '#8B5CF6' },
]

const SITE_MODES = [
  { value: 'default' as const, label: 'Défaut Medianet', hint: 'Les autres pages gardent les couleurs Medianet.' },
  { value: 'same' as const,    label: 'Comme l’accueil', hint: 'Les couleurs de la page d’accueil s’appliquent à tout le site public.' },
  { value: 'custom' as const,  label: 'Dédiées',         hint: 'Des couleurs différentes pour le reste du site public.' },
]

/** Hex picker + text input; empty = the Medianet default (shown in the swatch and placeholder). */
function ColorField({ label, value, fallback, onChange }: {
  label: string; value?: string; fallback: string; onChange: (v: string) => void
}) {
  return (
    <div className="space-y-1">
      <span className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        {label}
        {value
          ? <button type="button" onClick={() => onChange('')} className="text-[11px] font-semibold text-brand-600 hover:underline dark:text-brand-400">Défaut</button>
          : <span className="text-[11px]">Défaut Medianet</span>}
      </span>
      <div className="flex gap-2">
        <input type="color" value={value || fallback} onChange={(e) => onChange(e.target.value)} aria-label={label}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-input" />
        <Input value={value ?? ''} placeholder={`Défaut (${fallback})`} onChange={(e) => onChange(e.target.value)} className="font-mono" />
      </div>
    </div>
  )
}

export function SiteSettingsPanel({ doc, set }: { doc: LandingDoc; set: (patch: Partial<LandingDoc>) => void }) {
  const mode = doc.siteThemeMode ?? 'default'
  return (
    <>
      <Group title="Logo du site">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-14 min-w-[160px] items-center justify-center rounded-lg border border-border bg-white px-3">
            <img src={doc.logoUrl || '/brand/medianet-incubator.svg'} alt="Logo" className="max-h-10 w-auto object-contain" />
          </div>
          {doc.logoUrl && (
            <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={() => set({ logoUrl: '' })}>
              <RotateCcw className="h-3.5 w-3.5" />Revenir au logo Medianet Incubator
            </Button>
          )}
        </div>
        <ImageUpload value={doc.logoUrl} folder="branding" previewHeight={50} compact enableSearch={false}
          onChange={(url) => set({ logoUrl: url })} />
        <p className="text-[11px] text-muted-foreground">
          SVG ou PNG transparent recommandé. Remplace le logo du site public et de l’administration (après publication).
        </p>
      </Group>

      <Group title="Couleurs de la page d’accueil">
        <div className="flex flex-wrap gap-1.5">
          {THEME_PRESETS.map((t) => {
            const active = (doc.primaryColor ?? '') === t.primary && (doc.accentColor ?? '') === t.accent
            const isDefault = !t.primary
            return (
              <button key={t.id} type="button" title={t.label} onClick={() => set({ primaryColor: t.primary, accentColor: t.accent })}
                className={cn('relative h-8 w-8 overflow-hidden rounded-lg border-2 transition-transform hover:scale-105',
                  active ? 'border-foreground' : 'border-transparent')}
                style={{ background: `linear-gradient(135deg, ${t.primary || MEDIANET_PRIMARY} 50%, ${t.accent || MEDIANET_ACCENT} 50%)` }}>
                {isDefault && <span className="absolute inset-x-0 bottom-0 bg-black/45 text-[8px] font-bold leading-3 text-white">M</span>}
              </button>
            )
          })}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <ColorField label="Couleur primaire" value={doc.primaryColor} fallback={MEDIANET_PRIMARY} onChange={(v) => set({ primaryColor: v })} />
          <ColorField label="Couleur accent (dégradés)" value={doc.accentColor} fallback={MEDIANET_ACCENT} onChange={(v) => set({ accentColor: v })} />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Titres, boutons, cartes, icônes et dégradés suivent ces couleurs ; les contrastes sont ajustés automatiquement en mode clair et sombre.
        </p>
      </Group>

      <Group title="Couleurs du reste du site public">
        <Segmented label="Programmes, connexion, tableaux de bord, profil…" value={mode} onChange={(v) => set({ siteThemeMode: v })}
          options={SITE_MODES.map(({ value, label }) => ({ value, label }))} />
        <p className="text-[11px] text-muted-foreground">{SITE_MODES.find((m) => m.value === mode)?.hint}</p>
        {mode === 'custom' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <ColorField label="Couleur primaire du site" value={doc.sitePrimaryColor} fallback={MEDIANET_PRIMARY} onChange={(v) => set({ sitePrimaryColor: v })} />
            <ColorField label="Couleur accent du site" value={doc.siteAccentColor} fallback={MEDIANET_ACCENT} onChange={(v) => set({ siteAccentColor: v })} />
          </div>
        )}
      </Group>

      <Group title="Pied de page">
        <TextField label="Texte du pied de page" value={doc.footerText} onChange={(v) => set({ footerText: v })} />
      </Group>
    </>
  )
}
