import { Briefcase, GraduationCap, Sparkles } from 'lucide-react'
import type { FrontofficeRole } from '@/store/auth.store'

/**
 * One look per front-office role, used everywhere a role appears (dashboard
 * space switcher, sidebar dots, account menu) so users can tell them apart:
 * porteur = brand color, mentor = emerald, juré = amber.
 */
export const ROLE_META: Record<FrontofficeRole, {
  /** Short label (chips, switcher). */
  label: string
  /** Full name of the role / space. */
  long: string
  icon: any
  /** Text color. */
  text: string
  /** Solid dot color. */
  dot: string
  /** Tinted chip (bg + text + border). */
  chip: string
}> = {
  PORTEUR: {
    label: 'Porteur', long: 'Porteur de projet', icon: Briefcase,
    text: 'text-brand-600 dark:text-brand-400', dot: 'bg-brand-500',
    chip: 'border-brand-500/30 bg-brand-500/10 text-brand-700 dark:text-brand-300',
  },
  MENTOR: {
    label: 'Mentor', long: 'Mentor', icon: Sparkles,
    text: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500',
    chip: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  JURY: {
    label: 'Juré', long: 'Membre du jury', icon: GraduationCap,
    text: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500',
    chip: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
}
