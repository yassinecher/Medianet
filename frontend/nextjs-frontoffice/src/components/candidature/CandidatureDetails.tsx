'use client'
/**
 * CandidatureDetails — a complete, read-only view of everything submitted in a
 * candidature: the linked organisation (identity + team, fetched when an
 * organizationId is present), then the submission grouped into sections
 * (Entreprise & équipe, Projet, Marché & business, Motivation) and the custom
 * form answers. Reused by the porteur candidature detail page and the jury
 * evaluation page so "all the details about the organisation" show in one place.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Building2, Users, Globe2, MapPin, Mail, Phone, Linkedin, FileText, ExternalLink,
} from 'lucide-react'
import { organizationsApi } from '@/lib/api'
import { getInitials } from '@/lib/utils'

const normalizeUrl = (u?: string) => (!u ? '' : /^https?:\/\//.test(u) ? u : `https://${u}`)
const prettyKey = (k: string) =>
  k.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^\w/, (c) => c.toUpperCase())
const fmtVal = (v: any): string => {
  if (v == null || v === '') return ''
  if (typeof v === 'boolean') return v ? 'Oui' : 'Non'
  if (Array.isArray(v)) return v.join(', ')
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

interface Field { label: string; value: any }
function Section({ title, fields }: { title: string; fields: Field[] }) {
  const rows = fields.filter((f) => fmtVal(f.value) !== '')
  if (rows.length === 0) return null
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="mb-3 text-sm font-bold text-foreground">{title}</h3>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {rows.map((f) => (
          <div key={f.label} className="min-w-0">
            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{f.label}</dt>
            <dd className="text-sm text-foreground whitespace-pre-wrap break-words">{fmtVal(f.value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

interface OrgMember { id: number; fullName: string; role?: string; headline?: string; avatarUrl?: string; linkedInUrl?: string; expertise?: string[] }
interface Org {
  id: number; name: string; type?: string; sector?: string; city?: string; country?: string
  website?: string; logoUrl?: string; description?: string; contactEmail?: string; contactPhone?: string
  members?: OrgMember[]
}

/** Linked-organisation card (identity + team). Fetched by id; silent if absent.
 *  When `embedded` (e.g. the jury evaluation), the org + members are shown
 *  read-only with no links out to the organisations module. */
