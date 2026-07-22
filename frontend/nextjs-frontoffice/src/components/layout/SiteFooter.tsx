import Link from 'next/link'
import { Mail, MapPin, Phone } from 'lucide-react'
import { MedianetLogo } from '@/components/brand/MedianetLogo'
import { CONTACT, PUBLIC_LINKS, SOCIALS } from '@/lib/site'

/**
 * Site-wide footer — Medianet identity, public links, contact and social
 * accounts, closed by the signature multicolor stripe.
 */
export function SiteFooter({ footerText }: { footerText?: string }) {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        {/* Brand */}
        <div className="space-y-3">
          <MedianetLogo href="/" />
          <p className="text-sm leading-relaxed text-muted-foreground">
            L&apos;incubateur Medianet accompagne les startups tunisiennes —
            programmes d&apos;incubation, mentorat et coaching IA.
          </p>
          <div className="flex gap-1.5">
            {SOCIALS.map(({ name, href, Icon }) => (
              <a key={name} href={href} target="_blank" rel="noopener noreferrer" title={name}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-brand-500 hover:bg-brand-500/10 hover:text-brand-600 dark:hover:text-brand-400">
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>

        {/* Découvrir */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Découvrir</p>
          <ul className="space-y-2">
            {PUBLIC_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-sm text-muted-foreground transition-colors hover:text-brand-600 dark:hover:text-brand-400">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Espace porteur */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Espace porteur</p>
          <ul className="space-y-2">
            {[
              { label: 'Connexion', href: '/login' },
              { label: 'Créer un compte', href: '/register' },
              { label: 'Mes candidatures', href: '/candidatures' },
              { label: 'Tableau de bord', href: '/dashboard' },
            ].map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-sm text-muted-foreground transition-colors hover:text-brand-600 dark:hover:text-brand-400">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Contact */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contact</p>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            <li className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />{CONTACT.address}</li>
            <li className="flex items-center gap-2"><Mail className="h-4 w-4 shrink-0 text-brand-500" />
              <a href={`mailto:${CONTACT.email}`} className="hover:text-brand-600 dark:hover:text-brand-400">{CONTACT.email}</a>
            </li>
            <li className="flex items-center gap-2"><Phone className="h-4 w-4 shrink-0 text-brand-500" />{CONTACT.phone}</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-5 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            {footerText ?? '© 2026 Medianet Incubateur. Tous droits réservés.'}
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            E-business · Digital Strategy
          </p>
        </div>
      </div>
      <div className="brand-stripe h-1 w-full" />
    </footer>
  )
}
