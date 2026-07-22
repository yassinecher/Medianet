'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut, Menu, X, Briefcase, Sparkles, GraduationCap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { useAuthStore, useUser, frontofficeRolesOf, permsOf, type FrontofficeRole } from '@/store/auth.store'
import { Button } from '@/components/ui/button'
import { cn, getInitials } from '@/lib/utils'

const navLinks = [
  { label: 'Programmes', href: '/programmes' }, // public — always visible
  // Discovery pages — navbar shows them to VISITORS (logged-in users keep a
  // compact workspace nav; these stay one click away in the footer).
  { label: 'Partenaires', href: '/partenaires', publicOnly: true },
  { label: 'Sociétés incubées', href: '/societes-incubees', publicOnly: true },
  { label: 'À propos', href: '/a-propos', publicOnly: true },
  { label: 'Tableau de bord', href: '/dashboard', auth: true },
  { label: 'Mes candidatures', href: '/candidatures', auth: true, perm: 'candidatures:read' },
  { label: 'Mes organisations', href: '/organizations', auth: true, perm: 'organizations:read' },
  { label: 'Mes tâches', href: '/tasks', auth: true, perm: 'tasks:read' },
] as const

const ROLE_META: Record<FrontofficeRole, { label: string; icon: any; color: string }> = {
  PORTEUR: { label: 'Porteur', icon: Briefcase,    color: 'text-brand-600 dark:text-brand-400'   },
  MENTOR:  { label: 'Mentor',  icon: Sparkles,     color: 'text-emerald-600 dark:text-emerald-400' },
  JURY:    { label: 'Juré',    icon: GraduationCap, color: 'text-amber-600 dark:text-amber-400'   },
}

export function Navbar() {
  const realUser = useUser()
  const logout = useAuthStore((s) => s.logout)
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // ── Edit-mode preview: when the navbar is rendered inside the backoffice
  // landing-page editor iframe (?edit=1), force a logged-out view so the
  // admin sees what an anonymous visitor sees, not their own admin profile.
  const [editMode, setEditMode] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    setEditMode(new URLSearchParams(window.location.search).get('edit') === '1')
  }, [])
  const user = editMode ? null : realUser

  // Layout adapts to the user's full role + permission set (no role-picking).
  const roles = frontofficeRolesOf(user)
  const perms = permsOf(user)

  const handleLogout = () => { logout(); router.push('/') }

  // Filter nav links by auth + the union of the user's roles and permissions.
  const visibleLinks = navLinks.filter((l: any) => {
    if (l.auth && !user) return false
    if (l.publicOnly && user) return false
    if (!l.roles && !l.perm) return true
    if (l.roles?.some((r: FrontofficeRole) => roles.includes(r))) return true
    if (l.perm && perms.includes(l.perm)) return true
    return false
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
              {/* Role badges — informational (the layout follows roles + permissions) */}
              {roles.length > 0 && (
                <div className="hidden items-center gap-1 sm:flex">
                  {roles.map((r) => {
                    const Icon = ROLE_META[r].icon
                    return (
                      <span key={r}
                        className={cn('flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1.5 text-xs font-bold', ROLE_META[r].color)}>
                        <Icon className="h-3 w-3" />
                        <span className="hidden sm:inline">{ROLE_META[r].label}</span>
                      </span>
                    )
                  })}
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
