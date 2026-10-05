'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, EyeOff, ExternalLink, ImagePlus, LayoutTemplate } from 'lucide-react'
import { frontofficeBase } from '@/lib/frontoffice'
import { MagicCard } from '@/components/magicui/magic-card'
import { Button } from '@/components/ui/button'
import { BLOCK_META, parseProgrammePage } from '@/components/programme-page-editor/schema'
import type { Programme } from '@/types'

const HIDDEN_STATUS: Record<string, string> = { DRAFT: 'brouillon', ARCHIVED: 'archivé', CANCELLED: 'annulé' }

/**
 * Entry point to the « Page publique » builder from the programme's Infos tab:
 * a mini preview of the hero, what the page contains, and shortcuts.
 */
export function PublicPageCard({ programme }: { programme: Programme }) {
  const [base, setBase] = useState('')
  useEffect(() => { setBase(frontofficeBase()) }, [])
  const page = parseProgrammePage(programme.pageJson)
  const visible = page.blocks.filter((b) => b.visible !== false)
  const photos = programme.galleryUrls?.length ?? 0
  const hidden = programme.type === 'PRIVATE'
    ? 'privé (visible seulement par les invités)'
    : HIDDEN_STATUS[programme.status] ? `${HIDDEN_STATUS[programme.status]} : invisible pour les visiteurs` : null

  return (
    <MagicCard className="overflow-hidden p-0">
      <div className="grid md:grid-cols-[minmax(0,260px)_1fr]">
        {/* Mini hero */}
        <div className="relative min-h-[150px] overflow-hidden text-white">
          {programme.bannerImageUrl
            ? <img src={programme.bannerImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
            : <div className="absolute inset-0 bg-gradient-to-br from-brand-600 via-brand-500 to-brand-accent" />}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/40 to-slate-950/10" />
          <div className="relative flex h-full flex-col justify-end gap-1 p-4">
            {programme.logoUrl && (
              <span className="mb-1 flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-white p-1">
                <img src={programme.logoUrl} alt="" className="max-h-full max-w-full object-contain" />
              </span>
            )}
            <p className="line-clamp-2 text-sm font-bold leading-tight">{programme.title}</p>
            {programme.tagline && <p className="line-clamp-1 text-[11px] text-white/80">{programme.tagline}</p>}
          </div>
        </div>

        <div className="space-y-3 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="flex items-center gap-2 font-semibold text-foreground">
              <LayoutTemplate className="h-4 w-4 text-brand-500" />Page publique
            </h2>
            {hidden && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                <EyeOff className="h-3 w-3" />Programme {hidden}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Bannière, textes, chiffres, objectifs, photos, vidéo, FAQ, témoignages… Choisissez les sections, leur ordre et
            leur style, avec un aperçu en direct de la page vue par les porteurs de projet.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {visible.slice(0, 8).map((b) => {
              const Icon = BLOCK_META[b.type]?.icon
              return (
                <span key={b.id} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
                  {Icon && <Icon className="h-3 w-3" />}{BLOCK_META[b.type]?.label ?? b.type}
                </span>
              )
            })}
            {visible.length > 8 && <span className="text-[11px] text-muted-foreground">+{visible.length - 8}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Link href={`/programmes/${programme.id}/page-publique`}>
              <Button variant="brand" size="sm" className="gap-1.5">Personnaliser la page<ArrowRight className="h-3.5 w-3.5" /></Button>
            </Link>
            <Link href={`/programmes/${programme.id}/page-publique?block=gallery`}>
              <Button variant="outline" size="sm" className="gap-1.5"><ImagePlus className="h-3.5 w-3.5" />Photos ({photos})</Button>
            </Link>
            {base && !hidden && (
              <a href={`${base}/programmes/${programme.id}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground hover:text-foreground">
                <ExternalLink className="h-3.5 w-3.5" />Voir sur le site
              </a>
            )}
          </div>
        </div>
      </div>
    </MagicCard>
  )
}
