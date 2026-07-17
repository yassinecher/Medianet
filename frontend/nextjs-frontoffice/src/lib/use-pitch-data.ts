'use client'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { candidaturesApi, pitchApi, type PitchSubmission } from '@/lib/api'

export interface PitchProgramme {
  programmeId: number
  programmeName: string
  companyName?: string
  projectName?: string
  organizationId?: number
}

/** A presentation session — a "phase" in the UI. */
export interface PitchSession {
  sessionId: number
  title: string
  startDate?: string
  pitchDeadline?: string
  open?: boolean
  submissions?: PitchSubmission[]
}

/**
 * Loads the porteur's programmes and their presentation sessions.
 *
 * Every level of /presentations reads through this, so the global page and a
 * single phase can never disagree about what was submitted. Pass a programmeId
 * to fetch only that programme's sessions.
 */
export function usePitchData(programmeId?: number) {
  const [programmes, setProgrammes] = useState<PitchProgramme[]>([])
  const [sessionsByProg, setSessionsByProg] = useState<Record<number, PitchSession[]>>({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await candidaturesApi.myList()
      const list: any[] = data?.content ?? data ?? []
      const uniq = new Map<number, PitchProgramme>()
      for (const c of list) {
        if (c.programmeId == null || uniq.has(c.programmeId)) continue
        uniq.set(c.programmeId, {
          programmeId: c.programmeId,
          programmeName: c.programmeName ?? `Programme #${c.programmeId}`,
          companyName: c.companyName,
          projectName: c.projectName,
          organizationId: c.organizationId,
        })
      }
      const all = Array.from(uniq.values())
      setProgrammes(all)

      const wanted = programmeId != null ? all.filter((p) => p.programmeId === programmeId) : all
      const entries = await Promise.all(wanted.map(async (p) => {
        try {
          const r = await pitchApi.presentations(p.programmeId)
          // Keep closed sessions that already hold work — hiding them would make
          // past videos vanish from the history and break the progress trend.
          const sessions: PitchSession[] = (r.data ?? []).filter(
            (s: PitchSession) => s.open || (s.submissions?.length ?? 0) > 0,
          )
          return [p.programmeId, sessions] as const
        } catch { return [p.programmeId, [] as PitchSession[]] as const }
      }))
      setSessionsByProg(Object.fromEntries(entries))
    } catch {
      toast.error('Impossible de charger vos présentations')
    } finally {
      setLoading(false)
    }
  }, [programmeId])

  useEffect(() => { load() }, [load])

  return { programmes, sessionsByProg, loading, reload: load }
}
