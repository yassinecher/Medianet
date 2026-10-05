'use client'
import Link from 'next/link'
import { ArrowUpRight, Info } from 'lucide-react'
import { BlockEditor as LandingBlockEditor } from '@/components/landing-editor/BlockEditor'
import {
  AreaField, Field, Group, ItemsEditor, NumberField, Segmented, TextField,
} from '@/components/landing-editor/fields'
import type { LandingBlock } from '@/components/landing-editor/schema'
import { ImageUpload } from '@/components/upload/ImageUpload'
import { ImageListEditor } from '@/components/upload/ImageListEditor'
import { cn } from '@/lib/utils'
import { DEFAULT_APPLY_SUBTITLE, LANDING_TYPES, type PageFields, type ProgrammeBlock, type ProgrammeHeroSettings } from './schema'

type Patch = (patch: Record<string, any>) => void
type SetFields = (patch: Partial<PageFields>) => void

/** Live data the bound blocks display (edited elsewhere in the programme). */
export interface EditorContext {
  programmeId: number
  sessions: { title?: string; galleryUrls?: string[] }[]
  criteriaCount: number
  partnersCount: number
  sectors: string[]
  acceptingApplications: boolean
}

// ── Small shared controls ───────────────────────────────────────────────────

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background px-3 py-2.5">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand-500" />
      <span>
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
      </span>
    </label>
  )
}

