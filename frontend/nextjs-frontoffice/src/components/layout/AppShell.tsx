'use client'
/**
 * Dashboard-style app shell for authenticated frontoffice routes
 * (dashboard, candidatures, tasks, invitations).
 *
 * Layout:
 *   ┌──────────┬────────────────────────────────┐
 *   │ sidebar  │ topbar (greeting + role/avatar)│
 *   │ (icons + │────────────────────────────────│
 *   │  labels) │          page content          │
 *   └──────────┴────────────────────────────────┘
 *
 * The sidebar is collapsible (icon-only mode). State persisted to localStorage.
 * Mobile: the sidebar collapses to a slide-over overlay.
 */
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import type { User } from '@/types'
import {
  Home, FileText, CheckSquare, FolderKanban, LogOut, ChevronLeft, ChevronRight,
  Briefcase, Sparkles, GraduationCap, Menu, X, ChevronDown, Bell, User as UserIcon,
} from 'lucide-react'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { useAuthStore, useUser, useActiveRole, frontofficeRolesOf, type FrontofficeRole } from '@/store/auth.store'
import { cn, getInitials } from '@/lib/utils'

const ROLE_META: Record<FrontofficeRole, { label: string; icon: any; color: string }> = {
  PORTEUR: { label: 'Porteur', icon: Briefcase,     color: 'text-brand-600 dark:text-brand-400'     },
  MENTOR:  { label: 'Mentor',  icon: Sparkles,      color: 'text-emerald-600 dark:text-emerald-400' },
  JURY:    { label: 'Juré',    icon: GraduationCap, color: 'text-amber-600 dark:text-amber-400'     },
}

type NavItem = {
  label: string
  href: string
  icon: any
  roles?: FrontofficeRole[]
}

