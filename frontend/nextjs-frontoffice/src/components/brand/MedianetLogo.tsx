import Link from 'next/link'
import { cn } from '@/lib/utils'

/**
 * Medianet wordmark — MEDIA in brand blue, NET in neutral grey, the
 * "E-business Digital Strategy" tagline and the signature multicolor stripe.
 * Pure CSS/typography (no image asset needed), so it inherits both themes.
 */
export function MedianetLogo({ size = 'md', stripe = true, tagline = true, href, className }: {
  size?: 'sm' | 'md' | 'lg'
  stripe?: boolean
  tagline?: boolean
  /** Wrap in a link (e.g. "/") when provided. */
  href?: string
  className?: string
}) {
  const word = size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-lg' : 'text-2xl'
  const inner = (
    <span className={cn('inline-flex flex-col leading-none', className)}>
      <span className={cn('font-extrabold tracking-tight', word)}>
        <span style={{ color: '#00A3E0' }}>MEDIA</span>
        <span className="text-muted-foreground">NET</span>
      </span>
      {tagline && (
        <span className="mt-0.5 text-[8px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          E-business Digital Strategy
        </span>
      )}
      {stripe && <span className="brand-stripe mt-1.5 h-[3px] w-full rounded-full" />}
    </span>
  )
  return href ? <Link href={href} className="inline-flex">{inner}</Link> : inner
}
