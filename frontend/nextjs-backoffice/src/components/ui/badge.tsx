import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/** Status pill. Replaces the ad-hoc `<span className="rounded-full …">` scattered
 *  across pages so every badge shares one shape, size and colour language. */
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-none transition-colors',
  {
    variants: {
      variant: {
        default:     'border-transparent bg-brand-500/10 text-brand-700 dark:text-brand-300',
        secondary:   'border-transparent bg-muted text-muted-foreground',
        outline:     'border-border text-foreground',
        success:     'border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
        warning:     'border-transparent bg-amber-500/10 text-amber-700 dark:text-amber-300',
        destructive: 'border-transparent bg-rose-500/10 text-rose-700 dark:text-rose-300',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { badgeVariants }
