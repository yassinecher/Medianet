'use client'
import { cn } from '@/lib/utils'
import { useBrandLogoUrl } from './useBrandLogo'

/**
 * Compact brand mark for tight spots (collapsed sidebar): the four Medianet
 * shapes only, cropped from the full artwork — readable on light and dark.
 * An admin-chosen logo ("Logo du site") replaces it, scaled to fit.
 */
export function MedianetMark({ className }: { className?: string }) {
  const custom = useBrandLogoUrl()
  return custom
    ? <img src={custom} alt="Medianet Incubator" className={cn('h-8 w-auto max-w-[56px] object-contain', className)} />
    : <img src="/brand/medianet-mark.svg" alt="Medianet Incubator" className={cn('h-[18px] w-auto', className)} />
}
