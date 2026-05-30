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
        // Auto-pick the active role if only one frontoffice role is available.
        const fo = frontofficeRolesOf(user)
        const activeRole: FrontofficeRole | null = fo.length === 1 ? fo[0] : null
        set({ user, token, isAuthenticated: true, activeRole })
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
export const useIsPorteur = () => useAuthStore((s) => s.activeRole === 'PORTEUR')
export const useIsMentor = () => useAuthStore((s) => s.activeRole === 'MENTOR')
export const useIsJury = () => useAuthStore((s) => s.activeRole === 'JURY')
