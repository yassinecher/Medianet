'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Users, UserCheck, UserX, Shield, Mail, Check, X,
  Sparkles, Briefcase, GraduationCap, Crown, Pencil, Lock, KeyRound, Save
} from 'lucide-react'
import toast from 'react-hot-toast'
import { usersApi } from '@/lib/api'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { MagicCard } from '@/components/magicui/magic-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/utils'
import { useCan } from '@/hooks/useCan'

// ── Types ─────────────────────────────────────────────────────────────────────

interface User {
  id: number
  firstName: string
  lastName: string
  email: string
  role: string          // primary role (backward compat)
  roles?: string[]      // full set of roles
  active?: boolean
  createdAt?: string
}

const ROLES = [
  { value: 'PORTEUR', label: 'Porteur',       icon: Briefcase,    color: 'brand'   },
  { value: 'MENTOR',  label: 'Mentor',        icon: Sparkles,     color: 'green'   },
  { value: 'JURY',    label: 'Juré',          icon: GraduationCap, color: 'amber'  },
  { value: 'ADMIN',   label: 'Administrateur', icon: Crown,       color: 'purple'  },
] as const

const roleLabel = (r: string) => ROLES.find((x) => x.value === r)?.label ?? r

const roleBadge: Record<string, string> = {
  PORTEUR: 'bg-brand-500/10 text-brand-700 dark:text-brand-300 border-brand-500/30',
  MENTOR:  'bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/30',
  JURY:    'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
  ADMIN:   'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30',
}

// CRUD columns for the permission matrix (read first — it's auto-granted by C/U/D).
const ACTIONS = [
  { key: 'read', short: 'R', label: 'Lire' },
  { key: 'create', short: 'C', label: 'Créer' },
  { key: 'update', short: 'U', label: 'Modifier' },
  { key: 'delete', short: 'D', label: 'Supprimer' },
] as const
const MODULE_LABEL: Record<string, string> = {
  dashboard: 'Tableau de bord', programmes: 'Programmes', candidatures: 'Candidatures',
  tasks: 'Tâches', notifications: 'Invitations', users: 'Utilisateurs',
  organizations: 'Organisations', landing: 'Page d\'accueil', ai: 'IA',
  reports: 'Rapports', settings: 'Paramètres', sessions: 'Sessions',
}

// Modules a NON-admin user may hold (front-office features). Admin-only modules
// (dashboard, users, organizations, landing, ai, reports, settings, notifications)
// are hidden in the matrix and stripped when editing a non-admin user.
const NON_ADMIN_MODULES = ['programmes', 'candidatures', 'sessions', 'tasks', 'organizations']
const isFrontofficeSlug = (slug: string) => NON_ADMIN_MODULES.includes(slug.split(':')[0])

