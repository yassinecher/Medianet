'use client'
import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  KeyRound, Plus, Pencil, Trash2, Save, X, Lock, Shield, Users as UsersIcon,
  GitBranch, Layers, ShieldAlert,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { rolesApi, usersApi, type RoleDto } from '@/lib/api'
import { PermissionMatrix, allSlugsOf, type CatalogModule } from '@/components/PermissionMatrix'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { MagicCard } from '@/components/magicui/magic-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useCan } from '@/hooks/useCan'

interface Draft {
  name: string
  displayName: string
  description: string
  permissions: Set<string>
  /** Parent role name ('' = no inheritance). */
  parentName: string
}
const emptyDraft = (): Draft => ({ name: '', displayName: '', description: '', permissions: new Set(), parentName: '' })

export default function RolesPage() {
  const { can, isAdmin } = useCan()
  const [roles, setRoles] = useState<RoleDto[]>([])
  const [catalog, setCatalog] = useState<CatalogModule[]>([])
  const [loading, setLoading] = useState(true)
  /** id of the role being edited, or 'new' for the create form */
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [saving, setSaving] = useState(false)

  const load = () => {
    Promise.all([rolesApi.list(), usersApi.permissionsCatalog()])
      .then(([r, c]) => { setRoles(r.data ?? []); setCatalog(c.data ?? []) })
      .catch((err) => toast.error(err.response?.data?.message ?? 'Impossible de charger les rôles'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const knownSlugs = useMemo(() => allSlugsOf(catalog), [catalog])

  const openCreate = () => { setEditing('new'); setDraft(emptyDraft()) }
  const openEdit = (role: RoleDto) => {
    setEditing(role.id)
    setDraft({
      name: role.name,
      displayName: role.displayName,
      description: role.description ?? '',
      permissions: new Set(role.permissions ?? []),
      parentName: role.parentName ?? '',
    })
  }
  const closeEditor = () => { setEditing(null); setDraft(emptyDraft()) }

  /** Effective permissions of the selected parent (own + its inherited chain). */
  const parentEffective = useMemo(() => {
    if (!draft.parentName) return new Set<string>()
    const p = roles.find((r) => r.name === draft.parentName)
    return new Set<string>([...(p?.permissions ?? []), ...(p?.inheritedPermissions ?? [])])
  }, [draft.parentName, roles])

  /** True when `candidate` inherits (directly or transitively) from `ancestorName`. */
  const inheritsFrom = (candidate: RoleDto, ancestorName: string): boolean => {
    const seen = new Set<string>()
    let cur: RoleDto | undefined = candidate
    while (cur?.parentName && !seen.has(cur.parentName)) {
      if (cur.parentName === ancestorName) return true
      seen.add(cur.parentName)
      cur = roles.find((r) => r.name === cur!.parentName)
    }
    return false
  }

  const togglePerm = (slug: string) => {
    const [module, action] = slug.split(':')
    setDraft((d) => {
      const next = new Set(d.permissions)
      if (next.has(slug)) {
        // Read stays locked while any C/U/D of the module is selected.
        if (action === 'read' && ['create', 'update', 'delete'].some((a) => next.has(`${module}:${a}`))) return d
        next.delete(slug)
      } else {
        next.add(slug)
        if (action !== 'read' && knownSlugs.has(`${module}:read`)) next.add(`${module}:read`) // auto-read
      }
      return { ...d, permissions: next }
    })
  }

  const save = async () => {
    if (!draft.displayName.trim()) { toast.error('Le libellé du rôle est requis'); return }
    setSaving(true)
    try {
      if (editing === 'new') {
        if (!draft.name.trim()) { toast.error('Le nom du rôle est requis'); setSaving(false); return }
        await rolesApi.create({
          name: draft.name.trim(),
          displayName: draft.displayName.trim(),
          description: draft.description || undefined,
          permissions: Array.from(draft.permissions),
          ...(draft.parentName ? { parentName: draft.parentName } : {}),
        })
        toast.success(`Rôle ${draft.name.trim().toUpperCase()} créé`)
      } else if (typeof editing === 'number') {
        const role = roles.find((r) => r.id === editing)
        await rolesApi.update(editing, {
          // System role names + inheritance are locked server-side — don't send them.
          ...(role && !role.systemRole ? { name: draft.name.trim(), parentName: draft.parentName } : {}),
          displayName: draft.displayName.trim(),
          description: draft.description,
          // ADMIN's permission set is immutable server-side — don't send it.
          ...(role?.name === 'ADMIN' ? {} : { permissions: Array.from(draft.permissions) }),
        })
        toast.success('Rôle mis à jour — les utilisateurs concernés sont notifiés en direct')
      }
      closeEditor()
      load()
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? err.response?.data?.error ?? 'Erreur')
    } finally { setSaving(false) }
  }

  const remove = async (role: RoleDto) => {
    if (!confirm(`Supprimer le rôle ${role.displayName} (${role.name}) ?`)) return
    try {
      await rolesApi.delete(role.id)
      toast.success('Rôle supprimé')
      load()
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? err.response?.data?.error ?? 'Erreur')
    }
  }

  const renderEditor = (role: RoleDto | null) => {
    const isAdminRole = role?.name === 'ADMIN'
    const isSystem = role?.systemRole ?? false
    return (
      <motion.div key="editor" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
        <div className="border-t border-border mt-3 pt-3 space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <div>
              <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Nom (code)</label>
              <Input placeholder="ex : COACH" value={draft.name} disabled={isSystem}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') }))} />
            </div>
            <div>
              <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Libellé</label>
              <Input placeholder="ex : Coach" value={draft.displayName}
                onChange={(e) => setDraft((d) => ({ ...d, displayName: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Description</label>
              <Input placeholder="Description du rôle" value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
            </div>
          </div>

          {!isSystem && (
            <div className="space-y-1">
              <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <GitBranch className="h-3 w-3" />Hériter d&apos;un rôle (optionnel)
              </label>
              <select value={draft.parentName}
                onChange={(e) => setDraft((d) => ({ ...d, parentName: e.target.value }))}
                className="h-10 w-full max-w-xs rounded-lg border border-input bg-background px-3 text-sm">
                <option value="">— Aucun héritage —</option>
                {roles
                  .filter((r) => r.name !== 'ADMIN'
                    && (!role || (r.name !== role.name && !inheritsFrom(r, role.name))))
                  .map((r) => (
                    <option key={r.name} value={r.name}>{r.displayName} ({r.name})</option>
                  ))}
              </select>
              {draft.parentName && (
                <p className="text-[10px] text-muted-foreground">
                  Ce rôle disposera en permanence de toutes les permissions de{' '}
                  <span className="font-semibold">{draft.parentName}</span> ({parentEffective.size} permission(s),
                  verrouillées <Lock className="inline h-2.5 w-2.5" /> ci-dessous) — toute modification du rôle
                  parent s&apos;applique en direct.
                </p>
              )}
            </div>
          )}

          {isAdminRole ? (
            <p className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5" />
              Le rôle ADMIN détient toujours l&apos;intégralité des permissions — sa liste n&apos;est pas modifiable.
            </p>
          ) : (
            <>
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5" />
                Permissions du rôle — cocher Créer / Modifier / Supprimer ajoute « Voir » automatiquement.
              </p>
              <PermissionMatrix
                catalog={catalog}
                selected={draft.permissions}
                inherited={parentEffective}
                onToggle={togglePerm}
                adminEditable={isAdmin}
              />
            </>
          )}

          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={saving} className="gap-1.5">
              <Save className="h-3.5 w-3.5" />{editing === 'new' ? 'Créer le rôle' : 'Enregistrer'}
            </Button>
            <Button size="sm" variant="ghost" onClick={closeEditor}>Annuler</Button>
          </div>
          {typeof editing === 'number' && (
            <p className="text-[10px] text-muted-foreground">
              ⚡ Les utilisateurs qui détiennent ce rôle voient leurs accès se mettre à jour en direct, sans reconnexion.
            </p>
          )}
        </div>
      </motion.div>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <KeyRound className="h-6 w-6 text-brand-500" />Rôles &amp; permissions
            </h1>
            <p className="text-muted-foreground">
              {roles.length} rôle(s) — créez des rôles personnalisés et choisissez leurs permissions
            </p>
          </div>
          {can('roles:create') && (
            <Button variant="brand" className="gap-1.5" onClick={openCreate}>
              <Plus className="h-4 w-4" />Nouveau rôle
            </Button>
          )}
        </motion.div>

        {/* Create form */}
        <AnimatePresence>
          {editing === 'new' && (
            <MagicCard className="p-4">
              <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Plus className="h-4 w-4 text-brand-500" />Créer un rôle
              </p>
              {renderEditor(null)}
            </MagicCard>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
        ) : (
          <div className="space-y-2">
            {roles.map((role, i) => (
              <motion.div key={role.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                <MagicCard className="p-4">
                  <div className="flex items-center gap-4">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white
                      ${role.name === 'ADMIN' ? 'bg-gradient-to-br from-purple-500 to-purple-700' : 'bg-gradient-to-br from-brand-500 to-purple-600'}`}>
                      <Shield className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-foreground">{role.displayName}</p>
                        <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] font-bold text-muted-foreground">{role.name}</span>
                        {role.systemRole && (
                          <span className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                            <Lock className="h-2.5 w-2.5" />Système
                          </span>
                        )}
                        {role.parentName && (
                          <span className="flex items-center gap-1 rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-[10px] font-bold text-teal-700 dark:text-teal-300"
                            title={`Hérite en direct de toutes les permissions de ${role.parentName}`}>
                            <GitBranch className="h-2.5 w-2.5" />hérite de {role.parentName}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 mt-0.5 text-xs text-muted-foreground">
                        {role.description && <span>{role.description}</span>}
                        <span className="flex items-center gap-1"><UsersIcon className="h-3 w-3" />{role.userCount} utilisateur(s)</span>
                        <span className="flex items-center gap-1">
                          <KeyRound className="h-3 w-3" />
                          {role.permissions?.length ?? 0} permission(s)
                          {(role.inheritedPermissions?.length ?? 0) > 0 && ` + ${role.inheritedPermissions.length} héritée(s)`}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {editing !== role.id && can('roles:update') && (
                        <Button variant="ghost" size="sm" onClick={() => openEdit(role)} className="gap-1">
                          <Pencil className="h-3.5 w-3.5" />Modifier
                        </Button>
                      )}
                      {!role.systemRole && can('roles:delete') && (
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive gap-1"
                          onClick={() => remove(role)}>
                          <Trash2 className="h-3.5 w-3.5" />Supprimer
                        </Button>
                      )}
                      {editing === role.id && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={closeEditor}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <AnimatePresence>
                    {editing === role.id && renderEditor(role)}
                  </AnimatePresence>
                </MagicCard>
              </motion.div>
            ))}
          </div>
        )}

        {/* ── Modules & accès: which permission unlocks each module, and who has it ── */}
        {!loading && catalog.length > 0 && (
          <MagicCard className="p-4">
            <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Layers className="h-4 w-4 text-brand-500" />Modules &amp; accès
            </p>
            <p className="mb-3 text-xs text-muted-foreground">
              Un module n&apos;apparaît dans la navigation que si l&apos;utilisateur détient sa permission
              « Voir » — via un rôle (héritage compris) ou une permission directe. Ce tableau montre,
              pour chaque module, la permission requise et les rôles qui l&apos;accordent.
            </p>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/40 text-muted-foreground">
                    <th className="py-1.5 px-2 text-left font-medium">Module</th>
                    <th className="py-1.5 px-2 text-left font-medium">Portée</th>
                    <th className="py-1.5 px-2 text-left font-medium">Permission requise</th>
                    <th className="py-1.5 px-2 text-left font-medium">Rôles y donnant accès</th>
                  </tr>
                </thead>
                <tbody>
                  {catalog.map((m) => {
                    const readSlug = `${m.key}:read`
                    const grantingRoles = roles.filter((r) =>
                      (r.permissions ?? []).includes(readSlug) || (r.inheritedPermissions ?? []).includes(readSlug))
                    return (
                      <tr key={m.key} className="border-t border-border/50 align-top">
                        <td className="py-1.5 px-2">
                          <p className="font-medium text-foreground">{m.label}</p>
                          {m.description && <p className="text-[10px] text-muted-foreground">{m.description}</p>}
                        </td>
                        <td className="py-1.5 px-2">
                          {m.scope === 'ADMIN' ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                              <ShieldAlert className="h-2.5 w-2.5" />Administration
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-brand-500/30 bg-brand-500/10 px-2 py-0.5 text-[10px] font-bold text-brand-700 dark:text-brand-300">
                              <Layers className="h-2.5 w-2.5" />Plateforme
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-2">
                          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground">{readSlug}</code>
                        </td>
                        <td className="py-1.5 px-2">
                          <div className="flex flex-wrap gap-1">
                            {grantingRoles.length === 0
                              ? <span className="text-muted-foreground/60">aucun rôle (permission directe uniquement)</span>
                              : grantingRoles.map((r) => (
                                <span key={r.name}
                                  title={(r.inheritedPermissions ?? []).includes(readSlug)
                                    ? `Hérité de ${r.parentName}` : 'Permission propre au rôle'}
                                  className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold text-foreground">
                                  {r.displayName}
                                  {(r.inheritedPermissions ?? []).includes(readSlug) && ' ↑'}
                                </span>
                              ))}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">↑ = accès hérité du rôle parent.</p>
          </MagicCard>
        )}
      </div>
    </AdminLayout>
  )
}
