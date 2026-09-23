'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface LandingImage { url?: string; caption?: string }
export interface CustomSection {
  id?: string
  layout?: 'text-image' | 'gallery' | 'carousel'
  badge?: string
  title?: string
  subtitle?: string
  body?: string
  imagePosition?: 'left' | 'right'
  background?: 'default' | 'muted' | 'dark'
  ctaLabel?: string
  ctaLink?: string
  visible?: boolean
  images?: LandingImage[]
}

/** Cross-fading background slideshow for the hero (one photo = static). */
export function HeroSlideshow({ images, interval = 6000 }: { images: string[]; interval?: number }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (images.length < 2) return
    const t = setInterval(() => setI((n) => (n + 1) % images.length), interval)
    return () => clearInterval(t)
  }, [images.length, interval])
  return (
    <div className="pointer-events-none absolute inset-0">
      <AnimatePresence initial={false}>
        <motion.div key={images[i]}
          initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 1.2 }}
          className="absolute inset-0 opacity-25 dark:opacity-30"
          style={{ backgroundImage: `url(${images[i]})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
      </AnimatePresence>
      {/* Keep the headline readable over any photo */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/20 to-background" />
    </div>
  )
}

/** Sliding photo carousel with arrows, dots, captions and autoplay (pauses on hover). */
export function PhotoCarousel({ images, className, aspect = 'aspect-[16/9]' }: { images: LandingImage[]; className?: string; aspect?: string }) {
  const photos = images.filter((p) => p.url)
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const n = photos.length
  useEffect(() => {
    if (n < 2 || paused) return
    const t = setInterval(() => setI((x) => (x + 1) % n), 5000)
    return () => clearInterval(t)
  }, [n, paused])
  if (n === 0) return null
  const cur = photos[Math.min(i, n - 1)]
  const go = (d: number) => setI((x) => (x + d + n) % n)
  return (
    <div className={cn('group relative overflow-hidden rounded-2xl border border-border bg-muted shadow-xl', className)}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className={cn('relative', aspect)}>
        <AnimatePresence initial={false} mode="popLayout">
          <motion.img key={cur.url} src={cur.url} alt={cur.caption ?? ''}
            initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.45 }}
            className="absolute inset-0 h-full w-full object-cover" />
        </AnimatePresence>
        {cur.caption && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-5 pb-4 pt-10">
            <p className="text-sm font-medium text-white">{cur.caption}</p>
          </div>
        )}
      </div>
      {n > 1 && (
        <>
          <button type="button" onClick={() => go(-1)} aria-label="Photo précédente"
            className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-black/60">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button type="button" onClick={() => go(1)} aria-label="Photo suivante"
            className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-black/60">
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-3 right-4 flex gap-1.5">
            {photos.map((_, k) => (
              <button key={k} type="button" onClick={() => setI(k)} aria-label={`Photo ${k + 1}`}
                className={cn('h-2 rounded-full transition-all', k === i ? 'w-6 bg-white' : 'w-2 bg-white/50 hover:bg-white/80')} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/** Photo grid; clicking a photo opens it full-screen (arrow keys / Esc). */
export function PhotoGallery({ images }: { images: LandingImage[] }) {
  const photos = images.filter((p) => p.url)
  const [open, setOpen] = useState<number | null>(null)
  const n = photos.length
  useEffect(() => {
    if (open === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null)
      if (e.key === 'ArrowRight') setOpen((x) => (x === null ? x : (x + 1) % n))
      if (e.key === 'ArrowLeft') setOpen((x) => (x === null ? x : (x - 1 + n) % n))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, n])
  if (n === 0) return null
  return (
    <>
      <div className={cn('grid gap-3', n === 1 ? 'grid-cols-1' : n === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3')}>
        {photos.map((p, k) => (
          <motion.button key={`${p.url}-${k}`} type="button" onClick={() => setOpen(k)}
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: k * 0.05 }}
            className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-border bg-muted text-left">
            <img src={p.url} alt={p.caption ?? ''} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
            {p.caption && (
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-8 text-xs font-medium text-white">
                {p.caption}
              </span>
            )}
          </motion.button>
        ))}
      </div>
      <AnimatePresence>
        {open !== null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4" onClick={() => setOpen(null)}>
            <button type="button" aria-label="Fermer" onClick={() => setOpen(null)}
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20">
              <X className="h-5 w-5" />
            </button>
            <figure className="max-h-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
              <img src={photos[open].url} alt={photos[open].caption ?? ''} className="max-h-[80vh] w-auto rounded-lg object-contain" />
              {photos[open].caption && <figcaption className="mt-3 text-center text-sm text-white/80">{photos[open].caption}</figcaption>}
            </figure>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

const BG: Record<string, string> = {
  default: '',
  muted: 'bg-muted/30',
  dark: 'bg-slate-950 text-white',
}

/** Renders one admin-created section (text + photo, photo grid, or carousel). */
export function CustomSectionView({ section: s }: { section: CustomSection }) {
  const dark = s.background === 'dark'
  const images = (s.images ?? []).filter((p) => p.url)
  const heading = (
    <>
      {s.badge && (
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-xs text-brand-600 dark:text-brand-400">
          {s.badge}
        </div>
      )}
      {s.title && <h2 className={cn('text-3xl font-bold md:text-4xl', dark ? 'text-white' : 'text-foreground')}>{s.title}</h2>}
      {s.subtitle && <p className={cn('mt-2', dark ? 'text-slate-400' : 'text-muted-foreground')}>{s.subtitle}</p>}
    </>
  )
  const body = s.body && (
    <p className={cn('mt-4 whitespace-pre-line leading-relaxed', dark ? 'text-slate-300' : 'text-muted-foreground')}>{s.body}</p>
  )
  const cta = s.ctaLabel && (
    <Link href={s.ctaLink || '/register'}
      className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600">
      {s.ctaLabel} <ArrowRight className="h-4 w-4" />
    </Link>
  )

  if (s.layout === 'gallery' || s.layout === 'carousel') {
    return (
      <section className={cn('px-4 py-20', BG[s.background ?? 'default'])}>
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">{heading}{body}</div>
          {s.layout === 'carousel' ? <PhotoCarousel images={images} /> : <PhotoGallery images={images} />}
          {cta && <div className="text-center">{cta}</div>}
        </div>
      </section>
    )
  }

  // text-image: a single photo, or a small carousel when several were added
  const media = images.length > 1
    ? <PhotoCarousel images={images} />
    : images.length === 1
      ? (
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-border shadow-xl">
          <img src={images[0].url} alt={images[0].caption ?? s.title ?? ''} className="h-full w-full object-cover" />
        </div>
      )
      : <div className="hidden aspect-[4/3] rounded-2xl border border-border bg-gradient-to-br from-brand-500/20 via-brand-accent/20 to-transparent md:block" />
  const imageLeft = s.imagePosition === 'left'
  return (
    <section className={cn('px-4 py-20', BG[s.background ?? 'default'])}>
      <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-2">
        <motion.div initial={{ opacity: 0, x: imageLeft ? 20 : -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
          className={imageLeft ? 'md:order-2' : ''}>
          {heading}{body}{cta}
        </motion.div>
        <motion.div initial={{ opacity: 0, x: imageLeft ? -20 : 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
          className={imageLeft ? 'md:order-1' : ''}>
          {media}
        </motion.div>
      </div>
    </section>
  )
}
