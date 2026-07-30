'use client'
/**
 * Reusable photo gallery + lightbox. Used for the programme « Retour en images »
 * and for per-session photo strips on the programme timeline.
 *
 *  variant="grid"  — responsive thumbnail grid (default)
 *  variant="strip" — a compact horizontal row (for inside a session card)
 *
 * Clicking a thumbnail opens a full-screen lightbox with keyboard + arrow
 * navigation. No external dependency.
 */
import { useCallback, useEffect, useState } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export function PhotoGallery({
  images, variant = 'grid', className,
}: {
  images?: string[]
  variant?: 'grid' | 'strip'
  className?: string
}) {
  const list = (images ?? []).filter(Boolean)
  const [open, setOpen] = useState<number | null>(null)

  const close = useCallback(() => setOpen(null), [])
  const go = useCallback(
    (d: number) => setOpen((i) => (i == null ? i : (i + d + list.length) % list.length)),
    [list.length],
  )

  useEffect(() => {
    if (open == null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow }
  }, [open, close, go])

  if (list.length === 0) return null

  const STRIP_MAX = 6

  return (
    <>
      {variant === 'strip' ? (
        <div className={cn('flex gap-2 overflow-x-auto pb-1', className)}>
          {list.slice(0, STRIP_MAX).map((src, i) => {
            const overflow = i === STRIP_MAX - 1 && list.length > STRIP_MAX
            return (
              <button key={i} type="button" onClick={() => setOpen(i)}
                className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full object-cover transition-transform duration-300 hover:scale-105" />
                {overflow && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-xs font-bold text-white">
                    +{list.length - STRIP_MAX + 1}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      ) : (
        <div className={cn('grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4', className)}>
          {list.map((src, i) => (
            <button key={i} type="button" onClick={() => setOpen(i)}
              className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
              <span className="pointer-events-none absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
            </button>
          ))}
        </div>
      )}

      {open != null && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4" onClick={close} role="dialog" aria-modal="true">
          <button className="absolute right-4 top-4 rounded-full p-1.5 text-white/80 transition-colors hover:bg-white/10 hover:text-white" onClick={close} aria-label="Fermer">
            <X className="h-6 w-6" />
          </button>
          {list.length > 1 && (
            <>
              <button className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                onClick={(e) => { e.stopPropagation(); go(-1) }} aria-label="Précédent">
                <ChevronLeft className="h-7 w-7" />
              </button>
              <button className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                onClick={(e) => { e.stopPropagation(); go(1) }} aria-label="Suivant">
                <ChevronRight className="h-7 w-7" />
              </button>
            </>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={list[open]} alt="" className="max-h-[85vh] max-w-[92vw] rounded-lg object-contain shadow-2xl" onClick={(e) => e.stopPropagation()} />
          {list.length > 1 && (
            <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white/80">
              {open + 1} / {list.length}
            </span>
          )}
        </div>
      )}
    </>
  )
}
