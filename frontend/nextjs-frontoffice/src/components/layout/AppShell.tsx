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
  Building2, Presentation, Mail, Loader2,
} from 'lucide-react'
import { fetchNotifications, relTime, type NotificationItem } from '@/lib/notifications'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { useAuthStore, useUser, useFrontofficeRoles, usePerms, type FrontofficeRole } from '@/store/auth.store'
import { startAuthEvents } from '@/lib/authEvents'
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
  /** Required: the user must hold at least ONE of these roles. */
  roles?: FrontofficeRole[]
  /** Required: the user must hold this permission. */
  perm?: string
}

const NAV: NavItem[] = [
  // The dashboard is role-dependent: it only exists for front-office roles.
  { label: 'Tableau de bord',  href: '/dashboard',     icon: Home,          roles: ['PORTEUR', 'MENTOR', 'JURY'] },
  { label: 'Notifications',    href: '/notifications', icon: Bell,          roles: ['PORTEUR', 'MENTOR', 'JURY'] },
  { label: 'Programmes',       href: '/programmes',    icon: FolderKanban,  perm: 'programmes:read' },
  // "Mes candidatures" is the porteur experience — a jury/mentor holding
  // candidatures:read (to consult dossiers) must NOT see it.
  { label: 'Mes candidatures', href: '/candidatures',  icon: FileText,      roles: ['PORTEUR'], perm: 'candidatures:read' },
  { label: 'Mes présentations', href: '/presentations', icon: Presentation,  roles: ['PORTEUR'] },
  { label: 'Mes évaluations',  href: '/evaluations',   icon: GraduationCap, roles: ['JURY'], perm: 'candidatures:evaluate' },
  { label: 'Mes organisations', href: '/organizations', icon: Building2,    perm: 'organizations:read' },
  { label: 'Mes tâches',       href: '/tasks',         icon: CheckSquare,   perm: 'tasks:read' },
]

/**
 * Constraints are cumulative (AND): an item requiring a role AND a permission
 * only shows when the user satisfies BOTH. Losing either one — e.g. an admin
 * revokes the permission while the user is logged in — removes the item live.
 */
function navVisible(item: NavItem, roles: FrontofficeRole[], perms: string[]): boolean {
  if (item.roles && !item.roles.some((r) => roles.includes(r))) return false
  if (item.perm && !perms.includes(item.perm)) return false
  return true
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const user = useUser()
  const roles = useFrontofficeRoles()
  const perms = usePerms()
  const logout = useAuthStore((s) => s.logout)

  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Persist collapsed state across page loads
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('frontoffice.sidebar.collapsed') : null
    if (stored === '1') setCollapsed(true)
  }, [])
  // Live permission updates: refreshes the JWT (and this layout) whenever an
  // admin changes this user's roles/permissions; logs out if disabled.
  useEffect(() => { startAuthEvents() }, [])
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('frontoffice.sidebar.collapsed', collapsed ? '1' : '0')
    }
  }, [collapsed])

  // Close mobile sidebar on route change
  useEffect(() => { setMobileOpen(false) }, [pathname])

  const visibleNav = NAV.filter((n) => navVisible(n, roles, perms))

  const handleLogout = () => { logout(); router.push('/') }

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
                    title={collapsed ? item.label : [
                      item.roles ? `Rôle : ${item.roles.join(' ou ')}` : null,
                      item.perm ? `Permission : ${item.perm}` : null,
                    ].filter(Boolean).join(' · ') || undefined}
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

              {/* Avatar dropdown — account/theme/logout (no role switching) */}
              <AvatarMenu user={user} roles={roles} onLogout={handleLogout} />
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
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const ref = useRef<HTMLDivElement>(null)

  const load = () => { setLoading(true); fetchNotifications().then(setItems).finally(() => setLoading(false)) }

  // Load once on mount (drives the badge) and refresh each time the panel opens.
  useEffect(() => { load() }, [])
  useEffect(() => { if (open) load() }, [open])

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])

  const unread = items.filter((n) => n.unread).length
  const KindIcon = (k: NotificationItem['kind']) => (k === 'task' ? CheckSquare : Mail)

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)} title="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-background">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-border bg-card shadow-xl overflow-hidden z-50">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Notifications</p>
            {unread > 0 && (
              <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-400">
                {unread} à traiter
              </span>
            )}
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>
          ) : items.length === 0 ? (
            <div className="p-6 text-center">
              <Bell className="mx-auto h-8 w-8 text-muted-foreground opacity-30 mb-2" />
              <p className="text-xs text-muted-foreground">Aucune notification.</p>
            </div>
          ) : (
            <ul className="max-h-80 overflow-y-auto divide-y divide-border">
              {items.slice(0, 6).map((n) => {
                const Icon = KindIcon(n.kind)
                const inner = (
                  <div className="flex gap-2.5">
                    <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                      n.kind === 'task' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-brand-500/10 text-brand-600 dark:text-brand-400')}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{n.title}</p>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">{relTime(n.at)}</p>
                    </div>
                    {n.unread && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
                  </div>
                )
                return (
                  <li key={n.id} className={cn('px-3 py-2 hover:bg-accent/30', n.unread && 'bg-brand-500/5')}>
                    {n.href
                      ? <Link href={n.href} onClick={() => setOpen(false)} className="block">{inner}</Link>
                      : inner}
                  </li>
                )
              })}
            </ul>
          )}
          <Link href="/notifications" onClick={() => setOpen(false)}
            className="block border-t border-border px-3 py-2 text-center text-xs font-semibold text-brand-600 hover:bg-accent dark:text-brand-400">
            Voir toutes les notifications
          </Link>
        </div>
      )}
    </div>
  )
}

// ── Avatar dropdown — account, theme, role, logout ──────────────────────────

function AvatarMenu({ user, roles, onLogout }: {
  user: User | null
  roles: FrontofficeRole[]
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
            {roles.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {roles.map((r) => {
                  const I = ROLE_META[r].icon
                  return (
                    <span key={r} className={cn('inline-flex items-center gap-1 rounded-full bg-card border border-border px-2 py-0.5 text-[10px] font-bold', ROLE_META[r].color)}>
                      <I className="h-3 w-3" />
                      {ROLE_META[r].label}
                    </span>
                  )
                })}
              </div>
            )}
          </div>

          {/* Profile (porteurs) */}
          {roles.includes('PORTEUR') && (
            <Link href="/profile" onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors">
              <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
              Mon profil
            </Link>
          )}

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
