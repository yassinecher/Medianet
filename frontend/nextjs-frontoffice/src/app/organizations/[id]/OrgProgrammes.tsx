'use client'
/**
 * « Programmes rejoints » on an organisation profile. Lists the programmes this
 * organisation participates in, with its mentor per programme and a link to the
 * dedicated Coaching module. Coaching itself lives in its own module (/coaching)
 * — the org page stays focused on identity + history + programmes joined.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FolderKanban, Handshake, ArrowRight } from 'lucide-react'
import { participantsApi } from '@/lib/api'

type Part = {
  id: number; programmeId: number; programmeName?: string
  mentorName?: string; status?: string
}
const STATUS: Record<string, string> = { ACTIVE: 'Actif', ALUMNI: 'Alumni', WITHDRAWN: 'Retiré' }

export function OrgProgrammes({ orgId }: { orgId: number }) {
  const [parts, setParts] = useState<Part[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    participantsApi.byOrg(orgId)
      .then((r) => setParts(r.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [orgId])

  if (loading || parts.length === 0) return null

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
        <FolderKanban className="h-4 w-4 text-brand-500" />Programmes rejoints
        <span className="text-xs font-normal text-muted-foreground">{parts.length}</span>
      </h2>
      <div className="space-y-2">
        {parts.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background/50 px-3 py-2.5">
            <Link href={`/programmes/${p.programmeId}`} className="truncate text-sm font-semibold text-foreground hover:text-brand-600 dark:hover:text-brand-400">
              {p.programmeName || `Programme #${p.programmeId}`}
            </Link>
            {p.status && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{STATUS[p.status] ?? p.status}</span>}
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-0.5 text-[11px] font-medium text-purple-700 dark:text-purple-300">
              <Handshake className="h-3 w-3" />{p.mentorName || 'Aucun référent'}
            </span>
            <Link href={`/coaching/${p.id}`}
              className="ml-auto inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-accent">
              Suivi de coaching<ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}
