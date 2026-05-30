'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Briefcase, Sparkles, GraduationCap, ArrowRight, Check } from 'lucide-react'
import {
  useAuthStore, useUser, useActiveRole, frontofficeRolesOf,
  type FrontofficeRole,
} from '@/store/auth.store'
import { Particles } from '@/components/magicui/particles'
import { BorderBeam } from '@/components/magicui/border-beam'

const ROLE_CARDS: Record<FrontofficeRole, {
  title: string; tagline: string; icon: any; gradient: string; bullets: string[]
}> = {
  PORTEUR: {
    title: 'Porteur de projet',
    tagline: 'Vous portez une idée et candidatez à des programmes.',
    icon: Briefcase,
    gradient: 'from-brand-500 to-purple-600',
    bullets: ['Explorer les programmes ouverts', 'Soumettre vos candidatures', 'Suivre vos tâches'],
  },
  MENTOR: {
    title: 'Mentor',
    tagline: 'Vous accompagnez les porteurs sur leur parcours.',
    icon: Sparkles,
    gradient: 'from-emerald-500 to-teal-600',
    bullets: ['Voir vos porteurs assignés', 'Gérer vos sessions', 'Suivre l\'avancement'],
  },
  JURY: {
    title: 'Juré',
    tagline: "Vous évaluez les candidatures selon les critères du programme.",
    icon: GraduationCap,
    gradient: 'from-amber-500 to-orange-600',
    bullets: ['Voir les candidatures à évaluer', 'Noter selon les critères', 'Soumettre vos évaluations'],
  },
}

export default function SelectRolePage() {
  const router = useRouter()
  const user = useUser()
  const activeRole = useActiveRole()
  const setActiveRole = useAuthStore((s) => s.setActiveRole)
  const logout = useAuthStore((s) => s.logout)

  const roles = frontofficeRolesOf(user)

  // Bounce away from this page if it doesn't apply
  useEffect(() => {
    if (!user) { router.replace('/login'); return }
    if (roles.length === 0) { router.replace('/login'); return }
    if (roles.length === 1) {
      setActiveRole(roles[0])
      router.replace('/dashboard')
    }
  }, [user, roles, router, setActiveRole])

  const choose = (role: FrontofficeRole) => {
    setActiveRole(role)
    router.replace('/dashboard')
  }

  if (!user || roles.length <= 1) return null

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12">
      <div className="absolute inset-0"><Particles quantity={60} color="#6272f6" /></div>
      <div className="mesh-gradient absolute inset-0" />

      <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.35 }}
        className="relative z-10 w-full max-w-4xl">

        <div className="mb-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-black text-foreground mb-2">
            Bonjour {user.firstName} 👋
          </h1>
          <p className="text-muted-foreground">
            Votre compte a plusieurs profils. Choisissez celui que vous voulez utiliser maintenant.
          </p>
          <p className="mt-1 text-xs text-muted-foreground/80">
            Vous pourrez en changer à tout moment depuis le menu utilisateur.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((role, i) => {
            const cfg = ROLE_CARDS[role]
            const Icon = cfg.icon
            const isActive = activeRole === role
            return (
              <motion.button key={role} type="button"
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                whileHover={{ y: -4 }} onClick={() => choose(role)}
                className="group relative overflow-hidden rounded-2xl border-2 border-border bg-card p-6 text-left shadow-lg hover:border-brand-400 hover:shadow-2xl transition-all">
                <BorderBeam duration={8 + i * 2} />

                <div className={`mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${cfg.gradient} shadow-lg`}>
                  <Icon className="h-7 w-7 text-white" />
                </div>

                <h3 className="text-xl font-black text-foreground mb-1">{cfg.title}</h3>
                <p className="text-sm text-muted-foreground mb-4">{cfg.tagline}</p>

                <ul className="space-y-1.5 mb-5">
                  {cfg.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Check className="h-3.5 w-3.5 mt-0.5 text-brand-500 shrink-0" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>

                <div className="flex items-center gap-1.5 text-sm font-bold text-brand-600 dark:text-brand-400 group-hover:gap-2.5 transition-all">
                  Continuer comme {cfg.title}
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>

                {isActive && (
                  <span className="absolute top-3 right-3 rounded-full bg-brand-500 text-white px-2 py-0.5 text-[10px] font-bold">
                    Actif
                  </span>
                )}
              </motion.button>
            )
          })}
        </div>

        <div className="mt-8 text-center">
          <button type="button" onClick={() => { logout(); router.push('/login') }}
            className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline">
            Se déconnecter
          </button>
        </div>
      </motion.div>
    </div>
  )
}
