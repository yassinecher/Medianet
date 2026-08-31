import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import Cookies from 'js-cookie'
import type { User } from '@/types'

interface AuthStore {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  setAuth: (user: User, token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null, token: null, isAuthenticated: false,
      setAuth: (user, token) => {
        Cookies.set('admin_token', token, { expires: 7, sameSite: 'Strict' })
        set({ user, token, isAuthenticated: true })
      },
      logout: () => {
        Cookies.remove('admin_token')
        set({ user: null, token: null, isAuthenticated: false })
      },
    }),
    {
      name: 'bo-auth',
      partialize: (s) => ({ user: s.user, token: s.token }),
      onRehydrateStorage: () => (s) => {
        if (!s) return
        // The cookie is the source of truth: if it's gone (expired / cleared on a
        // 401), drop the persisted session so guards stay consistent.
        if (!Cookies.get('admin_token')) { s.user = null; s.token = null; s.isAuthenticated = false }
        else s.isAuthenticated = true
      },
    }
  )
)

export const useUser = () => useAuthStore((s) => s.user)
