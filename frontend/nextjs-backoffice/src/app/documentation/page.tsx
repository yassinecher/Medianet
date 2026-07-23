'use client'
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  BookOpen, Search, Compass, LayoutDashboard, Sparkles, FolderKanban, FileText,
  CheckSquare, Bell, Users, KeyRound, BarChart3, Building2, Handshake, Home, Tags,
  Trash2, Settings, Presentation, GanttChartSquare, Video, ShieldCheck,
  Image as ImageIcon, Lightbulb, ArrowRight, Globe, Lock,
  Layers, Palette, Type, Users2, Bot, ChevronRight,
} from 'lucide-react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { PageHeader } from '@/components/ui/page-header'
import { cn } from '@/lib/utils'

/* ────────────────────────────────────────────────────────────────────────────
 * Guide & Documentation — an in-app help centre for administrators.
 *
 * Every "screenshot" here is a live interface illustration built from the same
 * design tokens as the real console (the <Shot> component reproduces the sidebar
 * + content area and highlights where the feature lives). They never go stale,
 * are theme-aware, and stay sharp at any zoom — no static images to maintain.
 * ──────────────────────────────────────────────────────────────────────────── */

// The real sidebar, mirrored small so a figure can point to "you are here".
const MINI_NAV = [
  { label: 'Tableau de bord', icon: LayoutDashboard },
  { label: 'Assistant IA', icon: Sparkles },
  { label: 'Programmes', icon: FolderKanban },
  { label: 'Candidatures', icon: FileText },
  { label: 'Tâches', icon: CheckSquare },
  { label: 'Invitations', icon: Bell },
  { label: 'Utilisateurs', icon: Users },
  { label: 'Rôles & permissions', icon: KeyRound },
  { label: 'Rapports', icon: BarChart3 },
  { label: 'Organisations', icon: Building2 },
  { label: 'Partenaires', icon: Handshake },
  { label: 'Page d’accueil', icon: Home },
  { label: 'Référentiels', icon: Tags },
  { label: 'Corbeille', icon: Trash2 },
  { label: 'Paramètres', icon: Settings },
]

// Table-of-contents metadata — drives both the sticky nav and the search filter.
type SectionMeta = { id: string; label: string; icon: typeof BookOpen; group: string; keywords: string }
const SECTIONS: SectionMeta[] = [
  { id: 'intro', label: 'Bien démarrer', icon: Compass, group: 'Général', keywords: 'introduction espace public backoffice connexion login thème sombre clair barre latérale permissions accès' },
  { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard, group: 'Général', keywords: 'kpi indicateurs graphiques entonnoir statistiques pitch vue ensemble' },
  { id: 'ai', label: 'Assistant IA — Medi', icon: Sparkles, group: 'Général', keywords: 'medi ia intelligence artificielle chat rédaction suggestions réglages' },
  { id: 'programmes', label: 'Programmes', icon: FolderKanban, group: 'Programmes', keywords: 'programme créer assistant wizard statut brouillon ouvert archivé onglets' },
  { id: 'parcours', label: 'Parcours & sessions (Gantt)', icon: GanttChartSquare, group: 'Programmes', keywords: 'parcours phases sessions gantt planning imbriquer chevauchement détacher dates historique' },
  { id: 'studio', label: 'Studio de présentation', icon: Presentation, group: 'Programmes', keywords: 'présentation studio canva diapo bloc texte forme image contributeur équipe pagination présenter pptx export import logo' },
  { id: 'pitch', label: 'Journée de présentation & pitchs IA', icon: Video, group: 'Programmes', keywords: 'pitch vidéo présentation jour transcription analyse ia score élocution porteur' },
  { id: 'galleries', label: 'Galeries en images', icon: ImageIcon, group: 'Programmes', keywords: 'galerie image photo souvenir session programme retour' },
  { id: 'candidatures', label: 'Candidatures', icon: FileText, group: 'Sélection', keywords: 'candidature dossier revue évaluation critères score ia accepter rejeter jury' },
  { id: 'tasks', label: 'Tâches', icon: CheckSquare, group: 'Sélection', keywords: 'tâche todo assignation échéance retard suivi' },
  { id: 'invitations', label: 'Invitations', icon: Bell, group: 'Sélection', keywords: 'invitation inviter porteur mentor juré lien suivi modèle email' },
  { id: 'users', label: 'Utilisateurs', icon: Users, group: 'Administration', keywords: 'utilisateur compte créer éditer rôle permission activer désactiver' },
  { id: 'roles', label: 'Rôles & permissions', icon: KeyRound, group: 'Administration', keywords: 'rôle permission matrice héritage scope sse temps réel rbac dynamique' },
  { id: 'reports', label: 'Rapports', icon: BarChart3, group: 'Administration', keywords: 'rapport analytique statistique export données' },
  { id: 'organizations', label: 'Organisations & sociétés incubées', icon: Building2, group: 'Vitrine', keywords: 'organisation société incubée entreprise vitrine showcase public' },
  { id: 'partners', label: 'Partenaires', icon: Handshake, group: 'Vitrine', keywords: 'partenaire sponsor logo visibilité public' },
  { id: 'landing', label: 'Page d’accueil', icon: Home, group: 'Vitrine', keywords: 'page accueil landing site public éditeur bannière' },
  { id: 'catalogs', label: 'Référentiels', icon: Tags, group: 'Administration', keywords: 'référentiel catalogue type session taxonomie ajout rapide liste' },
  { id: 'trash', label: 'Corbeille & sauvegarde', icon: Trash2, group: 'Administration', keywords: 'corbeille supprimé restaurer purge sauvegarde export backup' },
  { id: 'settings', label: 'Paramètres', icon: Settings, group: 'Administration', keywords: 'paramètre profil préférence mot de passe compte' },
]

