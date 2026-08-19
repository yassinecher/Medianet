'use client'
/**
 * Meeting requests for one participation. The mentor OR the porteur can propose a
 * rendez-vous (date, time, place, note); the other side accepts or declines.
 * Accepted meetings show on both people's shared calendars. Renders nothing if
 * the viewer isn't a participant (the list call 403s).
 */
import { useCallback, useEffect, useState } from 'react'
import { CalendarClock, Plus, X, Loader2, MapPin, Check, Ban } from 'lucide-react'
import toast from 'react-hot-toast'
import { meetingsApi } from '@/lib/api'
import { useUser } from '@/store/auth.store'
import { formatDate } from '@/lib/utils'

type Meeting = {
  id: number; proposedDate?: string; proposedTime?: string; location?: string; note?: string
  requestedByUserId?: number; requestedByName?: string; status?: string
}
const todayISO = () => new Date().toISOString().slice(0, 10)
const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING:   { label: 'En attente', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  ACCEPTED:  { label: 'Confirmé',   cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  DECLINED:  { label: 'Refusé',     cls: 'bg-rose-500/15 text-rose-700 dark:text-rose-300' },
  CANCELLED: { label: 'Annulé',     cls: 'bg-muted text-muted-foreground' },
}

export function MeetingsPanel({ participantId }: { participantId: number }) {
  const user = useUser()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [hidden, setHidden] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [f, setF] = useState({ proposedDate: todayISO(), proposedTime: '', location: '', note: '' })

  const load = useCallback(() => {
    setLoading(true)
    meetingsApi.list(participantId)
      .then((r) => setMeetings(r.data ?? []))
      .catch(() => setHidden(true))
      .finally(() => setLoading(false))
  }, [participantId])
  useEffect(() => { load() }, [load])

  const request = async () => {
    if (!f.proposedDate) { toast.error('Choisissez une date.'); return }
    setSaving(true)
    try {
      const r = await meetingsApi.request(participantId, f)
      setMeetings((arr) => [r.data, ...arr])
      setF({ proposedDate: todayISO(), proposedTime: '', location: '', note: '' })
      setShowForm(false)
      toast.success('Demande de rendez-vous envoyée')
    } catch (e: any) { toast.error(e.response?.data?.message ?? 'Échec') }
    finally { setSaving(false) }
  }
  const respond = async (id: number, status: string) => {
    try {
      const r = await meetingsApi.respond(id, status)
      setMeetings((arr) => arr.map((m) => (m.id === id ? r.data : m)))
    } catch (e: any) { toast.error(e.response?.data?.message ?? 'Échec') }
  }

  if (hidden || loading) return null
  const input = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand-500'

  return (
    <div className="mt-3 rounded-xl border border-border bg-background/50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold text-foreground"><CalendarClock className="h-4 w-4 text-brand-500" />Rendez-vous
          {meetings.length > 0 && <span className="text-xs font-normal text-muted-foreground">{meetings.length}</span>}
        </h3>
        <button onClick={() => setShowForm((v) => !v)} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-accent">
          {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}{showForm ? 'Annuler' : 'Demander un rendez-vous'}
        </button>
      </div>

      {showForm && (
        <div className="mb-3 space-y-2 rounded-lg border border-border bg-card p-3">
          <div className="flex flex-wrap gap-2">
            <input type="date" value={f.proposedDate} onChange={(e) => setF({ ...f, proposedDate: e.target.value })} className={input + ' sm:max-w-[170px]'} />
            <input type="time" value={f.proposedTime} onChange={(e) => setF({ ...f, proposedTime: e.target.value })} className={input + ' sm:max-w-[130px]'} />
            <input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="Lieu (Visio, bureau…)" className={input + ' flex-1'} />
          </div>
          <textarea value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} rows={2} placeholder="Objet du rendez-vous (optionnel)…" className={input + ' resize-y'} />
          <div className="flex justify-end">
            <button onClick={request} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Envoyer la demande
            </button>
          </div>
        </div>
      )}

      {meetings.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">Aucun rendez-vous pour le moment.</p>
      ) : (
        <ol className="space-y-1.5">
          {meetings.map((m) => {
            const st = STATUS[m.status ?? 'PENDING'] ?? STATUS.PENDING
            const mine = m.requestedByUserId === user?.id
            const canAct = m.status === 'PENDING'
            return (
              <li key={m.id} className="rounded-lg border border-border bg-card px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{m.proposedDate ? formatDate(m.proposedDate) : 'Date à définir'}{m.proposedTime ? ` · ${m.proposedTime}` : ''}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${st.cls}`}>{st.label}</span>
                  {m.location && <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><MapPin className="h-3 w-3" />{m.location}</span>}
                  <span className="ml-auto text-[10px] text-muted-foreground">{mine ? 'Vous' : m.requestedByName || '—'}</span>
                </div>
                {m.note && <p className="mt-0.5 text-[11px] text-muted-foreground">{m.note}</p>}
                {canAct && (
                  <div className="mt-1.5 flex gap-1.5">
                    {mine ? (
                      <button onClick={() => respond(m.id, 'CANCELLED')} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-rose-600"><Ban className="h-3 w-3" />Annuler</button>
                    ) : (
                      <>
                        <button onClick={() => respond(m.id, 'ACCEPTED')} className="inline-flex items-center gap-1 rounded-md bg-emerald-500 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-600"><Check className="h-3 w-3" />Accepter</button>
                        <button onClick={() => respond(m.id, 'DECLINED')} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-rose-600"><X className="h-3 w-3" />Refuser</button>
                      </>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
