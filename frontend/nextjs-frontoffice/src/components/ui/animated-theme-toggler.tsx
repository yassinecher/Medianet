'use client'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'
import { useCallback } from 'react'
import { flushSync } from 'react-dom'
import { cn } from '@/lib/utils'

/**
 * AnimatedThemeToggler — switches light/dark using the View Transitions API.
 *
 * On click:
 *  1. Sets --vt-x / --vt-y CSS vars on <html> to the button's center position.
 *  2. Calls document.startViewTransition(() => setTheme(...)).
 *  3. The CSS in globals.css animates a circle that expands from that point,
 *     revealing the new theme underneath — same effect as MagicUI's toggler.
 *
 * Falls back to an instant theme switch when View Transitions API is unavailable
 * (Firefox < 126, Safari < 18).
 */
export function AnimatedThemeToggler({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()

  const toggle = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const newTheme = resolvedTheme === 'dark' ? 'light' : 'dark'

      // Fallback for browsers without View Transitions support
      if (!('startViewTransition' in document)) {
        setTheme(newTheme)
        return
      }

      // Position the reveal circle at the button's center
      const rect = e.currentTarget.getBoundingClientRect()
      const x = Math.round(rect.left + rect.width / 2)
      const y = Math.round(rect.top + rect.height / 2)
      document.documentElement.style.setProperty('--vt-x', `${x}px`)
      document.documentElement.style.setProperty('--vt-y', `${y}px`)

      document.startViewTransition(() => {
        flushSync(() => setTheme(newTheme))
      })
    },
    [resolvedTheme, setTheme],
  )

  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      className={cn(
        'relative flex h-9 w-9 items-center justify-center rounded-lg',
        'text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
        className,
      )}
    >
      {/* Sun — visible in light mode */}
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      {/* Moon — visible in dark mode */}
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </button>
  )
}
