'use client'
import { cn } from '@/lib/utils'
import { useEffect, useRef } from 'react'

/**
 * BorderBeam — animated gradient border.
 *
 * Technique: conic-gradient rotated via rAF, masked to only the border strip
 * using CSS mask-composite: exclude (hides interior, shows only the border area).
 *
 * Why not the original offset-path: rect() approach?
 * → Poor browser support (Chrome 116+, not Safari, not Firefox stable).
 *
 * Why not the white padding-box overlay?
 * → That paints a solid white div over the card content, hiding labels and text.
 */
export function BorderBeam({
  className,
  size = 200,
  duration = 8,
  colorFrom = '#6272f6',
  colorTo = '#a78bfa',
  delay = 0,
  borderWidth = 1.5,
}: {
  className?: string
  size?: number
  duration?: number
  colorFrom?: string
  colorTo?: string
  delay?: number
  borderWidth?: number
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    let raf: number
    let startTs: number | null = null
    const totalMs = duration * 1000
    const delayMs = delay * 1000

    const tick = (ts: number) => {
      if (!startTs) startTs = ts - delayMs
      const elapsed = (ts - startTs) % totalMs
      const deg = (elapsed / totalMs) * 360
      // Just the conic gradient — no white interior overlay
      el.style.background = `conic-gradient(from ${deg}deg, transparent 0deg, ${colorFrom} 60deg, ${colorTo} 120deg, transparent 180deg)`
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [duration, colorFrom, colorTo, delay])

  return (
    <div
      ref={ref}
      className={cn('pointer-events-none absolute inset-0 rounded-[inherit]', className)}
      style={{
        border: `${borderWidth}px solid transparent`,
        // Mask trick: show ONLY the border strip, keep interior fully transparent.
        // Layer 1 (padding-box): white mask = opaque inside padding area
        // Layer 2 (border-box):  white mask = opaque over entire element
        // exclude/source-out composite: visible only where layer2=1 AND layer1=0
        //   → only the border strip is visible, interior is transparent
        WebkitMask: 'linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)',
        WebkitMaskComposite: 'source-out',
        mask: 'linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)',
        maskComposite: 'exclude',
      }}
    />
  )
}