const NAV: NavItem[] = [
  { label: 'Tableau de bord',  href: '/dashboard',    icon: Home },
  { label: 'Programmes',       href: '/programmes',   icon: FolderKanban },
  { label: 'Mes candidatures', href: '/candidatures', icon: FileText, roles: ['PORTEUR'] },
  { label: 'Mes tâches',       href: '/tasks',        icon: CheckSquare },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const user = useUser()
  const activeRole = useActiveRole()
  const setActiveRole = useAuthStore((s) => s.setActiveRole)
  const logout = useAuthStore((s) => s.logout)

  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Persist collapsed state across page loads
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('frontoffice.sidebar.collapsed') : null
    if (stored === '1') setCollapsed(true)
  }, [])
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('frontoffice.sidebar.collapsed', collapsed ? '1' : '0')
    }
  }, [collapsed])

  // Close mobile sidebar on route change
  useEffect(() => { setMobileOpen(false) }, [pathname])

  const availableRoles = frontofficeRolesOf(user)
  const visibleNav = NAV.filter((n) => !n.roles || (activeRole && n.roles.includes(activeRole)))

  const handleLogout = () => { logout(); router.push('/') }
  const switchRole = (r: FrontofficeRole) => { setActiveRole(r); router.push('/dashboard') }

  return (
    <div className="min-h-screen bg-muted/20">
      {/* ── SIDEBAR (desktop) ─────────────────────────────────────────── */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-card transition-all duration-200 md:flex',
        collapsed ? 'w-16' : 'w-60',
      )}>
        {/* Brand */}
        <Link href="/dashboard" className={cn(
          'flex h-16 items-center border-b border-border px-4 transition-colors hover:bg-accent/30',
          collapsed && 'justify-center px-0'
        )}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-purple-600">
            <span className="text-xs font-bold text-white">M</span>
          </div>
          {!collapsed && <span className="ml-2.5 truncate font-bold text-foreground">Medianet</span>}
        </Link>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-2">
          <ul className="space-y-0.5">
            {visibleNav.map((item) => {
              const Icon = item.icon
              const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
              return (
                <li key={item.href}>
                  <Link href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      active
                        ? 'bg-brand-500/10 text-brand-700 dark:text-brand-300'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                      collapsed && 'justify-center px-0'
                    )}>
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Footer: collapse toggle */}
        <div className="border-t border-border p-2">
          <button type="button" onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? 'Étendre' : 'Réduire'}
            className="flex h-9 w-full items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            {!collapsed && <span className="ml-2 text-xs">Réduire</span>}
          </button>
        </div>
      </aside>

      {/* ── SIDEBAR (mobile slide-over) ───────────────────────────────── */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)} />
          <aside className="fixed inset-y-0 left-0 z-50 w-64 border-r border-border bg-card flex flex-col md:hidden animate-in slide-in-from-left duration-200">
            <div className="flex h-16 items-center justify-between border-b border-border px-4">
              <Link href="/dashboard" className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-purple-600">
                  <span className="text-xs font-bold text-white">M</span>
                </div>
                <span className="font-bold text-foreground">Medianet</span>
              </Link>
              <button type="button" onClick={() => setMobileOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-2">
              <ul className="space-y-0.5">
                {visibleNav.map((item) => {
                  const Icon = item.icon
                  const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
                  return (
                    <li key={item.href}>
                      <Link href={item.href}
                        className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                          active ? 'bg-brand-500/10 text-brand-700 dark:text-brand-300' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}>
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </nav>
          </aside>
        </>
      )}

      {/* ── MAIN AREA ─────────────────────────────────────────────────── */}
      <div className={cn('transition-all duration-200', collapsed ? 'md:ml-16' : 'md:ml-60')}>
        {/* TOPBAR — minimal: Dashboard + Notifications + Avatar dropdown */}
        <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
          <div className="flex h-14 items-center justify-between px-4 sm:px-6">
            <button type="button" onClick={() => setMobileOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent md:hidden">
              <Menu className="h-4 w-4" />
            </button>
            <div className="hidden md:block" />

            <div className="flex items-center gap-1">
              {/* Dashboard quick-jump */}
              <Link href="/dashboard" title="Tableau de bord"
                className={cn('flex h-9 w-9 items-center justify-center rounded-md transition-colors',
                  pathname === '/dashboard' ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400'
                                            : 'text-muted-foreground hover:bg-accent hover:text-foreground')}>
                <Home className="h-4 w-4" />
              </Link>

              {/* Notifications */}
              <NotificationsButton />

              {/* Avatar dropdown — holds account/role-switch/theme/logout */}
              <AvatarMenu user={user} activeRole={activeRole} availableRoles={availableRoles}
                onSwitchRole={switchRole} onLogout={handleLogout} />
            </div>
          </div>
        </header>

        {/* CONTENT */}
        <main className="px-4 py-6 sm:px-6">
          {children}
        </main>
      </div>
    </div>
  )
}

// ── Notifications bell ──────────────────────────────────────────────────────

function NotificationsButton() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // TODO: wire real notifications from a backend feed. For now we show a small
  // sample so the UI is testable; the unread count drives the red dot.
  const notifications: Array<{ id: string; title: string; body: string; ts: string; unread: boolean }> = []

  const unread = notifications.filter((n) => n.unread).length

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)} title="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-2 w-2 rounded-full bg-red-500 ring-2 ring-background" />
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-border bg-card shadow-xl overflow-hidden z-50">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Notifications</p>
            {unread > 0 && (
              <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-400">
                {unread}
              </span>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="p-6 text-center">
              <Bell className="mx-auto h-8 w-8 text-muted-foreground opacity-30 mb-2" />
              <p className="text-xs text-muted-foreground">Aucune notification.</p>
            </div>
          ) : (
            <ul className="max-h-80 overflow-y-auto divide-y divide-border">
              {notifications.map((n) => (
                <li key={n.id} className={cn('flex gap-3 px-3 py-2 text-sm hover:bg-accent/30', n.unread && 'bg-brand-500/5')}>
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: n.unread ? '#FF6A00' : 'transparent' }} />
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{n.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{n.ts}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

// ── Avatar dropdown — account, theme, role, logout ──────────────────────────

function AvatarMenu({ user, activeRole, availableRoles, onSwitchRole, onLogout }: {
  user: User | null
  activeRole: FrontofficeRole | null
  availableRoles: FrontofficeRole[]
  onSwitchRole: (r: FrontofficeRole) => void
  onLogout: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])

  if (!user) return null

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="flex h-9 items-center gap-2 rounded-full pl-1 pr-2.5 border border-transparent hover:border-border hover:bg-accent transition-colors">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-[11px] font-bold dark:bg-brand-900/40 dark:text-brand-400">
          {getInitials(`${user.firstName} ${user.lastName}`)}
        </div>
        <span className="hidden text-sm font-medium text-foreground sm:inline">{user.firstName}</span>
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-border bg-card shadow-xl overflow-hidden z-50">
          {/* User header */}
          <div className="border-b border-border px-3 py-3 bg-gradient-to-br from-brand-500/5 to-purple-500/5">
            <p className="text-sm font-bold text-foreground truncate">{user.firstName} {user.lastName}</p>
            <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
            {activeRole && (
              <span className={cn('mt-1.5 inline-flex items-center gap-1 rounded-full bg-card border border-border px-2 py-0.5 text-[10px] font-bold', ROLE_META[activeRole].color)}>
                {(() => { const I = ROLE_META[activeRole].icon; return <I className="h-3 w-3" /> })()}
                {ROLE_META[activeRole].label}
              </span>
            )}
          </div>

          {/* Account */}
          <Link href="/account" onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors">
            <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
            Mon compte
          </Link>

          {/* Theme — wrap the toggler so menu doesn't close on click */}
          <div className="flex items-center justify-between px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors">
            <span>Thème</span>
            <AnimatedThemeToggler />
          </div>

          {/* Role switcher */}
          {availableRoles.length > 1 && (
            <>
              <div className="border-t border-border" />
              <p className="px-3 pt-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Profils</p>
              {availableRoles.map((r) => {
                const Icon = ROLE_META[r].icon
                const active = r === activeRole
                return (
                  <button key={r} type="button" onClick={() => { onSwitchRole(r); setOpen(false) }}
                    className={cn('flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors',
                      active ? 'bg-brand-500/10 text-brand-700 dark:text-brand-300 font-semibold' : 'hover:bg-accent text-foreground')}>
                    <Icon className={cn('h-3.5 w-3.5', ROLE_META[r].color)} />
                    {ROLE_META[r].label}
                    {active && <span className="ml-auto text-[10px] text-brand-600">●</span>}
                  </button>
                )
              })}
            </>
          )}

          {/* Logout */}
          <div className="border-t border-border" />
          <button type="button" onClick={() => { onLogout(); setOpen(false) }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors">
            <LogOut className="h-3.5 w-3.5" />
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  )
}