function OrganisationCard({ organizationId, embedded }: { organizationId: number; embedded?: boolean }) {
  const [org, setOrg] = useState<Org | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let cancelled = false
    organizationsApi.get(organizationId)
      .then((r) => { if (!cancelled) setOrg(r.data) })
      .catch(() => { /* org may be inaccessible — skip silently */ })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [organizationId])

  if (loading || !org) return null
  const headline = [org.sector, [org.city, org.country].filter(Boolean).join(', ')].filter(Boolean).join(' · ')
  const members = org.members ?? []

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="h-16 bg-gradient-to-r from-brand-500 via-brand-600 to-purple-600" />
      <div className="px-5 pb-5">
        <div className="-mt-8 flex items-end gap-3">
          {org.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logoUrl} alt={org.name} className="h-16 w-16 rounded-xl object-cover border-4 border-card bg-card shadow" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-xl border-4 border-card bg-muted shadow"><Building2 className="h-7 w-7 text-muted-foreground" /></div>
          )}
          {embedded ? (
            // Jury context: open the full profile in a NEW TAB so the evaluation
            // page (and its back-stack) is never disturbed.
            <a href={`/organizations/${org.id}`} target="_blank" rel="noreferrer"
              className="ml-auto inline-flex items-center gap-1 pb-1 text-xs font-semibold text-brand-600 hover:underline">
              Profil complet<ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <Link href={`/organizations/${org.id}`} className="ml-auto inline-flex items-center gap-1 pb-1 text-xs font-semibold text-brand-600 hover:underline">
              Voir l&apos;organisation<ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>
        <div className="mt-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-bold text-foreground">{org.name}</h3>
            {org.type && <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:text-brand-300">{org.type}</span>}
          </div>
          {headline && <p className="text-sm text-muted-foreground">{headline}</p>}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {org.website && <a href={normalizeUrl(org.website)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-brand-600"><Globe2 className="h-3 w-3" />{org.website.replace(/^https?:\/\//, '')}</a>}
            {org.contactEmail && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{org.contactEmail}</span>}
            {org.contactPhone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{org.contactPhone}</span>}
            {(org.city || org.country) && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{[org.city, org.country].filter(Boolean).join(', ')}</span>}
          </div>
          {org.description && <p className="mt-3 text-sm text-muted-foreground whitespace-pre-wrap">{org.description}</p>}
        </div>

        {members.length > 0 && (
          <div className="mt-4 border-t border-border pt-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-foreground"><Users className="h-3.5 w-3.5 text-brand-500" />Équipe ({members.length})</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {members.map((m) => {
                const inner = (
                  <>
                    {m.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.avatarUrl} alt={m.fullName} className="h-8 w-8 rounded-full object-cover border border-border" />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-[10px] font-bold dark:bg-brand-900/40 dark:text-brand-300">{getInitials(m.fullName)}</div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{m.fullName}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{m.headline || m.role || ''}</p>
                    </div>
                    {m.linkedInUrl && <Linkedin className="ml-auto h-3 w-3 text-muted-foreground shrink-0" />}
                  </>
                )
                const cls = 'flex items-center gap-2 rounded-lg border border-border bg-background/50 px-2.5 py-1.5 hover:border-brand-400'
                const href = `/organizations/${org.id}/members/${m.id}`
                return embedded
                  ? <a key={m.id} href={href} target="_blank" rel="noreferrer" className={cls}>{inner}</a>
                  : <Link key={m.id} href={href} className={cls}>{inner}</Link>
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function CandidatureDetails({ c, embedded = false }: { c: any; embedded?: boolean }) {
  // Parse the custom form answers (JSON map of fieldKey → value).
  let custom: Record<string, any> = {}
  try { if (c?.customAnswers) custom = JSON.parse(c.customAnswers) } catch { /* ignore malformed */ }
  const customEntries = Object.entries(custom).filter(([, v]) => fmtVal(v) !== '')

  return (
    <div className="space-y-4">
      {c?.organizationId && <OrganisationCard organizationId={c.organizationId} embedded={embedded} />}

      <Section title="Entreprise & équipe" fields={[
        { label: 'Entreprise', value: c?.companyName },
        { label: 'Fondateur', value: c?.founderName },
        { label: 'Email fondateur', value: c?.founderEmail },
        { label: 'Co-fondateurs', value: c?.coFounders },
        { label: 'Parcours de l\'équipe', value: c?.teamBackground },
        { label: 'Taille de l\'équipe', value: c?.teamSize },
        { label: 'Niveau d\'engagement', value: c?.engagementLevel },
        { label: 'Email de contact', value: c?.contactEmail },
        { label: 'Téléphone', value: c?.contactPhone },
      ]} />

      <Section title="Projet" fields={[
        { label: 'Nom du projet', value: c?.projectName },
        { label: 'Description', value: c?.projectDescription },
        { label: 'Problème', value: c?.problemStatement },
        { label: 'Solution', value: c?.solutionDescription },
        { label: 'Avantage concurrentiel', value: c?.competitiveAdvantage },
        { label: 'Technologie', value: c?.technologyDescription },
        { label: 'Secteur', value: c?.sector },
        { label: 'Domaine', value: c?.domain },
        { label: 'Stade actuel', value: c?.currentStage },
        { label: 'Stack technique', value: c?.techStack },
      ]} />

      <Section title="Marché & business" fields={[
        { label: 'Marché cible', value: c?.targetMarket },
        { label: 'A des clients', value: c?.hasCustomers },
        { label: 'Incubation antérieure', value: c?.hasPriorIncubation },
        { label: 'Détails incubation', value: c?.priorIncubationDetails },
        { label: 'Modèle économique', value: c?.businessModel },
        { label: 'Canaux de distribution', value: c?.distributionChannels },
        { label: 'Financement recherché', value: c?.fundingRequired },
      ]} />

      <Section title="Motivation & besoins" fields={[
        { label: 'Motivation', value: c?.motivation },
        { label: 'Besoins d\'accompagnement', value: c?.supportNeeds },
        { label: 'Autres besoins', value: c?.otherNeeds },
        { label: 'Attentes du programme', value: c?.programmeExpectations },
        { label: 'Pitch deck', value: c?.pitchDeckUrl },
      ]} />

      {customEntries.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground"><FileText className="h-4 w-4 text-brand-500" />Réponses au formulaire</h3>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {customEntries.map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{prettyKey(k)}</dt>
                <dd className="text-sm text-foreground whitespace-pre-wrap break-words">{fmtVal(v)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  )
}
