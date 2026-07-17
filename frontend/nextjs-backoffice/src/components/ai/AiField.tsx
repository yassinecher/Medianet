'use client'
import { useState } from 'react'
import { Sparkles, Wand2, Loader2, Undo2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { adminAiApi } from '@/lib/api'

/**
 * A text field (input or textarea) with two AI actions:
 *  • Générer  — writes the field from scratch, using `context` as the brief.
 *  • Améliorer — rewrites the current draft (only shown when there's text).
 * The previous value is stashed so a bad suggestion is one click from undo.
 */
export function AiField({
  field, label, value, onChange, context, placeholder, required,
  multiline, rows = 4, hint,
}: {
  field: string
  label: string
  value: string
  onChange: (v: string) => void
  /** Free-text brief the model uses to ground the suggestion (title, sectors…). */
  context?: string
  placeholder?: string
  required?: boolean
  multiline?: boolean
  rows?: number
  hint?: string
}) {
  const [busy, setBusy] = useState<null | 'generate' | 'enhance'>(null)
  const [prev, setPrev] = useState<string | null>(null)

  const run = async (mode: 'generate' | 'enhance') => {
    setBusy(mode)
    try {
      const { data } = await adminAiApi.fieldSuggest({ field, mode, current: value, context })
      if (data.error) { toast.error(data.error); return }
      const next = data.value ?? ''
      if (!next.trim()) { toast.error('Aucune suggestion — précisez le contexte, puis réessayez'); return }
      setPrev(value)
      onChange(next)
      toast.success(mode === 'generate' ? 'Généré par l’IA' : 'Amélioré par l’IA')
    } catch (e: any) {
      // A saturated provider used to hang forever; the 60s client timeout now
      // aborts and lands here with ECONNABORTED — tell the user plainly.
      const timedOut = e?.code === 'ECONNABORTED' || /timeout/i.test(e?.message ?? '')
      toast.error(timedOut
        ? 'Le modèle IA met trop de temps à répondre — réessayez dans un instant.'
        : (e?.response?.data?.error ?? 'IA indisponible — réessayez.'))
    } finally { setBusy(null) }
  }

  const undo = () => { if (prev != null) { onChange(prev); setPrev(null) } }
  const disabled = busy !== null

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-medium text-foreground">
          {label}{required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
        <div className="flex items-center gap-1">
          {prev != null && (
            <button type="button" onClick={undo} title="Annuler la suggestion"
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent">
              <Undo2 className="h-3 w-3" />Annuler
            </button>
          )}
          {value.trim().length > 2 && (
            <button type="button" onClick={() => run('enhance')} disabled={disabled}
              title="Améliorer le texte actuel avec l’IA"
              className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-1 text-[11px] font-medium text-brand-600 transition-colors hover:bg-brand-500/10 disabled:opacity-50 dark:text-brand-400">
              {busy === 'enhance' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}Améliorer
            </button>
          )}
          <button type="button" onClick={() => run('generate')} disabled={disabled}
            title="Générer ce champ avec l’IA"
            className="inline-flex items-center gap-1 rounded-md border border-brand-500/40 bg-brand-500/10 px-1.5 py-1 text-[11px] font-semibold text-brand-600 transition-colors hover:bg-brand-500/20 disabled:opacity-50 dark:text-brand-400">
            {busy === 'generate' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}Générer
          </button>
        </div>
      </div>

      {multiline ? (
        <textarea
          value={value} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder}
          className={cn('w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y',
            disabled && 'opacity-60')} />
      ) : (
        <input
          value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          className={cn('flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            disabled && 'opacity-60')} />
      )}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}
