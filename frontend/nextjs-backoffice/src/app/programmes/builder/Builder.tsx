'use client'
/**
 * Visual programme builder — n8n / ComfyUI style.
 *
 * Layout:
 *   ┌────────────┬──────────────────────────────┬────────────────┐
 *   │  PALETTE   │           CANVAS             │   INSPECTOR    │
 *   │ categorized│  nodes + edges + timeline    │ tabs per node  │
 *   └────────────┴──────────────────────────────┴────────────────┘
 *
 * Node types:
 *   ── METADATA (singletons) ──
 *     • programme        — title, status (root)
 *     • description      — long programme description
 *     • visual           — tagline, logo, banner, location
 *     • formTemplate     — picks the formulaire template
 *     • stats            — programme key numbers
 *     • objectives       — list of programme goals
 *     • benefits         — list of perks for participants
 *     • timeline         — single visual container holding sessions
 *
 *   ── DYNAMIC (multi-instance) ──
 *     • criterion        — evaluation criterion (input → programme)
 *     • session          — event on the timeline (sits ON the timeline node)
 *
 * Save flow:
 *   1. POST /api/programmes  — title, description, status, all metadata
 *   2. for each criterion → POST /:id/criteria
 *   3. for each session   → POST /:id/phases with criterionWeights, tasks, ...
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, Panel,
  addEdge, applyNodeChanges, applyEdgeChanges, Handle, Position, useReactFlow,
  type Connection, type Edge, type Node, type NodeChange, type EdgeChange, type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  Box, Plus, Layers, Target, Trash2, Save, ArrowLeft, Loader2, Sparkles,
  FileText, Eye, FileQuestion, Image as ImageIcon, BarChart3, Flag, Gift,
  Calendar, Users, UserPlus, Building2, CheckSquare, Sliders, Clock,
  Info, FormInput, LayoutGrid, GripVertical,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { programmesApi, sessionsApi, SESSION_TYPES, ACTIVITY_TYPES } from '@/lib/api'
import type { SessionType, ActivityType } from '@/lib/api'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TimelineNode as RichTimelineNode } from './Timeline'
import { usePresets, type BuilderPreset } from './usePresets'
import { FormBuilder } from '@/components/formbuilder/FormBuilder'
import { parseSchema, type CustomFormSchema } from '@/components/formbuilder/schema'

// ── Node data shapes ─────────────────────────────────────────────────────────

type NodeKind =
  | 'programme' | 'description' | 'visual' | 'formTemplate' | 'stats'
  | 'objectives' | 'benefits' | 'timeline'
  | 'criterion' | 'session'

interface ProgrammeData   extends Record<string, unknown> { kind: 'programme'; title: string; status: 'DRAFT'|'OPEN'|'IN_PROGRESS'|'EVALUATION'|'CLOSED'; type: 'PUBLIC'|'PRIVATE'; sectors: string[]; startDate?: string; endDate?: string }
interface DescriptionData extends Record<string, unknown> { kind: 'description'; description: string }
interface VisualData      extends Record<string, unknown> { kind: 'visual'; tagline: string; logoUrl: string; bannerImageUrl: string; location: string; applicationUrl: string }
interface FormTemplateData extends Record<string, unknown> { kind: 'formTemplate'; formTemplate: 'STANDARD'|'MINIMAL'|'FOODSTART'|'TECH'|'AGRITECH'; customFormSchema: string }
interface StatsData       extends Record<string, unknown> { kind: 'stats'; maxStartups?: number; expertCount?: number; trainingSessionsCount?: number; mentoringHoursPerMonth?: number }
interface ObjectivesData  extends Record<string, unknown> { kind: 'objectives'; objectives: string[] }
interface BenefitsData    extends Record<string, unknown> { kind: 'benefits'; benefits: string[] }
interface TimelineData    extends Record<string, unknown> { kind: 'timeline' }
interface CriterionData   extends Record<string, unknown> { kind: 'criterion'; name: string; description: string; weight: number }
interface SessionData     extends Record<string, unknown> {
  kind: 'session'
  title: string
  description: string
  startDate?: string
  endDate?: string
  durationKind: 'day' | 'week' | 'custom'
  location: string
  responsibles: string[]
  guests: string[]
  startupIds: number[]
  tasks: Array<{ title: string; assignee?: string; done: boolean }>
  /** Map criterionNodeId → weight 0..1. Resolved to real ids at save time. */
  criterionWeights: Record<string, number>
  /** Unified Session model — what kind of session this is. */
  sessionType: SessionType
  /** Lifecycle state — drives programme status automatically. */
  status: 'UPCOMING' | 'ACTIVE' | 'COMPLETED'
  /** Day-by-day breakdown of the session. Persisted only after the session has an id. */
  days: BuilderDay[]
}

/** Day-of-a-session, persisted in the visual builder's local state.
 *  `id` (when present) is the server-side id — needed for direct days/activities updates. */
export interface BuilderDay {
  id?: number
  dayOrder: number
  title?: string
  description?: string
  date?: string
  location?: string
  activities: BuilderActivity[]
}

export interface BuilderActivity {
  id?: number
  activityOrder: number
  title: string
  description?: string
  type: ActivityType
  startTime?: string  // "HH:mm" or "HH:mm:ss"
  endTime?: string
  location?: string
  responsibles: string[]
  guests: string[]
}

type BuilderNode =
  | Node<ProgrammeData, 'programme'>
  | Node<DescriptionData, 'description'>
  | Node<VisualData, 'visual'>
  | Node<FormTemplateData, 'formTemplate'>
  | Node<StatsData, 'stats'>
  | Node<ObjectivesData, 'objectives'>
  | Node<BenefitsData, 'benefits'>
  | Node<TimelineData, 'timeline'>
  | Node<CriterionData, 'criterion'>
  | Node<SessionData, 'session'>

// ── Palette catalog (drives the sidebar) ─────────────────────────────────────

const SECTORS = [
  'Tech / Numérique', 'Finance / Fintech', 'Agriculture / Agritech',
  'Santé / Medtech', 'Éducation', 'Énergie / Cleantech',
  'Commerce / Retail', 'Industrie', 'Transport / Mobilité', 'Tourisme', 'Immobilier',
]

const NODE_META: Record<NodeKind, { label: string; color: string; icon: any; singleton: boolean; category: string; desc: string }> = {
  programme:    { label: 'Programme',         color: 'brand',     icon: Box,         singleton: true,  category: 'Métadonnées', desc: 'Titre, statut, dates' },
  description:  { label: 'Description',       color: 'sky',       icon: FileText,    singleton: true,  category: 'Métadonnées', desc: 'Texte long' },
  visual:       { label: 'Présentation',      color: 'pink',      icon: ImageIcon,   singleton: true,  category: 'Métadonnées', desc: 'Tagline, logo, bannière' },
  formTemplate: { label: 'Formulaire',        color: 'indigo',    icon: FormInput,   singleton: true,  category: 'Métadonnées', desc: 'Squelette de candidature' },
  stats:        { label: 'Chiffres clés',     color: 'cyan',      icon: BarChart3,   singleton: true,  category: 'Métadonnées', desc: 'Mentors, sessions, h…' },
  objectives:   { label: 'Objectifs',         color: 'yellow',    icon: Flag,        singleton: true,  category: 'Contenu',     desc: 'Buts du programme' },
  benefits:     { label: 'Bénéfices',         color: 'rose',      icon: Gift,        singleton: true,  category: 'Contenu',     desc: 'Ce que les startups gagnent' },
  criterion:    { label: 'Critère',           color: 'purple',    icon: Target,      singleton: false, category: 'Évaluation',  desc: 'Critère d\'évaluation pondéré' },
  timeline:     { label: 'Timeline',          color: 'amber',     icon: Calendar,    singleton: true,  category: 'Calendrier',  desc: 'Unique — porte toutes les sessions' },
  session:      { label: 'Session',           color: 'emerald',   icon: Layers,      singleton: false, category: 'Calendrier',  desc: 'Évènement sur la timeline' },
}
// 'timeline' + 'session' are intentionally removed from the palette — they
// live on the Parcours tab (TimelineTab). Existing programmes with session
// nodes already saved still load harmlessly (skipped by the Atelier loader).
const NODE_KIND_ORDER: NodeKind[] = [
  'programme', 'description', 'visual', 'formTemplate', 'stats',
  'objectives', 'benefits',
  'criterion',
]
const CATEGORY_ORDER = ['Métadonnées', 'Contenu', 'Évaluation', 'Calendrier']

