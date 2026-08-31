'use client'
/**
 * Coaching workspace overview — the at-a-glance dashboard for one participation.
 * Aggregates the programme-service data the viewer (mentor or porteur) reliably
 * owns: coaching plan progress + notes, upcoming meeting, pitch scores (mentor),
 * reviews. Gives the mentor context and next actions without scrolling every panel.
 */
import { useEffect, useMemo, useState } from 'react'
import {
  Target, CalendarClock, StickyNote, Presentation, Star, ArrowRight, UserRound, Mail,
  FolderKanban, ListChecks, Loader2,
} from 'lucide-react'
import { coachingApi, meetingsApi, reviewsApi, pitchApi } from '@/lib/api'
import { formatDate } from '@/lib/utils'

type Part = {
  id: number; programmeId?: number; programmeName?: string
  organizationName?: string; porteurName?: string; porteurEmail?: string
  mentorUserId?: number; porteurUserId?: number
}
type Tab = 'plan' | 'meetings' | 'pitchs' | 'reviews'

const todayISO = () => new Date().toISOString().slice(0, 10)

export function CoachingOverview({ p, isMentor, onGoTab }: {
  p: Part; isMentor: boolean; onGoTab: (t: Tab) => void
}) {
  const [loading, setLoading] = useState(true)
  const [milestones, setMilestones] = useState<{ label: string; done: boolean }[]>([])
  const [notes, setNotes] = useState<any[]>([])
  const [meetings, setMeetings] = useState<any[]>([])
  const [pitches, setPitches] = useState<any[]>([])
  const [reviews, setReviews] = useState<any[]>([])

  useEffect(() => {
    let alive = true
    setLoading(true)
    const jobs: Promise<any>[] = [
      coachingApi.get(p.id).then((r) => r.data).catch(() => null),
      meetingsApi.list(p.id).then((r) => r.data ?? []).catch(() => []),
      reviewsApi.list(p.id).then((r) => r.data ?? []).catch(() => []),
      isMentor ? pitchApi.mentee(p.id).then((r) => r.data ?? []).catch(() => []) : Promise.resolve([]),
    ]
    Promise.all(jobs).then(([coaching, meets, revs, pitch]) => {
      if (!alive) return
      let ms: any[] = []
      try { ms = coaching?.plan?.milestonesJson ? JSON.parse(coaching.plan.milestonesJson) : [] } catch { ms = [] }
      setMilestones(Array.isArray(ms) ? ms : [])
      setNotes(coaching?.notes ?? [])
      setMeetings(meets)
      setReviews(revs)
      setPitches(pitch)
    }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [p.id, isMentor])

  const pct = milestones.length ? Math.round((milestones.filter((m) => m.done).length / milestones.length) * 100) : 0
  const openMs = milestones.filter((m) => !m.done)
  const nextMeeting = useMemo(() => {
    const t = todayISO()
    return [...meetings]
      .filter((m) => (m.status === 'ACCEPTED' || m.status === 'PENDING') && (m.proposedDate ?? '') >= t)
      .sort((a, b) => (a.proposedDate ?? '').localeCompare(b.proposedDate ?? ''))[0]
  }, [meetings])
  const bestPitch = useMemo(() => pitches.reduce((mx, s) => Math.max(mx, s.aiScore ?? 0), 0), [pitches])
  const avgReview = useMemo(() => {
    const rated = reviews.filter((r) => r.rating)
    return rated.length ? (rated.reduce((s, r) => s + (r.rating ?? 0), 0) / rated.length) : 0
  }, [reviews])

  if (loading) return <div className="flex h-40 items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>

  const stat = 'rounded-2xl border border-border bg-card p-4'
  return (
    <div className="space-y-4">
      {/* Stat strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <button onClick={() => onGoTab('plan')} className={`${stat} text-left transition-colors hover:border-brand-300`}>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground"><Target className="h-3.5 w-3.5" />Plan</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{pct}<span className="text-sm text-muted-foreground">%</span></p>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-purple-500" style={{ width: `${Math.max(3, pct)}%` }} />
          </div>
        </button>
        <button onClick={() => onGoTab('meetings')} className={`${stat} text-left transition-colors hover:border-brand-300`}>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground"><CalendarClock className="h-3.5 w-3.5" />Prochain RDV</p>
          <p className="mt-1 truncate text-sm font-bold text-foreground">{nextMeeting ? formatDate(nextMeeting.proposedDate) : '—'}</p>
          <p className="text-[11px] text-muted-foreground">{nextMeeting ? (nextMeeting.proposedTime || nextMeeting.status) : 'Aucun planifié'}</p>
        </button>
        <button onClick={() => onGoTab('plan')} className={`${stat} text-left transition-colors hover:border-brand-300`}>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground"><StickyNote className="h-3.5 w-3.5" />Séances</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{notes.length}</p>
          <p className="text-[11px] text-muted-foreground">note{notes.length > 1 ? 's' : ''} de séance</p>
        </button>
        {isMentor ? (
          <button onClick={() => onGoTab('pitchs')} className={`${stat} text-left transition-colors hover:border-brand-300`}>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground"><Presentation className="h-3.5 w-3.5" />Pitchs</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{pitches.length}</p>
            <p className="text-[11px] text-muted-foreground">{bestPitch > 0 ? `meilleur ${bestPitch}/10` : 'aucune analyse'}</p>
          </button>
        ) : (
          <button onClick={() => onGoTab('reviews')} className={`${stat} text-left transition-colors hover:border-brand-300`}>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground"><Star className="h-3.5 w-3.5" />Avis</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{avgReview > 0 ? avgReview.toFixed(1) : '—'}</p>
            <p className="text-[11px] text-muted-foreground">{reviews.length} avis</p>
          </button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Prochaines actions (open milestones) */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold text-foreground"><ListChecks className="h-4 w-4 text-brand-500" />Prochaines actions</h3>
            <button onClick={() => onGoTab('plan')} className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:underline dark:text-brand-400">Plan<ArrowRight className="h-3 w-3" /></button>
          </div>
          {milestones.length === 0 ? (
            <p className="text-xs italic text-muted-foreground">{isMentor ? 'Définissez des jalons dans le plan de coaching.' : 'Aucun jalon défini par votre mentor.'}</p>
          ) : openMs.length === 0 ? (
            <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Tous les jalons sont atteints</p>
          ) : (
            <ul className="space-y-1.5">
              {openMs.slice(0, 5).map((m, i) => (
                <li key={i} className="flex items-center gap-2 rounded-lg border border-border bg-background/50 px-3 py-2 text-sm text-foreground">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />{m.label}
                </li>
              ))}
              {openMs.length > 5 && <p className="text-[11px] text-muted-foreground">+{openMs.length - 5} autre(s)</p>}
            </ul>
          )}
        </div>

        {/* Contact + recent sessions */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground"><UserRound className="h-4 w-4 text-brand-500" />Contact</h3>
            <p className="text-sm font-semibold text-foreground">{p.porteurName || 'Porteur'}</p>
            {p.porteurEmail && (
              <a href={`mailto:${p.porteurEmail}`} className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-brand-600 hover:underline dark:text-brand-400">
                <Mail className="h-3.5 w-3.5" />{p.porteurEmail}
              </a>
            )}
            {p.programmeName && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"><FolderKanban className="h-3.5 w-3.5" />{p.programmeName}</p>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-bold text-foreground"><StickyNote className="h-4 w-4 text-brand-500" />Dernières séances</h3>
              <button onClick={() => onGoTab('plan')} className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:underline dark:text-brand-400">Journal<ArrowRight className="h-3 w-3" /></button>
            </div>
            {notes.length === 0 ? (
              <p className="text-xs italic text-muted-foreground">Aucune séance enregistrée.</p>
            ) : (
              <ul className="space-y-1.5">
                {notes.slice(0, 2).map((n) => (
                  <li key={n.id} className="rounded-lg border border-border bg-background/50 px-3 py-2">
                    <p className="text-xs font-semibold text-foreground">{n.title || 'Séance'}{n.sessionDate ? ` · ${formatDate(n.sessionDate)}` : ''}</p>
                    {n.content && <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{n.content}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
