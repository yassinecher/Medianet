'use client'
import { useState } from 'react'
import { Building2 } from 'lucide-react'

/** Organisation / partner logo that falls back to an icon when the image can't load. */
export function LogoImage({ src, alt, className, iconClassName = 'h-6 w-6' }: {
  src?: string | null
  alt: string
  className?: string
  iconClassName?: string
}) {
  const [failed, setFailed] = useState<string | null>(null)
  if (!src || failed === src) return <Building2 className={`${iconClassName} text-muted-foreground`} />
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} onError={() => setFailed(src)} />
}
