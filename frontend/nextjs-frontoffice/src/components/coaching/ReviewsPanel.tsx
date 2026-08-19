'use client'
/**
 * Reviews / feedback on one participation. The mentor, the porteur, a team
 * member or an admin can leave a rating + comment, targeting the startup, the
 * mentor (accompaniment) or the programme. Renders nothing if the viewer isn't
 * allowed to see the participation (the list call 403s).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Star, MessageSquareQuote, Plus, X, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { reviewsApi } from '@/lib/api'
import { formatDate } from '@/lib/utils'

type Review = {
  id: number; authorUserId?: number; authorName?: string; authorRole?: string
  targetType?: string; rating?: number; comment?: string; createdAt?: string
}

const ROLE: Record<string, { label: string; cls: string }> = {
  MENTOR:  { label: 'Mentor',  cls: 'bg-purple-500/15 text-purple-700 dark:text-purple-300' },
  PORTEUR: { label: 'Porteur', cls: 'bg-brand-500/15 text-brand-700 dark:text-brand-300' },
  MEMBER:  { label: 'Membre',  cls: 'bg-sky-500/15 text-sky-700 dark:text-sky-300' },
  ADMIN:   { label: 'Admin',   cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
}
const TARGETS: { value: string; label: string }[] = [
  { value: 'STARTUP',   label: 'La startup' },
  { value: 'MENTOR',    label: 'L’accompagnement (mentor)' },
  { value: 'PROGRAMME', label: 'Le programme' },
]
const TARGET_LABEL: Record<string, string> = Object.fromEntries(TARGETS.map((t) => [t.value, t.label]))

function Stars({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value
        const star = <Star className={`h-4 w-4 ${filled ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40'}`} />
        return onChange ? (
          <button key={n} type="button" onClick={() => onChange(n)} className="transition-transform hover:scale-110" title={`${n}/5`}>{star}</button>
        ) : <span key={n}>{star}</span>
      })}
    </div>
  )
}

export function ReviewsPanel({ participantId }: { participantId: number }) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [hidden, setHidden] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [f, setF] = useState({ targetType: 'STARTUP', rating: 0, comment: '' })

  const load = useCallback(() => {
    setLoading(true)
    reviewsApi.list(participantId)
      .then((r) => setReviews(r.data ?? []))
      .catch(() => setHidden(true))
      .finally(() => setLoading(false))
  }, [participantId])
  useEffect(() => { load() }, [load])

  const avg = useMemo(() => {
    const rated = reviews.filter((r) => r.rating)
    return rated.length ? rated.reduce((s, r) => s + (r.rating ?? 0), 0) / rated.length : 0
  }, [reviews])

  const submit = async () => {
    if (!f.rating && !f.comment.trim()) { toast.error('Ajoutez une note ou un commentaire.'); return }
    setSaving(true)
    try {
      const r = await reviewsApi.add(participantId, { targetType: f.targetType, rating: f.rating || undefined, comment: f.comment.trim() || undefined })
      setReviews((arr) => [r.data, ...arr])
      setF({ targetType: 'STARTUP', rating: 0, comment: '' })
      setShowForm(false)
      toast.success('Avis publié')
    } catch (e: any) { toast.error(e.response?.data?.message ?? 'Échec') }
    finally { setSaving(false) }
  }

  if (hidden || loading) return null
  const input = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand-500'

  return (
    <div className="mt-3 rounded-xl border border-border bg-background/50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
          <MessageSquareQuote className="h-4 w-4 text-brand-500" />Avis &amp; retours
          {reviews.length > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
              {avg > 0 && <><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{avg.toFixed(1)}</>}
              <span>· {reviews.length}</span>
            </span>
          )}
        </h3>
        <button onClick={() => setShowForm((v) => !v)} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-accent">
          {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}{showForm ? 'Annuler' : 'Laisser un avis'}
        </button>
      </div>

      {showForm && (
        <div className="mb-3 space-y-2 rounded-lg border border-border bg-card p-3">
          <div className="flex flex-wrap items-center gap-3">
            <select value={f.targetType} onChange={(e) => setF({ ...f, targetType: e.target.value })} className={input + ' sm:max-w-[240px]'}>
              {TARGETS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Note</span>
              <Stars value={f.rating} onChange={(v) => setF({ ...f, rating: v })} />
            </div>
          </div>
          <textarea value={f.comment} onChange={(e) => setF({ ...f, comment: e.target.value })} rows={3} placeholder="Votre retour (points forts, axes de progrès…)" className={input + ' resize-y'} />
          <div className="flex justify-end">
            <button onClick={submit} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Publier l’avis
            </button>
          </div>
        </div>
      )}

      {reviews.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">Aucun avis pour le moment.</p>
      ) : (
        <ul className="space-y-1.5">
          {reviews.map((r) => {
            const role = ROLE[r.authorRole ?? ''] ?? { label: r.authorRole ?? '—', cls: 'bg-muted text-muted-foreground' }
            return (
              <li key={r.id} className="rounded-lg border border-border bg-card px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{r.authorName || 'Anonyme'}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${role.cls}`}>{role.label}</span>
                  {r.rating ? <Stars value={r.rating} /> : null}
                  <span className="ml-auto text-[10px] text-muted-foreground">{r.createdAt ? formatDate(r.createdAt) : ''}</span>
                </div>
                <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground/80">{TARGET_LABEL[r.targetType ?? 'STARTUP'] ?? r.targetType}</p>
                {r.comment && <p className="mt-1 whitespace-pre-wrap text-[13px] text-foreground/90">{r.comment}</p>}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