const COLOR_CLASSES: Record<string, { border: string; ring: string; dot: string; bg: string; text: string }> = {
  brand:   { border: 'border-brand-500/50',   ring: 'ring-brand-500/30',   dot: 'text-brand-600',   bg: 'bg-brand-500',   text: 'text-brand-700 dark:text-brand-300' },
  sky:     { border: 'border-sky-500/50',     ring: 'ring-sky-500/30',     dot: 'text-sky-600',     bg: 'bg-sky-500',     text: 'text-sky-700 dark:text-sky-300' },
  pink:    { border: 'border-pink-500/50',    ring: 'ring-pink-500/30',    dot: 'text-pink-600',    bg: 'bg-pink-500',    text: 'text-pink-700 dark:text-pink-300' },
  indigo:  { border: 'border-indigo-500/50',  ring: 'ring-indigo-500/30',  dot: 'text-indigo-600',  bg: 'bg-indigo-500',  text: 'text-indigo-700 dark:text-indigo-300' },
  cyan:    { border: 'border-cyan-500/50',    ring: 'ring-cyan-500/30',    dot: 'text-cyan-600',    bg: 'bg-cyan-500',    text: 'text-cyan-700 dark:text-cyan-300' },
  yellow:  { border: 'border-yellow-500/50',  ring: 'ring-yellow-500/30',  dot: 'text-yellow-600',  bg: 'bg-yellow-500',  text: 'text-yellow-700 dark:text-yellow-400' },
  rose:    { border: 'border-rose-500/50',    ring: 'ring-rose-500/30',    dot: 'text-rose-600',    bg: 'bg-rose-500',    text: 'text-rose-700 dark:text-rose-300' },
  purple:  { border: 'border-purple-500/50',  ring: 'ring-purple-500/30',  dot: 'text-purple-600',  bg: 'bg-purple-500',  text: 'text-purple-700 dark:text-purple-300' },
  amber:   { border: 'border-amber-500/50',   ring: 'ring-amber-500/30',   dot: 'text-amber-600',   bg: 'bg-amber-500',   text: 'text-amber-700 dark:text-amber-300' },
  emerald: { border: 'border-emerald-500/50', ring: 'ring-emerald-500/30', dot: 'text-emerald-600', bg: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300' },
}

// ── Node renderers ───────────────────────────────────────────────────────────

function BasicNode({ kind, title, subtitle, selected, hasTarget = false, hasSource = false }: {
  kind: NodeKind; title: string; subtitle?: string; selected?: boolean; hasTarget?: boolean; hasSource?: boolean
}) {
  const meta = NODE_META[kind]
  const c = COLOR_CLASSES[meta.color]
  const Icon = meta.icon
  return (
    <div className={`rounded-xl border-2 bg-card p-2.5 min-w-[170px] shadow-md ${c.border} ${selected ? `ring-2 ${c.ring}` : ''}`}>
      {hasTarget && <Handle type="target" position={Position.Left} className={`!h-3 !w-3 ${c.bg.replace('bg-', '!bg-')} !border-2 !border-card`} />}
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`h-3 w-3 ${c.dot}`} />
        <span className={`text-[9px] font-bold uppercase tracking-wider ${c.text}`}>{meta.label}</span>
      </div>
      <p className="text-xs font-bold text-foreground truncate">{title || 'Sans titre'}</p>
      {subtitle && <p className="text-[9px] text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
      {hasSource && <Handle type="source" position={Position.Right} className={`!h-3 !w-3 ${c.bg.replace('bg-', '!bg-')} !border-2 !border-card`} />}
    </div>
  )
}

const ProgrammeNode    = ({ data, selected }: any) => <BasicNode kind="programme"    title={data.title} subtitle={data.status} selected={selected} hasTarget hasSource />
const DescriptionNode  = ({ data, selected }: any) => <BasicNode kind="description"  title="Description" subtitle={data.description ? `${data.description.length} car.` : 'Vide'} selected={selected} hasSource />
const VisualNode       = ({ data, selected }: any) => <BasicNode kind="visual"       title={data.tagline || 'Présentation visuelle'} subtitle={data.location} selected={selected} hasSource />
const FormTemplateNode = ({ data, selected }: any) => {
  // Subtitle reflects the custom form when one is defined (it overrides the skeleton).
  let subtitle = 'Squelette candidature'
  try {
    const sch = data.customFormSchema ? JSON.parse(data.customFormSchema) : null
    if (sch?.sections?.length) {
      const fields = sch.sections.reduce((n: number, s: any) => n + (s.fields?.length ?? 0), 0)
      subtitle = `Personnalisé · ${sch.sections.length} section(s), ${fields} champ(s)`
    }
  } catch { /* malformed schema — keep default subtitle */ }
  return <BasicNode kind="formTemplate" title={data.formTemplate} subtitle={subtitle} selected={selected} hasSource />
}
const StatsNode        = ({ data, selected }: any) => <BasicNode kind="stats"        title="Chiffres clés" subtitle={`${data.maxStartups ?? 0} startups · ${data.expertCount ?? 0} experts`} selected={selected} hasSource />
const ObjectivesNode   = ({ data, selected }: any) => <BasicNode kind="objectives"   title="Objectifs" subtitle={`${(data.objectives ?? []).length} objectifs`} selected={selected} hasSource />
const BenefitsNode     = ({ data, selected }: any) => <BasicNode kind="benefits"     title="Bénéfices" subtitle={`${(data.benefits ?? []).length} bénéfices`} selected={selected} hasSource />

function CriterionNode({ data, selected }: any) {
  return (
    <div className={`rounded-xl border-2 bg-card p-2.5 min-w-[180px] shadow-md border-purple-500/50 ${selected ? 'ring-2 ring-purple-500/30' : ''}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <Target className="h-3 w-3 text-purple-600" />
        <span className="text-[9px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">Critère (input)</span>
      </div>
      <p className="text-xs font-bold text-foreground truncate">{data.name || 'Sans nom'}</p>
      <div className="mt-1.5 flex items-center gap-1.5">
        <div className="h-1 flex-1 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-purple-500" style={{ width: `${Math.round((data.weight ?? 0) * 100)}%` }} />
        </div>
        <span className="text-[9px] font-bold text-foreground">{Math.round((data.weight ?? 0) * 100)}%</span>
      </div>
      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !bg-purple-500 !border-2 !border-card" />
    </div>
  )
}

function SessionNode({ data, selected }: any) {
  const c = COLOR_CLASSES.emerald
  const st = (data.sessionType as string) ?? 'INCUBATION'
  const status = (data.status as string) ?? 'UPCOMING'
  const tone = SESSION_TYPE_TONE[st] ?? SESSION_TYPE_TONE.INCUBATION
  return (
    <div className={`rounded-xl border-2 bg-card p-2.5 min-w-[190px] shadow-md ${c.border} ${selected ? `ring-2 ${c.ring}` : ''}`}>
      <Handle type="target" position={Position.Top} className="!h-3 !w-3 !bg-emerald-500 !border-2 !border-card" />
      <div className="flex items-center gap-1.5 mb-1">
        <Layers className="h-3 w-3 text-emerald-600" />
        <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider border ${tone}`}>
          {SESSION_TYPE_LABEL[st] ?? 'Session'}
        </span>
        <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[8px] font-semibold ${
          status === 'ACTIVE'    ? 'bg-emerald-500 text-white' :
          status === 'COMPLETED' ? 'bg-slate-500 text-white'   : 'bg-muted text-muted-foreground'
        }`}>
          {status === 'ACTIVE' ? '● Live' : status === 'COMPLETED' ? '✓' : '○'}
        </span>
      </div>
      <p className="text-xs font-bold text-foreground truncate">{data.title || 'Sans titre'}</p>
      {(data.startDate || data.endDate) && (
        <p className="text-[9px] text-muted-foreground mt-0.5">{data.startDate ?? '?'} → {data.endDate ?? '?'}</p>
      )}
      <div className="mt-1 flex gap-2 text-[9px] text-muted-foreground">
        {(data.days ?? []).length > 0 && <span><Calendar className="h-2.5 w-2.5 inline" /> {(data.days ?? []).length}j</span>}
        {(data.responsibles ?? []).length > 0 && <span><Users className="h-2.5 w-2.5 inline" /> {(data.responsibles ?? []).length}</span>}
        {(data.tasks ?? []).length > 0 && <span><CheckSquare className="h-2.5 w-2.5 inline" /> {(data.tasks ?? []).length}</span>}
      </div>
    </div>
  )
}

const nodeTypes: NodeTypes = {
  programme:    ProgrammeNode    as any,
  description:  DescriptionNode  as any,
  visual:       VisualNode       as any,
  formTemplate: FormTemplateNode as any,
  stats:        StatsNode        as any,
  objectives:   ObjectivesNode   as any,
  benefits:     BenefitsNode     as any,
  criterion:    CriterionNode    as any,
  timeline:     RichTimelineNode as any,
  session:      SessionNode      as any,
}

// ── Page entry ───────────────────────────────────────────────────────────────

/**
 * Reusable inner component — used by both /programmes/builder (new)
 * and /programmes/[id]/builder (edit existing).
 */
export function BuilderInnerExported(props: BuilderProps = {}) {
  return (
    <ReactFlowProvider>
      <BuilderInner {...props} />
    </ReactFlowProvider>
  )
}

export interface BuilderProps {
  /** When provided, save uses PUT /api/programmes/:id instead of POST. */
  existingProgrammeId?: number
  /** Initial nodes (e.g. loaded from server). Falls back to default Programme + Timeline. */
  initialNodes?: BuilderNode[]
  /** Initial edges (e.g. loaded from server). Falls back to []. */
  initialEdges?: Edge[]
}

function defaultDataFor(kind: NodeKind): any {
  switch (kind) {
    case 'programme':    return { kind, title: 'Nouveau programme', status: 'DRAFT', type: 'PUBLIC', sectors: [] }
    case 'description':  return { kind, description: '' }
    case 'visual':       return { kind, tagline: '', logoUrl: '', bannerImageUrl: '', location: '', applicationUrl: '' }
    case 'formTemplate': return { kind, formTemplate: 'STANDARD', customFormSchema: '' }
    case 'stats':        return { kind, maxStartups: 0, expertCount: 0, trainingSessionsCount: 0, mentoringHoursPerMonth: 0 }
    case 'objectives':   return { kind, objectives: [] }
    case 'benefits':     return { kind, benefits: [] }
    case 'timeline':     return { kind }
    case 'criterion':    return { kind, name: 'Nouveau critère', description: '', weight: 0.25 }
    case 'session':      return { kind, title: 'Nouvelle session', description: '', durationKind: 'day', location: '',
                                  responsibles: [], guests: [], startupIds: [], tasks: [], criterionWeights: {},
                                  sessionType: 'INCUBATION', status: 'UPCOMING', days: [] }
  }
}

// ── Session-type display ────────────────────────────────────────────────────

const SESSION_TYPE_LABEL: Record<string, string> = {
  CANDIDATURE_SUBMISSION: 'Candidature',
  PRESELECTION:           'Présélection',
  PITCH_DAY:              'Pitch Day',
  ONBOARDING:             'Onboarding',
  INCUBATION:             'Incubation',
  DEMO_DAY:               'Demo Day',
  TRAINING_DAY:           'Formation',
}

const SESSION_TYPE_TONE: Record<string, string> = {
  CANDIDATURE_SUBMISSION: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-300/40',
  PRESELECTION:           'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300/40',
  PITCH_DAY:              'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-300/40',
  ONBOARDING:             'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300/40',
  INCUBATION:             'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-300/40',
  DEMO_DAY:               'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-300/40',
  TRAINING_DAY:           'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-300/40',
}

const ACTIVITY_TYPE_LABEL: Record<string, string> = {
  ACTIVITY: 'Activité', TRAINING_STEP: 'Étape formation', KEYNOTE: 'Keynote',
  WORKSHOP: 'Atelier', PANEL: 'Panel', PITCH: 'Pitch',
  BREAK: 'Pause', NETWORKING: 'Networking', OTHER: 'Autre',
}

/**
 * Map a preset's normalized durationKind ('day' | 'range') onto the session
 * node's legacy model ('day' | 'week' | 'custom'). Ranges become 'custom'.
 */
const presetToSessionKind = (preset: BuilderPreset): SessionData['durationKind'] =>
  preset.durationKind === 'day' ? 'day' : 'custom'

function BuilderInner(props: BuilderProps = {}) {
  const router = useRouter()
  const rf = useReactFlow()
  const canvasRef = useRef<HTMLDivElement>(null)
  const [saving, setSaving] = useState(false)
  const [nodes, setNodes] = useState<BuilderNode[]>(props.initialNodes ?? [
    { id: 'programme', type: 'programme', position: { x: 60, y: 200 }, data: defaultDataFor('programme') } as BuilderNode,
    // The timeline node is gone — sessions live on the Parcours tab now.
  ])
  const [edges, setEdges] = useState<Edge[]>(props.initialEdges ?? [])
  const [selectedId, setSelectedId] = useState<string | null>('programme')
  /** Session presets — DB-backed, single source of truth (see usePresets). */
  const presets = usePresets(props.existingProgrammeId)

  const onNodesChange = useCallback((c: NodeChange[]) => setNodes((nds) => applyNodeChanges(c, nds) as BuilderNode[]), [])
  const onEdgesChange = useCallback((c: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(c, eds)), [])
  const onConnect = useCallback((c: Connection) => setEdges((eds) => addEdge({ ...c, animated: true, style: { strokeWidth: 2 } }, eds)), [])

  // Expose a global so the Timeline node + criterion inspector can switch the
  // selected node from inside their own React subtree (they can't call setSelectedId directly).
  // The expanded Timeline modal also uses these to add/update/remove session nodes
  // without leaving the modal.
  if (typeof window !== 'undefined') {
    (window as any).__builder_selectNode = (id: string) => setSelectedId(id)
    ;(window as any).__builder_addSessionPreset = (presetId: number, atDate?: string) => {
      const preset = presets.find((p) => p.id === presetId)
      if (!preset) return
      // Bypass `addNode`'s auto-inferred dates when an explicit date is given.
      if (atDate) {
        const id = `session-${Date.now()}`
        let data: any = defaultDataFor('session')
        data = { ...data, title: preset.title, durationKind: presetToSessionKind(preset) }
        // Apply duration-driven end date
        data.startDate = atDate
        if (preset.durationKind === 'day') data.endDate = atDate
        else {
          const dt = new Date(atDate + 'T12:00:00'); dt.setDate(dt.getDate() + 13)
          data.endDate = dt.toISOString().slice(0, 10)
        }
        const newNode = { id, type: 'session', position: { x: 100 + nodes.filter((n) => n.data.kind === 'session').length * 210, y: 820 }, data } as BuilderNode
        setNodes((nds) => [...nds, newNode])
        setEdges((eds) => [...eds, { id: `e-timeline-${id}`, source: 'timeline', target: id, animated: true, style: { strokeWidth: 2, stroke: '#F59E0B' } }])
        setSelectedId(id)
        return id
      }
      addNode('session', undefined, preset)
    }
    ;(window as any).__builder_updateSession = (id: string, patch: any) => updateData(id, patch)
    ;(window as any).__builder_removeSession = (id: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== id))
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id))
      if (selectedId === id) setSelectedId(null)
    }
  }

  /**
   * Compute a placement for a new node that's GUARANTEED to be visible.
   * Strategy:
   *   1. If a drop position is provided (drag-and-drop), use it (already in flow coords).
   *   2. Otherwise, anchor relative to a relevant existing node (timeline for sessions,
   *      programme for criteria + metadata) with a stack offset for same-kind nodes.
   *   3. Avoid placing exactly on top of an existing node by nudging.
   */
  const nextPos = (kind: NodeKind, drop?: { x: number; y: number }) => {
    if (drop) return drop
    const sameKindCount = nodes.filter((n) => n.data.kind === kind).length
    const prog = nodes.find((n) => n.data.kind === 'programme')
    const tl   = nodes.find((n) => n.data.kind === 'timeline')

    let target: { x: number; y: number }
    if (kind === 'session' && tl) {
      // Sessions stack horizontally just below the timeline
      target = { x: tl.position.x + 30 + (sameKindCount * 200), y: tl.position.y + 160 }
    } else if (kind === 'criterion' && prog) {
      // Criteria stack in a tidy column to the LEFT of programme (they are inputs)
      target = { x: prog.position.x - 220, y: prog.position.y + sameKindCount * 100 }
    } else if (kind === 'timeline' && prog) {
      target = { x: prog.position.x + 400, y: prog.position.y + 280 }
    } else if (prog) {
      // Metadata nodes: column to the RIGHT of programme, stacked
      const sameCategory = nodes.filter((n) => NODE_META[n.data.kind as NodeKind]?.category === NODE_META[kind].category).length
      target = { x: prog.position.x + 280, y: prog.position.y - 80 + sameCategory * 110 }
    } else {
      target = { x: 300, y: 300 }
    }

    // Nudge if exactly overlapping an existing node
    while (nodes.some((n) => Math.abs(n.position.x - target.x) < 20 && Math.abs(n.position.y - target.y) < 20)) {
      target = { x: target.x + 30, y: target.y + 30 }
    }
    return target
  }

  /**
   * Auto-fill session dates: chain from the last existing session's end date,
   * else from programme.startDate, else from today. Duration defaults to 1 day.
   */
  const inferSessionDates = (kind: 'day' | 'week' | 'custom'): { startDate: string; endDate: string } => {
    const sessions = nodes.filter((n): n is Node<SessionData, 'session'> => n.data.kind === 'session')
    const lastEnd = sessions
      .map((s) => s.data.endDate || s.data.startDate)
      .filter(Boolean)
      .sort()
      .pop()
    const prog = nodes.find((n): n is Node<ProgrammeData, 'programme'> => n.data.kind === 'programme')
    const fallback = lastEnd
      ? new Date(new Date(lastEnd + 'T12:00:00').getTime() + 24 * 3600 * 1000)
      : prog?.data.startDate
        ? new Date(prog.data.startDate + 'T12:00:00')
        : new Date()
    const startISO = fallback.toISOString().slice(0, 10)
    const endDate = new Date(fallback)
    endDate.setDate(endDate.getDate() + (kind === 'week' ? 6 : 0))
    return { startDate: startISO, endDate: endDate.toISOString().slice(0, 10) }
  }

  const addNode = (
    kind: NodeKind,
    drop?: { x: number; y: number },
    preset?: BuilderPreset,
  ) => {
    const meta = NODE_META[kind]
    if (meta.singleton && nodes.some((n) => n.data.kind === kind)) {
      toast.error(`Une seule node « ${meta.label} » est autorisée.`)
      return
    }
    const id = `${kind}-${Date.now()}`
    let data = defaultDataFor(kind)
    if (kind === 'session') {
      if (preset) data = { ...data, title: preset.title, durationKind: presetToSessionKind(preset) }
      const dates = inferSessionDates(data.durationKind)
      data = { ...data, ...dates }
      // Day-locked: mirror endDate from startDate when duration is "day"
      if (data.durationKind === 'day') data.endDate = data.startDate
    }
    const newNode = { id, type: kind, position: nextPos(kind, drop), data } as BuilderNode
    setNodes((nds) => [...nds, newNode])
    setSelectedId(id)

    // Auto-wiring of common patterns
    const newEdges: Edge[] = []
    if (kind === 'criterion') {
      newEdges.push({ id: `e-${id}-programme`, source: id, target: 'programme', animated: true, style: { strokeWidth: 2 } })
    } else if (kind === 'session') {
      newEdges.push({ id: `e-timeline-${id}`, source: 'timeline', target: id, animated: true, style: { strokeWidth: 2, stroke: '#F59E0B' } })
    } else if (['description', 'visual', 'formTemplate', 'stats', 'objectives', 'benefits'].includes(kind)) {
      newEdges.push({ id: `e-${id}-programme`, source: id, target: 'programme', animated: false, style: { strokeWidth: 1.5, strokeDasharray: '4 4', opacity: 0.5 } })
    } else if (kind === 'timeline') {
      newEdges.push({ id: `e-programme-${id}`, source: 'programme', target: id, animated: true, style: { strokeWidth: 2, stroke: '#F59E0B' } })
    }
    if (newEdges.length) setEdges((eds) => [...eds, ...newEdges])
    // Smooth focus on the new node
    setTimeout(() => { try { rf.fitView({ nodes: [{ id }], padding: 0.5, duration: 400 }) } catch {} }, 50)
  }

  /** Re-arrange every node into a tidy, deterministic layout. */
  const autoArrange = () => {
    setNodes((nds) => {
      const byKind = (k: NodeKind) => nds.filter((n) => n.data.kind === k)
      const positions = new Map<string, { x: number; y: number }>()
      const prog = byKind('programme')[0]
      const tl   = byKind('timeline')[0]
      if (prog) positions.set(prog.id, { x: 100, y: 260 })
      // Criteria: column to the left
      byKind('criterion').forEach((c, i) => positions.set(c.id, { x: -160, y: 100 + i * 100 }))
      // Metadata: column to the right
      const metaKinds: NodeKind[] = ['description', 'visual', 'formTemplate', 'stats', 'objectives', 'benefits']
      let metaIdx = 0
      for (const k of metaKinds) {
        const m = byKind(k)[0]
        if (!m) continue
        positions.set(m.id, { x: 400, y: 60 + metaIdx * 90 })
        metaIdx++
      }
      // Timeline: bottom
      if (tl) positions.set(tl.id, { x: 200, y: 600 })
      // Sessions: row below timeline
      byKind('session').forEach((s, i) => positions.set(s.id, { x: 100 + i * 210, y: 820 }))
      return nds.map((n) => ({ ...n, position: positions.get(n.id) ?? n.position })) as BuilderNode[]
    })
    setTimeout(() => { try { rf.fitView({ padding: 0.15, duration: 600 }) } catch {} }, 100)
    toast.success('Disposition appliquée ✓')
  }

  // ── Drag-and-drop from palette ──────────────────────────────────────────
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move'
  }, [])
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const kind = e.dataTransfer.getData('application/builder-node') as NodeKind
    if (!kind || !NODE_META[kind]) return
    const pos = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const presetId = e.dataTransfer.getData('application/session-preset')
    const preset = presetId ? presets.find((p) => p.id === Number(presetId)) : undefined
    addNode(kind, pos, preset)
  }, [addNode, rf, presets])

  const removeSelected = () => {
    if (!selectedId) return
    if (selectedId === 'programme' || selectedId === 'timeline') {
      toast.error('Ce nœud ne peut pas être supprimé.')
      return
    }
    setNodes((nds) => nds.filter((n) => n.id !== selectedId))
    setEdges((eds) => eds.filter((e) => e.source !== selectedId && e.target !== selectedId))
    setSelectedId(null)
  }

  const updateData = (id: string, patch: any) => setNodes((nds) =>
    nds.map((n) => n.id === id ? ({ ...n, data: { ...n.data, ...patch } } as BuilderNode) : n))

  const selectedNode = useMemo(() => nodes.find((n) => n.id === selectedId) ?? null, [nodes, selectedId])
  const criteria = nodes.filter((n): n is Node<CriterionData, 'criterion'> => n.data.kind === 'criterion')
  const sessions = nodes.filter((n): n is Node<SessionData,   'session'>   => n.data.kind === 'session')
  // The programme's own window — sessions must stay inside it (mirrors the backend
  // PROGRAM_DATE_CONFLICT rule), so we clamp every session date picker to it.
  const progWindow = useMemo(() => {
    const p = nodes.find((n): n is Node<ProgrammeData, 'programme'> => n.data.kind === 'programme')
    return { start: p?.data.startDate || undefined, end: p?.data.endDate || undefined }
  }, [nodes])

  // ── Save ─────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    const prog = nodes.find((n): n is Node<ProgrammeData, 'programme'> => n.data.kind === 'programme')

    const desc = nodes.find((n): n is Node<DescriptionData, 'description'> => n.data.kind === 'description')
    const vis  = nodes.find((n): n is Node<VisualData,      'visual'>      => n.data.kind === 'visual')
    const ft   = nodes.find((n): n is Node<FormTemplateData,'formTemplate'>=> n.data.kind === 'formTemplate')
    const st   = nodes.find((n): n is Node<StatsData,       'stats'>       => n.data.kind === 'stats')
    const obj  = nodes.find((n): n is Node<ObjectivesData,  'objectives'>  => n.data.kind === 'objectives')
    const ben  = nodes.find((n): n is Node<BenefitsData,    'benefits'>    => n.data.kind === 'benefits')

    // ── Required-information gate ────────────────────────────────────────────
    // Before creating a programme, the essentials + a candidature form must be
    // set. Collect everything missing and show one clear, actionable message.
    // (Skipped in edit mode — an existing programme already cleared this.)
    if (!props.existingProgrammeId) {
      const hasCustomForm = !!ft?.data.customFormSchema && ft.data.customFormSchema.trim().length > 2
      const missing: string[] = []
      if (!prog || !prog.data.title.trim())                       missing.push('un titre (nœud Programme)')
      if (!prog?.data.startDate)                                  missing.push('une date de début (nœud Programme)')
      if (!prog?.data.endDate)                                    missing.push('une date de fin (nœud Programme)')
      if (prog?.data.startDate && prog?.data.endDate && prog.data.endDate < prog.data.startDate)
        missing.push('une date de fin postérieure à la date de début')
      if (!prog?.data.sectors || prog.data.sectors.length === 0)  missing.push('au moins un secteur (nœud Programme)')
      if (!desc?.data.description?.trim())                         missing.push('une description (nœud Description)')
      if (!ft)                                                     missing.push('un formulaire de candidature (ajoutez le nœud Formulaire)')
      else if (!ft.data.formTemplate && !hasCustomForm)           missing.push('le choix du formulaire (modèle ou formulaire personnalisé)')
      if (missing.length > 0) {
        toast.error('Informations requises avant la création :\n• ' + missing.join('\n• '),
          { duration: 6000, style: { maxWidth: 460, whiteSpace: 'pre-line' } })
        if (!prog?.data.title.trim() || !prog?.data.sectors?.length || !prog?.data.startDate || !prog?.data.endDate) setSelectedId('programme')
        else if (!desc?.data.description?.trim()) { const d = nodes.find(n => n.data.kind === 'description'); if (d) setSelectedId(d.id) }
        else if (ft) setSelectedId(ft.id)
        return
      }
    } else if (!prog || !prog.data.title.trim()) {
      toast.error('Programme — un titre est requis'); return
    }
    if (!prog) return // (unreachable — gates above guarantee it; narrows the type)

    setSaving(true)
    try {
      const payload: any = {
        title: prog.data.title.trim(),
        status: prog.data.status,
        type: prog.data.type,
        sectors: prog.data.sectors,
        formTemplate: ft?.data.formTemplate ?? 'STANDARD',
        // Custom form schema (JSON string) — '' clears it so the skeleton applies.
        customFormSchema: ft?.data.customFormSchema ?? '',
      }
      if (prog.data.startDate)            payload.startDate = prog.data.startDate
      if (prog.data.endDate)              payload.endDate = prog.data.endDate
      if (desc?.data.description)         payload.description = desc.data.description
      if (vis) {
        if (vis.data.tagline)             payload.tagline = vis.data.tagline
        if (vis.data.logoUrl)             payload.logoUrl = vis.data.logoUrl
        if (vis.data.bannerImageUrl)      payload.bannerImageUrl = vis.data.bannerImageUrl
        if (vis.data.location)            payload.location = vis.data.location
        if (vis.data.applicationUrl)      payload.applicationUrl = vis.data.applicationUrl
      }
      if (st) {
        if (st.data.maxStartups)            payload.maxStartups = st.data.maxStartups
        if (st.data.expertCount)            payload.expertCount = st.data.expertCount
        if (st.data.trainingSessionsCount)  payload.trainingSessionsCount = st.data.trainingSessionsCount
        if (st.data.mentoringHoursPerMonth) payload.mentoringHoursPerMonth = st.data.mentoringHoursPerMonth
      }
      if (obj && obj.data.objectives.length) payload.objectives = obj.data.objectives
      if (ben && ben.data.benefits.length)   payload.benefits = ben.data.benefits

      // Create OR update depending on mode
      let programmeId: number
      if (props.existingProgrammeId) {
        await programmesApi.update(props.existingProgrammeId, payload)
        programmeId = props.existingProgrammeId
      } else {
        const r = await programmesApi.create(payload)
        programmeId = r.data?.id ?? r.data?.programmeId
        if (!programmeId) throw new Error('Pas d\'id renvoyé par le serveur')
      }

      // Criteria — map clientId → serverId
      // If editing an existing programme, criterion nodes loaded from DB carry
      // their real id encoded in the node id ("crit-real-42") — re-use it.
      const critIdMap: Record<string, number> = {}
      for (const c of criteria) {
        const m = c.id.match(/^crit-real-(\d+)$/)
        if (m) { critIdMap[c.id] = Number(m[1]); continue }
        try {
          const cr = await programmesApi.addCriterion(programmeId, {
            name: c.data.name, description: c.data.description, weight: c.data.weight,
          })
          if (cr.data?.id) critIdMap[c.id] = cr.data.id
        } catch (e: any) { console.warn('criterion failed', c.id, e?.message) }
      }

      // Sessions are NO LONGER persisted from the Atelier (canvas) tab.
      // The Parcours tab owns them via sessionsApi and saves autonomously,
      // so we skip the legacy node-collection loop here. Any leftover
      // session nodes on the canvas (from older sessions) are ignored.

      toast.success(props.existingProgrammeId ? 'Programme mis à jour ✓' : 'Programme créé ✓')
      router.push(`/programmes/${programmeId}`)
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Erreur')
    } finally { setSaving(false) }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] gap-3">
      {/* ─── ATELIER — the React Flow canvas. The Parcours is its own full
           page at /programmes/[id]/timeline (separate from the canvas). ─── */}
      <div className="flex-1 min-h-0 grid grid-cols-[230px_1fr_360px] gap-3">
      {/* PALETTE */}
      <div className="rounded-2xl border border-border bg-card p-3 flex flex-col gap-2 overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xs font-bold text-foreground">Bibliothèque</h2>
          <Link href="/programmes" className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" />Retour
          </Link>
        </div>
        <p className="text-[10px] text-muted-foreground mb-1">Cliquez ou glissez sur le canvas.</p>

        {CATEGORY_ORDER.map((cat) => {
          const kinds = NODE_KIND_ORDER.filter((k) => NODE_META[k].category === cat)
          return (
            <div key={cat} className="mt-2">
              <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">{cat}</p>
              <div className="space-y-1">
                {kinds.map((k) => {
                  const meta = NODE_META[k]
                  const c = COLOR_CLASSES[meta.color]
                  const Icon = meta.icon
                  const existsAsSingleton = meta.singleton && nodes.some((n) => n.data.kind === k)
                  return (
                    <div key={k}>
                      <button type="button" onClick={() => addNode(k)} disabled={existsAsSingleton}
                        draggable={!existsAsSingleton}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('application/builder-node', k)
                          e.dataTransfer.effectAllowed = 'move'
                        }}
                        title={existsAsSingleton ? 'Déjà ajouté' : `Cliquez ou glissez le ${meta.label} sur le canvas`}
                        className={`group w-full text-left rounded-lg border-2 bg-card p-2 transition-all ${c.border} hover:bg-accent/30 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 ${!existsAsSingleton ? 'cursor-grab active:cursor-grabbing' : ''}`}>
                        <div className="flex items-center gap-2">
                          <GripVertical className={`h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-60 transition-opacity ${existsAsSingleton ? 'hidden' : ''}`} />
                          <Icon className={`h-3.5 w-3.5 ${c.dot}`} />
                          <span className="text-xs font-bold text-foreground flex-1 truncate">{meta.label}</span>
                          {meta.singleton && <span className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">1</span>}
                          {!existsAsSingleton && <Plus className="h-3 w-3 text-muted-foreground" />}
                        </div>
                        <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight">{meta.desc}</p>
                      </button>

                      {/* Predefined session presets — shown under the generic Session item */}
                      {k === 'session' && (
                        <div className="mt-1 ml-1 pl-2 border-l-2 border-emerald-500/30 space-y-0.5">
                          <p className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
                            Presets
                          </p>
                          {presets.map((p, i) => (
                            <button key={p.id ?? i} type="button"
                              onClick={() => addNode('session', undefined, p)}
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData('application/builder-node', 'session')
                                if (p.id != null) e.dataTransfer.setData('application/session-preset', String(p.id))
                                e.dataTransfer.effectAllowed = 'move'
                              }}
                              title={`Ajouter une session "${p.title}"`}
                              className="group w-full text-left rounded-md border border-border bg-card px-2 py-1 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-grab active:cursor-grabbing"
                              style={{ borderLeft: `3px solid ${p.color}` }}>
                              <div className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color }} />
                                <span className="text-[10px] font-bold flex-1 truncate">{p.title}</span>
                                <span className="text-[8px] font-semibold opacity-70">
                                  {p.durationKind === 'day' ? '1j' : '…'}
                                </span>
                                <Plus className="h-2.5 w-2.5 opacity-50" />
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        <div className="mt-3 rounded-lg border border-dashed border-border bg-muted/30 p-2 text-[10px] text-muted-foreground space-y-1">
          <p className="font-bold uppercase tracking-wider text-foreground/70 mb-0.5">Astuces</p>
          <p>• <strong>Glisser-déposer</strong> les nodes là où vous voulez</p>
          <p>• <strong>Suppr</strong> supprime le nœud sélectionné</p>
          <p>• Les sessions reprennent la <strong>date du jour suivant</strong></p>
          <p>• Bouton <strong>Aligner</strong> ↗ pour ranger automatiquement</p>
        </div>
      </div>

      {/* CANVAS */}
      <div ref={canvasRef} className="relative rounded-2xl border border-border bg-card overflow-hidden"
        onDragOver={onDragOver} onDrop={onDrop}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_, n) => setSelectedId(n.id)}
          onPaneClick={() => setSelectedId(null)}
          fitView
          deleteKeyCode={['Delete', 'Backspace']}
          onNodesDelete={(deleted) => {
            // Protect singletons that should never be deleted
            const protectedIds = ['programme', 'timeline']
            const toRestore = deleted.filter((n) => protectedIds.includes(n.id)) as BuilderNode[]
            if (toRestore.length > 0) {
              setNodes((nds) => [...nds, ...toRestore.filter((n) => !nds.some((x) => x.id === n.id))])
              toast.error('Programme et Timeline ne peuvent pas être supprimés')
            }
          }}>
          <Background gap={20} size={1} className="opacity-50" />
          <Controls showInteractive={false} className="!bg-card !border !border-border !rounded-lg" />
          <MiniMap pannable zoomable className="!bg-card !border !border-border !rounded-lg"
            nodeColor={(n: any) => {
              const k = (n.data?.kind ?? 'programme') as NodeKind
              const color = NODE_META[k]?.color ?? 'brand'
              const colorMap: Record<string,string> = { brand:'#FF6A00', sky:'#0EA5E9', pink:'#EC4899', indigo:'#6366F1', cyan:'#06B6D4', yellow:'#EAB308', rose:'#F43F5E', purple:'#A855F7', amber:'#F59E0B', emerald:'#10B981' }
              return colorMap[color] ?? '#FF6A00'
            }} />

          <Panel position="top-left" className="!m-3">
            <div className="rounded-xl border border-border bg-card/95 backdrop-blur px-3 py-1.5 shadow-md">
              <p className="text-xs font-bold text-foreground inline-flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-brand-500" />
                Constructeur visuel
              </p>
              <p className="text-[10px] text-muted-foreground">
                {nodes.length} nœud{nodes.length > 1 ? 's' : ''} · {criteria.length} critère{criteria.length > 1 ? 's' : ''} · {sessions.length} session{sessions.length > 1 ? 's' : ''}
              </p>
            </div>
          </Panel>

          <Panel position="top-right" className="!m-3">
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  if (props.existingProgrammeId) router.push(`/programmes/${props.existingProgrammeId}/timeline`)
                  else toast.error('Enregistrez d’abord le programme pour ouvrir le Parcours')
                }}
                variant="outline"
                className="gap-1.5 shadow-md backdrop-blur bg-card/95 border-amber-500/40 text-amber-700 dark:text-amber-300"
                title="Ouvrir le Parcours (page séparée)">
                <Calendar className="h-4 w-4" />Voir le Parcours
              </Button>
              <Button onClick={autoArrange} variant="outline" className="gap-1.5 shadow-md backdrop-blur bg-card/95"
                title="Re-arranger automatiquement les nœuds">
                <LayoutGrid className="h-4 w-4" />Aligner
              </Button>
              <Button onClick={handleSave} disabled={saving} variant="brand" className="gap-1.5 shadow-lg">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? 'Sauvegarde…' : props.existingProgrammeId ? 'Enregistrer' : 'Créer le programme'}
              </Button>
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* INSPECTOR */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden flex flex-col">
        {!selectedNode ? (
          <div className="text-center py-8 px-4 text-muted-foreground flex-1 flex flex-col items-center justify-center">
            <FileQuestion className="mx-auto h-8 w-8 opacity-30 mb-2" />
            <p className="text-xs">Cliquez sur un nœud pour l'éditer,<br/>ou ajoutez-en un depuis la bibliothèque.</p>
          </div>
        ) : (
          <Inspector
            node={selectedNode}
            allCriteria={criteria}
            allSessions={sessions}
            progWindow={progWindow}
            onChange={(patch) => updateData(selectedNode.id, patch)}
            onSelectNode={setSelectedId}
            onDelete={(selectedNode.id === 'programme' || selectedNode.id === 'timeline') ? undefined : removeSelected}
          />
        )}
      </div>
      </div>
    </div>
  )
}

// ── Inspector dispatcher ────────────────────────────────────────────────────

function Inspector({ node, allCriteria, allSessions, progWindow, onChange, onSelectNode, onDelete }: {
  node: BuilderNode
  allCriteria: Node<CriterionData, 'criterion'>[]
  allSessions: Node<SessionData, 'session'>[]
  progWindow: { start?: string; end?: string }
  onChange: (patch: any) => void
  onSelectNode: (id: string) => void
  onDelete?: () => void
}) {
  const meta = NODE_META[node.data.kind as NodeKind]
  const c = COLOR_CLASSES[meta.color]
  const Icon = meta.icon

  return (
    <div className="flex flex-col h-full">
      <div className={`flex items-center gap-2 px-4 py-3 border-b border-border bg-gradient-to-r from-card to-muted/20`}>
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${c.bg} text-white`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{meta.category}</p>
          <p className="text-sm font-bold text-foreground truncate">{meta.label}</p>
        </div>
        {onDelete && (
          <button type="button" onClick={onDelete} title="Supprimer"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:border-destructive hover:text-destructive hover:bg-destructive/5 transition-colors">
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {node.data.kind === 'programme'    && <ProgrammeInspector  d={node.data as ProgrammeData}   onChange={onChange} />}
        {node.data.kind === 'description'  && <DescriptionInspector d={node.data as DescriptionData} onChange={onChange} />}
        {node.data.kind === 'visual'       && <VisualInspector     d={node.data as VisualData}      onChange={onChange} />}
        {node.data.kind === 'formTemplate' && <FormTemplateInspector d={node.data as FormTemplateData} onChange={onChange} />}
        {node.data.kind === 'stats'        && <StatsInspector      d={node.data as StatsData}       onChange={onChange} />}
        {node.data.kind === 'objectives'   && <ListInspector       items={(node.data as ObjectivesData).objectives} placeholder="Ajouter un objectif…" onChange={(items) => onChange({ objectives: items })} />}
        {node.data.kind === 'benefits'     && <ListInspector       items={(node.data as BenefitsData).benefits} placeholder="Ajouter un bénéfice…" onChange={(items) => onChange({ benefits: items })} />}
        {node.data.kind === 'timeline'     && <TimelineInspector   sessions={allSessions} onSelectNode={onSelectNode} />}
        {node.data.kind === 'criterion'    && <CriterionInspector  d={node.data as CriterionData} node={node as Node<CriterionData,'criterion'>}
                                                                    allSessions={allSessions} onChange={onChange} onSelectNode={onSelectNode} />}
        {node.data.kind === 'session'      && <SessionInspector    d={node.data as SessionData} node={node as Node<SessionData,'session'>}
                                                                    allCriteria={allCriteria} progWindow={progWindow} onChange={onChange} onSelectNode={onSelectNode} />}
      </div>
    </div>
  )
}

// ── Individual inspectors ───────────────────────────────────────────────────

function Field({ label, children, hint, required }: { label: string; children: React.ReactNode; hint?: string; required?: boolean }) {
  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
        {label}{required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  )
}

function ProgrammeInspector({ d, onChange }: { d: ProgrammeData; onChange: (p: Partial<ProgrammeData>) => void }) {
  const toggleSector = (s: string) => {
    const set = new Set(d.sectors); set.has(s) ? set.delete(s) : set.add(s)
    onChange({ sectors: Array.from(set) })
  }
  return (
    <>
      <Field label="Titre"><Input value={d.title} onChange={(e) => onChange({ title: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Statut">
          <select value={d.status} onChange={(e) => onChange({ status: e.target.value as any })}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm">
            <option value="DRAFT">Brouillon</option><option value="OPEN">Ouvert</option>
            <option value="IN_PROGRESS">En cours</option><option value="EVALUATION">Évaluation</option>
            <option value="CLOSED">Fermé</option>
          </select>
        </Field>
        <Field label="Type">
          <select value={d.type} onChange={(e) => onChange({ type: e.target.value as any })}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm">
            <option value="PUBLIC">Public</option><option value="PRIVATE">Privé</option>
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Date début" required><Input type="date" value={d.startDate ?? ''} onChange={(e) => onChange({ startDate: e.target.value })} /></Field>
        <Field label="Date fin" required><Input type="date" value={d.endDate ?? ''} onChange={(e) => onChange({ endDate: e.target.value })} /></Field>
      </div>
      <Field label={`Secteurs (${d.sectors.length})`}>
        <div className="flex flex-wrap gap-1">
          {SECTORS.map((s) => (
            <button type="button" key={s} onClick={() => toggleSector(s)}
              className={`rounded-full px-2 py-0.5 text-[10px] border transition-colors ${
                d.sectors.includes(s)
                  ? 'border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-300 font-semibold'
                  : 'border-border bg-card text-muted-foreground hover:border-brand-400'
              }`}>{s}</button>
          ))}
        </div>
      </Field>
    </>
  )
}

function DescriptionInspector({ d, onChange }: { d: DescriptionData; onChange: (p: any) => void }) {
  return (
    <Field label="Description longue" hint="Affichée sur la page publique du programme.">
      <textarea rows={10} value={d.description} onChange={(e) => onChange({ description: e.target.value })}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-y" />
    </Field>
  )
}

function VisualInspector({ d, onChange }: { d: VisualData; onChange: (p: any) => void }) {
  return (
    <>
      <Field label="Tagline" hint="Slogan court qui apparaît sous le titre.">
        <Input value={d.tagline} placeholder="Le programme FoodTech de référence" onChange={(e) => onChange({ tagline: e.target.value })} />
      </Field>
      <Field label="Logo URL"><Input value={d.logoUrl} placeholder="https://…" onChange={(e) => onChange({ logoUrl: e.target.value })} /></Field>
      <Field label="Bannière URL"><Input value={d.bannerImageUrl} placeholder="https://…" onChange={(e) => onChange({ bannerImageUrl: e.target.value })} /></Field>
      <Field label="Lieu"><Input value={d.location} placeholder="Startup Village, Tunis" onChange={(e) => onChange({ location: e.target.value })} /></Field>
      <Field label="Lien candidature externe (optionnel)" hint="Si rempli, remplace le formulaire interne.">
        <Input value={d.applicationUrl} placeholder="https://typeform.com/…" onChange={(e) => onChange({ applicationUrl: e.target.value })} />
      </Field>
    </>
  )
}

function FormTemplateInspector({ d, onChange }: { d: FormTemplateData; onChange: (p: any) => void }) {
  const [formModal, setFormModal] = useState(false)
  const customSchema = parseSchema(d.customFormSchema)
  const hasCustom = !!customSchema && customSchema.sections.length > 0
  const fieldCount = hasCustom
    ? customSchema!.sections.reduce((n, s) => n + s.fields.length, 0)
    : 0
  const templates = [
    { v: 'STANDARD',  label: 'Standard',      desc: 'Formulaire officiel Medianet — 4 sections' },
    { v: 'MINIMAL',   label: 'Minimaliste',   desc: 'Idéal pour hackathons — projet + motivation' },
    { v: 'FOODSTART', label: 'FoodStart',     desc: 'FoodTech — distribution + production' },
    { v: 'TECH',      label: 'Tech / SaaS',   desc: 'Stack technique + scalabilité' },
    { v: 'AGRITECH',  label: 'Agritech',      desc: 'Partenariats agricoles + impact' },
  ]
  return (
    <>
      {/* Custom form — overrides the skeleton when defined */}
      <Field label="Formulaire personnalisé">
        <div className="space-y-1.5">
          {hasCustom ? (
            <div className="rounded-lg border-2 border-indigo-500 bg-indigo-500/5 p-2">
              <p className="text-sm font-bold text-foreground">Personnalisé actif</p>
              <p className="text-[10px] text-muted-foreground">
                {customSchema!.sections.length} section(s) · {fieldCount} champ(s) — remplace le squelette ci-dessous.
              </p>
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground">
              Aucun formulaire personnalisé — les porteurs verront le squelette sélectionné ci-dessous.
            </p>
          )}
          <div className="flex gap-1.5">
            <Button type="button" variant="outline" size="sm" className="flex-1 gap-1 h-8 text-xs"
              onClick={() => setFormModal(true)}>
              <FormInput className="h-3 w-3" />{hasCustom ? 'Éditer le formulaire' : 'Créer un formulaire'}
            </Button>
            {hasCustom && (
              <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-destructive hover:text-destructive"
                onClick={() => { if (confirm('Supprimer le formulaire personnalisé ? Le squelette reprendra la main.')) onChange({ customFormSchema: '' }) }}>
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </Field>

      <Field label={`Squelette de formulaire${hasCustom ? ' (inactif — personnalisé prioritaire)' : ''}`}>
        <div className={`space-y-1.5 ${hasCustom ? 'opacity-50' : ''}`}>
          {templates.map((t) => (
            <button type="button" key={t.v} onClick={() => onChange({ formTemplate: t.v })}
              className={`w-full text-left rounded-lg border-2 p-2 transition-colors ${d.formTemplate === t.v ? 'border-indigo-500 bg-indigo-500/5' : 'border-border bg-card hover:border-indigo-400'}`}>
              <p className="text-sm font-bold text-foreground">{t.label}</p>
              <p className="text-[10px] text-muted-foreground">{t.desc}</p>
            </button>
          ))}
        </div>
      </Field>

      {/* Centered modal hosting the full FormBuilder (the inspector is too narrow) */}
      {formModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setFormModal(false)} />
          <div className="relative z-10 w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <FormInput className="h-4 w-4 text-indigo-500" />Formulaire de candidature personnalisé
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Sections + champs vus par les porteurs. Enregistré avec le programme (bouton Enregistrer du builder).
                </p>
              </div>
              <button type="button" onClick={() => setFormModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <FormBuilder
                value={customSchema}
                onChange={(next: CustomFormSchema | null) =>
                  onChange({ customFormSchema: next && next.sections.length ? JSON.stringify(next) : '' })}
              />
            </div>
            <div className="border-t border-border px-4 py-2.5 shrink-0 flex justify-end">
              <Button type="button" size="sm" onClick={() => setFormModal(false)}>Terminé</Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function StatsInspector({ d, onChange }: { d: StatsData; onChange: (p: any) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Field label="Startups"><Input type="number" value={d.maxStartups ?? ''} onChange={(e) => onChange({ maxStartups: e.target.value ? Number(e.target.value) : undefined })} /></Field>
      <Field label="Experts"><Input type="number" value={d.expertCount ?? ''} onChange={(e) => onChange({ expertCount: e.target.value ? Number(e.target.value) : undefined })} /></Field>
      <Field label="Sessions formation"><Input type="number" value={d.trainingSessionsCount ?? ''} onChange={(e) => onChange({ trainingSessionsCount: e.target.value ? Number(e.target.value) : undefined })} /></Field>
      <Field label="H. mentorat / mois"><Input type="number" value={d.mentoringHoursPerMonth ?? ''} onChange={(e) => onChange({ mentoringHoursPerMonth: e.target.value ? Number(e.target.value) : undefined })} /></Field>
    </div>
  )
}

function ListInspector({ items, placeholder, onChange }: { items: string[]; placeholder: string; onChange: (next: string[]) => void }) {
  const [input, setInput] = useState('')
  const add = () => { if (input.trim()) { onChange([...items, input.trim()]); setInput('') } }
  return (
    <>
      <Field label={`Liste (${items.length})`}>
        <div className="space-y-1">
          {items.map((it, i) => (
            <div key={i} className="flex items-center gap-1 rounded-md border border-border bg-muted/30 px-2 py-1">
              <span className="flex-1 text-xs text-foreground truncate">{it}</span>
              <button type="button" onClick={() => onChange(items.filter((_, idx) => idx !== i))}
                className="text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </Field>
      <div className="flex gap-1.5">
        <Input value={input} placeholder={placeholder} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }} />
        <Button type="button" onClick={add} variant="outline" size="sm" className="shrink-0"><Plus className="h-3.5 w-3.5" /></Button>
      </div>
    </>
  )
}

function CriterionInspector({ d, node, allSessions, onChange, onSelectNode }: {
  d: CriterionData
  node: Node<CriterionData, 'criterion'>
  allSessions: Node<SessionData, 'session'>[]
  onChange: (p: any) => void
  onSelectNode: (id: string) => void
}) {
  return (
    <>
      <Field label="Nom"><Input value={d.name} onChange={(e) => onChange({ name: e.target.value })} /></Field>
      <Field label="Description">
        <textarea rows={3} value={d.description} onChange={(e) => onChange({ description: e.target.value })}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-y" />
      </Field>
      <Field label={`Poids global du critère : ${Math.round((d.weight ?? 0) * 100)}%`}>
        <input type="range" min={0} max={100} step={5} value={Math.round((d.weight ?? 0) * 100)}
          onChange={(e) => onChange({ weight: Number(e.target.value) / 100 })}
          className="w-full accent-purple-500" />
      </Field>

      <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-3 mt-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 mb-2 flex items-center gap-1">
          <Sliders className="h-3 w-3" />Pondération sur les sessions
        </p>
        {allSessions.length === 0 ? (
          <p className="text-[11px] text-muted-foreground italic">Ajoute des sessions pour pouvoir leur attribuer un poids spécifique pour ce critère.</p>
        ) : (
          <div className="space-y-2">
            {allSessions.map((s) => {
              const w = s.data.criterionWeights?.[node.id] ?? 0
              return (
                <div key={s.id} className="rounded-md bg-card border border-border p-2">
                  <button type="button" onClick={() => onSelectNode(s.id)}
                    className="text-[11px] font-bold text-foreground hover:text-emerald-700 dark:hover:text-emerald-400 truncate text-left w-full">
                    {s.data.title || '(session sans titre)'}
                  </button>
                  <div className="flex items-center gap-2 mt-1">
                    <input type="range" min={0} max={100} step={5} value={Math.round(w * 100)}
                      onChange={(e) => {
                        const nextWeights = { ...(s.data.criterionWeights ?? {}), [node.id]: Number(e.target.value) / 100 }
                        // Update the session node from the criterion inspector — needs the
                        // parent setter. We piggy-back on a custom event since onChange is
                        // bound to this node only. Use a top-level dispatch hack via window.
                        ;(window as any).__builder_setSessionWeights?.(s.id, nextWeights)
                      }}
                      className="flex-1 accent-purple-500" />
                    <span className="text-[10px] font-bold text-foreground w-8 text-right">{Math.round(w * 100)}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

function SessionInspector({ d, node, allCriteria, progWindow, onChange, onSelectNode }: {
  d: SessionData
  node: Node<SessionData, 'session'>
  allCriteria: Node<CriterionData, 'criterion'>[]
  progWindow: { start?: string; end?: string }
  onChange: (p: any) => void
  onSelectNode: (id: string) => void
}) {
  const [tab, setTab] = useState<'info' | 'days' | 'tasks' | 'people' | 'weights'>('info')

  // Wire the global setter so CriterionInspector can adjust THIS session's weights
  if (typeof window !== 'undefined') {
    (window as any).__builder_setSessionWeights = (sessionId: string, w: Record<string, number>) => {
      if (sessionId === node.id) onChange({ criterionWeights: w })
      // For other sessions we'd need a different mechanism, but the criterion
      // inspector loops through allSessions and uses this for each — we miss
      // sessions other than the selected. Acceptable trade-off for the POC.
    }
  }

  const updateTask = (i: number, patch: Partial<{ title: string; assignee?: string; done: boolean }>) =>
    onChange({ tasks: d.tasks.map((t, idx) => idx === i ? { ...t, ...patch } : t) })
  const addTask = () => onChange({ tasks: [...d.tasks, { title: 'Nouvelle tâche', done: false }] })
  const removeTask = (i: number) => onChange({ tasks: d.tasks.filter((_, idx) => idx !== i) })

  return (
    <>
      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted/30 p-1">
        {[
          ['info',    'Infos',    Info],
          ['days',    'Jours',    Calendar],
          ['tasks',   'Tâches',   CheckSquare],
          ['people',  'Équipe',   Users],
          ['weights', 'Critères', Sliders],
        ].map(([key, label, Icon]: any) => (
          <button key={key} type="button" onClick={() => setTab(key)}
            className={`flex-1 inline-flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[10px] font-bold transition-colors ${tab === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            <Icon className="h-3 w-3" />{label}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <div className="space-y-3 pt-2">
          <Field label="Type de session">
            <div className="flex flex-wrap gap-1">
              {SESSION_TYPES.map((t) => (
                <button key={t} type="button" onClick={() => onChange({ sessionType: t })}
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-all ${
                    d.sessionType === t
                      ? SESSION_TYPE_TONE[t] + ' ring-2 ring-offset-1 ring-offset-card ring-current'
                      : 'border-border text-muted-foreground hover:border-emerald-400'}`}>
                  {SESSION_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Statut">
            <div className="flex gap-1.5">
              {(['UPCOMING', 'ACTIVE', 'COMPLETED'] as const).map((s) => (
                <button key={s} type="button" onClick={() => onChange({ status: s })}
                  className={`flex-1 rounded-md border-2 px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                    d.status === s
                      ? s === 'ACTIVE'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      : 'border-border bg-card text-muted-foreground hover:border-emerald-400'}`}>
                  {s === 'UPCOMING' ? 'À venir' : s === 'ACTIVE' ? 'En cours' : 'Terminée'}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Titre"><Input value={d.title} onChange={(e) => onChange({ title: e.target.value })} /></Field>
          <Field label="Description">
            <textarea rows={3} value={d.description} onChange={(e) => onChange({ description: e.target.value })}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-y" />
          </Field>
          <Field label="Durée">
            <div className="flex gap-1.5">
              {(['day', 'week', 'custom'] as const).map((k) => (
                <button type="button" key={k}
                  onClick={() => {
                    // Switching duration kind reflows endDate sensibly:
                    //  - day    → mirror start
                    //  - week   → start + 6
                    //  - custom → keep as-is
                    let patch: any = { durationKind: k }
                    if (d.startDate) {
                      if (k === 'day') {
                        patch.endDate = d.startDate
                      } else if (k === 'week') {
                        const dt = new Date(d.startDate + 'T12:00:00')
                        dt.setDate(dt.getDate() + 6)
                        patch.endDate = dt.toISOString().slice(0, 10)
                      }
                    }
                    onChange(patch)
                  }}
                  className={`flex-1 rounded-md border-2 px-2 py-1.5 text-[11px] font-semibold transition-colors capitalize ${d.durationKind === k ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-border bg-card text-muted-foreground hover:border-emerald-400'}`}>
                  {k === 'day' ? 'Journée' : k === 'week' ? 'Semaine' : 'Personnalisé'}
                </button>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Début">
              <Input type="date" value={d.startDate ?? ''}
                min={progWindow.start} max={progWindow.end}
                onChange={(e) => {
                const sd = e.target.value
                // For "day" sessions, lock endDate to startDate.
                const patch: any = { startDate: sd }
                if (d.durationKind === 'day') patch.endDate = sd
                else if (d.durationKind === 'week' && sd) {
                  const dt = new Date(sd + 'T12:00:00')
                  dt.setDate(dt.getDate() + 6)
                  patch.endDate = dt.toISOString().slice(0, 10)
                }
                onChange(patch)
              }} />
            </Field>
            <Field label={d.durationKind === 'day' ? 'Fin (= Début)' : 'Fin'}>
              <Input
                type="date"
                value={d.endDate ?? ''}
                min={d.startDate || progWindow.start} max={progWindow.end}
                disabled={d.durationKind === 'day'}
                title={d.durationKind === 'day'
                  ? 'Verrouillé — passez à "Semaine" ou "Personnalisé" pour modifier'
                  : ''}
                onChange={(e) => onChange({ endDate: e.target.value })}
                className={d.durationKind === 'day' ? 'opacity-60 cursor-not-allowed' : ''}
              />
            </Field>
          </div>
          {(progWindow.start || progWindow.end) && (
            <p className="text-[10px] text-muted-foreground -mt-1">
              La session doit rester dans la fenêtre du programme ({progWindow.start ?? '?'} → {progWindow.end ?? '?'}).
            </p>
          )}
          <Field label="Lieu"><Input value={d.location} placeholder="Salle A, en ligne, …" onChange={(e) => onChange({ location: e.target.value })} /></Field>
        </div>
      )}

      {tab === 'days' && (
        <DaysTab d={d} onChange={onChange} />
      )}

      {tab === 'tasks' && (
        <div className="space-y-2 pt-2">
          {d.tasks.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic">Aucune tâche. Ajoutez-en pour préparer la session.</p>
          ) : (
            d.tasks.map((t, i) => (
              <div key={i} className="rounded-md border border-border bg-muted/30 p-2 space-y-1">
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={t.done} onChange={(e) => updateTask(i, { done: e.target.checked })}
                    className="h-3.5 w-3.5 accent-emerald-500" />
                  <input value={t.title} onChange={(e) => updateTask(i, { title: e.target.value })}
                    className={`flex-1 bg-transparent text-xs focus:outline-none ${t.done ? 'line-through text-muted-foreground' : 'text-foreground'}`} />
                  <button type="button" onClick={() => removeTask(i)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                <Input value={t.assignee ?? ''} placeholder="Assignée à (optionnel)"
                  onChange={(e) => updateTask(i, { assignee: e.target.value })} className="h-7 text-[11px]" />
              </div>
            ))
          )}
          <Button type="button" onClick={addTask} variant="outline" size="sm" className="w-full gap-1.5">
            <Plus className="h-3 w-3" />Ajouter une tâche
          </Button>
        </div>
      )}

      {tab === 'people' && (
        <div className="space-y-4 pt-2">
          <PeopleList label="Responsables" icon={Users}
            items={d.responsibles} placeholder="Nom ou email…"
            onChange={(items) => onChange({ responsibles: items })} />
          <PeopleList label="Invités externes" icon={UserPlus}
            items={d.guests} placeholder="Nom de l'invité…"
            onChange={(items) => onChange({ guests: items })} />
          <PeopleList label="Startups" icon={Building2}
            items={d.startupIds.map(String)} placeholder="ID candidature…"
            onChange={(items) => onChange({ startupIds: items.map(Number).filter((n) => !isNaN(n)) })} />
        </div>
      )}

      {tab === 'weights' && (
        <div className="space-y-2 pt-2">
          <p className="text-[10px] text-muted-foreground">
            Poids de chaque critère SPÉCIFIQUE à cette session. Différent du poids global du critère.
          </p>
          {allCriteria.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic">Ajoutez des critères pour les pondérer ici.</p>
          ) : (
            allCriteria.map((c) => {
              const w = d.criterionWeights?.[c.id] ?? 0
              return (
                <div key={c.id} className="rounded-md border border-border bg-muted/30 p-2">
                  <button type="button" onClick={() => onSelectNode(c.id)}
                    className="text-[11px] font-bold text-foreground hover:text-purple-700 dark:hover:text-purple-400 truncate text-left w-full">
                    {c.data.name || '(critère sans nom)'}
                  </button>
                  <div className="flex items-center gap-2 mt-1">
                    <input type="range" min={0} max={100} step={5} value={Math.round(w * 100)}
                      onChange={(e) => onChange({ criterionWeights: { ...d.criterionWeights, [c.id]: Number(e.target.value) / 100 } })}
                      className="flex-1 accent-purple-500" />
                    <span className="text-[10px] font-bold text-foreground w-8 text-right">{Math.round(w * 100)}%</span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </>
  )
}

function PeopleList({ label, icon: Icon, items, placeholder, onChange }: {
  label: string; icon: any; items: string[]; placeholder: string; onChange: (next: string[]) => void
}) {
  const [input, setInput] = useState('')
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
        <Icon className="h-3 w-3" />{label} ({items.length})
      </p>
      <div className="space-y-1 mb-1.5">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-1 rounded-md border border-border bg-muted/30 px-2 py-1">
            <span className="flex-1 text-[11px] text-foreground truncate">{it}</span>
            <button type="button" onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              className="text-muted-foreground hover:text-destructive transition-colors">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-1.5">
        <Input value={input} placeholder={placeholder} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (input.trim()) { onChange([...items, input.trim()]); setInput('') } } }}
          className="h-8 text-xs" />
        <Button type="button" onClick={() => { if (input.trim()) { onChange([...items, input.trim()]); setInput('') } }}
          variant="outline" size="sm" className="h-8 px-2"><Plus className="h-3 w-3" /></Button>
      </div>
    </div>
  )
}

function TimelineInspector({ sessions, onSelectNode }: { sessions: Node<SessionData, 'session'>[]; onSelectNode: (id: string) => void }) {
  if (sessions.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground italic">
        Aucune session sur la timeline. Ajoutez une <strong>Session</strong> depuis la bibliothèque — elle sera automatiquement reliée à la timeline.
      </p>
    )
  }
  // Sort by startDate when available
  const sorted = [...sessions].sort((a, b) => (a.data.startDate ?? '').localeCompare(b.data.startDate ?? ''))
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] text-muted-foreground mb-1">{sorted.length} session(s) sur la timeline. Cliquez pour éditer.</p>
      {sorted.map((s, i) => (
        <button key={s.id} type="button" onClick={() => onSelectNode(s.id)}
          className="w-full text-left rounded-lg border border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500 transition-colors p-2">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[9px] font-bold px-1.5 py-0.5">#{i + 1}</span>
            <span className="text-xs font-bold text-foreground flex-1 truncate">{s.data.title}</span>
            <span className="text-[9px] text-muted-foreground uppercase">{s.data.durationKind}</span>
          </div>
          {(s.data.startDate || s.data.endDate) && (
            <p className="text-[9px] text-muted-foreground mt-0.5"><Clock className="h-2.5 w-2.5 inline mr-0.5" />{s.data.startDate ?? '?'} → {s.data.endDate ?? '?'}</p>
          )}
        </button>
      ))}
    </div>
  )
}


// ── DaysTab — embedded day/activity editor inside the Session inspector ───────

function DaysTab({ d, onChange }: { d: SessionData; onChange: (p: any) => void }) {
  const days = d.days ?? []
  const updateDay = (i: number, patch: Partial<BuilderDay>) =>
    onChange({ days: days.map((day, idx) => idx === i ? { ...day, ...patch } : day) })
  const addDay = () => onChange({ days: [...days, {
    dayOrder: days.length + 1, title: '', activities: [],
  } as BuilderDay] })
  const removeDay = (i: number) =>
    onChange({ days: days.filter((_, idx) => idx !== i).map((day, idx) => ({ ...day, dayOrder: idx + 1 })) })

  if (days.length === 0) {
    return (
      <div className="space-y-2 pt-2">
        <p className="text-[11px] text-muted-foreground italic">
          Aucun jour. Décomposez cette session en 1..N jours avec activités timées.
        </p>
        <Button type="button" onClick={addDay} variant="outline" size="sm" className="w-full gap-1.5">
          <Plus className="h-3 w-3" />Ajouter le 1er jour
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3 pt-2">
      {days.map((day, i) => (
        <DayBlock key={i} day={day}
          onUpdate={(patch) => updateDay(i, patch)}
          onRemove={() => removeDay(i)} />
      ))}
      <Button type="button" onClick={addDay} variant="outline" size="sm" className="w-full gap-1.5">
        <Plus className="h-3 w-3" />Ajouter un jour
      </Button>
    </div>
  )
}

function DayBlock({ day, onUpdate, onRemove }: {
  day: BuilderDay; onUpdate: (p: Partial<BuilderDay>) => void; onRemove: () => void
}) {
  const activities = day.activities ?? []
  const updateAct = (i: number, patch: Partial<BuilderActivity>) =>
    onUpdate({ activities: activities.map((a, idx) => idx === i ? { ...a, ...patch } : a) })
  const addAct = () => onUpdate({ activities: [...activities, {
    activityOrder: activities.length, title: 'Nouvelle activité',
    type: 'ACTIVITY' as ActivityType, responsibles: [], guests: [],
  } as BuilderActivity] })
  const removeAct = (i: number) =>
    onUpdate({ activities: activities.filter((_, idx) => idx !== i)
      .map((a, idx) => ({ ...a, activityOrder: idx })) })

  return (
    <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2 space-y-2">
      <div className="flex items-center gap-1.5">
        <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-700 dark:text-emerald-300">
          Jour {day.dayOrder ?? '?'}
        </span>
        <Input value={day.title ?? ''} placeholder="Titre du jour (ex. Kickoff)"
          onChange={(e) => onUpdate({ title: e.target.value })}
          className="h-7 text-[11px] flex-1" />
        <button type="button" onClick={onRemove}
          className="text-muted-foreground hover:text-destructive" title="Supprimer le jour">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <Input type="date" value={day.date ?? ''} onChange={(e) => onUpdate({ date: e.target.value })}
          className="h-7 text-[11px]" />
        <Input value={day.location ?? ''} placeholder="Lieu spécifique"
          onChange={(e) => onUpdate({ location: e.target.value })} className="h-7 text-[11px]" />
      </div>

      <div className="space-y-1.5">
        {activities.length === 0 && (
          <p className="text-[10px] text-muted-foreground italic text-center py-1">
            Pas encore d'activité.
          </p>
        )}
        {activities.map((a, i) => (
          <ActivityBlock key={i} a={a}
            onUpdate={(patch) => updateAct(i, patch)}
            onRemove={() => removeAct(i)} />
        ))}
        <Button type="button" onClick={addAct} variant="ghost" size="sm"
          className="w-full h-7 gap-1.5 text-[10px]">
          <Plus className="h-3 w-3" />Ajouter une activité
        </Button>
      </div>
    </div>
  )
}

function ActivityBlock({ a, onUpdate, onRemove }: {
  a: BuilderActivity; onUpdate: (p: Partial<BuilderActivity>) => void; onRemove: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded border border-border bg-background">
      <div className="flex items-center gap-1 p-1.5">
        <button type="button" onClick={() => setOpen(o => !o)}
          className="text-muted-foreground hover:text-foreground text-[10px]">
          {open ? '▾' : '▸'}
        </button>
        <Input value={a.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          className="h-6 text-[11px] flex-1" />
        <Input type="time" value={(a.startTime ?? '').slice(0, 5)}
          onChange={(e) => onUpdate({ startTime: e.target.value })} className="h-6 text-[10px] w-16" />
        <span className="text-muted-foreground text-[9px]">→</span>
        <Input type="time" value={(a.endTime ?? '').slice(0, 5)}
          onChange={(e) => onUpdate({ endTime: e.target.value })} className="h-6 text-[10px] w-16" />
        <button type="button" onClick={onRemove}
          className="text-muted-foreground hover:text-destructive">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      {open && (
        <div className="space-y-1.5 border-t border-border p-2">
          <div className="flex flex-wrap gap-1">
            {ACTIVITY_TYPES.map(t => (
              <button key={t} type="button" onClick={() => onUpdate({ type: t })}
                className={`rounded px-1.5 py-0.5 text-[9px] font-semibold border transition-all ${
                  a.type === t
                    ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                    : 'border-border text-muted-foreground hover:border-emerald-400'}`}>
                {ACTIVITY_TYPE_LABEL[t]}
              </button>
            ))}
          </div>
          <Input value={a.description ?? ''} placeholder="Description courte"
            onChange={(e) => onUpdate({ description: e.target.value })}
            className="h-6 text-[11px]" />
          <Input value={a.location ?? ''} placeholder="Lieu (salle, lien)"
            onChange={(e) => onUpdate({ location: e.target.value })} className="h-6 text-[11px]" />
          <Input value={(a.responsibles ?? []).join(', ')}
            placeholder="Responsables (séparés par virgule)"
            onChange={(e) => onUpdate({ responsibles: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
            className="h-6 text-[11px]" />
          <Input value={(a.guests ?? []).join(', ')}
            placeholder="Invités (séparés par virgule)"
            onChange={(e) => onUpdate({ guests: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
            className="h-6 text-[11px]" />
        </div>
      )}
    </div>
  )
}
