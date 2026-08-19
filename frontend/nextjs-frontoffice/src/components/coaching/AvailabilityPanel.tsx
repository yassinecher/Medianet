'use client'
/**
 * Availability slots for one participation.
 *   • The mentor publishes/removes the windows when they are free (global to
 *     all their mentees, but managed from here).
 *   • The porteur sees the mentor's open future slots and books one — which
 *     creates a confirmed rendez-vous (visible in « Rendez-vous » / calendar).
 * Renders nothing for anyone who is neither the mentor nor the porteur.
 */
import { useCallback, useEffect, useState } from 'react'
import { CalendarClock, Plus, X, Loader2, Trash2, Check, CalendarCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { availabilityApi } from '@/lib/api'
import { useUser } from '@/store/auth.store'
import { formatDate } from '@/lib/utils'

type Slot = {
  id: number; slotDate?: string; startTime?: string; endTime?: string; note?: string
  booked?: boolean; bookedByParticipantId?: number
}
const todayISO = () => new Date().toISOString().slice(0, 10)
const timeRange = (s: Slot) => [s.startTime, s.endTime].filter(Boolean).join(' – ')

export function AvailabilityPanel({ participantId, mentorUserId, porteurUserId }: {
  participantId: number; mentorUserId?: number | null; porteurUserId?: number | null
}) {
  const user = useUser()
  const uid = user?.id
  if (uid && uid === mentorUserId) return <MentorSlots />
  if (uid && uid === porteurUserId) return <PorteurBooking participantId={participantId} hasMentor={!!mentorUserId} />
  return null
}

const input = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand-500'

/** Mentor view — publish + remove my own availability windows. */
function MentorSlots() {
  const [slots, setSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [f, setF] = useState({ slotDate: todayISO(), startTime: '', endTime: '', note: '' })

  const load = useCallback(() => {
    setLoading(true)
    availabilityApi.mine().then((r) => setSlots(r.data ?? [])).catch(() => setSlots([])).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const add = async () => {
    if (!f.slotDate) { toast.error('Choisissez une date.'); return }
    setSaving(true)
    try {
      const r = await availabilityApi.create(f)
      setSlots((a) => [...a, r.data].sort((x, y) => (x.slotDate ?? '').localeCompare(y.slotDate ?? '') || (x.startTime ?? '').localeCompare(y.startTime ?? '')))
      setF({ slotDate: todayISO(), startTime: '', endTime: '', note: '' })
      setShowForm(false)
      toast.success('Créneau publié')
    } catch (e: any) { toast.error(e.response?.data?.message ?? 'Échec') }
    finally { setSaving(false) }
  }
  const remove = async (id: number) => {
    try { await availabilityApi.delete(id); setSlots((a) => a.filter((s) => s.id !== id)); toast.success('Créneau retiré') }
    catch (e: any) { toast.error(e.response?.data?.message ?? 'Échec') }
  }

  if (loading) return null
  const upcoming = slots.filter((s) => (s.slotDate ?? '') >= todayISO())

  return (
    <div className="mt-3 rounded-xl border border-border bg-background/50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold text-foreground"><CalendarClock className="h-4 w-4 text-brand-500" />Mes disponibilités
          {upcoming.length > 0 && <span className="text-xs font-normal text-muted-foreground">{upcoming.length}</span>}
        </h3>
        <button onClick={() => setShowForm((v) => !v)} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-accent">
          {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}{showForm ? 'Annuler' : 'Ajouter un créneau'}
        </button>
      </div>
      <p className="mb-2 text-[11px] text-muted-foreground">Vos porteurs peuvent réserver ces créneaux — la réservation devient un rendez-vous confirmé.</p>

      {showForm && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
          <input type="date" value={f.slotDate} onChange={(e) => setF({ ...f, slotDate: e.target.value })} className={input + ' sm:max-w-[160px]'} />
          <input type="time" value={f.startTime} onChange={(e) => setF({ ...f, startTime: e.target.value })} className={input + ' sm:max-w-[120px]'} title="Début" />
          <input type="time" value={f.endTime} onChange={(e) => setF({ ...f, endTime: e.target.value })} className={input + ' sm:max-w-[120px]'} title="Fin" />
          <input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Lieu / note (optionnel)" className={input + ' flex-1'} />
          <button onClick={add} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Publier
          </button>
        </div>
      )}

      {upcoming.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">Aucune disponibilité publiée.</p>
      ) : (
        <ul className="space-y-1.5">
          {upcoming.map((s) => (
            <li key={s.id} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
              <span className="text-sm font-semibold text-foreground">{s.slotDate ? formatDate(s.slotDate) : ''}</span>
              {timeRange(s) && <span className="text-[11px] text-muted-foreground">{timeRange(s)}</span>}
              {s.note && <span className="text-[11px] text-muted-foreground">· {s.note}</span>}
              {s.booked
                ? <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300"><Check className="h-3 w-3" />Réservé</span>
                : <button onClick={() => remove(s.id)} className="ml-auto text-muted-foreground hover:text-rose-500" title="Retirer"><Trash2 className="h-3.5 w-3.5" /></button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Porteur view — browse + book the mentor's open slots. */
function PorteurBooking({ participantId, hasMentor }: { participantId: number; hasMentor: boolean }) {
  const [slots, setSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState(true)
  const [booking, setBooking] = useState<number | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    availabilityApi.forParticipant(participantId).then((r) => setSlots(r.data ?? [])).catch(() => setSlots([])).finally(() => setLoading(false))
  }, [participantId])
  useEffect(() => { load() }, [load])

  const book = async (id: number) => {
    setBooking(id)
    try {
      await availabilityApi.book(id, participantId)
      setSlots((a) => a.filter((s) => s.id !== id))
      toast.success('Rendez-vous confirmé — visible dans « Rendez-vous »')
    } catch (e: any) { toast.error(e.response?.data?.message ?? 'Échec') }
    finally { setBooking(null) }
  }

  if (loading || !hasMentor) return null

  return (
    <div className="mt-3 rounded-xl border border-border bg-background/50 p-3">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground"><CalendarCheck className="h-4 w-4 text-brand-500" />Disponibilités du mentor
        {slots.length > 0 && <span className="text-xs font-normal text-muted-foreground">{slots.length}</span>}
      </h3>
      {slots.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">Votre mentor n’a pas publié de créneau pour le moment.</p>
      ) : (
        <ul className="space-y-1.5">
          {slots.map((s) => (
            <li key={s.id} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
              <span className="text-sm font-semibold text-foreground">{s.slotDate ? formatDate(s.slotDate) : ''}</span>
              {timeRange(s) && <span className="text-[11px] text-muted-foreground">{timeRange(s)}</span>}
              {s.note && <span className="text-[11px] text-muted-foreground">· {s.note}</span>}
              <button onClick={() => book(s.id)} disabled={booking === s.id}
                className="ml-auto inline-flex items-center gap-1 rounded-md bg-brand-500 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-brand-600 disabled:opacity-60">
                {booking === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}Réserver
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
