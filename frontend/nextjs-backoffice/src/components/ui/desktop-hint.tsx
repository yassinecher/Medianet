import { Monitor } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Shown on phones / small tablets above editors built for a large screen
 * (visual builder, presentation studio): they still work, but the user knows
 * why the canvas needs horizontal scrolling. Hidden from lg up.
 */
export function DesktopHint({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('mb-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300 lg:hidden', className)}>
      <Monitor className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children ?? 'Cet éditeur est conçu pour un grand écran : sur téléphone, faites défiler la zone de travail ou ouvrez-le sur ordinateur.'}</span>
    </div>
  )
}