// ── Component ─────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('ALL')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'DISABLED'>('ALL')
  const [editingRolesFor, setEditingRolesFor] = useState<number | null>(null)
  const [draftRoles, setDraftRoles] = useState<string[]>([])
  const [savingRoles, setSavingRoles] = useState(false)
  // Edit user data
  const [editingDataFor, setEditingDataFor] = useState<number | null>(null)
  const [draftData, setDraftData] = useState({ firstName: '', lastName: '', email: '' })
  const [savingData, setSavingData] = useState(false)
  // Permission matrix
  const [catalog, setCatalog] = useState<Record<string, string>>({})
  const [editingPermsFor, setEditingPermsFor] = useState<number | null>(null)
  const [draftPerms, setDraftPerms] = useState<Set<string>>(new Set())
  const [permInherited, setPermInherited] = useState<Set<string>>(new Set())
  const [savingPerms, setSavingPerms] = useState(false)
  const { can } = useCan()

  useEffect(() => {
    usersApi.list()
      .then((r) => setUsers(r.data?.content ?? r.data ?? []))
      .catch(() => toast.error('Impossible de charger les utilisateurs'))
      .finally(() => setLoading(false))
    usersApi.permissionsCatalog().then((r) => setCatalog(r.data ?? {})).catch(() => {})
  }, [])

  const modules = Array.from(new Set(Object.keys(catalog).map((s) => s.split(':')[0])))
    .filter((m) => MODULE_LABEL[m]).sort()

  const handleToggle = async (user: User) => {
    const willDisable = user.active !== false
    const action = willDisable ? 'désactiver' : 'activer'
    if (!confirm(`Voulez-vous ${action} le compte de ${user.firstName} ${user.lastName} ?`)) return
    try {
      const res = await usersApi.toggleActive(user.id)
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, ...res.data } : u))
      toast.success(`Compte ${willDisable ? 'désactivé' : 'activé'}`)
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Erreur')
    }
  }

  const openRolesEditor = (user: User) => {
    setEditingRolesFor(user.id)
    setDraftRoles(user.roles ?? [user.role])
  }

  const toggleDraftRole = (role: string) => {
    setDraftRoles((prev) => prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role])
  }

  const saveRoles = async (userId: number) => {
    if (draftRoles.length === 0) { toast.error('Au moins un rôle est requis'); return }
    setSavingRoles(true)
    try {
      const res = await usersApi.syncRoles(userId, draftRoles)
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, ...res.data } : u))
      toast.success('Rôles mis à jour')
      setEditingRolesFor(null)
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Erreur')
    } finally { setSavingRoles(false) }
  }

  // ── Edit user data ─────────────────────────────────────────────────────────
  const openDataEditor = (u: User) => {
    setEditingDataFor(u.id); setEditingRolesFor(null); setEditingPermsFor(null)
    setDraftData({ firstName: u.firstName ?? '', lastName: u.lastName ?? '', email: u.email ?? '' })
  }
  const saveData = async (userId: number) => {
    setSavingData(true)
    try {
      const res = await usersApi.updateUser(userId, draftData)
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, ...res.data } : u))
      toast.success('Utilisateur mis à jour'); setEditingDataFor(null)
    } catch (err: any) { toast.error(err.response?.data?.message ?? 'Erreur') } finally { setSavingData(false) }
  }

  // ── Permission matrix ────────────────────────────────────────────────────────
  const openPermsEditor = async (u: User) => {
    setEditingPermsFor(u.id); setEditingRolesFor(null); setEditingDataFor(null)
    setDraftPerms(new Set()); setPermInherited(new Set())
    const isAdminUser = (u.roles ?? [u.role]).includes('ADMIN')
    try {
      const r = await usersApi.get(u.id)
      let direct: string[] = r.data?.directPermissions ?? []
      let all: string[] = r.data?.allPermissions ?? []
      // A non-admin user can only hold front-office permissions. Drop any admin
      // module perms from the draft so saving (syncPermissions) removes them.
      if (!isAdminUser) {
        direct = direct.filter(isFrontofficeSlug)
        all = all.filter(isFrontofficeSlug)
      }
      setDraftPerms(new Set(direct))
      setPermInherited(new Set(all.filter((s) => !direct.includes(s)))) // role-inherited
    } catch { /* keep empties */ }
  }
  const togglePerm = (module: string, action: string) => {
    const slug = `${module}:${action}`
    setDraftPerms((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) {
        // Read is locked while any C/U/D of the module is selected.
        if (action === 'read' && ['create', 'update', 'delete'].some((a) => next.has(`${module}:${a}`))) return next
        next.delete(slug)
      } else {
        next.add(slug)
        if (action !== 'read' && catalog[`${module}:read`]) next.add(`${module}:read`) // auto-read
      }
      return next
    })
  }
  const savePerms = async (userId: number) => {
    setSavingPerms(true)
    try {
      const res = await usersApi.syncPermissions(userId, Array.from(draftPerms))
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, ...res.data } : u))
      toast.success('Permissions mises à jour'); setEditingPermsFor(null)
    } catch (err: any) { toast.error(err.response?.data?.message ?? 'Erreur') } finally { setSavingPerms(false) }
  }

  // ── Filtering ──────────────────────────────────────────────────────────
  const filtered = users.filter((u) => {
    const userRoles = u.roles ?? [u.role]
    if (roleFilter !== 'ALL' && !userRoles.includes(roleFilter)) return false
    if (statusFilter === 'ACTIVE' && u.active === false) return false
    if (statusFilter === 'DISABLED' && u.active !== false) return false
    if (search) {
      const q = search.toLowerCase()
      if (![u.firstName, u.lastName, u.email].some((v) => v?.toLowerCase().includes(q))) return false
    }
    return true
  })

  const roleCounts = ROLES.reduce((acc, r) => {
    acc[r.value] = users.filter((u) => (u.roles ?? [u.role]).includes(r.value)).length
    return acc
  }, {} as Record<string, number>)

  return (
    <AdminLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Users className="h-6 w-6 text-brand-500" />Utilisateurs
            </h1>
            <p className="text-muted-foreground">{users.length} compte(s) au total</p>
          </div>
          <Link href="/notifications">
            <Button variant="brand" className="gap-1.5">
              <Mail className="h-4 w-4" />Inviter (Juré / Mentor / Porteur)
            </Button>
          </Link>
        </motion.div>

        {/* Role stat cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {ROLES.map((r) => {
            const Icon = r.icon
            const active = roleFilter === r.value
            return (
              <button key={r.value} type="button"
                onClick={() => setRoleFilter(active ? 'ALL' : r.value)}
                className={`text-left rounded-2xl border-2 p-4 transition-all
                  ${active ? `border-${r.color}-500 bg-${r.color}-500/5` : 'border-border bg-card hover:border-brand-400'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`h-4 w-4 ${active ? `text-${r.color}-600` : 'text-muted-foreground'}`} />
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{r.label}</p>
                </div>
                <p className="text-2xl font-black text-foreground tabular-nums">{roleCounts[r.value] ?? 0}</p>
              </button>
            )
          })}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Rechercher par nom ou email…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm">
            <option value="ALL">Tous statuts</option>
            <option value="ACTIVE">Actifs</option>
            <option value="DISABLED">Désactivés</option>
          </select>
          {roleFilter !== 'ALL' && (
            <Button variant="ghost" size="sm" onClick={() => setRoleFilter('ALL')} className="gap-1">
              <X className="h-3.5 w-3.5" />Effacer filtre rôle
            </Button>
          )}
        </div>

        {loading ? (
          <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
            Aucun utilisateur trouvé
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((u, i) => {
              const userRoles = u.roles ?? [u.role]
              const isUserAdmin = userRoles.includes('ADMIN')
              const permModules = isUserAdmin ? modules : modules.filter((m) => NON_ADMIN_MODULES.includes(m))
              const isEditingRoles = editingRolesFor === u.id
              const isEditingData = editingDataFor === u.id
              const isEditingPerms = editingPermsFor === u.id
              const anyEditing = isEditingRoles || isEditingData || isEditingPerms
              const disabled = u.active === false
              return (
                <motion.div key={u.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                  <MagicCard className="p-4">
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white text-sm font-bold
                        ${disabled
                          ? 'bg-muted-foreground/40'
                          : 'bg-gradient-to-br from-brand-500 to-purple-600'}`}>
                        {(u.firstName?.[0] ?? '?').toUpperCase()}{(u.lastName?.[0] ?? '').toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`font-medium ${disabled ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                            {u.firstName} {u.lastName}
                          </p>
                          {!anyEditing && userRoles.map((r) => (
                            <span key={r} className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${roleBadge[r] ?? 'bg-muted text-muted-foreground border-border'}`}>
                              {roleLabel(r)}
                            </span>
                          ))}
                          {disabled && (
                            <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-600">Désactivé</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-3 mt-0.5 text-xs text-muted-foreground">
                          <span>{u.email}</span>
                          {u.createdAt && <span>· Inscrit {formatDate(u.createdAt)}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                        {!anyEditing && can('users:update') && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => openDataEditor(u)} className="gap-1">
                              <Pencil className="h-3.5 w-3.5" />Modifier
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => openRolesEditor(u)} className="gap-1">
                              <Shield className="h-3.5 w-3.5" />Rôles
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => openPermsEditor(u)} className="gap-1">
                              <KeyRound className="h-3.5 w-3.5" />Permissions
                            </Button>
                            <Button variant="ghost" size="sm"
                              className={disabled ? 'text-green-600 hover:text-green-600' : 'text-destructive hover:text-destructive'}
                              onClick={() => handleToggle(u)}>
                              {disabled ? <><UserCheck className="h-3.5 w-3.5 mr-1" />Activer</> : <><UserX className="h-3.5 w-3.5 mr-1" />Désactiver</>}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Inline role editor */}
                    <AnimatePresence>
                      {isEditingRoles && (
                        <motion.div key="roles" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          <div className="border-t border-border mt-3 pt-3 space-y-3">
                            <p className="text-xs font-medium text-muted-foreground">Choisir les rôles de cet utilisateur :</p>
                            <div className="flex flex-wrap gap-2">
                              {ROLES.map((r) => {
                                const Icon = r.icon
                                const selected = draftRoles.includes(r.value)
                                return (
                                  <button key={r.value} type="button"
                                    onClick={() => toggleDraftRole(r.value)}
                                    className={`flex items-center gap-1.5 rounded-xl border-2 px-3 py-1.5 text-xs font-medium transition-all
                                      ${selected ? `border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-300` : 'border-border bg-card text-muted-foreground hover:border-brand-400'}`}>
                                    <Icon className="h-3.5 w-3.5" />{r.label}
                                    {selected && <Check className="h-3 w-3" />}
                                  </button>
                                )
                              })}
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => saveRoles(u.id)} disabled={savingRoles} className="gap-1.5">
                                {savingRoles ? <Check className="h-3.5 w-3.5 animate-pulse" /> : <Check className="h-3.5 w-3.5" />}
                                Enregistrer
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingRolesFor(null)}>Annuler</Button>
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                              ⚠ Modifier le rôle d'un utilisateur change ses permissions immédiatement (la session JWT en cours reste valable jusqu'à expiration).
                            </p>
                          </div>
                        </motion.div>
                      )}

                      {isEditingData && (
                        <motion.div key="data" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          <div className="border-t border-border mt-3 pt-3 space-y-3">
                            <p className="text-xs font-medium text-muted-foreground">Modifier les données de l'utilisateur :</p>
                            <div className="grid gap-2 sm:grid-cols-3">
                              <Input placeholder="Prénom" value={draftData.firstName} onChange={(e) => setDraftData((d) => ({ ...d, firstName: e.target.value }))} />
                              <Input placeholder="Nom" value={draftData.lastName} onChange={(e) => setDraftData((d) => ({ ...d, lastName: e.target.value }))} />
                              <Input type="email" placeholder="Email" value={draftData.email} onChange={(e) => setDraftData((d) => ({ ...d, email: e.target.value }))} />
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => saveData(u.id)} disabled={savingData} className="gap-1.5"><Save className="h-3.5 w-3.5" />Enregistrer</Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingDataFor(null)}>Annuler</Button>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {isEditingPerms && (
                        <motion.div key="perms" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          <div className="border-t border-border mt-3 pt-3 space-y-3">
                            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                              <KeyRound className="h-3.5 w-3.5" />Permissions directes — cocher C/U/D ajoute « Lire » automatiquement ; les permissions héritées d'un rôle (<Lock className="inline h-3 w-3" />) sont verrouillées.
                            </p>
                            {!isUserAdmin && (
                              <p className="text-[10px] text-amber-600 dark:text-amber-400">
                                Utilisateur non-admin : seules les permissions front-office (Programmes, Candidatures, Sessions, Tâches, Organisations) sont attribuables. Les modules d'administration sont réservés aux administrateurs.
                              </p>
                            )}
                            <div className="overflow-x-auto rounded-lg border border-border">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="bg-muted/40 text-muted-foreground">
                                    <th className="text-left font-medium py-1.5 px-2">Module</th>
                                    {ACTIONS.map((a) => <th key={a.key} className="px-2 py-1.5 font-medium" title={a.label}>{a.short}</th>)}
                                  </tr>
                                </thead>
                                <tbody>
                                  {permModules.map((m) => (
                                    <tr key={m} className="border-t border-border/50">
                                      <td className="py-1.5 px-2 font-medium text-foreground">{MODULE_LABEL[m] ?? m}</td>
                                      {ACTIONS.map((a) => {
                                        const slug = `${m}:${a.key}`
                                        const exists = !!catalog[slug]
                                        const inherited = permInherited.has(slug)
                                        const checked = inherited || draftPerms.has(slug)
                                        const lockedRead = a.key === 'read' && ['create', 'update', 'delete'].some((x) => draftPerms.has(`${m}:${x}`))
                                        const cellDisabled = !exists || inherited || lockedRead
                                        return (
                                          <td key={a.key} className="px-2 py-1.5 text-center">
                                            {exists ? (
                                              <span className="inline-flex items-center justify-center gap-0.5">
                                                <input type="checkbox" checked={checked} disabled={cellDisabled}
                                                  onChange={() => togglePerm(m, a.key)} className="accent-brand-500 h-4 w-4 disabled:opacity-50" />
                                                {inherited && <Lock className="h-3 w-3 text-muted-foreground" />}
                                              </span>
                                            ) : <span className="text-muted-foreground/30">—</span>}
                                          </td>
                                        )
                                      })}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => savePerms(u.id)} disabled={savingPerms} className="gap-1.5"><Save className="h-3.5 w-3.5" />Enregistrer</Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingPermsFor(null)}>Annuler</Button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </MagicCard>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
