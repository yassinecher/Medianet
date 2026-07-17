'use client'
/**
 * Visual editor for an existing programme.
 *
 * Loads the programme + criteria + phases, converts them into builder nodes,
 * and mounts the same BuilderInnerExported component used by /programmes/builder.
 * Save uses PUT instead of POST (handled inside the builder via existingProgrammeId).
 */
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { type Edge } from '@xyflow/react'
import toast from 'react-hot-toast'
import { programmesApi } from '@/lib/api'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { BuilderInnerExported } from '../../builder/Builder'

export default function EditProgrammeBuilderPage() {
  const params = useParams<{ id: string }>()
  const id = Number(params?.id)
  const [loading, setLoading] = useState(true)
  const [initial, setInitial] = useState<{ nodes: any[]; edges: Edge[] } | null>(null)

  useEffect(() => {
    if (!id || isNaN(id)) { setLoading(false); return }
    ;(async () => {
      try {
        const [pr, ph, cr] = await Promise.all([
          programmesApi.get(id),
          programmesApi.phases(id),
          programmesApi.criteria(id),
        ])
        const prog = pr.data ?? {}
        const phases = ph.data ?? []
        const crits  = cr.data ?? []

        // Build nodes: programme + timeline + metadata + each criterion + each session
        const nodes: any[] = []
        const edges: Edge[] = []

        nodes.push({
          id: 'programme', type: 'programme', position: { x: 100, y: 260 },
          data: {
            kind: 'programme',
            title: prog.title ?? 'Programme',
            status: prog.status ?? 'DRAFT',
            type: prog.type ?? 'PUBLIC',
            sectors: prog.sectors ?? [],
            startDate: prog.startDate, endDate: prog.endDate,
          },
        })
        // Timeline node removed — sessions live on the Parcours tab now.

        // Description (only if non-empty)
        if (prog.description) {
          nodes.push({ id: 'description', type: 'description', position: { x: 460, y: 60 },
            data: { kind: 'description', description: prog.description } })
          edges.push({ id: 'e-description-programme', source: 'description', target: 'programme', animated: false, style: { strokeWidth: 1.5, strokeDasharray: '4 4', opacity: 0.5 } })
        }
        // Visual
        if (prog.tagline || prog.logoUrl || prog.bannerImageUrl || prog.location || prog.applicationUrl) {
          nodes.push({ id: 'visual', type: 'visual', position: { x: 460, y: 150 },
            data: { kind: 'visual', tagline: prog.tagline ?? '', logoUrl: prog.logoUrl ?? '',
              bannerImageUrl: prog.bannerImageUrl ?? '', location: prog.location ?? '',
              applicationUrl: prog.applicationUrl ?? '' } })
          edges.push({ id: 'e-visual-programme', source: 'visual', target: 'programme', animated: false, style: { strokeWidth: 1.5, strokeDasharray: '4 4', opacity: 0.5 } })
        }
        // Form template (always include — has a meaningful default)
        nodes.push({ id: 'formTemplate', type: 'formTemplate', position: { x: 460, y: 240 },
          data: { kind: 'formTemplate', formTemplate: prog.formTemplate ?? 'STANDARD',
            customFormSchema: prog.customFormSchema ?? '' } })
        edges.push({ id: 'e-formTemplate-programme', source: 'formTemplate', target: 'programme', animated: false, style: { strokeWidth: 1.5, strokeDasharray: '4 4', opacity: 0.5 } })
        // Stats
        if (prog.maxStartups || prog.expertCount || prog.trainingSessionsCount || prog.mentoringHoursPerMonth) {
          nodes.push({ id: 'stats', type: 'stats', position: { x: 460, y: 330 },
            data: { kind: 'stats', maxStartups: prog.maxStartups, expertCount: prog.expertCount,
              trainingSessionsCount: prog.trainingSessionsCount, mentoringHoursPerMonth: prog.mentoringHoursPerMonth } })
          edges.push({ id: 'e-stats-programme', source: 'stats', target: 'programme', animated: false, style: { strokeWidth: 1.5, strokeDasharray: '4 4', opacity: 0.5 } })
        }
        // Objectives + Benefits
        if (prog.objectives?.length) {
          nodes.push({ id: 'objectives', type: 'objectives', position: { x: 460, y: 420 },
            data: { kind: 'objectives', objectives: prog.objectives } })
          edges.push({ id: 'e-objectives-programme', source: 'objectives', target: 'programme', animated: false, style: { strokeWidth: 1.5, strokeDasharray: '4 4', opacity: 0.5 } })
        }
        if (prog.benefits?.length) {
          nodes.push({ id: 'benefits', type: 'benefits', position: { x: 460, y: 510 },
            data: { kind: 'benefits', benefits: prog.benefits } })
          edges.push({ id: 'e-benefits-programme', source: 'benefits', target: 'programme', animated: false, style: { strokeWidth: 1.5, strokeDasharray: '4 4', opacity: 0.5 } })
        }

        // Criteria — preserve DB id in the node id so save loop can re-use it
        crits.forEach((c: any, i: number) => {
          const nid = `crit-real-${c.id}`
          nodes.push({ id: nid, type: 'criterion', position: { x: -160, y: 100 + i * 100 },
            data: { kind: 'criterion', name: c.name ?? '', description: c.description ?? '', weight: c.weight ?? 0 } })
          edges.push({ id: `e-${nid}-programme`, source: nid, target: 'programme', animated: true, style: { strokeWidth: 2 } })
        })

        // Sessions — load weights map
        // Sessions are no longer loaded as React Flow nodes — they live
        // on the Parcours tab and are fetched independently by TimelineTab.

        setInitial({ nodes, edges })
      } catch (e: any) {
        toast.error(e?.response?.data?.message ?? 'Programme introuvable')
      } finally { setLoading(false) }
    })()
  }, [id])

  if (loading) return (
    <AdminLayout>
      <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />Chargement du programme…
      </div>
    </AdminLayout>
  )
  if (!initial) return (
    <AdminLayout>
      <div className="flex h-[60vh] items-center justify-center text-destructive">
        Programme introuvable.
      </div>
    </AdminLayout>
  )

  return (
    <AdminLayout>
      <BuilderInnerExported
        existingProgrammeId={id}
        initialNodes={initial.nodes}
        initialEdges={initial.edges}
      />
    </AdminLayout>
  )
}
