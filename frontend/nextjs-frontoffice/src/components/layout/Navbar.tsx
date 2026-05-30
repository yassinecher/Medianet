'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut, Menu, X, ChevronDown, Briefcase, Sparkles, GraduationCap, RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { useAuthStore, useUser, useActiveRole, frontofficeRolesOf, type FrontofficeRole } from '@/store/auth.store'
import { Button } from '@/components/ui/button'
import { cn, getInitials } from '@/lib/utils'

const navLinks = [
  { label: 'Programmes', href: '/programmes' },
  { label: 'Tableau de bord', href: '/dashboard', auth: true },
  { label: 'Mes candidatures', href: '/candidatures', auth: true, roles: ['PORTEUR'] },
  { label: 'Mes tâches', href: '/tasks', auth: true },
] as const

const ROLE_META: Record<FrontofficeRole, { label: string; icon: any; color: string }> = {
  PORTEUR: { label: 'Porteur', icon: Briefcase,    color: 'text-brand-600 dark:text-brand-400'   },
  MENTOR:  { label: 'Mentor',  icon: Sparkles,     color: 'text-emerald-600 dark:text-emerald-400' },
  JURY:    { label: 'Juré',    icon: GraduationCap, color: 'text-amber-600 dark:text-amber-400'   },
}

export function Navbar() {
  const realUser = useUser()
  const realRole = useActiveRole()
  const setActiveRole = useAuthStore((s) => s.setActiveRole)
  const logout = useAuthStore((s) => s.logout)
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [roleMenu, setRoleMenu] = useState(false)
  const roleMenuRef = useRef<HTMLDivElement>(null)

  // ── Edit-mode preview: when the navbar is rendered inside the backoffice
  // landing-page editor iframe (?edit=1), force a logged-out view so the
  // admin sees what an anonymous visitor sees, not their own admin profile.
  const [editMode, setEditMode] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    setEditMode(new URLSearchParams(window.location.search).get('edit') === '1')
  }, [])
  const user = editMode ? null : realUser
  const activeRole = editMode ? null : realRole

  const availableRoles = frontofficeRolesOf(user)
  const ActiveIcon = activeRole ? ROLE_META[activeRole].icon : Briefcase

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (roleMenuRef.current && !roleMenuRef.current.contains(e.target as Node)) setRoleMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = () => { logout(); router.push('/') }
  const switchRole = (role: FrontofficeRole) => {
    setActiveRole(role)
    setRoleMenu(false)
    // Navigate home to refresh role-scoped content
    router.push('/dashboard')
  }

  // Filter nav links by active role + auth
  const visibleLinks = navLinks.filter((l: any) => {
    if (l.auth && !user) return false
    if (l.roles && activeRole && !l.roles.includes(activeRole)) return false
    return true
  })

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-purple-600">
            <span className="text-xs font-bold text-white">M</span>
          </div>
          <span className="font-bold text-foreground">Medianet Incubateur</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {visibleLinks.map((l) => (
            <Link key={l.href} href={l.href}
              className={cn('rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                pathname === l.href ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >{l.label}</Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <AnimatedThemeToggler />
          {user ? (
            <>
              {/* Role badge + switcher */}
              {activeRole && (
                <div className="relative" ref={roleMenuRef}>
                  <button type="button" onClick={() => setRoleMenu((v) => !v)}
                    className={cn('flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1.5 text-xs font-bold transition-colors',
                      'hover:border-brand-400 hover:bg-accent', ROLE_META[activeRole].color)}>
                    <ActiveIcon className="h-3 w-3" />
                    <span className="hidden sm:inline">{ROLE_META[activeRole].label}</span>
                    {availableRoles.length > 1 && <ChevronDown className="h-3 w-3" />}
                  </button>
                  {roleMenu && availableRoles.length > 1 && (
                    <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-border bg-card shadow-xl overflow-hidden z-50">
                      <p className="border-b border-border px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                        Changer de profil
                      </p>
                      {availableRoles.map((r) => {
                        const Icon = ROLE_META[r].icon
                        const active = r === activeRole
                        return (
                          <button key={r} type="button" onClick={() => switchRole(r)}
                            className={cn('flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors',
                              active ? 'bg-brand-500/10 text-brand-700 dark:text-brand-300 font-semibold' : 'hover:bg-accent text-foreground')}>
                            <Icon className={cn('h-3.5 w-3.5', ROLE_META[r].color)} />
                            {ROLE_META[r].label}
                            {active && <span className="ml-auto text-[10px] text-brand-600">●</span>}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
              <div className="hidden items-center gap-2 sm:flex">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-xs font-semibold dark:bg-brand-900/40 dark:text-brand-400">
                  {getInitials(`${user.firstName} ${user.lastName}`)}
                </div>
                <span className="text-sm font-medium text-foreground">{user.firstName}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout}><LogOut className="h-4 w-4" /></Button>
            </>
          ) : (
            <div className="hidden gap-2 sm:flex">
              <Link href="/login"><Button variant="outline" size="sm">Connexion</Button></Link>
              <Link href="/register"><Button variant="brand" size="sm">S'inscrire</Button></Link>
            </div>
          )}
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(!open)}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-border bg-background px-4 py-3 md:hidden">
          <div className="space-y-1">
            {visibleLinks.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
                className={cn('block rounded-lg px-3 py-2.5 text-sm font-medium',
                  pathname === l.href ? 'bg-brand-500/10 text-brand-600' : 'text-muted-foreground hover:bg-accent'
                )}
              >{l.label}</Link>
            ))}
            {!user && (
              <div className="flex gap-2 pt-2">
                <Link href="/login" className="flex-1" onClick={() => setOpen(false)}>
                  <Button variant="outline" className="w-full" size="sm">Connexion</Button>
                </Link>
                <Link href="/register" className="flex-1" onClick={() => setOpen(false)}>
                  <Button variant="brand" className="w-full" size="sm">S'inscrire</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
