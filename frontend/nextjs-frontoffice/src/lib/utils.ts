import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatRelativeDate(date: string | Date): string {
  const d = new Date(date)
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (diffDays === 0) return "Aujourd'hui"
  if (diffDays === 1) return 'Hier'
  if (diffDays < 7) return `Il y a ${diffDays} jours`
  return formatDate(d)
}

export function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    // Candidature statuses
    PENDING: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    UNDER_EVALUATION: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    ACCEPTED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    // Programme statuses
    DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    OPEN: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    IN_PROGRESS: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    EVALUATION: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    CLOSED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    CANCELLED: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    // Task statuses
    COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  }
  return map[status] ?? 'bg-gray-100 text-gray-600'
}

export function scoreColor(score: number) {
  if (score >= 7) return 'text-emerald-500'
  if (score >= 5) return 'text-amber-500'
  return 'text-red-500'
}

export function priorityColor(priority: string): string {
  const map: Record<string, string> = {
    LOW:    'text-gray-500',
    MEDIUM: 'text-amber-500',
    HIGH:   'text-orange-500',
    URGENT: 'text-red-500',
  }
  return map[priority] ?? 'text-gray-500'
}