/** Where the block's data really lives — with a link to edit it there. */
function Source({ children, href, label }: { children: React.ReactNode; href?: string; label?: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-sky-500/25 bg-sky-500/5 px-3 py-2.5 text-xs text-sky-800 dark:text-sky-200">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div className="flex-1">
        {children}
        {href && (
          <Link href={href} target="_blank" className="ml-1 inline-flex items-center gap-0.5 font-semibold underline-offset-2 hover:underline">
            {label}<ArrowUpRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  )
}

function Heading({ d, set, withSubtitle = true }: { d: Record<string, any>; set: Patch; withSubtitle?: boolean }) {
  return (
    <Group title="En-tête de la section">
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Sur-titre (petit texte coloré)" value={d.eyebrow} placeholder="Le programme" onChange={(v) => set({ eyebrow: v })} />
        <TextField label="Libellé dans le menu de la page" value={d.navLabel} placeholder="Par défaut : nom du bloc" onChange={(v) => set({ navLabel: v })} />
      </div>
      <TextField label="Titre" value={d.title} onChange={(v) => set({ title: v })} />
      {withSubtitle && <AreaField label="Sous-titre" rows={2} value={d.subtitle} onChange={(v) => set({ subtitle: v })} />}
    </Group>
  )
}

function Background({ d, set }: { d: Record<string, any>; set: Patch }) {
  return (
    <Group title="Style">
      <Segmented label="Fond de la section" value={d.background ?? 'auto'} onChange={(v) => set({ background: v })}
        options={[{ value: 'auto', label: 'Auto' }, { value: 'default', label: 'Clair' }, { value: 'muted', label: 'Teinté' }, { value: 'dark', label: 'Sombre' }]} />
      <p className="text-[11px] text-muted-foreground">« Auto » alterne fond clair et teinté d’une section à l’autre.</p>
    </Group>
  )
}

/** string[] edited as collapsible items. */
function StringList({ items, onChange, addLabel, placeholder }: { items: string[]; onChange: (v: string[]) => void; addLabel: string; placeholder: string }) {
  return (
    <ItemsEditor items={items.map((text) => ({ text }))} onChange={(next) => onChange(next.map((i) => i.text ?? ''))}
      addLabel={addLabel} max={20} create={() => ({ text: '' })}
      itemLabel={(i) => i.text}
      render={(i, u) => <AreaField label="Texte" rows={2} value={i.text} placeholder={placeholder} onChange={(v) => u({ text: v })} />} />
  )
}

// ── Hero ────────────────────────────────────────────────────────────────────

export function HeroEditor({ hero, setHero, fields, setFields, ctx }: {
  hero: ProgrammeHeroSettings; setHero: (p: Partial<ProgrammeHeroSettings>) => void
  fields: PageFields; setFields: SetFields; ctx: EditorContext
}) {
  return (
    <>
      <Group title="Textes">
        <TextField label="Titre du programme" value={fields.title} onChange={(v) => setFields({ title: v })} />
        <AreaField label="Accroche" rows={2} value={fields.tagline} placeholder="Le programme FoodTech de référence en Tunisie"
          onChange={(v) => setFields({ tagline: v })} />
      </Group>
      <Group title="Visuels">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Photo de bannière" hint="Large et lumineuse, 1600 px de large ou plus." asDiv>
            <ImageUpload value={fields.bannerImageUrl} folder="banners" previewHeight={70} compact searchContext="hero"
              defaultQuery={fields.title} onChange={(url) => setFields({ bannerImageUrl: url })} />
          </Field>
          <Field label="Logo du programme" asDiv>
            <ImageUpload value={fields.logoUrl} folder="logos" previewHeight={70} compact enableSearch={false}
              onChange={(url) => setFields({ logoUrl: url })} />
          </Field>
        </div>
        <Segmented label="Fond de la bannière" value={hero.style ?? 'image'} onChange={(v) => setHero({ style: v })}
          options={[{ value: 'image', label: 'Photo (si disponible)' }, { value: 'gradient', label: 'Dégradé de couleur' }]} />
        <Segmented label="Hauteur" value={hero.height ?? 'tall'} onChange={(v) => setHero({ height: v })}
          options={[{ value: 'tall', label: 'Grande' }, { value: 'compact', label: 'Compacte' }]} />
      </Group>
      <Group title="Infos clés">
        <TextField label="Lieu" value={fields.location} placeholder="Startup Village, Tunis" onChange={(v) => setFields({ location: v })} />
        <Toggle label="Afficher le bandeau d’infos clés" hint="Dates, lieu, clôture des candidatures et nombre de places, sous le titre."
          checked={hero.showFacts !== false} onChange={(v) => setHero({ showFacts: v })} />
        <Source href={`/programmes/${ctx.programmeId}?tab=info&edit=1`} label="Modifier les dates">
          Les dates viennent des informations du programme ; la clôture, de la session « Candidature » du parcours.
        </Source>
      </Group>
      <Group title="Boutons">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Bouton principal" value={hero.ctaLabel} placeholder="Rejoindre le programme" onChange={(v) => setHero({ ctaLabel: v })} />
          <TextField label="Bouton secondaire" value={hero.secondaryLabel} placeholder="Découvrir le parcours" onChange={(v) => setHero({ secondaryLabel: v })} />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Le bouton principal n’apparaît que pendant les candidatures{ctx.acceptingApplications ? ' (ouvertes en ce moment)' : ' (fermées en ce moment)'} ;
          le secondaire mène au parcours. Laissez-le vide pour le masquer.
        </p>
      </Group>
    </>
  )
}

// ── Blocks ──────────────────────────────────────────────────────────────────

export function ProgrammeBlockEditor({ block, onChange, fields, setFields, ctx }: {
  block: ProgrammeBlock; onChange: Patch; fields: PageFields; setFields: SetFields; ctx: EditorContext
}) {
  const d = block.data ?? {}
  const set = onChange
  if (LANDING_TYPES.has(block.type)) {
    return <LandingBlockEditor block={block as unknown as LandingBlock} onChange={onChange} />
  }
  switch (block.type) {
    case 'about':
      return (
        <>
          <Heading d={d} set={set} withSubtitle={false} />
          <Group title="Texte">
            <AreaField label="Description du programme" rows={9} value={fields.description}
              hint="Séparez les paragraphes par une ligne vide. Aussi affichée sur les cartes du programme."
              onChange={(v) => setFields({ description: v })} />
          </Group>
          <Group title={`Photos (${(d.images ?? []).length})`}>
            <p className="-mt-1 text-[11px] text-muted-foreground">Optionnel : une photo à côté du texte, plusieurs = carrousel.</p>
            <ImageListEditor folder="programmes" captions searchQuery={fields.title}
              images={d.images ?? []} onChange={(images) => set({ images })} />
            {(d.images ?? []).length > 0 && (
              <Segmented label="Position des photos" value={d.imagePosition ?? 'right'} onChange={(v) => set({ imagePosition: v })}
                options={[{ value: 'left', label: 'À gauche' }, { value: 'right', label: 'À droite' }]} />
            )}
          </Group>
          <Background d={d} set={set} />
        </>
      )
    case 'highlights':
      return (
        <>
          <Heading d={d} set={set} />
          <Group title="Chiffres du programme">
            <div className="grid gap-3 sm:grid-cols-2">
              <NumberField label="Startups sélectionnées" min={0} value={fields.maxStartups} onChange={(v) => setFields({ maxStartups: v })} />
              <NumberField label="Experts & mentors" min={0} value={fields.expertCount} onChange={(v) => setFields({ expertCount: v })} />
              <NumberField label="Sessions de formation" min={0} value={fields.trainingSessionsCount} onChange={(v) => setFields({ trainingSessionsCount: v })} />
              <NumberField label="Heures de mentorat / mois" min={0} value={fields.mentoringHoursPerMonth} onChange={(v) => setFields({ mentoringHoursPerMonth: v })} />
            </div>
            <p className="text-[11px] text-muted-foreground">0 = chiffre masqué.</p>
          </Group>
          <Group title="Chiffres supplémentaires">
            <ItemsEditor items={d.extra ?? []} onChange={(extra) => set({ extra })} addLabel="Ajouter un chiffre" max={8}
              create={() => ({ label: 'Nouveau chiffre', value: 0, suffix: '' })}
              itemLabel={(s) => `${s.value ?? 0}${s.suffix ?? ''} ${s.label ?? ''}`}
              render={(s, u) => (
                <div className="grid grid-cols-6 gap-3">
                  <TextField className="col-span-6 sm:col-span-3" label="Libellé" value={s.label} onChange={(v) => u({ label: v })} />
                  <div className="col-span-3 sm:col-span-2"><NumberField label="Valeur" value={s.value} onChange={(v) => u({ value: v })} /></div>
                  <TextField className="col-span-3 sm:col-span-1" label="Suffixe" value={s.suffix} placeholder="%" onChange={(v) => u({ suffix: v })} />
                </div>
              )} />
          </Group>
          <Background d={d} set={set} />
        </>
      )
    case 'audience':
      return (
        <>
          <Heading d={d} set={set} withSubtitle={false} />
          <Group title="Texte (optionnel)">
            <AreaField label="À qui s’adresse le programme ?" rows={4} value={d.text}
              placeholder="Startups early-stage de l’agroalimentaire, avec un prototype et une équipe de 2 personnes ou plus…"
              onChange={(v) => set({ text: v })} />
          </Group>
          <Group title={`Secteurs (${ctx.sectors.length})`}>
            {ctx.sectors.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {ctx.sectors.map((s) => <span key={s} className="rounded-full bg-brand-500/10 px-2.5 py-1 text-xs font-medium text-brand-700 dark:text-brand-300">{s}</span>)}
              </div>
            ) : <p className="text-xs text-muted-foreground">Aucun secteur sélectionné.</p>}
            <Source href={`/programmes/${ctx.programmeId}?tab=info&edit=1`} label="Modifier les secteurs">
              Les secteurs servent aussi à l’éligibilité : ils se modifient dans les informations du programme.
            </Source>
          </Group>
          <Background d={d} set={set} />
        </>
      )
    case 'objectives':
      return (
        <>
          <Heading d={d} set={set} />
          <Group title={`Objectifs (${fields.objectives.length})`}>
            <StringList items={fields.objectives} onChange={(objectives) => setFields({ objectives })}
              addLabel="Ajouter un objectif" placeholder="Accompagner 10 startups jusqu’à leur première levée de fonds" />
            <Segmented label="Présentation" value={d.layout ?? 'cards'} onChange={(v) => set({ layout: v })}
              options={[{ value: 'cards', label: 'Cartes numérotées' }, { value: 'list', label: 'Liste' }]} />
          </Group>
          <Background d={d} set={set} />
        </>
      )
    case 'benefits':
      return (
        <>
          <Heading d={d} set={set} />
          <Group title={`Avantages (${fields.benefits.length})`}>
            <StringList items={fields.benefits} onChange={(benefits) => setFields({ benefits })}
              addLabel="Ajouter un avantage" placeholder="Accès à un espace de coworking pendant 6 mois" />
          </Group>
          <Background d={d} set={set} />
        </>
      )
    case 'journey': {
      const photos = ctx.sessions.reduce((n, s) => n + (s.galleryUrls?.length ?? 0), 0)
      return (
        <>
          <Heading d={d} set={set} />
          <Group title={`Sessions (${ctx.sessions.length})`}>
            <Source href={`/programmes/${ctx.programmeId}?tab=phases`} label="Gérer les sessions">
              La frise est construite automatiquement à partir des sessions du parcours (dates, lieux, statut).
            </Source>
            <Toggle label="Afficher les photos de chaque session" hint={`${photos} photo(s) dans les sessions pour l’instant.`}
              checked={d.showPhotos !== false} onChange={(v) => set({ showPhotos: v })} />
          </Group>
          <Background d={d} set={set} />
        </>
      )
    }
    case 'gallery': {
      const sessionPhotos = ctx.sessions.reduce((n, s) => n + (s.galleryUrls?.length ?? 0), 0)
      return (
        <>
          <Heading d={d} set={set} />
          <Group title={`Photos du programme (${fields.galleryUrls.length})`}>
            <ImageListEditor folder="gallery" searchQuery={fields.title}
              images={fields.galleryUrls.map((url) => ({ url }))}
              onChange={(imgs) => setFields({ galleryUrls: imgs.map((i) => i.url ?? '').filter(Boolean) })} />
          </Group>
          <Group title="Affichage">
            <Segmented label="Présentation" value={d.layout ?? 'grid'} onChange={(v) => set({ layout: v })}
              options={[{ value: 'grid', label: 'Mosaïque' }, { value: 'carousel', label: 'Carrousel' }]} />
            <Toggle label="Ajouter les photos des sessions" hint={`${sessionPhotos} photo(s) dans les sessions du parcours.`}
              checked={!!d.includeSessions} onChange={(v) => set({ includeSessions: v })} />
          </Group>
          <Background d={d} set={set} />
        </>
      )
    }
    case 'criteria':
      return (
        <>
          <Heading d={d} set={set} />
          <Group title={`Critères (${ctx.criteriaCount})`}>
            <Source href={`/programmes/${ctx.programmeId}?tab=criteria`} label="Gérer les critères">
              Affiche automatiquement les critères actifs et leur poids.
            </Source>
          </Group>
          <Background d={d} set={set} />
        </>
      )
    case 'partners':
      return (
        <>
          <Heading d={d} set={set} />
          <Group title={`Partenaires (${ctx.partnersCount})`}>
            <Source href={`/programmes/${ctx.programmeId}?tab=partners`} label="Gérer les partenaires">
              Affiche automatiquement les logos des partenaires associés au programme.
            </Source>
          </Group>
          <Background d={d} set={set} />
        </>
      )
    case 'apply':
      return (
        <>
          <Group title="Contenu">
            <TextField label="Titre" value={d.title} onChange={(v) => set({ title: v })} />
            <AreaField label="Texte" rows={3} value={d.subtitle} placeholder={DEFAULT_APPLY_SUBTITLE}
              hint="{programme} est remplacé par le nom du programme."
              onChange={(v) => set({ subtitle: v })} />
            <TextField label="Texte du bouton" value={d.buttonLabel} placeholder="Rejoindre le programme" onChange={(v) => set({ buttonLabel: v })} />
          </Group>
          <Source>
            Visible uniquement pendant les candidatures, et masqué pour les porteurs qui ont déjà candidaté.
            {ctx.acceptingApplications ? ' Les candidatures sont ouvertes en ce moment.' : ' Les candidatures sont fermées en ce moment.'}
          </Source>
        </>
      )
    case 'video': {
      const ok = /youtu\.?be|vimeo\.com/i.test(d.url ?? '')
      return (
        <>
          <Heading d={d} set={set} />
          <Group title="Vidéo">
            <TextField label="Lien YouTube ou Vimeo" value={d.url} placeholder="https://www.youtube.com/watch?v=…" onChange={(v) => set({ url: v })} />
            {d.url && !ok && <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">Seuls les liens YouTube et Vimeo sont pris en charge.</p>}
            <TextField label="Légende (optionnelle)" value={d.caption} onChange={(v) => set({ caption: v })} />
          </Group>
          <Background d={d} set={set} />
        </>
      )
    }
    default:
      return <p className={cn('text-sm text-muted-foreground')}>Type de bloc inconnu.</p>
  }
}
