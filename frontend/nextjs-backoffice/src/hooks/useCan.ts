'use client'
import { useUser } from '@/store/auth.store'

/**
 * Permission helper for the back-office. A user can do `module:action` if they are
 * ADMIN (admins hold every permission) or their effective permission set includes it.
 * `perms` comes from the login payload (`permissions`) or a refreshed `UserDto`
 * (`allPermissions`).
 */
export function useCan() {
  const user = useUser()
  const isAdmin = user?.role === 'ADMIN' || (user?.roles?.includes('ADMIN') ?? false)
  const perms = (user?.permissions ?? user?.allPermissions ?? []) as string[]
  const can = (slug: string) => isAdmin || perms.includes(slug)
  const canModule = (m: string) => isAdmin || perms.some((p) => p.startsWith(`${m}:`))
  return { isAdmin, can, canModule, perms }
}
