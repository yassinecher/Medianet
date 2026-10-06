import { cn } from '@/lib/utils'

/**
 * BorderBeam — a soft light gliding along a card's border.
 *
 * Drawn ON the parent's 1px border (`-inset-px`), so the parent must NOT be
 * `overflow-hidden` (that clips it back inside the border). Designed to stay
 * in the background: thin, long gradual tail, head that fades out, faint glow,
 * slow lap, gentle breathing — and it dims while a field inside the card has
 * focus, so it never competes with the form (globals.css: `.beam-*`).
 * The angle is a registered CSS custom property animated in CSS (no JS);
 * reduced-motion visitors get a faint, still accent.
 */
export function BorderBeam({
  className,
  duration = 16,
  // The back-office primary (tailwind brand-500).
  color = '#6272f6',
  delay = 0,
  borderWidth = 1.5,
}: {
  className?: string
  /** Seconds per full lap. */
  duration?: number
  /** Any CSS color (hex, rgb(), var()). */
  color?: string
  /** Seconds — offsets where the beam starts. */
  delay?: number
  borderWidth?: number
}) {
  const tint = (pct: number) => `color-mix(in srgb, ${color} ${pct}%, transparent)`
  return (
    <div aria-hidden className={cn('beam-wrap pointer-events-none absolute -inset-px rounded-[inherit]', className)}
      style={{ filter: `drop-shadow(0 0 8px ${tint(60)})` }}>
      <div className="beam-ring absolute inset-0 rounded-[inherit]"
        style={{
          ['--beam-width' as string]: `${borderWidth}px`,
          ['--beam-duration' as string]: `${duration}s`,
          ['--beam-delay' as string]: `${-delay}s`,
          // ~150° arc: long gradual tail → full color just before the head → soft fade-out.
          backgroundImage: `conic-gradient(from var(--beam-angle), transparent 0deg 210deg, ${tint(30)} 270deg, ${tint(85)} 320deg, ${color} 348deg, ${tint(80)} 355deg, transparent 360deg)`,
        }} />
    </div>
  )
}
