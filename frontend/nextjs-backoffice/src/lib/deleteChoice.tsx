'use client'
/**
 * Delete-choice dialog: on any delete across the admin, ask the user whether to
 * move the item to the Trash (recoverable) or delete it permanently.
 *
 * `await deleteChoice({ label })` resolves to 'trash' | 'purge' | null (cancel).
 * Mounts itself into document.body, so it's callable from anywhere.
 *
 * `performDelete(...)` ties it to the existing endpoints: the normal delete call
 * already soft-deletes (→ trash); "permanent" additionally purges it from the
 * trash, so no new backend endpoint is needed.
 */
import { createRoot } from 'react-dom/client'
import { trashApi } from '@/lib/api'

export type DeleteType = 'programme' | 'session' | 'task' | 'pitch'
export type DeleteOutcome = 'trash' | 'purge' | null

export interface DeleteChoiceOptions {
  /** What is being deleted, e.g. « la session "Demo Day" ». */
  label: string
  /** Optional extra warning line (e.g. nested items that go with it). */
  detail?: string
  /** Whether the "permanent" option is offered (default true). */
  allowPurge?: boolean
}

export function deleteChoice(opts: DeleteChoiceOptions): Promise<DeleteOutcome> {
  if (typeof document === 'undefined') return Promise.resolve(null)
  return new Promise((resolve) => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    const done = (v: DeleteOutcome) => { root.unmount(); host.remove(); resolve(v) }
    root.render(<Dialog opts={opts} onResolve={done} />)
  })
}

/**
 * Full flow: ask, then run the existing (soft) delete and, if the user chose
 * "permanent", purge it from the trash. Returns the outcome (null = cancelled).
 */
export async function performDelete(
  type: DeleteType,
  id: number,
  softDelete: () => Promise<unknown>,
  opts: DeleteChoiceOptions,
): Promise<DeleteOutcome> {
  const choice = await deleteChoice(opts)
  if (!choice) return null
  await softDelete()                      // existing endpoint → moves to Trash
  if (choice === 'purge') {
    try { await trashApi.purge(type, id) } // permanent: remove it from the Trash too
    catch { /* still in trash — recoverable, so non-fatal */ }
  }
  return choice
}

function Dialog({ opts, onResolve }: { opts: DeleteChoiceOptions; onResolve: (v: DeleteOutcome) => void }) {
  const allowPurge = opts.allowPurge !== false
  return (
    <div
      onClick={() => onResolve(null)}
      onKeyDown={(e) => { if (e.key === 'Escape') onResolve(null) }}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-2xl border-2 border-border bg-card shadow-2xl">
        <div className="px-5 py-4">
          <h2 className="text-sm font-bold text-foreground">Supprimer {opts.label} ?</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Choisissez de l’envoyer à la corbeille (récupérable) ou de le supprimer définitivement.
          </p>
          {opts.detail && (
            <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5 text-[11px] text-amber-700 dark:text-amber-300">
              {opts.detail}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2 border-t border-border bg-muted/20 px-5 py-3 sm:flex-row sm:justify-end">
          <button onClick={() => onResolve(null)}
            className="order-3 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-accent sm:order-1">
            Annuler
          </button>
          {allowPurge && (
            <button onClick={() => onResolve('purge')}
              className="order-2 rounded-lg border border-rose-500/40 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-500/10 dark:text-rose-400">
              Supprimer définitivement
            </button>
          )}
          <button autoFocus onClick={() => onResolve('trash')}
            className="order-1 rounded-lg bg-brand-500 px-4 py-1.5 text-xs font-bold text-white hover:bg-brand-600 sm:order-3">
            Mettre à la corbeille
          </button>
        </div>
      </div>
    </div>
  )
}
