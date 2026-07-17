'use client'
import { Check, Layers, Lock, ShieldAlert } from 'lucide-react'

/** Mirrors the grouped catalog returned by GET /api/auth/permissions. */
export interface CatalogPermission {
  slug: string
  action: string
  label: string
  scope: 'GENERAL' | 'ADMIN'
}
export interface CatalogModule {
  key: string
  label: string
  description?: string
  scope: 'GENERAL' | 'ADMIN'
  permissions: CatalogPermission[]
}

export const CRUD_ACTIONS = [
  { key: 'read', short: 'R', label: 'Voir' },
  { key: 'create', short: 'C', label: 'Créer' },
  { key: 'update', short: 'U', label: 'Modifier' },
  { key: 'delete', short: 'D', label: 'Supprimer' },
] as const
const CRUD_KEYS: string[] = CRUD_ACTIONS.map((a) => a.key)

/** All slugs present in the catalog — used by the auto-read toggle logic. */
export function allSlugsOf(catalog: CatalogModule[]): Set<string> {
  return new Set(catalog.flatMap((m) => m.permissions.map((p) => p.slug)))
}

interface Props {
  catalog: CatalogModule[]
  /** Currently selected (direct) permission slugs. */
  selected: Set<string>
  /** Role-inherited slugs — shown checked and locked. */
  inherited?: Set<string>
  onToggle: (slug: string) => void
  /** When false, the Administration section is visible but read-only. */
  adminEditable?: boolean
}

/**
 * Permission picker split into two clearly-labelled sections:
 *  - "Permissions plateforme": business capabilities any user may hold.
 *  - "Permissions d'administration": back-office access — visually flagged and
 *    only editable by administrators (enforced server-side too).
 * Non-CRUD permissions (e.g. candidatures:evaluate) render as chips in the
 * section matching THEIR scope.
 */
export function PermissionMatrix({ catalog, selected, inherited, onToggle, adminEditable = true }: Props) {
  const generalModules = catalog.filter((m) => m.scope === 'GENERAL')
  const adminModules = catalog.filter((m) => m.scope === 'ADMIN')
  // Specials grouped by the PERMISSION scope (candidatures:decide is ADMIN even
  // though its module is GENERAL).
  const specialsOf = (scope: 'GENERAL' | 'ADMIN') =>
    catalog.flatMap((m) =>
      m.permissions
        .filter((p) => !CRUD_KEYS.includes(p.action) && p.scope === scope)
        .map((p) => ({ ...p, moduleLabel: m.label }))
    )

  const isInherited = (slug: string) => inherited?.has(slug) ?? false

  const renderTable = (modules: CatalogModule[], scope: 'GENERAL' | 'ADMIN', editable: boolean) => (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-muted/40 text-muted-foreground">
            <th className="text-left font-medium py-1.5 px-2">Module</th>
            {CRUD_ACTIONS.map((a) => (
              <th key={a.key} className="px-2 py-1.5 font-medium w-12" title={a.label}>{a.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {modules.map((m) => (
            <tr key={m.key} className="border-t border-border/50 align-top">
              <td className="py-1.5 px-2">
                <p className="font-medium text-foreground">{m.label}</p>
                {m.description && <p className="text-[10px] text-muted-foreground">{m.description}</p>}
              </td>
              {CRUD_ACTIONS.map((a) => {
                const perm = m.permissions.find((p) => p.action === a.key && p.scope === scope)
                if (!perm) return <td key={a.key} className="px-2 py-1.5 text-center text-muted-foreground/30">—</td>
                const inheritedHere = isInherited(perm.slug)
                const checked = inheritedHere || selected.has(perm.slug)
                // Read stays locked while any C/U/D of the module is selected.
                const lockedRead = a.key === 'read' &&
                  ['create', 'update', 'delete'].some((x) => selected.has(`${m.key}:${x}`))
                const disabled = !editable || inheritedHere || lockedRead
                return (
                  <td key={a.key} className="px-2 py-1.5 text-center">
                    <span className="inline-flex items-center justify-center gap-0.5">
                      <input type="checkbox" checked={checked} disabled={disabled}
                        onChange={() => onToggle(perm.slug)}
                        className="accent-brand-500 h-4 w-4 disabled:opacity-50" />
                      {inheritedHere && <Lock className="h-3 w-3 text-muted-foreground" aria-label="Héritée d'un rôle" />}
                    </span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  const renderSpecials = (scope: 'GENERAL' | 'ADMIN', editable: boolean) => {
    const specials = specialsOf(scope)
    if (specials.length === 0) return null
    return (
      <div className="space-y-1.5">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Permissions spéciales</p>
        <div className="flex flex-wrap gap-2">
          {specials.map((p) => {
            const inheritedHere = isInherited(p.slug)
            const checked = inheritedHere || selected.has(p.slug)
            const disabled = !editable || inheritedHere
            return (
              <button key={p.slug} type="button" disabled={disabled}
                onClick={() => onToggle(p.slug)}
                className={`flex items-center gap-1.5 rounded-xl border-2 px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-60
                  ${checked ? 'border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-300' : 'border-border bg-card text-muted-foreground hover:border-brand-400'}`}>
                {p.label}
                <span className="font-mono text-[10px] opacity-60">{p.slug}</span>
                {inheritedHere ? <Lock className="h-3 w-3" /> : checked ? <Check className="h-3 w-3" /> : null}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── Plateforme ─────────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-brand-500" />
          <p className="text-xs font-semibold text-foreground">Permissions plateforme</p>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Capacités métier (programmes, candidatures, tâches…) attribuables à n&apos;importe quel utilisateur.
          Cocher Créer / Modifier / Supprimer ajoute « Voir » automatiquement.
        </p>
        {renderTable(generalModules, 'GENERAL', true)}
        {renderSpecials('GENERAL', true)}
      </section>

      {/* ── Administration ─────────────────────────────────────────────────── */}
      <section className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
        <div className="flex items-center gap-1.5">
          <ShieldAlert className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Permissions d&apos;administration</p>
        </div>
        <p className="text-[10px] text-amber-700/80 dark:text-amber-300/80">
          Donnent accès aux modules du back-office (utilisateurs, rôles, emails, contenu…).
          À réserver aux profils de confiance — seul un administrateur peut les attribuer.
        </p>
        {!adminEditable && (
          <p className="flex items-center gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-300">
            <Lock className="h-3 w-3" />Lecture seule : connectez-vous en tant qu&apos;administrateur pour les modifier.
          </p>
        )}
        {renderTable(adminModules, 'ADMIN', adminEditable)}
        {renderSpecials('ADMIN', adminEditable)}
      </section>
    </div>
  )
}
