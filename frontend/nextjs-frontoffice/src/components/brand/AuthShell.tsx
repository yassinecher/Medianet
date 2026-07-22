'use client'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, Rocket, Users2, Sparkles } from 'lucide-react'
import { MedianetLogo } from './MedianetLogo'

/**
 * Two-pane auth layout: form on the left (back button + logo + centered card),
 * Medianet brand panel on the right (lg+) — deep-blue gradient, glass cards and
 * the signature stripe. Fully responsive: the brand panel hides under lg.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      {/* ── Form side ── */}
      <div className="relative flex flex-col px-4 py-5 sm:px-8">
        <div className="flex items-center justify-between">
          <Link href="/"
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />Accueil
          </Link>
          <MedianetLogo size="sm" href="/" />
        </div>
        <div className="flex flex-1 items-center justify-center py-8">
          <motion.div initial={{ y: 14 }} animate={{ y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }}
            className="w-full max-w-md">
            {children}
          </motion.div>
        </div>
      </div>

      {/* ── Brand side (lg+) ── */}
      <div className="relative hidden overflow-hidden lg:block"
        style={{ background: 'linear-gradient(155deg,#062a40 0%,#064e75 38%,#0084c7 78%,#00a3e0 100%)' }}>
        {/* decorative shapes */}
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/5 blur-2xl" />
        <div className="absolute -bottom-32 -left-16 h-[28rem] w-[28rem] rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="absolute right-16 top-1/3 h-40 w-40 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm" style={{ transform: 'rotate(12deg)' }} />

        <div className="relative z-10 flex h-full flex-col justify-between p-12">
          <div>
            <span className="text-2xl font-extrabold tracking-tight text-white">MEDIA<span className="text-white/60">NET</span></span>
            <span className="brand-stripe mt-2 block h-1 w-40 rounded-full" />
          </div>

          <div className="max-w-md space-y-6">
            <h2 className="text-3xl font-extrabold leading-tight text-white" style={{ textWrap: 'balance' } as React.CSSProperties}>
              L&apos;incubateur qui fait décoller les startups.
            </h2>
            <p className="text-sm leading-relaxed text-white/75">
              Candidatez aux programmes, suivez votre parcours d&apos;incubation,
              entraînez votre pitch avec l&apos;IA et faites grandir votre projet
              avec les mentors Medianet.
            </p>
            <div className="grid gap-3">
              {[
                { Icon: Rocket, t: 'Programmes d’incubation', d: 'Candidature en ligne, parcours clair, suivi en temps réel' },
                { Icon: Sparkles, t: 'Coach IA de pitch', d: 'Analyse automatique de vos vidéos et conseils personnalisés' },
                { Icon: Users2, t: 'Mentors & jurys experts', d: 'Un accompagnement par l’écosystème Medianet' },
              ].map(({ Icon, t, d }) => (
                <div key={t} className="glass flex items-start gap-3 rounded-2xl p-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span>
                    <p className="text-sm font-semibold text-white">{t}</p>
                    <p className="text-xs text-white/65">{d}</p>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/50">
            E-business · Digital Strategy · Incubation
          </p>
        </div>
      </div>
    </div>
  )
}
