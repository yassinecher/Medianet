import Link from 'next/link'
import { cn } from '@/lib/utils'

/**
 * Medianet wordmark — MEDIA in gold, NET in cyan, an optional tagline and the
 * signature multicolor stripe. Pure CSS/typography (no image asset), so it works
 * in both themes. Self-contained (the stripe gradient is inline).
 */
export function MedianetLogo({ size = 'md', stripe = true, tagline = true, href, className }: {
  size?: 'sm' | 'md' | 'lg'
  stripe?: boolean
  tagline?: boolean
  href?: string
  className?: string
}) {
  const word = size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-lg' : 'text-2xl'
  const inner = (
    <span className={cn('inline-flex flex-col leading-none', className)}>
      <span className={cn('font-extrabold tracking-tight', word)}>
        <span style={{ color: '#fbb431' }}>MEDIA</span>
        <span style={{ color: '#0cb3d7' }}>NET</span>
      </span>
      {tagline && (
        <span className="mt-0.5 text-[8px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          E-business Digital Strategy
        </span>
      )}
      {stripe && (
        <span className="mt-1.5 h-[3px] w-full rounded-full"
          style={{ background: 'linear-gradient(90deg,#fbb431 0%,#f97316 35%,#0cb3d7 70%,#6272f6 100%)' }} />
      )}
    </span>
  )
  return href ? <Link href={href} className="inline-flex">{inner}</Link> : inner
}
