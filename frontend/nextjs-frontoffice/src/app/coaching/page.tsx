'use client'
/**
 * Coaching module (list). Its own dedicated space, separate from the org page.
 * Shows every coaching engagement of the signed-in user — as MENTOR (the
 * startups they accompany) and as PORTEUR (their own accompaniment) — each
 * opening a detailed workspace at /coaching/{participantId}.
 */
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Handshake, Building2, FolderKanban, ArrowRight, UserRound } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { MagicCard } from '@/components/magicui/magic-card'
import { Skeleton } from '@/components/ui/skeleton'
import { participantsApi } from '@/lib/api'
import { useUser } from '@/store/auth.store'

type Eng = {
  id: number; programmeId: number; programmeName?: string
  organizationId: number; organizationName?: string
  mentorUserId?: number | null; mentorName?: string
  porteurUserId?: number | null; porteurName?: string; status?: string
}
const STATUS: Record<string, string> = { ACTIVE: 'Actif', ALUMNI: 'Alumni', WITHDRAWN: 'Retiré' }

export default function CoachingListPage() {
  const user = useUser()
  const [rows, setRows] = useState<Eng[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    participantsApi.engagements()
      .then((r) => setRows(r.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const { asMentor, asPorteur } = useMemo(() => {
    const asMentor: Eng[] = [], asPorteur: Eng[] = []
    for (const e of rows) (e.mentorUserId === user?.id ? asMentor : asPorteur).push(e)
    return { asMentor, asPorteur }
  }, [rows, user?.id])

  const Card = ({ e, role }: { e: Eng; role: 'mentor' | 'porteur' }) => (
    <Link href={`/coaching/${e.id}`}>
      <MagicCard className="flex h-full items-start gap-3 p-4 transition-transform hover:scale-[1.02]">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/20 to-brand-500/20">
          <Building2 className="h-5 w-5 text-purple-500" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-sm font-semibold text-foreground">{e.organizationName || `Organisation #${e.organizationId}`}</p>
          {e.programmeName && <p className="line-clamp-1 flex items-center gap-1 text-xs text-muted-foreground"><FolderKanban className="h-3 w-3" />{e.programmeName}</p>}
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            {role === 'mentor'
              ? <><UserRound className="h-3 w-3" />{e.porteurName || 'Porteur'}</>
              : <><Handshake className="h-3 w-3" />{e.mentorName || 'Aucun référent'}</>}
            {e.status && <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold">{STATUS[e.status] ?? e.status}</span>}
          </p>
          <div className="mt-2 flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-purple-400">Ouvrir le suivi<ArrowRight className="h-3 w-3" /></div>
        </div>
      </MagicCard>
    </Link>
  )

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground"><Handshake className="h-6 w-6 text-purple-500" />Accompagnement</h1>
          <p className="text-sm text-muted-foreground">Vos suivis de coaching — plans, rendez-vous et comptes-rendus.</p>
        </motion.div>

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
        ) : rows.length === 0 ? (
          <MagicCard className="p-10 text-center">
            <Handshake className="mx-auto h-10 w-10 text-muted-foreground opacity-30" />
            <p className="mt-3 text-sm font-semibold text-foreground">Aucun accompagnement pour le moment</p>
            <p className="text-xs text-muted-foreground">Vos suivis de coaching apparaîtront ici dès qu’un référent est assigné.</p>
          </MagicCard>
        ) : (
          <div className="space-y-6">
            {asMentor.length > 0 && (
              <section>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground"><Handshake className="h-4 w-4 text-emerald-500" />Startups que j’accompagne<span className="text-xs font-normal text-muted-foreground">{asMentor.length}</span></h2>
                <div className="grid gap-3 sm:grid-cols-2">{asMentor.map((e) => <Card key={e.id} e={e} role="mentor" />)}</div>
              </section>
            )}
            {asPorteur.length > 0 && (
              <section>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground"><UserRound className="h-4 w-4 text-brand-500" />Mon accompagnement<span className="text-xs font-normal text-muted-foreground">{asPorteur.length}</span></h2>
                <div className="grid gap-3 sm:grid-cols-2">{asPorteur.map((e) => <Card key={e.id} e={e} role="porteur" />)}</div>
              </section>
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}
