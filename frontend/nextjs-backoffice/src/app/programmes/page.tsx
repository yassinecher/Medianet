'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Plus, Search, Eye, Trash2, Edit, PencilLine } from 'lucide-react'
import toast from 'react-hot-toast'
import { programmesApi } from '@/lib/api'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { MagicCard } from '@/components/magicui/magic-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, statusColor } from '@/lib/utils'
import { useCan } from '@/hooks/useCan'
import type { Programme } from '@/types'

const statusLabel: Record<string, string> = { DRAFT: 'Brouillon', OPEN: 'Ouvert', CLOSED: 'Fermé', ARCHIVED: 'Archivé' }

export default function ProgrammesPage() {
  const router = useRouter()
  const [programmes, setProgrammes] = useState<Programme[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const { can } = useCan()

  useEffect(() => {
    programmesApi.list().then((r) => setProgrammes(r.data?.content ?? r.data ?? [])).finally(() => setLoading(false))
  }, [])

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Supprimer le programme "${name}" ?`)) return
    try {
      await programmesApi.delete(id)
      setProgrammes((prev) => prev.filter((p) => p.id !== id))
      toast.success('Programme supprimé')
    } catch { toast.error('Échec de la suppression') }
  }


  const filtered = programmes.filter((p) => !search || (p.title ?? p.name ?? '').toLowerCase().includes(search.toLowerCase()))

  return (
    <AdminLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Programmes</h1>
            <p className="text-muted-foreground">{filtered.length} programme(s)</p>
          </div>
          {can('programmes:create') && (
            <Button variant="brand" onClick={() => router.push('/programmes/new')}>
              <Plus className="h-4 w-4" />Nouveau programme
            </Button>
          )}
        </motion.div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Rechercher..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {loading ? (
          <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
        ) : (
          <div className="space-y-3">
            {filtered.map((p, i) => (
              <motion.div key={p.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                <MagicCard className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground truncate">{p.title ?? p.name}</h3>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${statusColor(p.status)}`}>{statusLabel[p.status]}</span>
                      </div>
                      <div className="flex flex-wrap gap-3 mt-0.5 text-xs text-muted-foreground">
                        {(p.type ?? p.domain) && <span>{p.type ?? p.domain}</span>}
                        {p.region && <span>· {p.region}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {p.status === 'DRAFT' && (
                        <Link href={`/programmes/new?draft=${p.id}`}>
                          <Button variant="outline" size="sm" className="gap-1.5">
                            <PencilLine className="h-3.5 w-3.5" />Reprendre
                          </Button>
                        </Link>
                      )}
                      <Link href={`/programmes/${p.id}`}>
                        <Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button>
                      </Link>
                      <Link href={`/programmes/${p.id}`}>
                        <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
                      </Link>
                      {can('programmes:delete') && (
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(p.id, p.title ?? p.name ?? '')}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </MagicCard>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
