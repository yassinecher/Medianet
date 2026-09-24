'use client'
import { ImageListEditor } from '@/components/upload/ImageListEditor'
import {
  AreaField, BackgroundField, Group, IconField, ImageField, ItemsEditor, NumberField, Segmented, TextField,
} from './fields'
import type { LandingBlock } from './schema'

type Patch = (patch: Record<string, any>) => void

/** Form for the selected block; each type shows only its own fields. */
export function BlockEditor({ block, onChange }: { block: LandingBlock; onChange: Patch }) {
  const d = block.data ?? {}
  switch (block.type) {
    case 'hero': return <HeroEditor d={d} set={onChange} />
    case 'stats': return <StatsEditor d={d} set={onChange} />
    case 'features': return <FeaturesEditor d={d} set={onChange} />
    case 'media': return <MediaEditor d={d} set={onChange} />
    case 'process': return <ProcessEditor d={d} set={onChange} />
    case 'programmes': return <ProgrammesEditor d={d} set={onChange} />
    case 'testimonials': return <TestimonialsEditor d={d} set={onChange} />
    case 'faq': return <FaqEditor d={d} set={onChange} />
    case 'cta': return <CtaEditor d={d} set={onChange} />
    default: return null
  }
}

type P = { d: Record<string, any>; set: Patch }

function SectionHeading({ d, set, subtitle = true }: P & { subtitle?: boolean }) {
  return (
    <Group title="En-tête">
      <TextField label="Titre" value={d.title} onChange={(v) => set({ title: v })} />
      {subtitle && <TextField label="Sous-titre" value={d.subtitle} onChange={(v) => set({ subtitle: v })} />}
    </Group>
  )
}

function Style({ d, set, children }: P & { children?: React.ReactNode }) {
  return (
    <Group title="Style">
      <BackgroundField value={d.background} onChange={(v) => set({ background: v })} />
      {children}
    </Group>
  )
}

/** string[] ⇄ ImageListEditor's {url} items. */
function UrlList({ urls, onChange, folder, query }: { urls?: string[]; onChange: (u: string[]) => void; folder: string; query: string }) {
  return (
    <ImageListEditor folder={folder} searchQuery={query}
      images={(urls ?? []).map((url) => ({ url }))}
      onChange={(imgs) => onChange(imgs.map((i) => i.url ?? '').filter(Boolean))} />
  )
}

function HeroEditor({ d, set }: P) {
  return (
    <>
      <Group title="Contenu">
        <TextField label="Badge (au-dessus du titre)" value={d.badge} onChange={(v) => set({ badge: v })} />
        <TextField label="Titre" value={d.title} onChange={(v) => set({ title: v })} />
        <AreaField label="Sous-titre" rows={2} value={d.subtitle} onChange={(v) => set({ subtitle: v })} />
      </Group>
      <Group title="Boutons">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Bouton principal — texte" value={d.primaryCtaLabel} onChange={(v) => set({ primaryCtaLabel: v })} />
          <TextField label="Bouton principal — lien" value={d.primaryCtaLink} placeholder="/register" onChange={(v) => set({ primaryCtaLink: v })} />
          <TextField label="Bouton secondaire — texte" value={d.secondaryCtaLabel} onChange={(v) => set({ secondaryCtaLabel: v })} />
          <TextField label="Bouton secondaire — lien" value={d.secondaryCtaLink} placeholder="/programmes" onChange={(v) => set({ secondaryCtaLink: v })} />
        </div>
        <p className="text-[11px] text-muted-foreground">Laissez un texte vide pour masquer le bouton.</p>
      </Group>
      <Group title="Photos d’arrière-plan">
        <p className="-mt-1 text-[11px] text-muted-foreground">Plusieurs photos = diaporama (change toutes les 6 s).</p>
        <UrlList urls={d.images} onChange={(images) => set({ images })} folder="hero" query={d.title || 'startup incubator team'} />
      </Group>
    </>
  )
}

