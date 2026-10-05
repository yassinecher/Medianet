'use client'
import { useEffect } from 'react'
import { CheckCircle2, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BLOCK_CATALOG, type CatalogEntry, type LandingBlock } from './schema'

/** A catalog card. `single` = at most one per page; `group` = heading it is listed under. */
export interface PickerEntry {
  key: string
  type: string
  label: string
  description: string
  icon: any
  create: () => Record<string, any>
  single?: boolean
  group?: string
}

const landingCount = (entry: PickerEntry, blocks: { type: string; data?: any }[]) =>
  blocks.filter((b) => b.type === entry.type
    && (entry.type !== 'media' || (b.data?.layout ?? 'text-image') === entry.create().layout)).length

/**
 * Block catalog: each card says whether the page already has one (and how
 * many), so the admin decides. One-per-page blocks are disabled once present.
 */
export function BlockPicker<E extends PickerEntry = CatalogEntry>({
  open, blocks, afterLabel, onPick, onClose,
  catalog = BLOCK_CATALOG as unknown as E[], countFor = landingCount,
}: {
  open: boolean
  blocks: LandingBlock[] | { type: string; data?: any }[]
  /** Title of the block the new one will follow (undefined = end of page). */
  afterLabel?: string
  onPick: (entry: E) => void
  onClose: () => void
  catalog?: E[]
  countFor?: (entry: E, blocks: { type: string; data?: any }[]) => number
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const groups = Array.from(new Set(catalog.map((e) => e.group ?? '')))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="block-picker-title"
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 id="block-picker-title" className="text-base font-bold text-foreground">Ajouter un bloc</h2>
            <p className="text-xs text-muted-foreground">
              {afterLabel ? <>Il sera inséré après « {afterLabel} ».</> : <>Il sera ajouté à la fin de la page.</>}
              {' '}Vous pouvez ajouter plusieurs fois le même type de bloc.
            </p>
          </div>
          <button type="button" onClick={onClose} title="Fermer"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 overflow-y-auto p-4">
          {groups.map((group) => (
            <div key={group || 'all'}>
              {group && <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{group}</p>}
              <div className="grid gap-2 sm:grid-cols-2">
                {catalog.filter((e) => (e.group ?? '') === group).map((entry) => {
                  const count = countFor(entry, blocks as { type: string; data?: any }[])
                  const full = !!entry.single && count > 0
                  const Icon = entry.icon
                  return (
                    <button key={entry.key} type="button" disabled={full} onClick={() => onPick(entry)}
                      title={full ? 'Déjà sur la page (un seul par page) : réaffichez-le ou déplacez-le depuis la liste.' : undefined}
                      className="group flex items-start gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-brand-400 hover:bg-brand-500/5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-border disabled:hover:bg-card">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">{entry.label}</span>
                          {!full && <Plus className="ml-auto h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />}
                        </span>
                        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{entry.description}</span>
                        <span className={cn('mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                          count > 0 ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground')}>
                          {count > 0
                            ? <><CheckCircle2 className="h-3 w-3" />{full ? 'Déjà sur la page (un seul possible)' : `Déjà présent${count > 1 ? ` ×${count}` : ''}`}</>
                            : 'Pas encore sur la page'}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
