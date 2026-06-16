import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import Cookies from 'js-cookie'
import type { User } from '@/types'

/** Roles relevant to the frontoffice (porteur experience). ADMIN is backoffice-only. */
export const FRONTOFFICE_ROLES = ['PORTEUR', 'MENTOR', 'JURY'] as const
export type FrontofficeRole = typeof FRONTOFFICE_ROLES[number]

/** Filter a user's roles down to the ones that grant frontoffice access. */
export function frontofficeRolesOf(user: User | null | undefined): FrontofficeRole[] {
  if (!user) return []
  const all = new Set<string>([
    ...(user.roles ?? []),
    user.role,
  ].filter(Boolean) as string[])
  return FRONTOFFICE_ROLES.filter((r) => all.has(r))
}

/** Effective permission slugs (e.g. "candidatures:read") carried on the user. */
export function permsOf(user: User | null | undefined): string[] {
  if (!user) return []
  return (user.permissions ?? user.allPermissions ?? []) as string[]
}

/**
 * The single role used for role-flavored *content* (dashboard hero, copy).
 * Auto-derived — the user never picks it. Preference order = FRONTOFFICE_ROLES
 * (PORTEUR → MENTOR → JURY). The *layout* itself is driven by the full role +
 * permission set, not this single value.
 */
export function primaryRoleOf(user: User | null | undefined): FrontofficeRole | null {
  return frontofficeRolesOf(user)[0] ?? null
}

interface AuthStore {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  /** Which role the user has currently selected as active in the UI. */
  activeRole: FrontofficeRole | null
  setAuth: (user: User, token: string) => void
  setActiveRole: (role: FrontofficeRole | null) => void
  logout: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      activeRole: null,
      isAuthenticated: false,
      setAuth: (user, token) => {
        Cookies.set('token', token, { expires: 7, sameSite: 'Lax' })
        // The active role is auto-derived (primary role); the user never chooses.
        // The layout shows the union of all their roles + permissions regardless.
        set({ user, token, isAuthenticated: true, activeRole: primaryRoleOf(user) })
      },
      setActiveRole: (role) => set({ activeRole: role }),
      logout: () => {
        Cookies.remove('token')
        set({ user: null, token: null, isAuthenticated: false, activeRole: null })
      },
    }),
    {
      name: 'fo-auth',
      partialize: (s) => ({ user: s.user, token: s.token, activeRole: s.activeRole }),
      onRehydrateStorage: () => (s) => { if (s) s.isAuthenticated = !!s.token },
    }
  )
)

export const useUser = () => useAuthStore((s) => s.user)
export const useActiveRole = () => useAuthStore((s) => s.activeRole)
/** All frontoffice roles the user holds (drives layout/nav visibility). */
export const useFrontofficeRoles = () => useAuthStore((s) => frontofficeRolesOf(s.user))
/** Effective permission slugs the user holds (drives layout/nav visibility). */
export const usePerms = () => useAuthStore((s) => permsOf(s.user))
// Membership-based (true whenever the user HOLDS the role, not just "active").
export const useIsPorteur = () => useAuthStore((s) => frontofficeRolesOf(s.user).includes('PORTEUR'))
export const useIsMentor = () => useAuthStore((s) => frontofficeRolesOf(s.user).includes('MENTOR'))
export const useIsJury = () => useAuthStore((s) => frontofficeRolesOf(s.user).includes('JURY'))
