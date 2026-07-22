'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, Building2, Globe, Loader2, Mail, Phone } from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { Button } from '@/components/ui/button'
import { publicPartnersApi } from '@/lib/api'

interface Partner {
  id: number; name: string; logoUrl?: string
  description?: string; website?: string
  contactEmail?: string; contactPhone?: string
}

export default function PartenaireProfilePage() {
  const { id } = useParams<{ id: string }>()
  const [partner, setPartner] = useState<Partner | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    publicPartnersApi.get(Number(id))
      .then((r) => setPartner(r.data ?? null))
      .catch(() => setPartner(null))
      .finally(() => setLoading(false))
  }, [id])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />

      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
        <Link href="/partenaires"
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Tous les partenaires
        </Link>

        {loading ? (
          <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-brand-500" /></div>
        ) : !partner ? (
          <div className="py-24 text-center">
            <Building2 className="mx-auto h-10 w-10 text-muted-foreground opacity-30" />
            <p className="mt-3 text-sm font-medium text-foreground">Partenaire introuvable</p>
            <p className="mt-1 text-xs text-muted-foreground">Il n&apos;est peut-être plus visible publiquement.</p>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
            className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            {/* Header band */}
            <div className="relative h-28" style={{ background: 'linear-gradient(135deg,#064e75 0%,#0084c7 60%,#00a3e0 100%)' }}>
              <div className="brand-stripe absolute bottom-0 left-0 right-0 h-1" />
            </div>
            <div className="px-6 pb-8 sm:px-8">
              <div className="-mt-10 mb-5 flex items-end gap-4">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-card bg-white shadow-lg">
                  {partner.logoUrl
                    ? <img src={partner.logoUrl} alt={partner.name} className="h-full w-full object-contain p-2" />
                    : <Building2 className="h-8 w-8 text-muted-foreground" />}
                </div>
                <div className="min-w-0 pb-1">
                  <h1 className="truncate text-2xl font-bold text-foreground">{partner.name}</h1>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Partenaire Medianet</p>
                </div>
              </div>

              {partner.description ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{partner.description}</p>
              ) : (
                <p className="text-sm italic text-muted-foreground">Aucune description pour le moment.</p>
              )}

              {/* Contact / links */}
              <div className="mt-6 flex flex-wrap gap-2">
                {partner.website && (
                  <a href={partner.website.startsWith('http') ? partner.website : `https://${partner.website}`}
                    target="_blank" rel="noopener noreferrer">
                    <Button variant="brand" size="sm" className="gap-1.5"><Globe className="h-4 w-4" />Site web</Button>
                  </a>
                )}
                {partner.contactEmail && (
                  <a href={`mailto:${partner.contactEmail}`}>
                    <Button variant="outline" size="sm" className="gap-1.5"><Mail className="h-4 w-4" />{partner.contactEmail}</Button>
                  </a>
                )}
                {partner.contactPhone && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4" />{partner.contactPhone}
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </div>

      <SiteFooter />
    </div>
  )
}
