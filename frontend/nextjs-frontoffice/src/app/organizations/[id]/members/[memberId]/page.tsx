'use client'
/**
 * Member profile — a dedicated LinkedIn-style page for one organisation member.
 * Members are embedded in the organisation DTO, so we load the org and pick the
 * member by id (no dedicated endpoint). Read-only; the org owner edits members
 * inline back on the organisation page.
 */
import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Users, Mail, Phone, Linkedin, Building2,
} from 'lucide-react'
import { organizationsApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getInitials } from '@/lib/utils'

interface Member {
  id: number; fullName: string; email?: string; phone?: string; role?: string
  responsibilities?: string; expertise?: string[]; type?: string
  avatarUrl?: string; headline?: string; linkedInUrl?: string
}
interface Org { id: number; name: string; logoUrl?: string; createdByUserId?: number; members?: Member[] }

const MEMBER_TYPE_LABEL: Record<string, string> = { INTERNAL: 'Équipe interne', EXTERNAL: 'Externe / Conseil' }
const normalizeUrl = (u?: string) => (!u ? '' : /^https?:\/\//.test(u) ? u : `https://${u}`)

export default function MemberProfilePage() {
  const params = useParams()
  const router = useRouter()
  const orgId = Number(Array.isArray(params.id) ? params.id[0] : params.id)
  const memberId = Number(Array.isArray(params.memberId) ? params.memberId[0] : params.memberId)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => { setHydrated(true) }, [])

  const [org, setOrg] = useState<Org | null>(null)
  const [member, setMember] = useState<Member | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await organizationsApi.get(orgId)
      setOrg(r.data)
      const m = (r.data?.members ?? []).find((x: Member) => x.id === memberId) ?? null
      if (!m) setError('Membre introuvable.')
      setMember(m)
    } catch { setError('Organisation introuvable.') }
    finally { setLoading(false) }
  }, [orgId, memberId])

  useEffect(() => {
    if (hydrated && !isAuthenticated) { router.replace('/login'); return }
    if (hydrated && !isNaN(orgId) && !isNaN(memberId)) load()
  }, [hydrated, isAuthenticated, orgId, memberId, load, router])

  if (loading) {
    return <AppShell><div className="mx-auto max-w-3xl space-y-4"><Skeleton className="h-44 rounded-2xl" /><Skeleton className="h-32 rounded-2xl" /></div></AppShell>
  }
  if (error || !member || !org) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl py-20 text-center">
          <Users className="mx-auto h-10 w-10 text-muted-foreground opacity-30" />
          <p className="mt-3 text-sm text-muted-foreground">{error ?? 'Membre introuvable.'}</p>
          <Link href={`/organizations/${orgId}`} className="mt-4 inline-block"><Button variant="brand">Retour à l&apos;organisation</Button></Link>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-5">
        <Link href={`/organizations/${orgId}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />{org.name}
        </Link>

        {/* ── Header (cover + avatar) ── */}
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="h-28 bg-gradient-to-r from-brand-500 via-brand-600 to-purple-600" />
          <div className="px-5 pb-5">
            <div className="-mt-10 flex items-end gap-4">
              {member.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={member.avatarUrl} alt={member.fullName} className="h-20 w-20 rounded-2xl object-cover border-4 border-card shadow-md" />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-card bg-gradient-to-br from-brand-500 to-purple-600 text-white text-2xl font-black shadow-md">
                  {getInitials(member.fullName)}
                </div>
              )}
            </div>
            <div className="mt-3">
              <h1 className="text-xl font-bold text-foreground">{member.fullName}</h1>
              {(member.headline || member.role) && (
                <p className="text-sm font-medium text-muted-foreground">{member.headline || member.role}</p>
              )}
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {member.role && member.headline && (
                  <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:text-brand-300">{member.role}</span>
                )}
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{MEMBER_TYPE_LABEL[member.type ?? 'INTERNAL']}</span>
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Building2 className="h-3 w-3" />{org.name}</span>
              </div>
              {/* Links / contact */}
              <div className="mt-3 flex flex-wrap gap-2">
                {member.email && (
                  <a href={`mailto:${member.email}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:text-brand-600 hover:border-brand-400">
                    <Mail className="h-3.5 w-3.5" />{member.email}
                  </a>
                )}
                {member.phone && (
                  <a href={`tel:${member.phone}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
                    <Phone className="h-3.5 w-3.5" />{member.phone}
                  </a>
                )}
                {member.linkedInUrl && (
                  <a href={normalizeUrl(member.linkedInUrl)} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:text-[#0a66c2] hover:border-[#0a66c2]/50">
                    <Linkedin className="h-3.5 w-3.5" />LinkedIn
                  </a>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── About / responsibilities ── */}
        {member.responsibilities && (
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-sm font-bold text-foreground mb-2">À propos</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{member.responsibilities}</p>
          </div>
        )}

        {/* ── Skills ── */}
        {(member.expertise?.length ?? 0) > 0 && (
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-sm font-bold text-foreground mb-3">Compétences</h2>
            <div className="flex flex-wrap gap-1.5">
              {member.expertise!.map((x) => (
                <span key={x} className="rounded-full bg-brand-500/10 px-2.5 py-1 text-xs font-medium text-brand-700 dark:text-brand-300">{x}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
