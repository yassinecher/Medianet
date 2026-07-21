import * as React from 'react'
import { AlertTriangle, Inbox, RefreshCw, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

/**
 * The two "nothing to show" states every page needs, made consistent:
 *  • EmptyState — no data yet (dashed, calm, optional call-to-action)
 *  • ErrorState — a load failed (with a Retry action)
 * Replaces ~8 hand-rolled dashed empty blocks and scattered error markup.
 */
export interface EmptyStateProps {
  title: React.ReactNode
  description?: React.ReactNode
  icon?: LucideIcon
  action?: React.ReactNode
  className?: string
  /** Compact variant for inline placeholders inside panels. */
  compact?: boolean
}

export function EmptyState({ title, description, icon: Icon = Inbox, action, className, compact }: EmptyStateProps) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/10 text-center',
      compact ? 'p-6' : 'p-12', className)}>
      <Icon className={cn('mb-2 text-muted-foreground/40', compact ? 'h-8 w-8' : 'h-10 w-10')} aria-hidden />
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-md text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export interface ErrorStateProps {
  title?: React.ReactNode
  description?: React.ReactNode
  onRetry?: () => void
  retrying?: boolean
  className?: string
  compact?: boolean
}

export function ErrorState({ title = 'Une erreur est survenue', description, onRetry, retrying, className, compact }: ErrorStateProps) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/5 text-center',
      compact ? 'p-6' : 'p-10', className)} role="alert">
      <AlertTriangle className={cn('mb-2 text-rose-500', compact ? 'h-8 w-8' : 'h-10 w-10')} aria-hidden />
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-md text-xs text-muted-foreground">{description}</p>}
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={onRetry} disabled={retrying}>
          <RefreshCw className={cn('h-3.5 w-3.5', retrying && 'animate-spin')} />Réessayer
        </Button>
      )}
    </div>
  )
}
