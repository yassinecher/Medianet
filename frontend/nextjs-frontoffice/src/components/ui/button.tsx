import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
brand: ` relative overflow-hidden rounded-full px-6 py-3 font-semibold text-white shadow-[0_10px_30px_rgba(12,179,215,0.35)] transition-transform duration-300 hover:scale-105 active:scale-95 before:absolute before:inset-0 before:bg-gradient-to-r before:from-[#0cb3d7] before:via-[#0cb3d7] before:to-[#0cb3d7] before:transition-opacity before:duration-700 after:absolute after:inset-0 after:bg-gradient-to-r after:from-[#f9a602] after:via-[#0cb3d7] after:to-[#0cb3d7] after:opacity-0 after:transition-opacity after:duration-700 hover:after:opacity-100 hover:shadow-[0_14px_35px_rgba(12,179,215,0.45)] `},
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-12 rounded-xl px-8 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
)

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>>(
  ({ className, variant, size, ...props }, ref) => (
  <button
  className={cn(buttonVariants({ variant, size, className }))}
  ref={ref}
  {...props}
>
  <span className="relative z-10 flex items-center gap-2">{props.children}</span>
</button>  )
)
Button.displayName = 'Button'
export { Button, buttonVariants }
