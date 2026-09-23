'use client'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useBrandLogoUrl } from './useBrandLogo'

const HEIGHT = { sm: 'h-8', md: 'h-9', lg: 'h-11' } as const

/**
 * Medianet Incubator logo. Defaults to the bundled SVG (navy wordmark in light
 * mode, a light-text variant in dark mode); an admin can replace it from the
 * landing-page editor ("Logo du site"), which then applies to every page.
 * `stripe` / `tagline` are kept for call-site compatibility — the artwork
 * already contains the tagline and the multicolor mark.
 */
export function MedianetLogo({ size = 'md', href, className }: {
  size?: 'sm' | 'md' | 'lg'
  stripe?: boolean
  tagline?: boolean
  /** Wrap in a link (e.g. "/") when provided. */
  href?: string
  className?: string
}) {
  const custom = useBrandLogoUrl()
  const h = HEIGHT[size]
  const inner = (
    <span className={cn('inline-flex items-center', className)}>
      {custom ? (
        <img src={custom} alt="Medianet Incubator" className={cn(h, 'w-auto max-w-[220px] object-contain')} />
      ) : (
        <>
          <img src="/brand/medianet-incubator.svg" alt="Medianet Incubator" className={cn(h, 'w-auto dark:hidden')} />
          <img src="/brand/medianet-incubator-dark.svg" alt="Medianet Incubator" className={cn(h, 'hidden w-auto dark:block')} />
        </>
      )}
    </span>
  )
  return href ? <Link href={href} className="inline-flex">{inner}</Link> : inner
}
