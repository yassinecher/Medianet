'use client'
/**
 * /programmes/[id]/timeline — the full Parcours page.
 *
 * Single home of the Parcours (planning) experience, deliberately SEPARATE from
 * the visual canvas (/programmes/[id]/builder). It mounts <TimelineTab> as a
 * full-page surface: the swimlane editor (right-side panel) + the read-only
 * Aperçu (snake roadmap) live here, and nowhere else.
 */
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { programmesApi } from '@/lib/api'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { TimelineTab } from '../../builder/TimelineTab'

export default function ParcoursPage() {
  const params = useParams<{ id: string }>()
  const pid = Number(params?.id)
  const [loading, setLoading] = useState(true)
  const [programme, setProgramme] = useState<
    { title?: string; startDate?: string | null; endDate?: string | null } | null
  >(null)

  useEffect(() => {
    if (!pid || isNaN(pid)) { setLoading(false); return }
    let cancelled = false
    ;(async () => {
      try {
        const r = await programmesApi.get(pid)
        if (!cancelled) setProgramme(r.data ?? null)
      } catch {
        if (!cancelled) toast.error('Programme introuvable')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [pid])

  return (
    <AdminLayout>
      <div className="h-[calc(100vh-7rem)] rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />Chargement du parcours…
          </div>
        ) : (
          <TimelineTab programmeId={pid} programme={programme} />
        )}
      </div>
    </AdminLayout>
  )
}
