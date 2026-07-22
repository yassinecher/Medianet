'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Building2, Handshake, Loader2 } from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { MagicCard } from '@/components/magicui/magic-card'
import { publicPartnersApi } from '@/lib/api'

interface Partner {
  id: number; name: string; logoUrl?: string
  description?: string; website?: string
}

export default function PartenairesPage() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    publicPartnersApi.list()
      .then((r) => setPartners(r.data ?? []))
      .catch(() => setPartners([]))
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
            <Handshake className="h-3.5 w-3.5" />Écosystème Medianet
          </span>
          <h1 className="mt-4 text-3xl font-extrabold text-foreground sm:text-4xl">Nos partenaires</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
            Les organisations qui accompagnent l&apos;incubateur et ouvrent des portes aux startups.
          </p>
          <div className="brand-stripe mx-auto mt-6 h-1 w-32 rounded-full" />
        </div>
      </section>

      {/* Grid */}
      <section className="mx-auto w-full max-w-6xl flex-1 px-4 py-12">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-brand-500" /></div>
        ) : partners.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-16 text-center">
            <Building2 className="mx-auto h-10 w-10 text-muted-foreground opacity-30" />
            <p className="mt-3 text-sm font-medium text-foreground">Les partenaires arrivent bientôt</p>
            <p className="mt-1 text-xs text-muted-foreground">Revenez prochainement pour découvrir l&apos;écosystème.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {partners.map((p, i) => (
              <motion.div key={p.id} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: Math.min(i * 0.05, 0.3) }}>
                <Link href={`/partenaires/${p.id}`} className="block h-full">
                  <MagicCard className="flex h-full flex-col p-6 transition-transform hover:-translate-y-0.5">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-border bg-white">
                      {p.logoUrl
                        ? <img src={p.logoUrl} alt={p.name} className="h-full w-full object-contain p-1.5" />
                        : <Building2 className="h-7 w-7 text-muted-foreground" />}
                    </div>
                    <h3 className="font-semibold text-foreground">{p.name}</h3>
                    {p.description && <p className="mt-1.5 line-clamp-3 text-sm text-muted-foreground">{p.description}</p>}
                    <span className="mt-auto flex items-center gap-1 pt-4 text-sm font-medium text-brand-600 dark:text-brand-400">
                      Voir le profil<ArrowRight className="h-4 w-4" />
                    </span>
                  </MagicCard>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      <SiteFooter />
    </div>
  )
}
