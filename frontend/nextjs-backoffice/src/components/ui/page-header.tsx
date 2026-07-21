import * as React from 'react'
import Link from 'next/link'
import { ArrowLeft, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The one page title block used across the admin. Replaces ~17 hand-rolled
 * `h1 + p + actions` headers with a single accessible, consistent component:
 * optional leading icon, optional back link, a title, a description, and a
 * right-aligned actions slot. Additive — pages adopt it incrementally.
 */
export interface PageHeaderProps {
  title: React.ReactNode
  description?: React.ReactNode
  /** Leading brand icon shown in a rounded tile. */
  icon?: LucideIcon
  /** Renders a back button linking here. */
  backHref?: string
  /** Right-aligned actions (buttons, etc.). */
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({ title, description, icon: Icon, backHref, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-wrap items-start gap-3', className)}>
      {backHref && (
        <Link href={backHref} aria-label="Retour"
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
      )}
      {Icon && (
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
          <Icon className="h-5 w-5" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-2xl font-bold text-foreground">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** A lighter heading for sections within a page. */
export function SectionHeader({ title, description, icon: Icon, actions, className }: Omit<PageHeaderProps, 'backHref'>) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {Icon && <Icon className="h-4 w-4 shrink-0 text-brand-500" />}
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
