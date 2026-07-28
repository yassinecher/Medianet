'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Search, Sparkles, Trophy, Lock, LayoutGrid, Compass } from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { AppShell } from '@/components/layout/AppShell'
import { ProgrammeCard } from '@/components/programmes/ProgrammeCard'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { NumberTicker } from '@/components/magicui/number-ticker'
import { programmesApi, candidaturesApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import type { Programme } from '@/types'
import { useUser, frontofficeRolesOf } from '@/store/auth.store'
import { SiteFooter } from '@/components/layout/SiteFooter'

const statusOpts = [
  { label: 'Tous', value: '' },
  { label: 'Ouverts', value: 'OPEN' },
  { label: 'Fermés', value: 'CLOSED' },
]

export default function ProgrammesPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => { setHydrated(true) }, [])
  const user = useUser()
  const [programmes, setProgrammes] = useState<Programme[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  /** programmeId → the porteur's candidature status on it. */
  const [appliedMap, setAppliedMap] = useState<Record<number, string>>({})
  /** Ids of PRIVATE programmes the user was invited to — highlighted + sorted first. */
  const [invitedIds, setInvitedIds] = useState<Set<number>>(new Set())
  const isPorteur = frontofficeRolesOf(user).includes('PORTEUR')
  useEffect(() => {
    // publicOnly hides DRAFT / ARCHIVED / CANCELLED (and PRIVATE) programmes from porteurs.
    const publicP = programmesApi.list({ publicOnly: true, ...(status ? { status } : {}) })
      .then((r) => (r.data?.content ?? r.data ?? []) as Programme[])
      .catch(() => [] as Programme[])
    // Invitation-only programmes the caller can reach (empty for anonymous). These
    // are the only way a porteur discovers a PRIVATE programme.
    const invitedP = isAuthenticated
      ? programmesApi.invited().then((r) => (r.data ?? []) as Programme[]).catch(() => [] as Programme[])
      : Promise.resolve([] as Programme[])

    Promise.all([publicP, invitedP]).then(([pub, inv]) => {
      const invSet = new Set(inv.map((p) => p.id!).filter((id) => id != null))
      setInvitedIds(invSet)
      // Merge, invited first, de-duplicated by id.
      const byId = new Map<number, Programme>()
      for (const p of inv) if (p.id != null) byId.set(p.id, p)
      for (const p of pub) if (p.id != null && !byId.has(p.id)) byId.set(p.id, p)
      const merged = Array.from(byId.values()).sort((a, b) => {
        const ai = invSet.has(a.id!) ? 0 : 1, bi = invSet.has(b.id!) ? 0 : 1
        return ai - bi
      })
      setProgrammes(merged)
    }).finally(() => setLoading(false))
  }, [status, isAuthenticated])

  // Which programmes has this porteur already applied to (drives the badges)?
  useEffect(() => {
    if (!isAuthenticated) return
    if(!isPorteur)return
    candidaturesApi.myList()
      .then((r) => {
        const list: any[] = r.data?.content ?? r.data ?? []
        const map: Record<number, string> = {}
        for (const c of list) if (c.programmeId != null) map[c.programmeId] = c.status
        setAppliedMap(map)
      })
      .catch(() => {})
  }, [isAuthenticated])

  const filtered = programmes.filter((p) => !search || (p.title ?? p.name ?? '').toLowerCase().includes(search.toLowerCase()))

  // Live counts for the header stat strip.
  const openCount = programmes.filter((p) => (p as any).acceptingApplications ?? p.status === 'OPEN').length

  const stats = [
    { icon: LayoutGrid, value: programmes.length, label: 'Programmes' },
    { icon: Sparkles, value: openCount, label: 'Ouverts' },
    ...(invitedIds.size > 0 ? [{ icon: Lock, value: invitedIds.size, label: 'Sur invitation' }] : []),
  ]

  const content = (
    <div className="mx-auto max-w-6xl">
      {/* ── Branded header ── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
        className="relative mb-6 overflow-hidden rounded-3xl p-7 sm:p-9 text-white shadow-lg dark:brightness-90"
        style={{ background: 'linear-gradient(90deg, #fbb431 0%, #0a8fb1 45%, #14c8f3 100%)' }}
      >
        {/* dot texture */}
        <div className="pointer-events-none absolute inset-0 opacity-20"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '30px 30px' }} />
        {/* soft glow blobs */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-white/10 blur-3xl" />

        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
            <Compass className="h-3.5 w-3.5" />Explorez l&apos;accompagnement Medianet
          </span>
          <h1 className="mt-3 text-3xl sm:text-4xl font-black leading-tight tracking-tight">
            Programmes d&apos;incubation
          </h1>
          <p className="mt-2 max-w-xl text-sm sm:text-base text-white/85">
            Trouvez le programme fait pour votre projet et déposez votre candidature en quelques clics.
          </p>

          {/* Stat strip */}
          {!loading && programmes.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2.5">
              {stats.map((s) => (
                <div key={s.label}
                  className="flex items-center gap-2.5 rounded-2xl bg-white/15 px-4 py-2.5 backdrop-blur-sm ring-1 ring-white/20">
                  <s.icon className="h-4 w-4 text-white/90" />
                  <span className="text-xl font-black tabular-nums leading-none">
                    <NumberTicker value={s.value} className="text-white" />
                  </span>
                  <span className="text-xs font-medium text-white/80 leading-none">{s.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Filter bar (sticky) ── */}
      <div className="sticky top-2 z-10 mb-6 flex flex-col gap-3 rounded-2xl border border-border bg-card/80 p-3 shadow-sm backdrop-blur-md sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Rechercher un programme..." className="border-transparent bg-muted/50 pl-9 focus-visible:border-brand-500" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 rounded-xl border border-border bg-muted p-1">
            {statusOpts.map((o) => (
              <button key={o.value} onClick={() => setStatus(o.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${status === o.value ? 'bg-background text-brand-600 dark:text-brand-400 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                {o.label}
              </button>
            ))}
          </div>
          {!loading && (
            <span className="hidden shrink-0 text-xs font-medium text-muted-foreground sm:block">
              {filtered.length} résultat{filtered.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border bg-muted/20 px-6 py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/10">
            <Compass className="h-7 w-7 text-brand-500" />
          </div>
          <p className="font-semibold text-foreground">Aucun programme trouvé</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {search ? 'Essayez un autre mot-clé ou' : 'Aucun programme ne correspond à ce filtre pour le moment —'} ajustez vos filtres.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.05, 0.4) }}>
              <ProgrammeCard programme={p} appliedStatus={appliedMap[p.id!]} invited={invitedIds.has(p.id!)} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )

  // Logged-in users get the sidebar app shell; anonymous visitors see the
  // marketing-style navbar. We wait for client hydration before deciding so
  // we don't flash the wrong chrome.
  if (hydrated && isAuthenticated) return <AppShell>{content}</AppShell>
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8">{content}</main><SiteFooter/>
    </div>
  )
}
