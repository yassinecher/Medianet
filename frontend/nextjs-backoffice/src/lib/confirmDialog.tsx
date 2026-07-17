'use client'
/**
 * Imperative confirm / preview dialog — `await confirmDialog({...})` resolves
 * true/false. Mounts itself into document.body so it's callable from anywhere
 * (no provider / prop-drilling). Used for « confirmer avant d'ajouter » and
 * « aperçu avant de modifier » in the Parcours builder.
 */
import { createRoot } from 'react-dom/client'

export interface ConfirmLine {
  label: string
  /** Diff form: "from → to". */
  from?: string
  to?: string
  /** Single-value form. */
  value?: string
}
export interface ConfirmOptions {
  title: string
  message?: string
  lines?: ConfirmLine[]
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'brand' | 'danger'
}

export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  if (typeof document === 'undefined') return Promise.resolve(true)
  return new Promise((resolve) => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    const done = (v: boolean) => { root.unmount(); host.remove(); resolve(v) }
    root.render(<Dialog opts={opts} onResolve={done} />)
  })
}

function Dialog({ opts, onResolve }: { opts: ConfirmOptions; onResolve: (v: boolean) => void }) {
  const danger = opts.tone === 'danger'
  return (
    <div
      onClick={() => onResolve(false)}
      onKeyDown={(e) => { if (e.key === 'Escape') onResolve(false); if (e.key === 'Enter') onResolve(true) }}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-2xl border-2 border-border bg-card shadow-2xl">
        <div className="px-5 py-4">
          <h2 className="text-sm font-bold text-foreground">{opts.title}</h2>
          {opts.message && <p className="mt-1 text-xs text-muted-foreground">{opts.message}</p>}
          {opts.lines && opts.lines.length > 0 && (
            <div className="mt-3 space-y-1 rounded-xl border border-border bg-muted/20 p-3">
              {opts.lines.map((l, i) => (
                <div key={i} className="flex items-baseline gap-2 text-xs">
                  <span className="w-28 shrink-0 text-muted-foreground">{l.label}</span>
                  {l.from !== undefined || l.to !== undefined ? (
                    <span className="font-medium text-foreground">
                      <span className="text-muted-foreground line-through">{l.from || '—'}</span>
                      <span className="mx-1.5 text-brand-500">→</span>
                      <span>{l.to || '—'}</span>
                    </span>
                  ) : (
                    <span className="font-medium text-foreground">{l.value}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-border bg-muted/20 px-5 py-3">
          <button autoFocus onClick={() => onResolve(false)}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-accent">
            {opts.cancelLabel ?? 'Annuler'}
          </button>
          <button onClick={() => onResolve(true)}
            className={`rounded-lg px-4 py-1.5 text-xs font-bold text-white ${danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-brand-500 hover:bg-brand-600'}`}>
            {opts.confirmLabel ?? 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  )
}