export default function DocumentationPage() {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState('intro')
  const q = query.trim().toLowerCase()

  const visible = useMemo(
    () => SECTIONS.filter((s) => !q || (s.label + ' ' + s.keywords).toLowerCase().includes(q)),
    [q],
  )
  const visibleIds = useMemo(() => new Set(visible.map((s) => s.id)), [visible])

  // Scroll-spy: highlight the TOC entry of the section currently in view.
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (top) setActive(top.target.id)
      },
      { rootMargin: '-96px 0px -70% 0px', threshold: 0 },
    )
    SECTIONS.forEach((s) => { const el = document.getElementById(s.id); if (el) obs.observe(el) })
    return () => obs.disconnect()
  }, [q])

  const groups = useMemo(() => {
    const m = new Map<string, SectionMeta[]>()
    visible.forEach((s) => { const a = m.get(s.group) ?? []; a.push(s); m.set(s.group, a) })
    return Array.from(m.entries())
  }, [visible])

  const go = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <PageHeader
          icon={BookOpen}
          title="Guide & Documentation"
          description="Tout ce que vous pouvez faire dans la console — expliqué pas à pas, avec des repères visuels de l’interface."
        />

        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          {/* ── Sticky table of contents ─────────────────────────────────── */}
          <aside className="lg:sticky lg:top-2 lg:self-start">
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher dans le guide…"
                className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-brand-500"
              />
            </div>
            <nav className="max-h-[calc(100vh-11rem)] space-y-3 overflow-y-auto pr-1">
              {groups.length === 0 && (
                <p className="px-2 py-1 text-xs text-muted-foreground">Aucune rubrique ne correspond à « {query} ».</p>
              )}
              {groups.map(([group, items]) => (
                <div key={group}>
                  <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group}</p>
                  <div className="space-y-0.5">
                    {items.map((s) => {
                      const Icon = s.icon
                      const on = active === s.id
                      return (
                        <button key={s.id} onClick={() => go(s.id)}
                          className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors',
                            on ? 'bg-brand-500/10 font-medium text-brand-600 dark:text-brand-400' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}>
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{s.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </aside>

          {/* ── Content ──────────────────────────────────────────────────── */}
          <div className="min-w-0 space-y-10">
            {(!q || visibleIds.has('intro')) && <Intro />}
            {(!q || visibleIds.has('dashboard')) && <DashboardDoc />}
            {(!q || visibleIds.has('ai')) && <AiDoc />}
            {(!q || visibleIds.has('programmes')) && <ProgrammesDoc />}
            {(!q || visibleIds.has('parcours')) && <ParcoursDoc />}
            {(!q || visibleIds.has('studio')) && <StudioDoc />}
            {(!q || visibleIds.has('pitch')) && <PitchDoc />}
            {(!q || visibleIds.has('galleries')) && <GalleriesDoc />}
            {(!q || visibleIds.has('candidatures')) && <CandidaturesDoc />}
            {(!q || visibleIds.has('tasks')) && <TasksDoc />}
            {(!q || visibleIds.has('invitations')) && <InvitationsDoc />}
            {(!q || visibleIds.has('users')) && <UsersDoc />}
            {(!q || visibleIds.has('roles')) && <RolesDoc />}
            {(!q || visibleIds.has('reports')) && <ReportsDoc />}
            {(!q || visibleIds.has('organizations')) && <OrganizationsDoc />}
            {(!q || visibleIds.has('partners')) && <PartnersDoc />}
            {(!q || visibleIds.has('landing')) && <LandingDoc />}
            {(!q || visibleIds.has('catalogs')) && <CatalogsDoc />}
            {(!q || visibleIds.has('trash')) && <TrashDoc />}
            {(!q || visibleIds.has('settings')) && <SettingsDoc />}

            <p className="border-t border-border pt-6 text-center text-xs text-muted-foreground">
              Medianet Incubateur · Console d’administration — les illustrations reproduisent l’interface réelle de façon simplifiée.
            </p>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Reusable building blocks
 * ═══════════════════════════════════════════════════════════════════════════ */

function Section({ id, icon: Icon, title, lead, children }: {
  id: string; icon: typeof BookOpen; title: string; lead: string; children: React.ReactNode
}) {
  return (
    <motion.section id={id} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.35 }}
      className="scroll-mt-6 space-y-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500/15 to-purple-500/15 text-brand-600 dark:text-brand-400">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-xl font-bold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">{lead}</p>
        </div>
      </div>
      {children}
    </motion.section>
  )
}

/** A live interface illustration: mini console with the sidebar + a content area. */
function Shot({ active, path, caption, children }: {
  active: string; path: string; caption?: string; children: React.ReactNode
}) {
  return (
    <figure className="overflow-hidden rounded-xl border border-border bg-card shadow-lg">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 border-b border-border bg-muted/60 px-3 py-2">
        <span className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
        </span>
        <span className="ml-2 flex-1 truncate rounded-md bg-background px-2 py-1 text-[10px] text-muted-foreground">
          medianetincubatoradmin.duckdns.org{path}
        </span>
      </div>
      {/* App body */}
      <div className="flex min-h-[220px] text-[11px]">
        {/* Mini sidebar */}
        <div className="hidden w-40 shrink-0 flex-col border-r border-border bg-card sm:flex">
          <div className="flex items-center gap-2 border-b border-border px-2.5 py-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-brand-500 to-purple-600">
              <ShieldCheck className="h-3 w-3 text-white" />
            </span>
            <span className="text-[10px] font-bold">Admin Console</span>
          </div>
          <div className="flex-1 space-y-0.5 overflow-hidden p-1.5">
            {MINI_NAV.map((n) => {
              const on = n.label === active
              const Icon = n.icon
              return (
                <div key={n.label}
                  className={cn('flex items-center gap-1.5 rounded-md px-2 py-1',
                    on ? 'bg-brand-500/15 font-semibold text-brand-600 dark:text-brand-400' : 'text-muted-foreground')}>
                  <Icon className="h-3 w-3 shrink-0" />
                  <span className="truncate text-[10px]">{n.label}</span>
                </div>
              )
            })}
          </div>
        </div>
        {/* Content */}
        <div className="min-w-0 flex-1 bg-background p-3">{children}</div>
      </div>
      {caption && <figcaption className="border-t border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">{caption}</figcaption>}
    </figure>
  )
}

/** Small circled step/callout number. */
function Num({ n }: { n: number }) {
  return (
    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[11px] font-bold text-white">{n}</span>
  )
}

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="space-y-2.5">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3 text-sm text-foreground">
          <Num n={i + 1} />
          <span className="pt-0.5 leading-relaxed text-muted-foreground [&_b]:font-semibold [&_b]:text-foreground">{it}</span>
        </li>
      ))}
    </ol>
  )
}

function CanDo({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-2 rounded-lg border border-border bg-card p-2.5 text-sm text-muted-foreground">
          <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
          <span className="[&_b]:font-semibold [&_b]:text-foreground">{it}</span>
        </li>
      ))}
    </ul>
  )
}

function Tip({ children, tone = 'tip' }: { children: React.ReactNode; tone?: 'tip' | 'warn' }) {
  const warn = tone === 'warn'
  return (
    <div className={cn('flex items-start gap-2.5 rounded-lg border p-3 text-sm',
      warn ? 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200'
           : 'border-brand-500/30 bg-brand-500/10 text-brand-800 dark:text-brand-200')}>
      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="[&_b]:font-semibold">{children}</div>
    </div>
  )
}

/** Small heading used inside a section for a labelled block ("Ce que vous pouvez faire", etc.). */
function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </div>
  )
}