function StatsEditor({ d, set }: P) {
  return (
    <>
      <SectionHeading d={d} set={set} />
      <Group title="Chiffres">
        <ItemsEditor items={d.items ?? []} onChange={(items) => set({ items })} addLabel="Ajouter un chiffre" max={8}
          create={() => ({ label: 'Nouveau chiffre', value: 0, suffix: '+' })}
          itemLabel={(s) => `${s.value ?? 0}${s.suffix ?? ''} ${s.label ?? ''}`}
          render={(s, u) => (
            <div className="grid grid-cols-6 gap-3">
              <TextField className="col-span-6 sm:col-span-3" label="Libellé" value={s.label} onChange={(v) => u({ label: v })} />
              <div className="col-span-3 sm:col-span-2"><NumberField label="Valeur" value={s.value} onChange={(v) => u({ value: v })} /></div>
              <TextField className="col-span-3 sm:col-span-1" label="Suffixe" value={s.suffix} placeholder="+" onChange={(v) => u({ suffix: v })} />
            </div>
          )} />
      </Group>
      <Style d={d} set={set} />
    </>
  )
}

function FeaturesEditor({ d, set }: P) {
  return (
    <>
      <SectionHeading d={d} set={set} />
      <Group title="Cartes">
        <ItemsEditor items={d.items ?? []} onChange={(items) => set({ items })} addLabel="Ajouter une carte"
          create={() => ({ icon: 'Sparkles', title: 'Nouveau point fort', description: '' })}
          itemLabel={(f) => f.title}
          render={(f, u) => (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField label="Titre" value={f.title} onChange={(v) => u({ title: v })} />
                <IconField value={f.icon} onChange={(v) => u({ icon: v })} />
              </div>
              <AreaField label="Description" rows={2} value={f.description} onChange={(v) => u({ description: v })} />
              <ImageField label="Photo (remplace l’icône)" folder="features" value={f.imageUrl} query={f.title}
                onChange={(v) => u({ imageUrl: v })} />
            </>
          )} />
      </Group>
      <Style d={d} set={set} />
    </>
  )
}

function MediaEditor({ d, set }: P) {
  const layout = d.layout ?? 'text-image'
  return (
    <>
      <Group title="Disposition">
        <Segmented label="Présentation des photos" value={layout} onChange={(v) => set({ layout: v })}
          options={[{ value: 'text-image', label: 'Texte + photo' }, { value: 'gallery', label: 'Galerie' }, { value: 'carousel', label: 'Carrousel' }]} />
        {layout === 'text-image' && (
          <Segmented label="Position de la photo" value={d.imagePosition ?? 'right'} onChange={(v) => set({ imagePosition: v })}
            options={[{ value: 'left', label: 'À gauche' }, { value: 'right', label: 'À droite' }]} />
        )}
      </Group>
      <Group title="Contenu">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Titre" value={d.title} onChange={(v) => set({ title: v })} />
          <TextField label="Badge (optionnel)" value={d.badge} onChange={(v) => set({ badge: v })} />
        </div>
        <TextField label="Sous-titre" value={d.subtitle} onChange={(v) => set({ subtitle: v })} />
        <AreaField label="Texte" rows={5} value={d.body} onChange={(v) => set({ body: v })} />
      </Group>
      <Group title={`Photos (${(d.images ?? []).length})`}>
        <ImageListEditor folder="sections" captions searchQuery={d.title || 'startup incubator'}
          images={d.images ?? []} onChange={(images) => set({ images })} />
      </Group>
      <Group title="Bouton (optionnel)">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Texte" value={d.ctaLabel} placeholder="En savoir plus" onChange={(v) => set({ ctaLabel: v })} />
          <TextField label="Lien" value={d.ctaLink} placeholder="/programmes" onChange={(v) => set({ ctaLink: v })} />
        </div>
      </Group>
      <Style d={d} set={set} />
    </>
  )
}

