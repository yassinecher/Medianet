'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Search } from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { AppShell } from '@/components/layout/AppShell'
import { ProgrammeCard } from '@/components/programmes/ProgrammeCard'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { programmesApi, candidaturesApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import type { Programme } from '@/types'

const statusOpts = [
  { label: 'Tous', value: '' },
  { label: 'Ouverts', value: 'OPEN' },
  { label: 'Fermés', value: 'CLOSED' },
]

export default function ProgrammesPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => { setHydrated(true) }, [])

  const [programmes, setProgrammes] = useState<Programme[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  /** programmeId → the porteur's candidature status on it. */
  const [appliedMap, setAppliedMap] = useState<Record<number, string>>({})

  useEffect(() => {
    // publicOnly hides DRAFT / ARCHIVED / CANCELLED programmes from porteurs.
    programmesApi.list({ publicOnly: true, ...(status ? { status } : {}) })
      .then((r) => setProgrammes(r.data?.content ?? r.data ?? []))
      .finally(() => setLoading(false))
  }, [status])

  // Which programmes has this porteur already applied to (drives the badges)?
  useEffect(() => {
    if (!isAuthenticated) return
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

  const content = (
    <div className="mx-auto max-w-6xl">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Programmes d&apos;incubation</h1>
        <p className="mt-1 text-sm text-muted-foreground">{filtered.length} programme(s) disponible(s)</p>
      </motion.div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Rechercher un programme..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1 rounded-lg border border-border bg-muted p-1">
          {statusOpts.map((o) => (
            <button key={o.value} onClick={() => setStatus(o.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${status === o.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <ProgrammeCard programme={p} appliedStatus={appliedMap[p.id!]} />
            </motion.div>
          ))}
          {filtered.length === 0 && <div className="col-span-full py-16 text-center text-muted-foreground">Aucun programme trouvé</div>}
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
      <main className="mx-auto max-w-6xl px-4 py-8">{content}</main>
    </div>
  )
}