// Tiny UI primitives to compose the mock content inside <Shot>.
const Pill = ({ children, tone = 'slate' }: { children: React.ReactNode; tone?: string }) => {
  const map: Record<string, string> = {
    slate: 'bg-muted text-muted-foreground', green: 'bg-green-500/15 text-green-600 dark:text-green-400',
    amber: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', blue: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    brand: 'bg-brand-500/15 text-brand-600 dark:text-brand-400', red: 'bg-red-500/15 text-red-600 dark:text-red-400',
  }
  return <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-semibold', map[tone])}>{children}</span>
}
const Btn = ({ children, solid }: { children: React.ReactNode; solid?: boolean }) => (
  <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium',
    solid ? 'bg-brand-500 text-white' : 'border border-border bg-card text-foreground')}>{children}</span>
)
const Bar = ({ w = 'full', h = 2 }: { w?: string; h?: number }) => (
  <div className={cn('rounded-full bg-muted', w === 'full' ? 'w-full' : '')} style={{ height: h * 4, width: w !== 'full' ? w : undefined }} />
)
const MiniCard = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('rounded-lg border border-border bg-card p-2', className)}>{children}</div>
)

/* ═══════════════════════════════════════════════════════════════════════════
 * Sections
 * ═══════════════════════════════════════════════════════════════════════════ */

function Intro() {
  return (
    <Section id="intro" icon={Compass} title="Bien démarrer" lead="La plateforme Medianet Incubateur, en deux minutes.">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Medianet Incubateur repose sur <b className="text-foreground">deux sites complémentaires</b>. Vous, l’administrateur,
        travaillez dans la <b className="text-foreground">Console d’administration</b> ; les porteurs de projets, mentors et jurés
        utilisent l’<b className="text-foreground">Espace public</b>. Tout ce que vous publiez ou validez ici apparaît, en temps réel,
        du côté public.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <Globe className="h-4 w-4 text-brand-500" />
            <h3 className="text-sm font-semibold">Espace public (front-office)</h3>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Le site vitrine : programmes ouverts, page d’accueil, sociétés incubées, partenaires. Les porteurs y candidatent,
            suivent leur parcours et déposent leurs pitchs vidéo.
          </p>
          <p className="mt-2 truncate text-[11px] text-muted-foreground">🔗 medianetincubator.duckdns.org</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <Lock className="h-4 w-4 text-brand-500" />
            <h3 className="text-sm font-semibold">Console d’administration (back-office)</h3>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            L’espace réservé où vous gérez tout : programmes, candidatures, utilisateurs, présentations, rapports… C’est le site
            dans lequel vous êtes actuellement.
          </p>
          <p className="mt-2 truncate text-[11px] text-muted-foreground">🔗 medianetincubatoradmin.duckdns.org</p>
        </div>
      </div>

      <Shot active="Tableau de bord" path="/dashboard" caption="La barre latérale (à gauche) regroupe tous les modules. Le contenu s’affiche à droite.">
        <div className="flex items-center gap-2">
          <Num n={1} /><span className="text-[11px] font-medium">La barre latérale liste vos modules</span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Num n={2} /><span className="text-[11px] font-medium">En haut à droite : thème clair/sombre et votre compte</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {['Programmes', 'Candidatures', 'Utilisateurs'].map((t) => (
            <MiniCard key={t}><p className="text-[9px] text-muted-foreground">{t}</p><p className="text-sm font-bold">128</p></MiniCard>
          ))}
        </div>
      </Shot>

      <Block title="Les bases à connaître">
        <CanDo items={[
          <>La <b>barre latérale</b> ne montre que les modules auxquels vous avez droit — elle s’adapte à vos permissions.</>,
          <>Le bouton <b>soleil / lune</b> en haut à droite bascule entre thème clair et sombre.</>,
          <>Chaque module en <b>rouge « Accès refusé »</b> signifie qu’il vous manque une permission — voir <a href="#roles" className="text-brand-600 underline dark:text-brand-400">Rôles &amp; permissions</a>.</>,
          <>Les modifications sont <b>enregistrées immédiatement</b> ; pas de bouton « sauvegarder » global.</>,
        ]} />
      </Block>

      <Tip>
        <b>Astuce :</b> utilisez la barre de recherche du guide (en haut à gauche) pour trouver instantanément la rubrique
        qui vous intéresse — tapez par exemple « pitch », « permission » ou « présentation ».
      </Tip>
    </Section>
  )
}

