'use client'
import { useEffect, useRef, useState } from 'react'
import {
  ArrowDown, ArrowUp, Copy, Eye, EyeOff, GripVertical, MoreHorizontal, Palette, Plus, PlusSquare, Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { BLOCK_TYPES, blockTitle, mediaLayoutLabel, type LandingBlock } from './schema'

export const SETTINGS_ID = '__settings__'

/** Any editor block: the outline only needs id / type / visibility. */
export interface OutlineBlock { id: string; type: string; visible?: boolean; data: Record<string, any> }
export interface OutlineEntry { title: string; subtitle: string; icon: any }

const landingDescribe = (b: OutlineBlock): OutlineEntry => {
  const lb = b as LandingBlock
  const meta = BLOCK_TYPES[lb.type]
  return {
    title: blockTitle(lb),
    subtitle: `${meta?.label ?? b.type}${lb.type === 'media' ? ` · ${mediaLayoutLabel(lb.data?.layout)}` : ''}`,
    icon: meta?.icon ?? PlusSquare,
  }
}
const LANDING_PINNED: OutlineEntry = { title: 'Réglages du site', subtitle: 'Logo, couleurs, pied de page', icon: Palette }

/**
 * Left column of the editor: a pinned item (site settings, programme hero…) +
 * the page's blocks in order. Drag a row (or use the ⋯ menu / Alt+↑↓) to
 * reorder; the eye toggles visibility. `canDuplicate` = false hides
 * « Dupliquer » for one-per-page blocks.
 */
export function BlockOutline({
  blocks, selectedId, onSelect, onMove, onReorder, onToggle, onDuplicate, onDelete, onAdd,
  describe = landingDescribe, pinned = LANDING_PINNED, pinnedId = SETTINGS_ID, canDuplicate = () => true,
}: {
  blocks: OutlineBlock[]
  selectedId: string
  onSelect: (id: string) => void
  onMove: (id: string, dir: -1 | 1) => void
  onReorder: (from: number, to: number) => void
  onToggle: (id: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  /** Open the block catalog; `afterId` = insert position. */
  onAdd: (afterId?: string) => void
  describe?: (b: OutlineBlock) => OutlineEntry
  pinned?: OutlineEntry
  pinnedId?: string
  canDuplicate?: (b: OutlineBlock) => boolean
}) {
  const [menu, setMenu] = useState<string | null>(null)
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dropAt, setDropAt] = useState<number | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(null) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menu])

  const visibleCount = blocks.filter((b) => b.visible !== false).length
  const iconBtn = 'flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground'

  return (
    <div className="space-y-3">
      <button type="button" onClick={() => onSelect(pinnedId)}
        className={cn('flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors',
          selectedId === pinnedId ? 'border-brand-500 bg-brand-500/10' : 'border-border bg-card hover:border-brand-400')}>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
          <pinned.icon className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-foreground">{pinned.title}</span>
          <span className="block truncate text-[11px] text-muted-foreground">{pinned.subtitle}</span>
        </span>
      </button>

      <div className="flex items-center justify-between px-1">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Blocs de la page <span className="font-medium normal-case tracking-normal">· {visibleCount}/{blocks.length} visibles</span>
        </p>
      </div>

      <ol className="space-y-1" onDragLeave={(e) => { if (e.currentTarget === e.target) setDropAt(null) }}>
        {blocks.map((b, i) => {
          const entry = describe(b)
          const Icon = entry.icon ?? PlusSquare
          const hidden = b.visible === false
          const selected = selectedId === b.id
          return (
            <li key={b.id} className="relative"
              draggable
              onDragStart={(e) => { setDragFrom(i); e.dataTransfer.effectAllowed = 'move' }}
              onDragOver={(e) => {
                if (dragFrom === null) return
                e.preventDefault()
                const r = e.currentTarget.getBoundingClientRect()
                setDropAt(e.clientY < r.top + r.height / 2 ? i : i + 1)
              }}
              onDrop={(e) => {
                e.preventDefault()
                if (dragFrom !== null && dropAt !== null) {
                  const to = dropAt > dragFrom ? dropAt - 1 : dropAt
                  if (to !== dragFrom) onReorder(dragFrom, to)
                }
                setDragFrom(null); setDropAt(null)
              }}
              onDragEnd={() => { setDragFrom(null); setDropAt(null) }}>
              {dropAt === i && dragFrom !== null && <span className="absolute -top-[3px] left-2 right-2 h-0.5 rounded bg-brand-500" />}
              {dropAt === i + 1 && i === blocks.length - 1 && dragFrom !== null && (
                <span className="absolute -bottom-[3px] left-2 right-2 h-0.5 rounded bg-brand-500" />
              )}
              <div role="button" tabIndex={0} onClick={() => onSelect(b.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSelect(b.id)
                  if (e.altKey && e.key === 'ArrowUp') { e.preventDefault(); onMove(b.id, -1) }
                  if (e.altKey && e.key === 'ArrowDown') { e.preventDefault(); onMove(b.id, 1) }
                }}
                className={cn('group flex items-center gap-1.5 rounded-lg border px-1.5 py-1.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selected ? 'border-brand-500 bg-brand-500/10' : 'border-transparent hover:border-border hover:bg-card',
                  dragFrom === i && 'opacity-40')}>
                <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground/60" aria-hidden />
                <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
                  hidden ? 'bg-muted text-muted-foreground' : 'bg-brand-500/10 text-brand-600 dark:text-brand-400')}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className={cn('min-w-0 flex-1', hidden && 'opacity-60')}>
                  <span className="block truncate text-[13px] font-semibold leading-tight text-foreground">{entry.title}</span>
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {entry.subtitle}{hidden ? ' · masqué' : ''}
                  </span>
                </span>
                <button type="button" title={hidden ? 'Afficher' : 'Masquer'} onClick={(e) => { e.stopPropagation(); onToggle(b.id) }}
                  className={cn(iconBtn, !hidden && 'opacity-0 group-hover:opacity-100 focus:opacity-100', selected && 'opacity-100')}>
                  {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
                <button type="button" title="Plus d’actions" onClick={(e) => { e.stopPropagation(); setMenu(menu === b.id ? null : b.id) }}
                  className={cn(iconBtn, 'opacity-0 group-hover:opacity-100 focus:opacity-100', (selected || menu === b.id) && 'opacity-100')}>
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </div>

              {menu === b.id && (
                <div ref={menuRef} className="absolute right-1 top-full z-30 mt-1 w-52 overflow-hidden rounded-lg border border-border bg-popover py-1 shadow-xl">
                  {[
                    { label: 'Monter', icon: ArrowUp, disabled: i === 0, run: () => onMove(b.id, -1) },
                    { label: 'Descendre', icon: ArrowDown, disabled: i === blocks.length - 1, run: () => onMove(b.id, 1) },
                    { label: 'Dupliquer', icon: Copy, disabled: !canDuplicate(b), run: () => onDuplicate(b.id) },
                    { label: 'Ajouter un bloc après', icon: Plus, run: () => onAdd(b.id) },
                  ].map((a) => (
                    <button key={a.label} type="button" disabled={a.disabled}
                      onClick={() => { setMenu(null); a.run() }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground hover:bg-accent disabled:opacity-40 disabled:hover:bg-transparent">
                      <a.icon className="h-3.5 w-3.5 text-muted-foreground" />{a.label}
                    </button>
                  ))}
                  <div className="my-1 h-px bg-border" />
                  <button type="button" onClick={() => { setMenu(null); onDelete(b.id) }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-3.5 w-3.5" />Supprimer le bloc
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ol>

      <button type="button" onClick={() => onAdd(selectedId !== pinnedId ? selectedId : undefined)}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-brand-500/60 bg-brand-500/[0.04] py-2.5 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-500/10 dark:text-brand-300">
        <Plus className="h-4 w-4" />Ajouter un bloc
      </button>
      <p className="px-1 text-[10px] leading-relaxed text-muted-foreground">
        Glissez-déposez pour réordonner · Alt + ↑/↓ sur un bloc sélectionné.
      </p>
    </div>
  )
}
