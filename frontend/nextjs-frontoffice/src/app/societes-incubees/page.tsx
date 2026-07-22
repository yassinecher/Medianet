'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Building2, Globe, Loader2, Rocket } from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { MagicCard } from '@/components/magicui/magic-card'
import { incubatedApi } from '@/lib/api'

interface Company {
  id: number; name: string; logoUrl?: string
  description?: string; website?: string
  sector?: string; cohortYear?: string
}

export default function SocietesIncubeesPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    incubatedApi.list()
      .then((r) => setCompanies(r.data ?? []))
      .catch(() => setCompanies([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="mesh-gradient absolute inset-0" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-600 dark:text-brand-400">
            <Rocket className="h-3.5 w-3.5" />Elles sont passées par là
          </span>
          <h1 className="mt-4 text-3xl font-extrabold text-foreground sm:text-4xl">Sociétés incubées</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
            Les startups accompagnées par l&apos;incubateur Medianet — la preuve que ça marche.
          </p>
          <div className="brand-stripe mx-auto mt-6 h-1 w-32 rounded-full" />
        </div>
      </section>

      {/* Grid */}
      <section className="mx-auto w-full max-w-6xl flex-1 px-4 py-12">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-brand-500" /></div>
        ) : companies.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-16 text-center">
            <Rocket className="mx-auto h-10 w-10 text-muted-foreground opacity-30" />
            <p className="mt-3 text-sm font-medium text-foreground">Les premières sociétés arrivent bientôt</p>
            <p className="mt-1 text-xs text-muted-foreground">Le portfolio de l&apos;incubateur sera publié ici.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {companies.map((c, i) => (
              <motion.div key={c.id} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: Math.min(i * 0.05, 0.3) }}>
                <MagicCard className="flex h-full flex-col p-6">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-border bg-white">
                      {c.logoUrl
                        ? <img src={c.logoUrl} alt={c.name} className="h-full w-full object-contain p-1.5" />
                        : <Building2 className="h-6 w-6 text-muted-foreground" />}
                    </div>
                    {c.cohortYear && (
                      <span className="rounded-full bg-brand-500/10 px-2.5 py-1 text-[11px] font-bold text-brand-600 dark:text-brand-400">
                        Cohorte {c.cohortYear}
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-foreground">{c.name}</h3>
                  {c.sector && <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{c.sector}</p>}
                  {c.description && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{c.description}</p>}
                  {c.website && (
                    <a href={c.website.startsWith('http') ? c.website : `https://${c.website}`}
                      target="_blank" rel="noopener noreferrer"
                      className="mt-auto flex items-center gap-1.5 pt-4 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
                      <Globe className="h-4 w-4" />Visiter le site
                    </a>
                  )}
                </MagicCard>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      <SiteFooter />
    </div>
  )
}
