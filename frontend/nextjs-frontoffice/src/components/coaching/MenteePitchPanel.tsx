'use client'
/**
 * The mentee startup's pitch & training submissions, shown to the MENTOR inside
 * the coaching workspace (read-only). Each row links to the full analysis view.
 * Renders nothing for anyone who isn't the participation's mentor (the list 403s).
 */
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Presentation, Trophy, Dumbbell, ArrowRight, Gauge } from 'lucide-react'
import { pitchApi, type PitchSubmission } from '@/lib/api'
import { useUser } from '@/store/auth.store'

const KIND: Record<string, { label: string; Icon: typeof Trophy; cls: string }> = {
  FINAL:    { label: 'Pitch final', Icon: Trophy,   cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  TRAINING: { label: 'Entraînement', Icon: Dumbbell, cls: 'bg-brand-500/15 text-brand-700 dark:text-brand-300' },
}

export function MenteePitchPanel({ participantId, mentorUserId }: { participantId: number; mentorUserId?: number | null }) {
  const user = useUser()
  const [subs, setSubs] = useState<PitchSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [hidden, setHidden] = useState(false)

  const isMentor = !!user && user.id === mentorUserId

  const load = useCallback(() => {
    if (!isMentor) { setHidden(true); setLoading(false); return }
    setLoading(true)
    pitchApi.mentee(participantId)
      .then((r) => setSubs(r.data ?? []))
      .catch(() => setHidden(true))
      .finally(() => setLoading(false))
  }, [participantId, isMentor])
  useEffect(() => { load() }, [load])

  if (hidden || loading || !isMentor) return null

  return (
    <div className="mt-3 rounded-xl border border-border bg-background/50 p-3">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground">
        <Presentation className="h-4 w-4 text-brand-500" />Pitchs de la startup
        {subs.length > 0 && <span className="text-xs font-normal text-muted-foreground">{subs.length}</span>}
      </h3>
      {subs.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">Aucune présentation déposée pour le moment.</p>
      ) : (
        <ul className="space-y-1.5">
          {subs.map((s) => {
            const k = KIND[(s as any).kind ?? 'FINAL'] ?? KIND.FINAL
            const score = (s as any).aiScore
            return (
              <li key={s.id}>
                <Link href={`/presentations/${s.id}`} className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 transition-colors hover:border-brand-300">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${k.cls}`}><k.Icon className="h-3 w-3" />{k.label}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{(s as any).title || (s as any).projectName || (s as any).companyName || 'Présentation'}</span>
                  {score != null && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 dark:text-brand-400"><Gauge className="h-3 w-3" />{score}/10</span>}
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
