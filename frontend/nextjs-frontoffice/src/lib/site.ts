import { Facebook, Instagram, Linkedin, Twitter, Youtube, type LucideIcon } from 'lucide-react'

/**
 * Site-wide constants — social accounts & public navigation.
 * Adjust the URLs here once; navbar + footer + À propos all read this file.
 */
export const SOCIALS: { name: string; href: string; Icon: LucideIcon }[] = [
  { name: 'Facebook',  href: 'https://www.facebook.com/medianet.tn',            Icon: Facebook },
  { name: 'LinkedIn',  href: 'https://www.linkedin.com/company/medianet',       Icon: Linkedin },
  { name: 'Instagram', href: 'https://www.instagram.com/medianet.tn',           Icon: Instagram },
  { name: 'X',         href: 'https://x.com/medianet_tn',                       Icon: Twitter },
  { name: 'YouTube',   href: 'https://www.youtube.com/@medianet',               Icon: Youtube },
]

/** Public discovery pages (visible to visitors in navbar + everyone in footer). */
export const PUBLIC_LINKS = [
  { label: 'Programmes', href: '/programmes' },
  { label: 'Partenaires', href: '/partenaires' },
  { label: 'Sociétés incubées', href: '/societes-incubees' },
  { label: 'À propos', href: '/a-propos' },
]

export const CONTACT = {
  email: 'contact@medianet.com.tn',
  phone: '+216 71 000 000',
  address: 'Immeuble Medianet, Les Berges du Lac, Tunis',
}