function ProcessEditor({ d, set }: P) {
  return (
    <>
      <SectionHeading d={d} set={set} />
      <Group title="Étapes">
        <ItemsEditor items={d.items ?? []} onChange={(items) => set({ items })} addLabel="Ajouter une étape" max={12}
          create={() => ({ icon: 'FileText', title: `${(d.items?.length ?? 0) + 1}. Nouvelle étape`, description: '' })}
          itemLabel={(s) => s.title}
          render={(s, u) => (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField label="Titre" value={s.title} onChange={(v) => u({ title: v })} />
                <IconField value={s.icon} onChange={(v) => u({ icon: v })} />
              </div>
              <AreaField label="Description" rows={2} value={s.description} onChange={(v) => u({ description: v })} />
              <ImageField label="Photo (optionnelle)" folder="process" value={s.imageUrl} query={s.title}
                onChange={(v) => u({ imageUrl: v })} />
            </>
          )} />
      </Group>
      <Style d={d} set={set} />
    </>
  )
}

function ProgrammesEditor({ d, set }: P) {
  const limit = d.limit ?? 6
  return (
    <>
      <SectionHeading d={d} set={set} />
      <Group title="Programmes affichés">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Nombre maximum de cartes : {limit}</span>
          <input type="range" min={1} max={12} value={limit} onChange={(e) => set({ limit: Number(e.target.value) })}
            className="w-full accent-brand-500" />
        </label>
        <p className="text-[11px] text-muted-foreground">
          Les cartes viennent automatiquement des programmes ouverts ; chacune affiche la bannière du programme
          (ou la première photo de sa galerie) — à modifier dans <strong>Programmes</strong>.
        </p>
      </Group>
      <Group title="Carrousel photo (optionnel)">
        <UrlList urls={d.images} onChange={(images) => set({ images })} folder="programmes" query="startup incubator programme event" />
      </Group>
      <Style d={d} set={set} />
    </>
  )
}

function TestimonialsEditor({ d, set }: P) {
  return (
    <>
      <SectionHeading d={d} set={set} />
      <Group title="Témoignages">
        <ItemsEditor items={d.items ?? []} onChange={(items) => set({ items })} addLabel="Ajouter un témoignage" max={12}
          create={() => ({ quote: '', authorName: '', authorRole: '' })}
          itemLabel={(t) => t.authorName || (t.quote ?? '').slice(0, 40)}
          render={(t, u) => (
            <>
              <AreaField label="Citation" rows={3} value={t.quote} onChange={(v) => u({ quote: v })} />
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField label="Nom" value={t.authorName} onChange={(v) => u({ authorName: v })} />
                <TextField label="Fonction" value={t.authorRole} placeholder="Fondatrice, MaStartup" onChange={(v) => u({ authorRole: v })} />
              </div>
              <ImageField label="Photo (optionnelle)" folder="testimonials" value={t.photoUrl}
                query={t.authorName ? `${t.authorName} portrait` : 'professional portrait'} onChange={(v) => u({ photoUrl: v })} />
            </>
          )} />
      </Group>
      <Style d={d} set={set} />
    </>
  )
}

function FaqEditor({ d, set }: P) {
  return (
    <>
      <SectionHeading d={d} set={set} />
      <Group title="Questions">
        <ItemsEditor items={d.items ?? []} onChange={(items) => set({ items })} addLabel="Ajouter une question" max={30}
          create={() => ({ question: '', answer: '' })}
          itemLabel={(f) => f.question}
          render={(f, u) => (
            <>
              <TextField label="Question" value={f.question} onChange={(v) => u({ question: v })} />
              <AreaField label="Réponse" rows={3} value={f.answer} onChange={(v) => u({ answer: v })} />
            </>
          )} />
      </Group>
      <Style d={d} set={set} />
    </>
  )
}

function CtaEditor({ d, set }: P) {
  return (
    <>
      <Group title="Contenu">
        <TextField label="Titre" value={d.title} onChange={(v) => set({ title: v })} />
        <TextField label="Sous-titre" value={d.subtitle} onChange={(v) => set({ subtitle: v })} />
      </Group>
      <Group title="Bouton">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Texte" value={d.buttonLabel} onChange={(v) => set({ buttonLabel: v })} />
          <TextField label="Lien" value={d.buttonLink} placeholder="/register" onChange={(v) => set({ buttonLink: v })} />
        </div>
      </Group>
      <Style d={d} set={set} />
    </>
  )
}
