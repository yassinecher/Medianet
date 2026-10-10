import { Facebook, Instagram, Linkedin, Twitter, type LucideIcon } from 'lucide-react'

/**
 * Site-wide constants — social accounts & public navigation.
 * Adjust the URLs here once; navbar + footer + À propos all read this file.
 * Socials = the accounts linked from medianet-group.com (no YouTube channel there).
 */
export const SOCIALS: { name: string; href: string; Icon: LucideIcon }[] = [
  { name: 'Facebook',  href: 'https://www.facebook.com/MEDIANET.tn',         Icon: Facebook },
  { name: 'LinkedIn',  href: 'https://www.linkedin.com/company/medianet_2',  Icon: Linkedin },
  { name: 'Instagram', href: 'https://www.instagram.com/medianet.tn/',       Icon: Instagram },
  { name: 'X',         href: 'https://twitter.com/MedianetGroup',            Icon: Twitter },
]

/** Public discovery pages (visible to visitors in navbar + everyone in footer). */
export const PUBLIC_LINKS = [
  { label: 'Programmes', href: '/programmes' },
  { label: 'Partenaires', href: '/partenaires' },
  { label: 'Sociétés incubées', href: '/societes-incubees' },
  { label: 'À propos', href: '/a-propos' },
]

/**
 * Medianet's official details, as published on medianet-group.com/fr/contactez-nous
 * (checked 2026-10-08) — keep in sync with that page, never invent values here.
 */
export const CONTACT = {
  email: 'info@medianet.com.tn',
  phone: '+216 28 910 608',
  phoneHref: 'tel:+21628910608',
  address: 'Avenue Habib Bourguiba, 10 Décembre, Immeuble Essaadi Tour C-D Mezzanine, Menzah 4, 1004 Tunis',
}
