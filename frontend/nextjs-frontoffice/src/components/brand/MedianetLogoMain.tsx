import Link from 'next/link'
import { cn } from '@/lib/utils'

/**
 * Medianet wordmark — MEDIA in brand blue, NET in neutral grey, the
 * "E-business Digital Strategy" tagline and the signature multicolor stripe.
 * Pure CSS/typography (no image asset needed), so it inherits both themes.
 */
export function MedianetLogoMain({ size = 'md', stripe = true, tagline = true, href, className }: {
  size?: 'sm' | 'md' | 'lg'
  stripe?: boolean
  tagline?: boolean
  /** Wrap in a link (e.g. "/") when provided. */
  href?: string
  className?: string
}) {
  const word = size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-lg' : 'text-2xl'
  const inner = (
    <span className={cn('inline-flex  leading-none', className)}>
      <span className={cn('font-extrabold tracking-tight', word)}>
        <span style={{ color: '#fbb431' }}>MEDIA</span>
        <span className="text-muted-foreground" style={{color:'#0cb3d7'}}>NET</span>
      </span>
      {tagline && (
        <span className="mt-1.5 ml-1.5 text-[8px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          E-business <br/> Digital Strategy
        </span>
      )}
     
    </span>
  )
  return href ? <Link href={href} className="inline-flex">{inner}</Link> : inner
}
