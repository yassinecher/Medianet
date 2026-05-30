'use client'
import * as React from 'react'
import * as A from '@radix-ui/react-avatar'
import { cn } from '@/lib/utils'

export const Avatar = React.forwardRef<React.ElementRef<typeof A.Root>, React.ComponentPropsWithoutRef<typeof A.Root>>(({ className, ...p }, ref) => <A.Root ref={ref} className={cn('relative flex h-9 w-9 shrink-0 overflow-hidden rounded-full', className)} {...p} />)
Avatar.displayName = 'Avatar'
export const AvatarFallback = React.forwardRef<React.ElementRef<typeof A.Fallback>, React.ComponentPropsWithoutRef<typeof A.Fallback>>(({ className, ...p }, ref) => <A.Fallback ref={ref} className={cn('flex h-full w-full items-center justify-center rounded-full bg-brand-100 text-brand-700 text-xs font-semibold dark:bg-brand-900/40 dark:text-brand-400', className)} {...p} />)
AvatarFallback.displayName = 'AvatarFallback'