function DashboardDoc() {
  return (
    <Section id="dashboard" icon={LayoutDashboard} title="Tableau de bord" lead="Votre vue d’ensemble, mise à jour en direct.">
      <Shot active="Tableau de bord" path="/dashboard" caption="Indicateurs clés, courbe d’activité, entonnoir de sélection et analytique des pitchs.">
        <div className="grid grid-cols-4 gap-2">
          {[['Programmes', '12'], ['Candidatures', '340'], ['Utilisateurs', '512'], ['Acceptation', '38%']].map(([l, v]) => (
            <MiniCard key={l}><p className="text-[9px] text-muted-foreground">{l}</p><p className="text-base font-bold">{v}</p></MiniCard>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <MiniCard className="col-span-2"><p className="mb-1 text-[9px] text-muted-foreground">Activité — 6 mois</p><div className="flex h-14 items-end gap-1">{[6, 9, 5, 11, 8, 13].map((h, i) => <div key={i} className="flex-1 rounded-sm bg-brand-500/60" style={{ height: h * 4 }} />)}</div></MiniCard>
          <MiniCard><p className="mb-1 text-[9px] text-muted-foreground">Statuts</p><div className="mx-auto h-12 w-12 rounded-full border-[6px] border-brand-500/70 border-t-green-500" /></MiniCard>
        </div>
      </Shot>
      <Block title="Ce que vous y trouvez">
        <CanDo items={[
          <><b>Indicateurs clés</b> cliquables : programmes, candidatures, utilisateurs, taux d’acceptation.</>,
          <>Une <b>courbe d’activité</b> sur 3, 6 ou 12 mois (candidatures, inscriptions, invitations).</>,
          <>L’<b>entonnoir de sélection</b> : où les candidats abandonnent entre soumission et acceptation.</>,
          <>L’<b>analytique des pitchs vidéo</b> : nombre analysé, score moyen, meilleur score.</>,
          <>Un <b>bandeau d’alertes</b> : candidatures à traiter, tâches en retard, sessions à venir.</>,
          <>Les <b>dernières candidatures</b> reçues, en accès direct.</>,
        ]} />
      </Block>
      <Tip><b>Astuce :</b> chaque carte est un raccourci. Cliquez sur « Candidatures à traiter » pour aller droit au travail en attente.</Tip>
    </Section>
  )
}

function AiDoc() {
  return (
    <Section id="ai" icon={Sparkles} title="Assistant IA — Medi" lead="Un copilote qui rédige, résume et suggère à votre place.">
      <Shot active="Assistant IA" path="/ai-assistant" caption="Medi vous aide à rédiger descriptions, e-mails, critères… partout où l’étincelle ✨ apparaît.">
        <div className="rounded-lg border border-border bg-card p-2">
          <div className="mb-2 flex items-center gap-1.5"><Bot className="h-3.5 w-3.5 text-brand-500" /><span className="text-[10px] font-semibold">Medi</span></div>
          <div className="ml-auto mb-1.5 w-4/5 rounded-lg rounded-br-none bg-brand-500 px-2 py-1 text-[9px] text-white">Rédige la description d’un programme Agritech de 6 mois</div>
          <div className="mb-1 w-11/12 rounded-lg rounded-bl-none bg-muted px-2 py-1 text-[9px] text-muted-foreground">Voici une proposition : « Ce programme accompagne les startups… »</div>
          <div className="mt-2 flex gap-1"><Btn><Sparkles className="h-2.5 w-2.5" />Insérer</Btn><Btn>Reformuler</Btn></div>
        </div>
      </Shot>
      <Block title="Ce que vous pouvez faire">
        <CanDo items={[
          <>Discuter avec <b>Medi</b> pour obtenir des idées, des plans ou des textes prêts à coller.</>,
          <>Cliquer sur l’icône <b>étincelle ✨</b> à côté d’un champ (description, e-mail, critère) pour <b>générer ou améliorer</b> le texte.</>,
          <>Demander à Medi de <b>résumer</b> une candidature ou de <b>suggérer des critères</b> d’évaluation.</>,
          <>Régler le comportement de l’assistant dans <b>Assistant IA → Réglages</b>.</>,
        ]} />
      </Block>
      <Tip><b>Bon à savoir :</b> Medi propose, vous disposez. Rien n’est envoyé ni publié sans votre validation — vous relisez toujours avant d’insérer.</Tip>
    </Section>
  )
}

function ProgrammesDoc() {
  return (
    <Section id="programmes" icon={FolderKanban} title="Programmes" lead="Le cœur de la plateforme : créer et piloter vos programmes d’incubation.">
      <Shot active="Programmes" path="/programmes" caption="La liste des programmes, avec leur statut. Bouton « Nouveau programme » en haut à droite.">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold">Programmes</span>
          <Btn solid><FolderKanban className="h-2.5 w-2.5" />Nouveau programme</Btn>
        </div>
        <div className="space-y-1.5">
          {[['Incubation Tech 2026', 'green', 'Ouvert'], ['FoodStart', 'blue', 'En cours'], ['Agritech (brouillon)', 'slate', 'Brouillon']].map(([t, c, s]) => (
            <div key={t} className="flex items-center justify-between rounded-lg border border-border bg-card px-2 py-1.5">
              <span className="text-[10px] font-medium">{t}</span><Pill tone={c}>{s}</Pill>
            </div>
          ))}
        </div>
      </Shot>

      <Block title="Le cycle de vie d’un programme">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <Pill tone="slate">Brouillon</Pill><ChevronRight className="h-3 w-3 text-muted-foreground" />
          <Pill tone="green">Ouvert</Pill><ChevronRight className="h-3 w-3 text-muted-foreground" />
          <Pill tone="blue">En cours</Pill><ChevronRight className="h-3 w-3 text-muted-foreground" />
          <Pill tone="amber">Fermé</Pill><ChevronRight className="h-3 w-3 text-muted-foreground" />
          <Pill tone="red">Archivé</Pill>
        </div>
        <p className="text-sm text-muted-foreground">
          Seuls les programmes <b className="text-foreground">Ouverts</b> et <b className="text-foreground">En cours</b> sont visibles sur le site public.
          Un <b className="text-foreground">Brouillon</b> reste privé tant que vous ne l’ouvrez pas.
        </p>
      </Block>

      <Block title="Créer un programme — pas à pas">
        <Steps items={[
          <>Cliquez sur <b>Nouveau programme</b> : l’<b>assistant de création</b> s’ouvre.</>,
          <>Renseignez les <b>informations</b> (titre, description, dates, capacité) — l’étincelle ✨ de Medi peut rédiger pour vous.</>,
          <>Construisez le <b>formulaire de candidature</b> (glisser-déposer des champs).</>,
          <>Choisissez la <b>visibilité</b> : publique (tout le monde peut candidater) ou privée sur invitation.</>,
          <>Validez : le programme est créé en <b>Brouillon</b>. Ouvrez-le quand vous êtes prêt à recevoir des candidatures.</>,
        ]} />
        <Tip>L’assistant est <b>reprenable</b> : si vous quittez avant la fin, vous retrouvez votre brouillon dans la liste et reprenez là où vous vous étiez arrêté.</Tip>
      </Block>

      <Block title="Piloter un programme — ses onglets">
        <p className="text-sm text-muted-foreground">En ouvrant un programme, vous accédez à cinq groupes d’onglets :</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            ['Vue d’ensemble', 'Tableau de bord du programme + Informations éditables'],
            ['Candidatures', 'Dossiers reçus, Critères d’évaluation, Évaluations du jury'],
            ['Parcours', 'Sessions (planning Gantt), Tâches, Présentations'],
            ['Personnes', 'Participants, Invitations, Partenaires du programme'],
            ['Rapports', 'Statistiques propres à ce programme'],
          ].map(([t, d]) => (
            <div key={t} className="rounded-lg border border-border bg-card p-2.5">
              <p className="text-xs font-semibold text-foreground">{t}</p>
              <p className="text-[11px] text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">Les rubriques <a href="#parcours" className="text-brand-600 underline dark:text-brand-400">Parcours &amp; sessions</a>, <a href="#studio" className="text-brand-600 underline dark:text-brand-400">Studio de présentation</a> et <a href="#pitch" className="text-brand-600 underline dark:text-brand-400">pitchs IA</a> ci-dessous détaillent les fonctions les plus riches.</p>
      </Block>
    </Section>
  )
}

function ParcoursDoc() {
  return (
    <Section id="parcours" icon={GanttChartSquare} title="Parcours & sessions (planning Gantt)" lead="Organisez le déroulé du programme sur une frise chronologique.">
      <Shot active="Programmes" path="/programmes/12?tab=phases" caption="Le planning Gantt : chaque barre est une session, imbriquée dans sa phase.">
        <div className="space-y-1.5">
          <div className="flex items-center gap-1 text-[9px] text-muted-foreground"><span className="w-20">Phase</span><span>Sem 1</span><span>Sem 2</span><span>Sem 3</span><span>Sem 4</span></div>
          {[['Onboarding', 'brand', '10%', '30%'], ['Mentorat', 'green', '35%', '45%'], ['Pitch final', 'purple', '78%', '18%']].map(([l, c, left, w], i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-20 truncate text-[9px]">{l}</span>
              <div className="relative h-4 flex-1 rounded bg-muted">
                <div className="absolute top-0 h-4 rounded bg-brand-500/70" style={{ left: left as string, width: w as string }} />
              </div>
            </div>
          ))}
        </div>
      </Shot>
      <Block title="Ce que vous pouvez faire">
        <CanDo items={[
          <>Créer des <b>phases</b> et y placer des <b>sessions</b> (ateliers, mentorats, jurys…).</>,
          <><b>Glisser une session sur une autre</b> pour l’imbriquer automatiquement à l’intérieur.</>,
          <><b>Détacher</b> une session de sa phase parente sans erreur de chevauchement.</>,
          <>Ajuster les <b>dates</b> et durées directement sur la frise — les jours s’affichent clairement.</>,
          <>Attacher à chaque session des <b>critères</b>, une <b>galerie</b>, une <b>présentation</b> ou une <b>analyse vidéo</b>.</>,
          <>Consulter l’<b>historique des modifications</b> (compte + adresse IP + ce qui a changé).</>,
        ]} />
      </Block>
      <Block title="Après une modification importante">
        <Steps items={[
          <>Quand vous modifiez une session déjà planifiée, la console vous <b>propose de prévenir les personnes concernées</b>.</>,
          <>Un <b>assistant de notification</b> s’ouvre : il regroupe les destinataires <b>par rôle</b> (porteurs, mentors, jurés…).</>,
          <>Chaque e-mail est <b>modifiable</b> et affiché en <b>aperçu</b> avant envoi — rôle par rôle.</>,
          <>Vous validez, et seuls les destinataires <b>réellement liés</b> à la session reçoivent le message.</>,
        ]} />
      </Block>
      <Tip><b>Corbeille :</b> une session supprimée n’est pas perdue — elle part dans la <a href="#trash" className="text-brand-600 underline dark:text-brand-400">Corbeille</a> et peut être restaurée.</Tip>
    </Section>
  )
}

function StudioDoc() {
  return (
    <Section id="studio" icon={Presentation} title="Studio de présentation" lead="Un éditeur type Canva, intégré, pour créer les présentations du programme.">
      <Shot active="Programmes" path="/programmes/12/presentation" caption="Édition d’une diapo : barre d’outils à gauche, diapo au centre, liste des diapos en dessous.">
        <div className="flex gap-2">
          <div className="flex w-8 flex-col gap-1">
            {[Type, Layers, Palette, ImageIcon, Users2].map((I, i) => <div key={i} className="flex h-6 items-center justify-center rounded-md border border-border bg-card"><I className="h-3 w-3 text-muted-foreground" /></div>)}
          </div>
          <div className="flex-1">
            <div className="aspect-video rounded-lg border border-border bg-card p-2">
              <div className="mb-1 h-3 w-2/3 rounded bg-brand-500/60" />
              <Bar w="80%" /><div className="h-1" /><Bar w="55%" />
              <div className="mt-2 flex gap-1"><div className="h-6 w-6 rounded bg-purple-500/40" /><div className="h-6 w-10 rounded bg-green-500/30" /></div>
            </div>
            <div className="mt-1.5 flex gap-1">{[1, 2, 3].map((n) => <div key={n} className={cn('aspect-video w-10 rounded border', n === 1 ? 'border-brand-500' : 'border-border')} />)}</div>
          </div>
        </div>
      </Shot>
      <Block title="Ce que vous pouvez faire">
        <CanDo items={[
          <>Ajouter et disposer des <b>blocs</b> : titres, textes, formes, images, logos.</>,
          <>Mettre en forme le <b>texte</b> : police, taille, couleur, gras, alignement.</>,
          <>Puiser dans une <b>galerie de formes</b> (rectangle, cercle, ligne, flèche, étoile, triangle).</>,
          <><b>Téléverser des images</b> ou les choisir dans les galeries du programme (fini les URL).</>,
          <>Régler par bloc la <b>bordure</b> (couleur, épaisseur), le <b>fond</b> (couleur ou image) et l’<b>ordre</b> (avancer/reculer).</>,
          <><b>Redimensionner</b> un bloc sans déformer le texte ; annuler/rétablir avec <b>Ctrl+Z / Ctrl+Y</b>.</>,
          <>Gérer les <b>diapos</b> : ajouter, dupliquer, réordonner, supprimer, fond par diapo.</>,
          <>Ajouter les <b>contributeurs</b> par rôle (jurés, mentors…) avec photo, et une <b>diapo par équipe</b>.</>,
          <>Configurer la <b>pagination</b> : à partir de quelle diapo et à partir de quel numéro.</>,
          <><b>Présenter</b> en plein écran (flèches / espace, sans panneau de navigation).</>,
          <><b>Exporter en PowerPoint (PPTX)</b> ou <b>importer depuis Canva</b> en un clic.</>,
        ]} />
      </Block>
      <Block title="Créer une présentation — pas à pas">
        <Steps items={[
          <>Dans un programme, ouvrez l’onglet <b>Présentations</b> puis <b>Nouvelle présentation</b>.</>,
          <>L’<b>assistant</b> vous demande quoi mettre ; <b>Medi</b> propose idées, paragraphes et corrections.</>,
          <>Composez vos diapos avec la barre d’outils : texte, formes, images, contributeurs.</>,
          <>Réordonnez les diapos et réglez la pagination selon vos besoins.</>,
          <>Cliquez sur <b>Présenter</b> pour le plein écran, ou <b>Exporter</b> pour un fichier PPTX.</>,
        ]} />
      </Block>
      <Tip><b>Un programme peut contenir plusieurs présentations.</b> Chacune est enregistrée automatiquement au fil de vos modifications.</Tip>
    </Section>
  )
}

function PitchDoc() {
  return (
    <Section id="pitch" icon={Video} title="Journée de présentation & pitchs IA" lead="Les porteurs déposent des vidéos ; l’IA les transcrit et les analyse.">
      <Shot active="Programmes" path="/programmes/12?tab=phases" caption="Un pitch analysé : lecteur vidéo, transcription synchronisée et panneaux de score IA.">
        <div className="grid grid-cols-2 gap-2">
          <div className="aspect-video rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 p-2"><Video className="h-4 w-4 text-white/70" /></div>
          <div className="space-y-1">
            <MiniCard><p className="text-[9px] text-muted-foreground">Score global</p><p className="text-base font-bold text-green-600 dark:text-green-400">7,8<span className="text-[9px] text-muted-foreground"> / 10</span></p></MiniCard>
            <div className="flex gap-1"><Pill tone="blue">Élocution</Pill><Pill tone="green">Contenu</Pill><Pill tone="amber">Présence</Pill></div>
          </div>
        </div>
      </Shot>
      <Block title="Comment ça marche">
        <CanDo items={[
          <>Cochez <b>« analyse vidéo »</b> sur n’importe quelle session pour activer le dépôt de pitch.</>,
          <>Les porteurs déposent des <b>vidéos d’entraînement</b> (plusieurs) puis un <b>pitch final</b> (unique).</>,
          <>La vidéo est <b>transcrite automatiquement</b>, puis notée par l’IA (élocution, contenu, présence).</>,
          <>Vous suivez les <b>étapes de l’analyse en direct</b> et consultez transcription + conseils.</>,
          <>L’IA <b>signale</b> une vidéo hors-sujet (pas un pitch, aucune personne visible).</>,
          <>Vous fixez le <b>nombre maximum d’analyses d’entraînement</b> par session.</>,
        ]} />
      </Block>
      <Tip tone="warn"><b>Prérequis technique :</b> le service de traitement vidéo (MinIO + transcription) doit tourner côté serveur pour que le dépôt et l’analyse fonctionnent.</Tip>
    </Section>
  )
}

function GalleriesDoc() {
  return (
    <Section id="galleries" icon={ImageIcon} title="Galeries en images" lead="Un « retour en images » pour chaque session et pour le programme.">
      <Shot active="Programmes" path="/programmes/12?tab=phases" caption="Ajoutez des photos à une session ou au programme ; elles s’affichent côté public.">
        <div className="grid grid-cols-4 gap-1.5">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <div key={i} className="aspect-square rounded-md bg-gradient-to-br from-brand-500/20 to-purple-500/20" />)}
        </div>
      </Shot>
      <Block title="Ce que vous pouvez faire">
        <CanDo items={[
          <>Constituer une <b>galerie par session</b> (photos de l’atelier, du jury…).</>,
          <>Constituer une <b>galerie du programme</b> — le « retour en images » global.</>,
          <>Ces images alimentent automatiquement les <b>pages publiques</b> correspondantes.</>,
          <>Réutiliser ces images dans le <a href="#studio" className="text-brand-600 underline dark:text-brand-400">Studio de présentation</a>.</>,
        ]} />
      </Block>
    </Section>
  )
}

function CandidaturesDoc() {
  return (
    <Section id="candidatures" icon={FileText} title="Candidatures" lead="Recevoir, évaluer et décider — avec l’aide du scoring IA.">
      <Shot active="Candidatures" path="/candidatures" caption="Chaque dossier affiche son statut. Ouvrez-le pour l’évaluer et décider.">
        <div className="space-y-1.5">
          {[['Projet Solaris', 'amber', 'En attente'], ['GreenFarm', 'blue', 'En évaluation'], ['MedTrack', 'green', 'Acceptée']].map(([t, c, s]) => (
            <div key={t} className="flex items-center justify-between rounded-lg border border-border bg-card px-2 py-1.5">
              <div><p className="text-[10px] font-medium">{t}</p><p className="text-[9px] text-muted-foreground">Incubation Tech 2026</p></div>
              <Pill tone={c}>{s}</Pill>
            </div>
          ))}
        </div>
      </Shot>
      <Block title="Ce que vous pouvez faire">
        <CanDo items={[
          <>Parcourir toutes les candidatures et <b>filtrer</b> par programme ou statut.</>,
          <>Ouvrir un <b>dossier complet</b> : réponses au formulaire, pièces jointes, porteur.</>,
          <>Évaluer selon les <b>critères</b> du programme et consulter le <b>score IA</b> suggéré.</>,
          <>Voir les <b>évaluations du jury</b> agrégées.</>,
          <><b>Accepter</b> ou <b>rejeter</b> — le porteur est notifié et, s’il est accepté, rejoint le parcours.</>,
        ]} />
      </Block>
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <Pill tone="amber">En attente</Pill><ArrowRight className="h-3 w-3 text-muted-foreground" />
        <Pill tone="blue">En évaluation</Pill><ArrowRight className="h-3 w-3 text-muted-foreground" />
        <Pill tone="green">Acceptée</Pill><span className="text-muted-foreground">ou</span><Pill tone="red">Rejetée</Pill>
      </div>
    </Section>
  )
}

function TasksDoc() {
  return (
    <Section id="tasks" icon={CheckSquare} title="Tâches" lead="Le suivi opérationnel, par programme.">
      <Shot active="Tâches" path="/tasks" caption="Des tâches assignables, avec échéance ; les retards remontent au tableau de bord.">
        <div className="space-y-1.5">
          {[['Préparer le kit mentor', true, 'green'], ['Réserver la salle du jury', false, 'amber'], ['Relancer 3 porteurs', false, 'red']].map(([t, done, c], i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5">
              <span className={cn('flex h-3.5 w-3.5 items-center justify-center rounded border', done ? 'border-green-500 bg-green-500' : 'border-border')}>{done ? <CheckSquare className="h-2.5 w-2.5 text-white" /> : null}</span>
              <span className={cn('flex-1 text-[10px]', done && 'text-muted-foreground line-through')}>{t as string}</span>
              <Pill tone={c as string}>{c === 'red' ? 'En retard' : c === 'green' ? 'Faite' : 'À faire'}</Pill>
            </div>
          ))}
        </div>
      </Shot>
      <Block title="Ce que vous pouvez faire">
        <CanDo items={[
          <>Créer des tâches, les <b>assigner</b> et fixer une <b>échéance</b>.</>,
          <>Suivre l’avancement et voir d’un coup d’œil les <b>tâches en retard</b>.</>,
          <>Gérer les tâches d’un programme depuis son onglet <b>Tâches</b>, ou globalement depuis le module.</>,
        ]} />
      </Block>
    </Section>
  )
}

function InvitationsDoc() {
  return (
    <Section id="invitations" icon={Bell} title="Invitations" lead="Inviter porteurs, mentors et jurés — et suivre qui a répondu.">
      <Shot active="Invitations" path="/notifications" caption="Composez une invitation, choisissez le rôle, envoyez ; le lien de suivi trace l’ouverture.">
        <div className="rounded-lg border border-border bg-card p-2">
          <div className="mb-1.5 flex items-center gap-1.5"><Bell className="h-3 w-3 text-brand-500" /><span className="text-[10px] font-semibold">Nouvelle invitation</span></div>
          <div className="flex gap-1"><Pill tone="brand">Mentor</Pill><Pill>Juré</Pill><Pill>Porteur</Pill></div>
          <div className="mt-2 space-y-1"><Bar w="90%" /><Bar w="70%" /></div>
          <div className="mt-2 flex justify-end"><Btn solid>Envoyer</Btn></div>
        </div>
      </Shot>
      <Block title="Ce que vous pouvez faire">
        <CanDo items={[
          <>Inviter par e-mail avec un <b>rôle</b> pré-attribué (mentor, juré, porteur…).</>,
          <>Utiliser un <b>modèle</b> personnalisable pour le message.</>,
          <>Suivre l’état via un <b>lien de suivi</b> : envoyée, ouverte, acceptée.</>,
          <>Envoyer des <b>invitations privées</b> à un programme sur invitation.</>,
        ]} />
      </Block>
      <Tip><b>À distinguer :</b> ce module gère les invitations. Les notifications automatiques après une modification de session passent par l’<a href="#parcours" className="text-brand-600 underline dark:text-brand-400">assistant de notification</a> du planning.</Tip>
    </Section>
  )
}

function UsersDoc() {
  return (
    <Section id="users" icon={Users} title="Utilisateurs" lead="Gérer les comptes et ce à quoi chacun a accès.">
      <Shot active="Utilisateurs" path="/users" caption="La liste des comptes ; ouvrez-en un pour changer ses rôles et permissions.">
        <div className="space-y-1.5">
          {[['Yassine Cherni', 'Administrateur', 'green'], ['Sonia B.', 'Mentor', 'blue'], ['Karim T.', 'Juré', 'brand']].map(([n, r, c]) => (
            <div key={n} className="flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[9px] font-bold">{(n as string).split(' ').map((x) => x[0]).join('')}</span>
              <span className="flex-1 text-[10px] font-medium">{n}</span><Pill tone={c as string}>{r}</Pill>
            </div>
          ))}
        </div>
      </Shot>
      <Block title="Ce que vous pouvez faire">
        <CanDo items={[
          <><b>Créer</b>, <b>modifier</b> ou <b>désactiver</b> un compte.</>,
          <>Attribuer un ou plusieurs <b>rôles</b> à un utilisateur.</>,
          <>Accorder des <b>permissions individuelles</b> en plus de ses rôles (accès sur-mesure).</>,
          <>Voir immédiatement l’effet : les droits se propagent <b>en temps réel</b> (voir <a href="#roles" className="text-brand-600 underline dark:text-brand-400">Rôles</a>).</>,
        ]} />
      </Block>
    </Section>
  )
}

function RolesDoc() {
  return (
    <Section id="roles" icon={KeyRound} title="Rôles & permissions" lead="Le système de droits : rôles sur-mesure, matrice de permissions, mise à jour en direct.">
      <Shot active="Rôles & permissions" path="/roles" caption="Une matrice coche par coche : chaque rôle voit et fait exactement ce que vous autorisez.">
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="grid grid-cols-4 bg-muted/60 text-[9px] font-semibold"><span className="p-1.5">Module</span><span className="p-1.5 text-center">Voir</span><span className="p-1.5 text-center">Créer</span><span className="p-1.5 text-center">Suppr.</span></div>
          {['Programmes', 'Candidatures', 'Utilisateurs'].map((m, i) => (
            <div key={m} className="grid grid-cols-4 border-t border-border text-[9px]">
              <span className="p-1.5">{m}</span>
              {[true, i < 2, i < 1].map((v, j) => <span key={j} className="flex justify-center p-1.5">{v ? <CheckSquare className="h-3 w-3 text-green-500" /> : <span className="h-3 w-3 rounded border border-border" />}</span>)}
            </div>
          ))}
        </div>
      </Shot>
      <Block title="Ce que vous pouvez faire">
        <CanDo items={[
          <><b>Créer vos propres rôles</b> (au-delà des rôles standards) et cocher leurs permissions dans la matrice.</>,
          <>Faire <b>hériter</b> un rôle d’un rôle parent (il reçoit ses permissions + les siennes).</>,
          <>Distinguer les <b>portées</b> (scope) : permissions générales vs permissions d’administration, avec garde-fous.</>,
          <>Accorder des permissions <b>par utilisateur</b> depuis le module <a href="#users" className="text-brand-600 underline dark:text-brand-400">Utilisateurs</a>.</>,
          <>Un refus d’accès (403) <b>nomme la permission manquante</b> — vous savez exactement quoi accorder.</>,
        ]} />
      </Block>
      <Tip><b>Mise à jour en direct :</b> quand vous changez les droits de quelqu’un, sa session se met à jour <b>sans reconnexion</b> — la barre latérale et les accès s’adaptent immédiatement (technologie SSE).</Tip>
    </Section>
  )
}

function ReportsDoc() {
  return (
    <Section id="reports" icon={BarChart3} title="Rapports" lead="L’analytique consolidée de toute la plateforme.">
      <Shot active="Rapports" path="/reports" caption="Graphiques et indicateurs agrégés côté serveur — candidatures, utilisateurs, programmes.">
        <div className="grid grid-cols-2 gap-2">
          <MiniCard><p className="mb-1 text-[9px] text-muted-foreground">Candidatures / mois</p><div className="flex h-12 items-end gap-1">{[4, 7, 5, 9, 6, 11].map((h, i) => <div key={i} className="flex-1 rounded-sm bg-purple-500/60" style={{ height: h * 3.5 }} />)}</div></MiniCard>
          <MiniCard><p className="mb-1 text-[9px] text-muted-foreground">Rôles</p><div className="mx-auto mt-1 h-10 w-10 rounded-full border-[6px] border-brand-500/70 border-r-green-500 border-b-amber-500" /></MiniCard>
        </div>
      </Shot>
      <Block title="Ce que vous pouvez faire">
        <CanDo items={[
          <>Consulter des <b>statistiques agrégées</b> : candidatures, inscriptions, invitations, programmes.</>,
          <>Analyser la <b>répartition des rôles</b> et l’<b>entonnoir de conversion</b>.</>,
          <>Obtenir aussi des <b>rapports par programme</b> (onglet Rapports dans chaque programme).</>,
        ]} />
      </Block>
    </Section>
  )
}

function OrganizationsDoc() {
  return (
    <Section id="organizations" icon={Building2} title="Organisations & sociétés incubées" lead="Le répertoire des structures, et la vitrine publique des incubées.">
      <Shot active="Organisations" path="/organizations" caption="Activez « Sociétés incubées » sur une organisation pour la publier sur le site public.">
        <div className="space-y-1.5">
          {[['NovaTech', true], ['AgriLoop', true], ['StartLab', false]].map(([n, on]) => (
            <div key={n as string} className="flex items-center justify-between rounded-lg border border-border bg-card px-2 py-1.5">
              <div className="flex items-center gap-2"><div className="h-5 w-5 rounded bg-gradient-to-br from-brand-500/40 to-purple-500/40" /><span className="text-[10px] font-medium">{n}</span></div>
              <span className={cn('flex h-4 w-7 items-center rounded-full px-0.5', on ? 'justify-end bg-green-500' : 'justify-start bg-muted')}><span className="h-3 w-3 rounded-full bg-white" /></span>
            </div>
          ))}
        </div>
      </Shot>
      <Block title="Ce que vous pouvez faire">
        <CanDo items={[
          <><b>Répertorier</b> les organisations et leurs informations.</>,
          <>Basculer l’option <b>« société incubée »</b> pour qu’une structure apparaisse dans la vitrine publique.</>,
          <>Gérer ce qui s’affiche sur la page publique <b>« Sociétés incubées »</b>.</>,
        ]} />
      </Block>
    </Section>
  )
}

function PartnersDoc() {
  return (
    <Section id="partners" icon={Handshake} title="Partenaires" lead="Les partenaires et sponsors affichés sur le site public.">
      <Shot active="Partenaires" path="/partners" caption="Ajoutez logo + lien ; activez la visibilité pour publier sur le site public.">
        <div className="grid grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((i) => <div key={i} className="flex aspect-video items-center justify-center rounded-lg border border-border bg-card"><Handshake className="h-4 w-4 text-muted-foreground" /></div>)}
        </div>
      </Shot>
      <Block title="Ce que vous pouvez faire">
        <CanDo items={[
          <>Ajouter un partenaire avec son <b>logo</b>, son <b>nom</b> et un <b>lien</b>.</>,
          <>Contrôler sa <b>visibilité publique</b> (affiché ou masqué).</>,
          <>Rattacher des partenaires à un <b>programme</b> précis via son onglet Partenaires.</>,
        ]} />
      </Block>
    </Section>
  )
}

function LandingDoc() {
  return (
    <Section id="landing" icon={Home} title="Page d’accueil" lead="L’éditeur de la vitrine : ce que voient les visiteurs en premier.">
      <Shot active="Page d’accueil" path="/landing-page" caption="Modifiez bannière, textes et sections ; l’aperçu reflète le site public.">
        <div className="rounded-lg border border-border bg-card p-2">
          <div className="mb-1.5 h-10 rounded bg-gradient-to-r from-brand-500/30 to-purple-500/30" />
          <Bar w="60%" /><div className="h-1" /><Bar w="85%" />
          <div className="mt-2 grid grid-cols-3 gap-1">{[0, 1, 2].map((i) => <div key={i} className="h-8 rounded bg-muted" />)}</div>
        </div>
      </Shot>
      <Block title="Ce que vous pouvez faire">
        <CanDo items={[
          <>Éditer la <b>bannière</b>, les <b>textes</b> et les <b>sections</b> de la page d’accueil publique.</>,
          <>Mettre en avant les programmes, les chiffres clés et les appels à l’action.</>,
          <>Les changements sont <b>publiés</b> sur le site public dès l’enregistrement.</>,
        ]} />
      </Block>
    </Section>
  )
}

function CatalogsDoc() {
  return (
    <Section id="catalogs" icon={Tags} title="Référentiels" lead="Les listes de valeurs réutilisées partout (types de session, catégories…).">
      <Shot active="Référentiels" path="/catalogs" caption="Gérez les listes centrales ; l’ajout rapide crée une valeur sans quitter votre écran.">
        <div className="space-y-1.5">
          <p className="text-[9px] font-semibold text-muted-foreground">Types de session</p>
          <div className="flex flex-wrap gap-1"><Pill tone="brand">Atelier</Pill><Pill tone="green">Mentorat</Pill><Pill tone="blue">Jury</Pill><Pill tone="amber">Pitch</Pill><Pill>+ Ajouter</Pill></div>
        </div>
      </Shot>
      <Block title="Ce que vous pouvez faire">
        <CanDo items={[
          <>Gérer les <b>référentiels centraux</b> : types de session, catégories, étiquettes…</>,
          <>Utiliser l’<b>ajout rapide</b> : créer une nouvelle valeur directement depuis le champ qui l’utilise.</>,
          <>Garder des listes <b>cohérentes</b> dans toute la plateforme.</>,
        ]} />
      </Block>
    </Section>
  )
}

function TrashDoc() {
  return (
    <Section id="trash" icon={Trash2} title="Corbeille & sauvegarde" lead="Un filet de sécurité : rien n’est perdu par erreur.">
      <Shot active="Corbeille" path="/trash" caption="Éléments supprimés : restaurez-les, ou supprimez-les définitivement en connaissance de cause.">
        <div className="space-y-1.5">
          {[['Session « Pitch final »', 'Programme Tech'], ['Candidature #241', 'FoodStart']].map(([t, s]) => (
            <div key={t} className="flex items-center justify-between rounded-lg border border-border bg-card px-2 py-1.5">
              <div><p className="text-[10px] font-medium">{t}</p><p className="text-[9px] text-muted-foreground">{s}</p></div>
              <div className="flex gap-1"><Btn>Restaurer</Btn><Btn>Supprimer</Btn></div>
            </div>
          ))}
        </div>
      </Shot>
      <Block title="Ce que vous pouvez faire">
        <CanDo items={[
          <>Retrouver les <b>éléments supprimés</b> (programmes, sessions, tâches, candidatures, vidéos).</>,
          <><b>Restaurer</b> un élément en un clic — il revient exactement où il était.</>,
          <><b>Supprimer définitivement</b> ce dont vous êtes sûr de ne plus avoir besoin.</>,
          <>Exporter une <b>sauvegarde complète</b> des données dans un fichier téléchargeable.</>,
        ]} />
      </Block>
      <Tip tone="warn"><b>Attention :</b> la suppression définitive est irréversible. En cas de doute, laissez l’élément dans la corbeille.</Tip>
    </Section>
  )
}

function SettingsDoc() {
  return (
    <Section id="settings" icon={Settings} title="Paramètres" lead="Votre compte et vos préférences.">
      <Shot active="Paramètres" path="/settings" caption="Profil, mot de passe et préférences d’affichage.">
        <div className="space-y-2">
          <MiniCard><p className="text-[9px] text-muted-foreground">Profil</p><div className="mt-1 flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[9px] font-bold">YC</span><div><Bar w="80px" /><div className="h-1" /><Bar w="120px" /></div></div></MiniCard>
          <div className="flex items-center justify-between rounded-lg border border-border bg-card px-2 py-1.5"><span className="text-[10px]">Thème sombre</span><span className="flex h-4 w-7 items-center justify-end rounded-full bg-brand-500 px-0.5"><span className="h-3 w-3 rounded-full bg-white" /></span></div>
        </div>
      </Shot>
      <Block title="Ce que vous pouvez faire">
        <CanDo items={[
          <>Mettre à jour votre <b>profil</b> (nom, e-mail).</>,
          <>Changer votre <b>mot de passe</b>.</>,
          <>Régler vos <b>préférences</b> d’affichage (dont le thème clair/sombre).</>,
        ]} />
      </Block>
      <Tip><b>Sécurité :</b> pour votre protection, la saisie de mots de passe et d’informations sensibles se fait toujours par vous — jamais de façon automatisée.</Tip>
    </Section>
  )
}
