'use client'
import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Trash2, RotateCcw, Loader2, Rocket, CalendarClock, ClipboardList, Video, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { trashApi, type TrashItem } from '@/lib/api'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { MagicCard } from '@/components/magicui/magic-card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/utils'

const TYPE_META: Record<string, { label: string; icon: any; tone: string }> = {
  programme: { label: 'Programme', icon: Rocket,        tone: 'text-brand-500' },
  session:   { label: 'Session',   icon: CalendarClock, tone: 'text-sky-500' },
  task:      { label: 'Tâche',     icon: ClipboardList, tone: 'text-amber-500' },
  pitch:     { label: 'Vidéo de pitch', icon: Video,    tone: 'text-purple-500' },
}
const ORDER = ['programme', 'session', 'task', 'pitch']

export default function TrashPage() {
  const [items, setItems] = useState<TrashItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    trashApi.list()
      .then((r) => setItems(r.data ?? []))
      .catch(() => toast.error('Impossible de charger la corbeille'))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const key = (it: TrashItem) => `${it.type}-${it.id}`

  const restore = async (it: TrashItem) => {
    setBusy(key(it))
    try {
      await trashApi.restore(it.type, it.id)
      setItems((prev) => prev.filter((x) => key(x) !== key(it)))
      toast.success(`${TYPE_META[it.type]?.label ?? 'Élément'} restauré`)
    } catch (e: any) { toast.error(e.response?.data?.message ?? 'Échec de la restauration') }
    finally { setBusy(null) }
  }
  const purge = async (it: TrashItem) => {
    if (!confirm(`Supprimer définitivement « ${it.label} » ? Cette action est irréversible.`)) return
    setBusy(key(it))
    try {
      await trashApi.purge(it.type, it.id)
      setItems((prev) => prev.filter((x) => key(x) !== key(it)))
      toast.success('Supprimé définitivement')
    } catch (e: any) { toast.error(e.response?.data?.message ?? 'Échec de la suppression') }
    finally { setBusy(null) }
  }

  const grouped = ORDER
    .map((t) => ({ type: t, list: items.filter((x) => x.type === t) }))
    .filter((g) => g.list.length > 0)

  return (
    <AdminLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Trash2 className="h-6 w-6 text-brand-500" />Corbeille
          </h1>
          <p className="text-muted-foreground">
            {items.length} élément(s) supprimé(s) — restaurez-les à tout moment. Rien n’est perdu tant que vous ne supprimez pas définitivement.
          </p>
        </motion.div>

        {loading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
        ) : items.length === 0 ? (
          <MagicCard className="p-12 text-center">
            <Trash2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm font-medium text-foreground">La corbeille est vide</p>
            <p className="mt-1 text-xs text-muted-foreground">Les programmes, sessions, tâches et vidéos supprimés apparaîtront ici.</p>
          </MagicCard>
        ) : (
          <div className="space-y-6">
            {grouped.map((g) => {
              const meta = TYPE_META[g.type]
              const Icon = meta?.icon ?? Trash2
              return (
                <section key={g.type} className="space-y-2">
                  <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <Icon className={`h-4 w-4 ${meta?.tone ?? ''}`} />{meta?.label ?? g.type} ({g.list.length})
                  </h2>
                  <div className="space-y-2">
                    {g.list.map((it) => (
                      <MagicCard key={key(it)} className="flex items-center gap-3 p-3">
                        <Icon className={`h-4 w-4 shrink-0 ${meta?.tone ?? 'text-muted-foreground'}`} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{it.label || `#${it.id}`}</p>
                          <p className="text-[11px] text-muted-foreground">Supprimé {it.deletedAt ? formatDate(it.deletedAt) : ''}</p>
                        </div>
                        <Button variant="outline" size="sm" className="gap-1.5" disabled={busy === key(it)} onClick={() => restore(it)}>
                          {busy === key(it) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}Restaurer
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                          title="Supprimer définitivement" disabled={busy === key(it)} onClick={() => purge(it)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </MagicCard>
                    ))}
                  </div>
                </section>
              )
            })}

            <p className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              « Supprimer définitivement » est irréversible. La restauration ramène l’élément et tout ce qui lui est rattaché.
            </p>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
