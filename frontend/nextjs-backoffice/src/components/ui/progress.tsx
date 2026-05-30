'use client'
import * as React from 'react'
import * as P from '@radix-ui/react-progress'
import { cn } from '@/lib/utils'

export const Progress = React.forwardRef<React.ElementRef<typeof P.Root>, React.ComponentPropsWithoutRef<typeof P.Root>>(
  ({ className, value, ...props }, ref) => (
    <P.Root ref={ref} className={cn('relative h-2 w-full overflow-hidden rounded-full bg-secondary', className)} {...props}>
      <P.Indicator className="h-full w-full flex-1 bg-brand-500 transition-all duration-500" style={{ transform: `translateX(-${100 - (value || 0)}%)` }} />
    </P.Root>
  )
)
Progress.displayName = 'Progress'
