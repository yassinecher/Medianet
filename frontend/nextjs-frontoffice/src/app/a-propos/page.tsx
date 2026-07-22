'use client'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Award, Brain, Globe2, Rocket, Target, Users } from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { MedianetLogo } from '@/components/brand/MedianetLogo'
import { MagicCard } from '@/components/magicui/magic-card'
import { Button } from '@/components/ui/button'
import { SOCIALS } from '@/lib/site'

const VALUES = [
  { Icon: Rocket, title: 'Accélérer', text: 'Des programmes d’incubation structurés qui transforment une idée en startup opérationnelle.' },
  { Icon: Brain, title: 'Innover', text: 'Un coach IA analyse les pitchs des porteurs et délivre des conseils personnalisés en continu.' },
  { Icon: Users, title: 'Accompagner', text: 'Mentors, jurys et experts de l’écosystème Medianet aux côtés de chaque équipe.' },
  { Icon: Globe2, title: 'Rayonner', text: 'Un tremplin vers le marché tunisien, africain et international pour les sociétés incubées.' },
]

export default function AProposPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mesh-gradient absolute inset-0" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 text-center">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <div className="mb-6 flex justify-center"><MedianetLogo size="lg" /></div>
            <h1 className="mx-auto max-w-2xl text-3xl font-extrabold leading-tight text-foreground sm:text-4xl"
              style={{ textWrap: 'balance' } as React.CSSProperties}>
              L&apos;e-business tunisien a un incubateur&nbsp;: <span style={{ color: '#00A3E0' }}>Medianet</span>.
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Depuis plus de 20 ans, Medianet conçoit des solutions digitales pour les plus grandes
              entreprises tunisiennes. L&apos;incubateur prolonge cette expertise&nbsp;: détecter,
              former et faire décoller la prochaine génération de startups.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Mission */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-16">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map(({ Icon, title, text }, i) => (
            <motion.div key={title} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.06 }}>
              <MagicCard className="h-full p-5">
                <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mb-1 font-semibold text-foreground">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
              </MagicCard>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Ce que propose l'incubateur */}
      <section className="border-y border-border bg-card">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Un parcours complet, de l&apos;idée au Demo Day</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Chaque programme est un parcours&nbsp;: candidature en ligne, présélection par un jury,
              onboarding, ateliers et mentorat, entraînement au pitch analysé par l&apos;IA, et un
              Demo Day devant l&apos;écosystème. Les porteurs suivent tout depuis leur espace.
            </p>
            <ul className="mt-5 space-y-2.5">
              {[
                'Candidature et suivi 100 % en ligne',
                'Sessions, ateliers et journées organisés dans un parcours clair',
                'Analyse IA des vidéos de pitch, avec conseils personnalisés',
                'Évaluation transparente par des jurys experts',
              ].map((t) => (
                <li key={t} className="flex items-start gap-2 text-sm text-foreground">
                  <Target className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />{t}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link href="/programmes">
                <Button variant="brand" className="gap-1.5">Voir les programmes<ArrowRight className="h-4 w-4" /></Button>
              </Link>
              <Link href="/register"><Button variant="outline">Devenir porteur</Button></Link>
            </div>
          </div>
          <div className="grid content-center gap-4 sm:grid-cols-2">
            {[
              { n: '20+', l: "années d'expertise digitale" },
              { n: '100+', l: 'projets e-business livrés' },
              { n: '10+', l: "programmes d'accompagnement" },
              { n: '1', l: 'écosystème : Medianet' },
            ].map((s) => (
              <div key={s.l} className="rounded-2xl border border-border bg-background p-5 text-center shadow-sm">
                <p className="text-3xl font-extrabold" style={{ color: '#00A3E0' }}>{s.n}</p>
                <p className="mt-1 text-xs text-muted-foreground">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Suivez-nous */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 text-center">
        <h2 className="text-xl font-bold text-foreground">Suivez Medianet</h2>
        <p className="mt-1 text-sm text-muted-foreground">L&apos;actualité de l&apos;incubateur et de ses startups, sur nos réseaux.</p>
        <div className="mt-5 flex justify-center gap-2">
          {SOCIALS.map(({ name, href, Icon }) => (
            <a key={name} href={href} target="_blank" rel="noopener noreferrer" title={name}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-border text-muted-foreground transition-all hover:-translate-y-0.5 hover:border-brand-500 hover:bg-brand-500/10 hover:text-brand-600 dark:hover:text-brand-400">
              <Icon className="h-5 w-5" />
            </a>
          ))}
        </div>
        <div className="brand-stripe mx-auto mt-10 h-1 w-40 rounded-full" />
      </section>

      <SiteFooter />
    </div>
  )
}
