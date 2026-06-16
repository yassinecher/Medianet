'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, FolderKanban, FileText, CheckSquare,
  Bell, Bot, Users, Settings, LogOut, Moon, Sun,
  ChevronRight, Menu, X, Trophy, Shield, Home, Sparkles, Building2,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useAuthStore, useUser } from '@/store/auth.store'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn, getInitials } from '@/lib/utils'

const navItems = [
  { label: 'Tableau de bord', href: '/dashboard', icon: LayoutDashboard, module: 'dashboard' },
  { label: 'Assistant IA', href: '/ai-assistant', icon: Sparkles, highlight: true, module: 'ai' },
  { label: 'Programmes', href: '/programmes', icon: FolderKanban, module: 'programmes' },
  { label: 'Candidatures', href: '/candidatures', icon: FileText, module: 'candidatures' },
  { label: 'Tâches', href: '/tasks', icon: CheckSquare, module: 'tasks' },
  { label: 'Évaluation IA', href: '/ai-scoring', icon: Bot, module: 'ai' },
  { label: 'Matching IA', href: '/ai-matching', icon: Trophy, module: 'ai' },
  { label: 'Invitations', href: '/notifications', icon: Bell, module: 'notifications' },
  { label: 'Utilisateurs', href: '/users', icon: Users, module: 'users' },
  { label: 'Organisations', href: '/organizations', icon: Building2, module: 'organizations' },
  { label: 'Page d\'accueil', href: '/landing-page', icon: Home, module: 'landing' },
  { label: 'Paramètres', href: '/settings', icon: Settings, module: 'settings' },
] as const

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const user = useUser()
  const logout = useAuthStore((s) => s.logout)
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = () => { logout(); router.push('/login') }

  // A module is shown only when the user holds its `{module}:read` permission.
  // Fallback: if no permission info (older token), show everything (no lock-out).
  const perms = (user?.permissions ?? user?.allPermissions ?? []) as string[]
  const canSee = (m?: string) => !m || perms.length === 0 || perms.includes(`${m}:read`)

  const Sidebar = ({ onClose }: { onClose?: () => void }) => (
    <aside className="flex h-full w-64 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-border px-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 shadow-lg shadow-brand-500/25">
          <Shield className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">Admin Console</p>
          <p className="text-xs text-muted-foreground">Medianet Incubateur</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {navItems.filter((item: any) => canSee(item.module)).map((item: any) => {
          const Icon = item.icon
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link key={item.href} href={item.href} onClick={onClose}
              className={cn('group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400'
                  : item.highlight
                  ? 'bg-gradient-to-r from-brand-500/10 to-purple-500/10 text-foreground hover:from-brand-500/20 hover:to-purple-500/20'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}>
              <Icon className={cn('h-4 w-4 transition-transform duration-150 group-hover:scale-110',
                active && 'text-brand-600 dark:text-brand-400',
                item.highlight && !active && 'text-brand-600 dark:text-brand-400')} />
              <span className="flex-1">{item.label}</span>
              {item.highlight && !active && (
                <span className="rounded-full bg-gradient-to-r from-brand-500 to-purple-600 px-1.5 py-0.5 text-[9px] font-bold text-white">NEW</span>
              )}
              {active && <ChevronRight className="h-3 w-3 opacity-40" />}
            </Link>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 rounded-lg bg-muted px-3 py-2.5">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">{user ? getInitials(`${user.firstName} ${user.lastName}`) : 'A'}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-foreground">{user?.firstName} {user?.lastName}</p>
            <p className="text-xs text-muted-foreground">Administrateur</p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleLogout}>
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </aside>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <div className="hidden shrink-0 md:flex"><Sidebar /></div>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 md:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
            <motion.div initial={{ x: -256 }} animate={{ x: 0 }} exit={{ x: -256 }} className="absolute left-0 top-0 h-full shadow-2xl">
              <Sidebar onClose={() => setMobileOpen(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            <Sun className="h-4 w-4 rotate-0 scale-100 dark:-rotate-90 dark:scale-0 transition-all" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 dark:rotate-0 dark:scale-100 transition-all" />
          </Button>
          <div className="hidden items-center gap-2 sm:flex">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">{user ? getInitials(`${user.firstName} ${user.lastName}`) : 'A'}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium leading-none">{user?.firstName} {user?.lastName}</p>
              <p className="text-xs text-muted-foreground">Admin</p>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
