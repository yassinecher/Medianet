'use client'
import { ShieldX } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

/**
 * Shown in place of a page's content when the logged-in user lacks the
 * permission the page requires. Updates live: if an admin grants the permission
 * while the user is on the page, the layout re-renders and the content appears.
 */
export function AccessDenied({ permission, fallbackHref }: { permission?: string; fallbackHref?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10">
        <ShieldX className="h-8 w-8 text-red-500" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-foreground">Accès refusé</h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Vous n&apos;avez pas la permission requise pour accéder à cette page.
        </p>
        {permission && (
          <p className="mt-2 text-xs text-muted-foreground">
            Permission requise :{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">{permission}</code>
          </p>
        )}
        <p className="mt-3 max-w-md text-xs text-muted-foreground">
          Contactez un administrateur pour obtenir cet accès — dès qu&apos;il vous sera accordé,
          la page se débloquera automatiquement, sans reconnexion.
        </p>
      </div>
      {fallbackHref && (
        <Link href={fallbackHref}>
          <Button variant="outline" size="sm">Retour</Button>
        </Link>
      )}
    </div>
  )
}
