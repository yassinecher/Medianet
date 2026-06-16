'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot, Send, Loader2, User as UserIcon, Sparkles, History, RotateCcw, Check, X,
  AlertCircle, Trash2, MessageSquare, Zap, Settings as SettingsIcon,
  ChevronDown, ChevronRight, Brain, Search, Wrench, Image as ImageIcon,
  StopCircle, ArrowDown, Copy, CheckCheck,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { adminAiApi } from '@/lib/api'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { MagicCard } from '@/components/magicui/magic-card'
import { Button } from '@/components/ui/button'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Action {
  id: number
  tool: string
  title: string
  description?: string
  argsJson?: string
  status: 'PENDING' | 'EXECUTED' | 'FAILED' | 'REVERTED' | 'CANCELLED'
  errorMessage?: string
  createdAt?: string
  executedAt?: string
  revertedAt?: string
  resultJson?: string
}

interface Conversation {
  id: number
  title: string
  updatedAt?: string
}

/** A raw OpenAI-format message as stored in the DB. */
interface RawMessage {
  role: 'user' | 'assistant' | 'tool' | 'system'
  content: string | null
  tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>
  tool_call_id?: string
  name?: string
}

/** A grouped "turn": one user input → series of assistant + tool messages → final assistant text. */
interface Turn {
  /** The user message that started this turn (null for streaming new turn that hasn't been saved yet). */
  user: string
  /** Final text from the assistant (visible). */
  finalText: string
  /** Internal steps (tool calls + tool results) — collapsible "Réflexion". */
  steps: Step[]
  /** True while we're still waiting for the backend to return. */
  pending?: boolean
  /** Live activity label while streaming ("🔍 Recherche programmes…"). */
  liveStatus?: string
  /** Pending action ids referenced by this turn (so we can highlight them in the right panel). */
  pendingActionIds?: number[]
  /** Quick-reply chips suggested by the backend for the last turn. */
  suggestions?: string[]
  /** Inline "system" notes injected by the server (e.g. action confirmed/refused). */
  systemNotes?: string[]
  /** Photos returned by search_photos calls — rendered inline as cards above the AI bubble. */
  photoResults?: PhotoResult[]
  /** Multi-choice question from the AI — renders as clickable chips. */
  clarification?: {
    question: string
    multiSelect: boolean
    options: Array<{ label: string; description?: string }>
  }
  /** Multi-step plan from the AI — renders as a wizard with "Apply all". */
  plan?: ActionPlan
  /** When this turn started — used for animation keys. */
  ts: number
}

interface ActionPlan {
  title: string
  summary?: string
  steps: Array<{
    label: string
    tool: string
    args: Record<string, any>
    optional?: boolean
    dependsOnStep?: number
    fillField?: string
  }>
}

interface PhotoResult {
  url: string
  thumbnail?: string
  credit?: string
  creditUrl?: string
  title?: string
  query?: string
  size?: string
  topical?: boolean
  source?: string  // 'pexels' | 'unsplash' | 'openverse' | 'picsum'
}

interface Step {
  kind: 'tool_call' | 'tool_result' | 'thought'
  tool?: string
  args?: any
  result?: string
  isError?: boolean
}

const SUGGESTION_CATEGORIES: Array<{ tag: string; tagColor: string; items: { icon: string; label: string }[] }> = [
  {
    tag: 'Rapide',
    tagColor: 'bg-brand-500/15 text-brand-700 dark:text-brand-300',
    items: [
      { icon: '📋', label: 'Liste les programmes ouverts' },
      { icon: '📊', label: 'Combien de candidatures en évaluation ?' },
      { icon: '⏳', label: 'Que reste-t-il à confirmer ?' },
    ],
  },
  {
    tag: 'Créer',
    tagColor: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    items: [
      { icon: '🚀', label: 'Crée un programme « FoodTech 2026 » ouvert dès demain' },
      { icon: '✉️', label: 'Invite jane@example.com comme Juré' },
      { icon: '🖼', label: 'Trouve 4 photos tunisiennes pour la page d\'accueil' },
    ],
  },
  {
    tag: 'Audit',
    tagColor: 'bg-purple-500/15 text-purple-700 dark:text-purple-300',
    items: [
      { icon: '🔍', label: 'Liste les utilisateurs inactifs' },
      { icon: '🏆', label: 'Top 5 candidatures par score' },
    ],
  },
]

const STATUS_META: Record<string, { label: string; bg: string }> = {
  PENDING:   { label: 'En attente',  bg: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  EXECUTED:  { label: 'Exécutée',    bg: 'bg-green-500/10 text-green-700 dark:text-green-400' },
  FAILED:    { label: 'Échec',       bg: 'bg-red-500/10 text-red-700 dark:text-red-400' },
  REVERTED:  { label: 'Annulée',     bg: 'bg-orange-500/10 text-orange-700 dark:text-orange-400' },
  CANCELLED: { label: 'Refusée',     bg: 'bg-muted text-muted-foreground' },
}

// Friendly French labels per tool
const TOOL_LABEL: Record<string, string> = {
  search_programmes:   'Recherche de programmes',
  search_candidatures: 'Recherche de candidatures',
  search_users:        'Recherche d\'utilisateurs',
  search_photos:       'Recherche de photos',
  get_programme:       'Lecture d\'un programme',
  list_pending_actions:'Actions en attente',
  create_programme:    'Créer un programme',
  update_programme:    'Mettre à jour un programme',
  change_programme_status: 'Changer le statut',
  create_task:         'Créer une tâche',
  send_email:          'Envoyer un email',
  invite_user:         'Inviter un utilisateur',
  set_user_roles:      'Mettre à jour les rôles',
  toggle_user_active:  'Activer/désactiver',
  update_landing_page: 'Mettre à jour la page d\'accueil',
}

const TOOL_ICON: Record<string, any> = {
  search_programmes:   Search,
  search_candidatures: Search,
  search_users:        Search,
  search_photos:       ImageIcon,
  get_programme:       Search,
  list_pending_actions:Search,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Group flat OpenAI messages into Turns. */
function buildTurns(raw: RawMessage[]): Turn[] {
  const turns: Turn[] = []
  let current: Turn | null = null

  for (const m of raw) {
    if (m.role === 'user') {
      // A new turn starts. Plain string content; tool results also use role=user in some
      // implementations, but our backend uses role=tool for those so this is safe.
      current = { user: typeof m.content === 'string' ? m.content : '', finalText: '', steps: [], ts: turns.length }
      turns.push(current)
    } else if (m.role === 'assistant' && current) {
      // Text content if any
      if (typeof m.content === 'string' && m.content.trim()) {
        current.finalText = m.content
        // If there are also tool_calls, we keep the text as a "thought"
        if (m.tool_calls && m.tool_calls.length > 0) {
          current.steps.push({ kind: 'thought', result: m.content })
          current.finalText = '' // not final yet, will be overwritten by later text-only assistant msg
        }
      }
      // Tool calls
      for (const c of m.tool_calls ?? []) {
        let parsedArgs: any = {}
        try { parsedArgs = JSON.parse(c.function.arguments || '{}') } catch {}
        current.steps.push({ kind: 'tool_call', tool: c.function.name, args: parsedArgs })
      }
    } else if (m.role === 'tool' && current) {
      current.steps.push({ kind: 'tool_result', tool: m.name, result: m.content ?? '' })
      // search_photos returns JSON with items[] — surface those as proper photo cards
      if (m.name === 'search_photos' && typeof m.content === 'string') {
        try {
          const parsed = JSON.parse(m.content)
          const items = Array.isArray(parsed?.items) ? parsed.items : []
          if (items.length > 0) {
            const photos: PhotoResult[] = items.map((p: any) => ({
              url: String(p.url),
              thumbnail: p.thumbnail ? String(p.thumbnail) : undefined,
              credit: p.credit ? String(p.credit) : undefined,
              creditUrl: p.creditUrl ? String(p.creditUrl) : undefined,
              title: p.title ? String(p.title) : undefined,
              query: p.query ? String(p.query) : undefined,
              size: p.size ? String(p.size) : undefined,
              topical: p.topical ?? true,
              source: parsed.source ? String(parsed.source) : undefined,
            }))
            current.photoResults = [...(current.photoResults ?? []), ...photos]
          }
        } catch {}
      }
    } else if (m.role === 'system' && current && typeof m.content === 'string') {
      // Server-injected lifecycle note (action confirmed / refused / reverted)
      current.systemNotes = [...(current.systemNotes ?? []), m.content]
    }
  }
  return turns
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminAiPage() {
  const [conversationId, setConversationId] = useState<number | undefined>()
  const [conversations,  setConversations]  = useState<Conversation[]>([])
  const [turns,          setTurns]          = useState<Turn[]>([])
  const [pendingActions, setPendingActions] = useState<Action[]>([])
  const [historyActions, setHistoryActions] = useState<Action[]>([])
  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [tab,      setTab]      = useState<'chat' | 'history'>('chat')
  const [info,     setInfo]     = useState<{ backend: string; model: string; configured?: boolean } | null>(null)
  const [showJumpBtn, setShowJumpBtn] = useState(false)
  // Timestamp of the last successful confirmation — drives the "Continuer" chip
  // on the last turn so the admin can resume a multi-step plan in one click.
  const [lastConfirmHint, setLastConfirmHint] = useState<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortRef  = useRef<AbortController | null>(null)

  // ── Effects ────────────────────────────────────────────────────────────
  useEffect(() => { refreshConversations() }, [])
  useEffect(() => { refreshActions() }, [])
  useEffect(() => { adminAiApi.info().then((r) => setInfo(r.data)).catch(() => {}) }, [])
  useEffect(() => {
    // Auto-scroll to bottom UNLESS the user has scrolled up to read history
    if (!scrollRef.current) return
    const el = scrollRef.current
    const near = el.scrollHeight - (el.scrollTop + el.clientHeight) < 120
    if (near) el.scrollTop = el.scrollHeight
  }, [turns, loading])
  // Toggle the "jump to bottom" floating button
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      const dist = el.scrollHeight - (el.scrollTop + el.clientHeight)
      setShowJumpBtn(dist > 200)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [turns.length])
  const jumpToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }
  }

  const refreshConversations = () =>
    adminAiApi.conversations().then((r) => setConversations(r.data ?? [])).catch(() => {})

  const refreshActions = () =>
    Promise.all([
      adminAiApi.actions('PENDING').then((r) => setPendingActions(r.data ?? [])),
      adminAiApi.actions().then((r) => setHistoryActions(r.data ?? [])),
    ]).catch(() => {})

  const loadConversation = async (id: number) => {
    setConversationId(id)
    try {
      const r = await adminAiApi.messages(id)
      const raw = (r.data ?? []).map((m: any) => {
        try { return JSON.parse(m.contentJson) } catch { return null }
      }).filter(Boolean) as RawMessage[]
      setTurns(buildTurns(raw))
    } catch {
      toast.error('Conversation introuvable')
    }
  }

  const newConversation = () => {
    setConversationId(undefined)
    setTurns([])
  }

  const sendMessage = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim()
    if (!text || loading) return
    setInput('')
    setLastConfirmHint(null)  // hide the "Continuer" chip once a new message is sent
    // Optimistic turn — shows the user message + a "thinking" state
    setTurns((prev) => [...prev, { user: text, finalText: '', steps: [], pending: true, ts: Date.now() }])
    setLoading(true)
    // Fresh abort controller so the user can stop a slow request
    abortRef.current = new AbortController()

    // Mutate the live (last, pending) turn immutably — used by stream events.
    const patchLive = (fn: (t: Turn) => void) =>
      setTurns((prev) => {
        const next = [...prev]
        const last = next[next.length - 1]
        if (last?.pending) {
          const copy = { ...last, steps: [...last.steps] }
          fn(copy)
          next[next.length - 1] = copy
        }
        return next
      })

    try {
      // ── 1. Live SSE stream (preferred) — fall back to blocking POST ────────
      let done: any = null
      let streamError: string | null = null
      let gotAnyEvent = false
      try {
        await adminAiApi.chatStream({ conversationId, message: text }, (type, payload) => {
          gotAnyEvent = true
          switch (type) {
            case 'status':
              patchLive((t) => { t.liveStatus = payload?.label })
              break
            case 'tool_start':
              patchLive((t) => {
                t.liveStatus = payload?.label
                t.steps.push({ kind: 'tool_call', tool: payload?.tool })
              })
              break
            case 'tool_end':
              patchLive((t) => {
                t.liveStatus = undefined
                t.steps.push({ kind: 'tool_result', tool: payload?.tool, result: payload?.preview, isError: payload?.ok === false })
              })
              break
            case 'action_proposed':
              patchLive((t) => { t.liveStatus = `📋 ${payload?.title ?? 'Action proposée'}` })
              break
            case 'text':
              patchLive((t) => { t.finalText = payload?.content ?? '' })
              break
            case 'done':
              done = payload
              break
            case 'error':
              streamError = payload?.message ?? 'Erreur du flux'
              break
          }
        }, abortRef.current.signal)
      } catch (streamErr: any) {
        if (streamErr?.name === 'AbortError') throw streamErr
        // Endpoint unreachable before any event → silent fallback to blocking chat
        if (!gotAnyEvent) {
          const r = await adminAiApi.chat({ conversationId, message: text }, abortRef.current.signal)
          done = r.data
        } else if (!done) {
          throw streamErr
        }
      }
      if (!done && streamError) throw new Error(streamError)
      if (!done) throw new Error('Le flux s\'est terminé sans réponse.')

      // ── 2. Post-processing — identical to the blocking path ────────────────
      setConversationId(done.conversationId)
      // Reload conversation to get the full thread
      const msgs = await adminAiApi.messages(done.conversationId)
      const raw = (msgs.data ?? []).map((m: any) => {
        try { return JSON.parse(m.contentJson) } catch { return null }
      }).filter(Boolean) as RawMessage[]
      const rebuilt = buildTurns(raw)
      // Mark the last turn's pending action ids + suggestions + clarification so the UI highlights them
      if (rebuilt.length > 0) {
        if ((done.pendingActionIds ?? []).length > 0) {
          rebuilt[rebuilt.length - 1].pendingActionIds = done.pendingActionIds
        }
        if ((done.suggestions ?? []).length > 0) {
          rebuilt[rebuilt.length - 1].suggestions = done.suggestions
        }
        if (done.clarification) {
          rebuilt[rebuilt.length - 1].clarification = done.clarification
        }
        if (done.plan) {
          rebuilt[rebuilt.length - 1].plan = done.plan
        }
      }
      setTurns(rebuilt)
      if ((done.pendingActionIds ?? []).length > 0) {
        toast.success(`${done.pendingActionIds.length} action(s) à confirmer →`)
        refreshActions()
      }
      refreshConversations()
    } catch (err: any) {
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED' || err?.name === 'AbortError') {
        setTurns((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last && last.pending) { last.pending = false; last.finalText = '⏹ Génération arrêtée.' }
          return next
        })
        toast('Génération arrêtée', { icon: '⏹' })
        return
      }
      const msg = err.response?.data?.message ?? 'Erreur lors de la requête'
      // Replace the optimistic pending turn with an error
      setTurns((prev) => {
        const next = [...prev]
        const last = next[next.length - 1]
        if (last && last.pending) {
          last.pending = false
          last.finalText = `⚠ ${msg}`
        }
        return next
      })
      toast.error(msg)
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }

  const stopGeneration = () => {
    if (abortRef.current) abortRef.current.abort()
  }

  /** Re-send the most recent user message — useful when the AI flubbed it. */
  const regenerate = () => {
    if (loading) return
    // Find the last user message in the current turns
    const lastUserMsg = [...turns].reverse().find((t) => t.user)?.user
    if (!lastUserMsg) return
    // Drop the last turn (the bad one) and replay
    setTurns((prev) => prev.slice(0, -1))
    sendMessage(lastUserMsg)
  }

  /** Confirm every PENDING action proposed in the current (last) turn in sequence. */
  const handleConfirmAllInTurn = async (ids: number[]) => {
    if (ids.length === 0) return
    if (!confirm(`Confirmer ${ids.length} action(s) en lot ?`)) return
    let ok = 0
    for (const id of ids) {
      try { await adminAiApi.confirm(id); ok++ } catch {}
    }
    toast.success(`${ok}/${ids.length} action(s) exécutée(s)`)
    refreshActions()
  }

  /** After any status change, refresh actions + reload the conversation so the
   *  new server-side system note appears inline (and the AI sees it next turn). */
  const refreshConversationAndActions = async () => {
    refreshActions()
    if (!conversationId) return
    try {
      const r = await adminAiApi.messages(conversationId)
      const raw = (r.data ?? []).map((m: any) => {
        try { return JSON.parse(m.contentJson) } catch { return null }
      }).filter(Boolean) as RawMessage[]
      setTurns(buildTurns(raw))
    } catch {}
  }

  const handleConfirm = async (id: number) => {
    try {
      await adminAiApi.confirm(id)
      toast.success('Action exécutée')
      await refreshConversationAndActions()
      // Surface a "Continuer" chip on the last turn so the admin can resume
      // the multi-step plan with one click (or type something else to redirect).
      setLastConfirmHint(Date.now())
    }
    catch (err: any) { toast.error(err.response?.data?.message ?? 'Échec') }
  }
  const handleCancel = async (id: number) => {
    try { await adminAiApi.cancel(id); toast.success('Action refusée'); await refreshConversationAndActions() }
    catch (err: any) { toast.error(err.response?.data?.message ?? 'Erreur') }
  }
  const handleRevert = async (id: number) => {
    if (!confirm('Annuler cette action et restaurer l\'état précédent ?')) return
    try { await adminAiApi.revert(id); toast.success('Action annulée'); await refreshConversationAndActions() }
    catch (err: any) { toast.error(err.response?.data?.message ?? 'Erreur') }
  }
  const handleDeleteConversation = async (id: number) => {
    if (!confirm('Supprimer cette conversation ?')) return
    try {
      await adminAiApi.deleteConversation(id)
      setConversations((prev) => prev.filter((c) => c.id !== id))
      if (conversationId === id) newConversation()
      toast.success('Conversation supprimée')
    } catch { toast.error('Erreur') }
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <AdminLayout>
      <div className="grid gap-4 lg:grid-cols-[260px_1fr_320px] h-[calc(100vh-8rem)]">

        {/* ── LEFT: Conversation history ─────────────────────────── */}
        <div className="flex flex-col gap-3 overflow-hidden">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-foreground text-sm">Conversations</h2>
            <Button variant="ghost" size="sm" onClick={newConversation} className="gap-1.5 text-xs">
              <MessageSquare className="h-3.5 w-3.5" />Nouvelle
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 pr-1">
            {conversations.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Aucune conversation.</p>
            ) : conversations.map((c) => (
              <div key={c.id} className="group flex items-center gap-1">
                <button type="button" onClick={() => loadConversation(c.id)}
                  className={`flex-1 text-left rounded-lg px-3 py-2 text-xs transition-colors min-w-0
                    ${conversationId === c.id
                      ? 'bg-brand-500/10 text-brand-700 dark:text-brand-300 font-semibold'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                  <p className="truncate">{c.title}</p>
                </button>
                <button type="button" onClick={() => handleDeleteConversation(c.id)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1 transition-opacity">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── CENTER: Chat ──────────────────────────────────────── */}
        <div className="flex flex-col rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-3 border-b border-border px-5 py-3 bg-muted/20">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 shadow-lg shadow-brand-500/30">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-foreground">Assistant IA</h1>
              <p className="text-xs text-muted-foreground truncate">
                {info ? (
                  <span>{info.backend} · <code className="text-[10px] bg-muted px-1 py-0.5 rounded">{info.model}</code></span>
                ) : 'Toutes les écritures requièrent votre confirmation.'}
              </p>
            </div>
            <Link href="/ai-assistant/settings">
              <Button variant="ghost" size="sm" className="gap-1.5">
                <SettingsIcon className="h-3.5 w-3.5" />Paramètres
              </Button>
            </Link>
          </div>

          {/* Messages */}
          <div className="relative flex-1 overflow-hidden">
            <div ref={scrollRef} className="absolute inset-0 overflow-y-auto px-5 py-6 space-y-6">
              {turns.length === 0 && !loading ? (
                <EmptyState info={info} onSuggest={sendMessage} />
              ) : (
                <AnimatePresence>
                  {turns.map((t, i) => (
                    <TurnView key={`${t.ts}-${i}`} turn={t} isLast={i === turns.length - 1}
                      stillLoading={i === turns.length - 1 && loading}
                      pendingActions={pendingActions}
                      onConfirm={handleConfirm} onCancel={handleCancel}
                      onConfirmAllInTurn={handleConfirmAllInTurn}
                      onSuggestionClick={sendMessage}
                      onRegenerate={regenerate}
                      loading={loading}
                      conversationId={conversationId}
                      showContinueHint={!!lastConfirmHint && i === turns.length - 1} />
                  ))}
                </AnimatePresence>
              )}
            </div>
            {/* Jump-to-bottom floating button */}
            <AnimatePresence>
              {showJumpBtn && (
                <motion.button type="button" onClick={jumpToBottom}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                  className="absolute bottom-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-card border border-border shadow-lg text-foreground hover:bg-accent">
                  <ArrowDown className="h-4 w-4" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          {/* Composer */}
          <form onSubmit={(e) => { e.preventDefault(); sendMessage() }}
            className="border-t border-border p-3 bg-background">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
                }}
                placeholder="Demandez-moi de chercher, créer, inviter, trouver des photos…  ·  ↵ envoyer · ⇧↵ retour à la ligne"
                rows={2}
                className="flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                disabled={loading} />
              {loading ? (
                <Button type="button" onClick={stopGeneration}
                  className="h-10 w-10 p-0 bg-red-600 hover:bg-red-700 text-white shadow-lg"
                  title="Arrêter la génération">
                  <StopCircle className="h-4 w-4" />
                </Button>
              ) : (
                <Button type="submit" disabled={!input.trim()}
                  className="h-10 w-10 p-0 bg-gradient-to-br from-brand-600 to-purple-600 text-white shadow-lg">
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
          </form>
        </div>

        {/* ── RIGHT: Actions panel ──────────────────────────────── */}
        <div className="flex flex-col gap-3 overflow-hidden">
          <div className="inline-flex p-1 rounded-lg border border-border bg-muted/30 self-start text-xs">
            <button type="button" onClick={() => setTab('chat')}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors
                ${tab === 'chat' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
              À confirmer
              {pendingActions.length > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                  {pendingActions.length}
                </span>
              )}
            </button>
            <button type="button" onClick={() => setTab('history')}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors
                ${tab === 'history' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
              <History className="h-3 w-3 inline mr-1" />Historique
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {tab === 'chat' ? (
              pendingActions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Sparkles className="mx-auto h-8 w-8 opacity-30 mb-2" />
                  <p className="text-xs">Aucune action à confirmer.</p>
                </div>
              ) : (
                pendingActions.map((a) => (
                  <ActionCard key={a.id} action={a} onConfirm={handleConfirm} onCancel={handleCancel} />
                ))
              )
            ) : (
              historyActions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="mx-auto h-8 w-8 opacity-30 mb-2" />
                  <p className="text-xs">Pas d'actions encore.</p>
                </div>
              ) : (
                historyActions.map((a) => (
                  <ActionCard key={a.id} action={a} onRevert={handleRevert} />
                ))
              )
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}

// ── EmptyState ───────────────────────────────────────────────────────────────

function EmptyState({ info, onSuggest }: { info: any; onSuggest: (s: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-purple-600 mb-3 shadow-xl">
        <Bot className="h-8 w-8 text-white" />
      </div>
      <h2 className="text-xl font-black text-foreground mb-1">Comment puis-je vous aider ?</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Je peux chercher dans la base, trouver des photos, créer des programmes, envoyer des emails…
      </p>

      {info && info.configured === false && (
        <div className="w-full mb-6 rounded-xl border-2 border-amber-500/40 bg-amber-500/10 p-4 text-left">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-bold text-foreground">Clé API HuggingFace manquante</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configurez une clé gratuite pour activer l'assistant.
              </p>
              <Link href="/ai-assistant/settings">
                <Button size="sm" variant="brand" className="mt-3 gap-1.5">
                  <SettingsIcon className="h-3.5 w-3.5" />Configurer
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="w-full space-y-4 text-left">
        {SUGGESTION_CATEGORIES.map((cat) => (
          <div key={cat.tag}>
            <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider mb-1.5 ${cat.tagColor}`}>
              {cat.tag}
            </span>
            <div className="grid grid-cols-1 gap-1.5">
              {cat.items.map((s, i) => (
                <button key={i} type="button" onClick={() => onSuggest(s.label)}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 text-sm text-left hover:border-brand-400 hover:bg-accent/30 transition-all group">
                  <span className="text-base">{s.icon}</span>
                  <span className="flex-1 text-foreground">{s.label}</span>
                  <Send className="h-3.5 w-3.5 text-muted-foreground group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── TurnView (user msg + AI response card with collapsible thinking) ────────

function TurnView({ turn, isLast, stillLoading, pendingActions, onConfirm, onCancel, onConfirmAllInTurn, onSuggestionClick, onRegenerate, loading, conversationId, showContinueHint }: {
  turn: Turn
  isLast: boolean
  stillLoading: boolean
  pendingActions: Action[]
  pendingActions_unused?: never
  onConfirm: (id: number) => void
  onCancel: (id: number) => void
  onConfirmAllInTurn: (ids: number[]) => void
  onSuggestionClick: (s: string) => void
  onRegenerate: () => void
  loading: boolean
  conversationId?: number
  showContinueHint?: boolean
}) {
  // Resolve only PENDING actions from this turn (executed ones drop out of the inline list)
  const turnPending = (turn.pendingActionIds ?? [])
    .map((id) => pendingActions.find((x) => x.id === id))
    .filter(Boolean) as Action[]

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      {/* User bubble */}
      {turn.user && (
        <div className="flex gap-3 justify-end">
          <div className="max-w-[80%] rounded-2xl rounded-br-md bg-gradient-to-br from-brand-600 to-purple-600 px-4 py-2.5 text-sm text-white shadow-md whitespace-pre-wrap">
            {turn.user}
          </div>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
            <UserIcon className="h-4 w-4 text-foreground" />
          </div>
        </div>
      )}

      {/* AI response */}
      <div className="flex gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-purple-600">
          <Bot className={`h-4 w-4 text-white ${turn.pending ? 'animate-pulse' : ''}`} />
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          {/* Pending: thinking indicator with live activity */}
          {turn.pending && (
            <ThinkingBubble label={turn.liveStatus} />
          )}

          {/* Partial streamed text — visible while the agent is still working */}
          {turn.pending && turn.finalText && (
            <div className="rounded-2xl rounded-bl-md bg-muted px-4 py-2.5 text-sm leading-relaxed text-foreground">
              <MarkdownText text={turn.finalText} />
            </div>
          )}

          {/* Plan wizard — when the AI proposed a multi-step plan */}
          {turn.plan && isLast && (
            <PlanWizard plan={turn.plan} conversationId={conversationId} />
          )}

          {/* Clarification picker — when the AI asked for a choice */}
          {turn.clarification && isLast && (
            <ClarificationPicker
              data={turn.clarification}
              onSubmit={(answer) => onSuggestionClick(answer)}
            />
          )}

          {/* Photo gallery — when search_photos was called */}
          {(turn.photoResults ?? []).length > 0 && (
            <PhotoGallery photos={turn.photoResults!} />
          )}

          {/* Collapsible "Réflexion" with tool calls */}
          {turn.steps.length > 0 && (
            <ThinkingPanel steps={turn.steps} pending={!!turn.pending} />
          )}

          {/* Final text with markdown + typing animation on the latest turn */}
          {!turn.pending && turn.finalText && (() => {
            const isError = /^[⚠⏹]/.test(turn.finalText)
            return (
              <div className={`group relative rounded-2xl rounded-bl-md px-4 py-2.5 text-sm leading-relaxed ${
                isError
                  ? 'bg-red-500/10 border border-red-500/30 text-foreground'
                  : 'bg-muted text-foreground'
              }`}>
                {isLast
                  ? <TypingMarkdown key={turn.ts} text={turn.finalText} />
                  : <MarkdownText text={turn.finalText} />}
                <CopyButton text={turn.finalText} />
                {isError && isLast && turn.user && (
                  <button type="button" onClick={onRegenerate} disabled={loading}
                    className="mt-2 inline-flex items-center gap-1 rounded-md border border-red-500/40 bg-card px-2.5 py-1 text-[11px] font-semibold text-red-700 dark:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40">
                    <RotateCcw className="h-3 w-3" />Réessayer
                  </button>
                )}
              </div>
            )
          })()}

          {/* Inline system notes (action confirmed / refused / reverted) */}
          {(turn.systemNotes ?? []).map((note, i) => (
            <div key={`note-${i}`}
              className="rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-[11px] text-muted-foreground italic">
              {note}
            </div>
          ))}

          {/* Pending actions referenced by this turn */}
          {turnPending.length > 0 && (
            <div className="space-y-2">
              {turnPending.length > 1 && (
                <Button size="sm" onClick={() => onConfirmAllInTurn(turnPending.map((a) => a.id))}
                  className="gap-1.5 h-7 text-xs bg-green-600 hover:bg-green-700 text-white shadow-sm">
                  <CheckCheck className="h-3.5 w-3.5" />Confirmer les {turnPending.length} actions
                </Button>
              )}
              {turnPending.map((a) => (
                <InlinePendingActionCard key={a.id} action={a} onConfirm={onConfirm} onCancel={onCancel} />
              ))}
            </div>
          )}

          {/* Quick-reply chips + Continuer + regenerate (last turn only) */}
          {!turn.pending && isLast && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {/* "Continuer" chip — appears right after a successful confirmation
                  so the admin can resume the multi-step plan in one click. */}
              {showContinueHint && (
                <button type="button" onClick={() => onSuggestionClick('Continue avec l\'étape suivante du plan')}
                  className="inline-flex items-center gap-1 rounded-full border-2 border-brand-500 bg-brand-500/15 px-3 py-1 text-[11px] font-bold text-brand-700 dark:text-brand-300 hover:bg-brand-500/25 transition-colors">
                  <ArrowDown className="h-3 w-3 rotate-[-90deg]" />Continuer le plan
                </button>
              )}
              {(turn.suggestions ?? []).map((s, i) => (
                <button key={i} type="button" onClick={() => onSuggestionClick(s)}
                  className="rounded-full border border-border bg-card px-3 py-1 text-[11px] text-foreground hover:border-brand-400 hover:bg-brand-500/10 hover:text-brand-700 dark:hover:text-brand-300 transition-colors">
                  {s}
                </button>
              ))}
              {turn.user && (
                <button type="button" onClick={onRegenerate} disabled={loading}
                  title="Régénérer la réponse"
                  className="ml-auto inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-[11px] text-muted-foreground hover:border-brand-400 hover:bg-brand-500/10 hover:text-brand-700 dark:hover:text-brand-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  <RotateCcw className="h-3 w-3" />Régénérer
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ── Copy button (overlay on AI bubble) ──────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true); setTimeout(() => setCopied(false), 1500)
    } catch { toast.error('Copie impossible') }
  }
  return (
    <button type="button" onClick={onClick}
      title={copied ? 'Copié !' : 'Copier'}
      className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity rounded-md p-1 bg-card border border-border hover:bg-accent text-muted-foreground hover:text-foreground">
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
    </button>
  )
}

// ── Plan wizard (renders propose_plan as one editable form) ──────────────

function PlanWizard({ plan, conversationId }: {
  plan: ActionPlan
  conversationId?: number
}) {
  // Local copy of steps so admin can edit args + toggle optional ones
  const [steps, setSteps] = useState(plan.steps.map((s) => ({ ...s, enabled: true })))
  const [executing, setExecuting] = useState(false)
  const [results, setResults] = useState<Array<{ step: number; label: string; status: string; error?: string }> | null>(null)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  const toggleStep = (i: number) => setSteps((arr) =>
    arr.map((s, idx) => idx === i ? { ...s, enabled: !s.enabled } : s))

  const updateArg = (stepIdx: number, key: string, value: any) => setSteps((arr) =>
    arr.map((s, idx) => idx === stepIdx ? { ...s, args: { ...s.args, [key]: value } } : s))

  const toggleExpanded = (i: number) => setExpanded((s) => {
    const next = new Set(s); next.has(i) ? next.delete(i) : next.add(i); return next
  })

  const apply = async () => {
    setExecuting(true)
    const enabledSteps = steps.filter((s) => s.enabled).map(({ enabled, ...rest }) => rest)
    try {
      const r = await adminAiApi.executePlan({
        conversationId,
        plan: { ...plan, steps: enabledSteps },
      })
      setResults(r.data.results)
      const msg = `${r.data.ok} réussie(s), ${r.data.failed} échec(s)`
      toast.success(`Plan exécuté : ${msg}`)
      // Notable: we do NOT auto-send a follow-up message. The admin can ask
      // Médi for next steps explicitly via the suggestion chips, which avoids
      // re-running the agent loop on a meta-message ("Plan exécuté…") that
      // tends to confuse the model.
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Échec de l\'exécution')
    } finally { setExecuting(false) }
  }

  const enabledCount = steps.filter((s) => s.enabled).length

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border-2 border-brand-500/40 bg-gradient-to-br from-brand-500/[0.04] to-purple-500/[0.04] overflow-hidden">
      {/* Header */}
      <div className="border-b border-border bg-card/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground truncate">{plan.title}</p>
            {plan.summary && <p className="text-[11px] text-muted-foreground line-clamp-2">{plan.summary}</p>}
          </div>
          <span className="rounded-full bg-brand-500/15 px-2 py-0.5 text-[10px] font-bold text-brand-700 dark:text-brand-300">
            {enabledCount}/{steps.length} étape{steps.length > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Steps list */}
      <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
        {steps.map((step, i) => {
          const result = results?.find((r) => r.step === i)
          const isExpanded = expanded.has(i)
          const editableArgs = Object.entries(step.args ?? {}).filter(([k]) =>
            !['dependsOnStep', 'fillField'].includes(k))
          return (
            <div key={i} className={`px-4 py-2.5 transition-colors ${step.enabled ? '' : 'opacity-50 bg-muted/20'}`}>
              <div className="flex items-start gap-2">
                <input type="checkbox" checked={step.enabled} onChange={() => toggleStep(i)}
                  disabled={!!results || executing}
                  className="mt-0.5 h-3.5 w-3.5 accent-brand-500 cursor-pointer disabled:cursor-not-allowed" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground tabular-nums">
                      #{i + 1}
                    </span>
                    <span className="text-xs font-semibold text-foreground truncate">{step.label}</span>
                    {result && (
                      result.status === 'ok'
                        ? <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5"><Check className="h-2.5 w-2.5" />ok</span>
                        : <span className="text-[10px] font-bold text-red-600 dark:text-red-400 flex items-center gap-0.5"><X className="h-2.5 w-2.5" />{result.status}</span>
                    )}
                    <button type="button" onClick={() => toggleExpanded(i)}
                      className="ml-auto text-[10px] text-brand-600 hover:underline">
                      {isExpanded ? '▼ Masquer' : '▶ Détails'}
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    <code>{step.tool}</code>
                    {step.dependsOnStep != null && <span className="ml-2 italic">↗ dépend de #{step.dependsOnStep + 1}</span>}
                  </p>
                  {result?.error && (
                    <p className="text-[10px] text-red-600 dark:text-red-400 mt-1">⚠ {result.error}</p>
                  )}
                  {isExpanded && editableArgs.length > 0 && (
                    <div className="mt-2 space-y-1.5 rounded-lg bg-muted/30 p-2">
                      {editableArgs.map(([k, v]) => (
                        <div key={k} className="flex items-baseline gap-2 text-[11px]">
                          <span className="font-mono text-muted-foreground shrink-0 min-w-[100px]">{k}</span>
                          <input
                            value={typeof v === 'string' ? v : JSON.stringify(v)}
                            onChange={(e) => {
                              // Try to preserve type: parse JSON if it was originally non-string
                              let next: any = e.target.value
                              if (typeof v !== 'string') {
                                try { next = JSON.parse(e.target.value) } catch {}
                              }
                              updateArg(i, k, next)
                            }}
                            disabled={!!results || executing || !step.enabled}
                            className="flex-1 bg-card border border-input rounded px-1.5 py-0.5 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-60" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="border-t border-border bg-card/60 px-4 py-2.5">
        {results ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs">
              {(() => {
                const ok = results.filter((r) => r.status === 'ok').length
                const fail = results.length - ok
                return (
                  <>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 font-bold text-emerald-700 dark:text-emerald-400">
                      <Check className="h-3 w-3" />{ok} réussi{ok > 1 ? 'es' : 'e'}
                    </span>
                    {fail > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 font-bold text-red-700 dark:text-red-400">
                        <X className="h-3 w-3" />{fail} échec{fail > 1 ? 's' : ''}
                      </span>
                    )}
                    <span className="text-muted-foreground ml-auto">Plan terminé</span>
                  </>
                )
              })()}
            </div>
            <p className="text-[10px] text-muted-foreground italic">
              💡 Tape un nouveau message si tu veux qu'on continue (ex. « ajoute 2 critères »,
              « invite des mentors », « passe à autre chose »).
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <p className="text-[10px] text-muted-foreground flex-1">
              Décoche les étapes à ignorer · édite les valeurs si besoin · puis « Tout appliquer ».
            </p>
            <Button onClick={apply} disabled={executing || enabledCount === 0}
              variant="brand" size="sm" className="gap-1.5">
              {executing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
              {executing ? 'Exécution…' : `Tout appliquer (${enabledCount})`}
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ── Clarification picker (renders ask_user_choice as clickable chips) ─────

function ClarificationPicker({ data, onSubmit }: {
  data: { question: string; multiSelect: boolean; options: Array<{ label: string; description?: string }> }
  onSubmit: (answer: string) => void
}) {
  const [selected, setSelected] = useState<string[]>([])

  const toggle = (label: string) => {
    if (data.multiSelect) {
      setSelected((s) => s.includes(label) ? s.filter((x) => x !== label) : [...s, label])
    } else {
      // Single-select → submit immediately
      onSubmit(label)
    }
  }

  const submitMulti = () => {
    if (selected.length === 0) return
    onSubmit(selected.join(', '))
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border-2 border-brand-500/40 bg-gradient-to-br from-brand-500/[0.04] to-purple-500/[0.04] p-4">
      <div className="flex items-start gap-2 mb-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-brand-600 dark:text-brand-400 text-xs font-bold">?</span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">{data.question}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {data.multiSelect ? 'Choisis une ou plusieurs options' : 'Choisis une option'}
          </p>
        </div>
      </div>

      <div className="grid gap-1.5">
        {data.options.map((opt, i) => {
          const isSelected = selected.includes(opt.label)
          return (
            <button key={i} type="button" onClick={() => toggle(opt.label)}
              className={`flex items-start gap-2.5 rounded-xl border-2 px-3 py-2 text-left transition-all ${
                isSelected
                  ? 'border-brand-500 bg-brand-500/10'
                  : 'border-border bg-card hover:border-brand-400 hover:bg-accent/30'
              }`}>
              {/* Indicator: checkbox (multi) or radio (single) */}
              <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center ${
                data.multiSelect ? 'rounded' : 'rounded-full'
              } border-2 ${
                isSelected ? 'border-brand-500 bg-brand-500' : 'border-muted-foreground/40 bg-background'
              }`}>
                {isSelected && (data.multiSelect
                  ? <Check className="h-2.5 w-2.5 text-white" />
                  : <span className="h-1.5 w-1.5 rounded-full bg-white" />)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{opt.label}</p>
                {opt.description && (
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{opt.description}</p>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Submit button only for multi-select (single-select submits on click) */}
      {data.multiSelect && (
        <Button onClick={submitMulti} disabled={selected.length === 0}
          variant="brand" size="sm" className="mt-3 w-full gap-1.5">
          <Send className="h-3 w-3" />
          Valider ({selected.length})
        </Button>
      )}
    </motion.div>
  )
}

// ── Photo gallery (renders search_photos results inline) ───────────────────

const SOURCE_META: Record<string, { label: string; color: string }> = {
  pexels:    { label: 'Pexels',    color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  unsplash:  { label: 'Unsplash',  color: 'bg-black/10 text-foreground dark:bg-white/10' },
  openverse: { label: 'OpenVerse', color: 'bg-purple-500/15 text-purple-700 dark:text-purple-300' },
  picsum:    { label: 'Picsum',    color: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
}

function PhotoGallery({ photos }: { photos: PhotoResult[] }) {
  // Dedupe by URL (in case the same photo appears in multiple search results)
  const unique = useMemo(() => {
    const seen = new Set<string>()
    return photos.filter((p) => p.url && !seen.has(p.url) && seen.add(p.url))
  }, [photos])

  const source = unique[0]?.source
  const meta = source ? SOURCE_META[source] : null

  return (
    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
      className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2 bg-muted/30">
        <ImageIcon className="h-3.5 w-3.5 text-brand-500" />
        <span className="text-xs font-bold text-foreground">
          {unique.length} photo{unique.length > 1 ? 's' : ''} trouvée{unique.length > 1 ? 's' : ''}
        </span>
        {meta && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.color}`}>
            via {meta.label}
          </span>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 p-1.5">
        {unique.map((p, i) => <PhotoCard key={i} photo={p} />)}
      </div>
    </motion.div>
  )
}

function PhotoCard({ photo }: { photo: PhotoResult }) {
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [copied, setCopied] = useState(false)

  const copyUrl = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    try {
      await navigator.clipboard.writeText(photo.url)
      setCopied(true); setTimeout(() => setCopied(false), 1500)
      toast.success('URL copiée')
    } catch { toast.error('Copie impossible') }
  }

  return (
    <a href={photo.url} target="_blank" rel="noopener noreferrer"
      className="group relative aspect-video overflow-hidden rounded-lg border border-border bg-muted block">
      {/* Loading + error states */}
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground p-1 text-center">
          <X className="h-4 w-4 text-red-500" />
          <p className="text-[9px] mt-1">Image indisponible</p>
        </div>
      )}
      {/* The image */}
      <img src={photo.thumbnail ?? photo.url} alt={photo.title ?? ''}
        onLoad={() => setStatus('ok')}
        onError={() => setStatus('error')}
        className={`h-full w-full object-cover transition-all group-hover:scale-105 ${status === 'ok' ? 'opacity-100' : 'opacity-0'}`} />
      {/* Gradient overlay with credit + copy */}
      {status === 'ok' && (
        <>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <p className="text-[9px] text-white truncate" title={photo.credit}>{photo.credit}</p>
          </div>
          <button type="button" onClick={copyUrl}
            title={copied ? 'Copié !' : 'Copier l\'URL'}
            className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-md bg-black/60 backdrop-blur text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80">
            {copied ? <Check className="h-3 w-3 text-emerald-300" /> : <Copy className="h-3 w-3" />}
          </button>
        </>
      )}
    </a>
  )
}

// ── Thinking bubble (pending) ────────────────────────────────────────────────

function ThinkingBubble({ label }: { label?: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md bg-muted px-4 py-2.5 text-sm text-muted-foreground">
      <div className="flex gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      {/* Live activity from the SSE stream — falls back to the generic label */}
      <AnimatePresence mode="wait">
        <motion.span key={label ?? 'default'} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}>
          {label ?? 'Réflexion…'}
        </motion.span>
      </AnimatePresence>
    </div>
  )
}

// ── Collapsible thinking panel ───────────────────────────────────────────────

function ThinkingPanel({ steps, pending }: { steps: Step[]; pending: boolean }) {
  const [open, setOpen] = useState(false)
  const toolCalls = steps.filter((s) => s.kind === 'tool_call')

  if (toolCalls.length === 0 && !pending) return null

  return (
    <div className="rounded-xl border border-border bg-muted/30 overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors">
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <Brain className="h-3 w-3" />
        <span>Réflexion</span>
        <span className="text-[10px] opacity-70">
          ({toolCalls.length} étape{toolCalls.length > 1 ? 's' : ''})
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {toolCalls.slice(0, 3).map((s, i) => {
            const Icon = TOOL_ICON[s.tool ?? ''] ?? Wrench
            return <Icon key={i} className="h-3 w-3 opacity-60" />
          })}
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            className="overflow-hidden">
            <div className="border-t border-border p-3 space-y-2">
              {steps.map((s, i) => <StepView key={i} step={s} />)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function StepView({ step }: { step: Step }) {
  if (step.kind === 'tool_call') {
    const Icon = TOOL_ICON[step.tool ?? ''] ?? Wrench
    return (
      <div className="rounded-lg bg-card border border-border p-2">
        <div className="flex items-center gap-1.5 mb-1">
          <Icon className="h-3 w-3 text-brand-500" />
          <span className="text-[11px] font-bold text-foreground">
            {TOOL_LABEL[step.tool ?? ''] ?? step.tool}
          </span>
        </div>
        {step.args && Object.keys(step.args).length > 0 && (
          <pre className="text-[10px] text-muted-foreground bg-muted/40 rounded px-1.5 py-1 overflow-x-auto">
            {JSON.stringify(step.args, null, 2)}
          </pre>
        )}
      </div>
    )
  }
  if (step.kind === 'tool_result') {
    const truncated = (step.result ?? '').length > 280
      ? (step.result ?? '').slice(0, 280) + '…'
      : step.result
    return (
      <div className="rounded-lg bg-card border border-border p-2">
        <div className="flex items-center gap-1.5 mb-1">
          <Check className="h-3 w-3 text-emerald-500" />
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Résultat</span>
        </div>
        <pre className="text-[10px] text-muted-foreground bg-muted/40 rounded px-1.5 py-1 overflow-x-auto whitespace-pre-wrap break-words">
          {truncated}
        </pre>
      </div>
    )
  }
  // thought
  return (
    <div className="rounded-lg bg-card border border-border p-2">
      <p className="text-[11px] text-muted-foreground italic">{step.result}</p>
    </div>
  )
}

// ── Lightweight markdown renderer ───────────────────────────────────────────
// We deliberately don't pull react-markdown (100kb+) — we only support a small
// safe subset: **bold**, *italic*, `code`, [link](url), `- bullets`, blank-line
// paragraphs. Anything else falls through as plain text (HTML-escaped).

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function inlineMd(s: string): string {
  let out = escapeHtml(s)
  // Code spans first (so we don't process ** inside them)
  out = out.replace(/`([^`]+)`/g, '<code class="rounded bg-background border border-border px-1 py-0.5 text-[12px]">$1</code>')
  // Bold then italic
  out = out.replace(/\*\*([^*\n]+)\*\*/g, '<strong class="font-bold">$1</strong>')
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em class="italic">$2</em>')
  // Links [text](url) — basic, only http(s)
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener" class="text-brand-600 dark:text-brand-400 underline underline-offset-2 hover:no-underline">$1</a>')
  return out
}

/** Render markdown text as paragraphs + bullet lists. Pure JSX, sanitized. */
function MarkdownText({ text }: { text: string }) {
  const blocks = useMemo(() => {
    // Split on blank lines → blocks (paragraphs or lists)
    const lines = text.replace(/\r\n/g, '\n').split('\n')
    const blocks: Array<{ kind: 'p' | 'ul' | 'ol'; items: string[] }> = []
    let buf: string[] = []
    const flushPara = () => {
      if (buf.length) {
        blocks.push({ kind: 'p', items: [buf.join(' ')] })
        buf = []
      }
    }
    let listBuf: string[] = []
    let listKind: 'ul' | 'ol' | null = null
    const flushList = () => {
      if (listBuf.length && listKind) {
        blocks.push({ kind: listKind, items: listBuf })
        listBuf = []; listKind = null
      }
    }
    for (const raw of lines) {
      const line = raw.trimEnd()
      if (!line) { flushPara(); flushList(); continue }
      const bullet = line.match(/^\s*[-•*]\s+(.*)$/)
      const numbered = line.match(/^\s*\d+\.\s+(.*)$/)
      if (bullet) { flushPara(); listKind = 'ul'; listBuf.push(bullet[1]); continue }
      if (numbered) { flushPara(); listKind = 'ol'; listBuf.push(numbered[1]); continue }
      flushList()
      buf.push(line)
    }
    flushPara(); flushList()
    return blocks
  }, [text])

  return (
    <div className="space-y-2">
      {blocks.map((b, i) => {
        if (b.kind === 'p') {
          return (
            <p key={i} className="whitespace-pre-wrap"
               dangerouslySetInnerHTML={{ __html: inlineMd(b.items[0]) }} />
          )
        }
        const ListTag: any = b.kind === 'ol' ? 'ol' : 'ul'
        return (
          <ListTag key={i}
            className={`pl-5 space-y-1 ${b.kind === 'ol' ? 'list-decimal' : 'list-disc'} marker:text-brand-500`}>
            {b.items.map((it, j) => (
              <li key={j} dangerouslySetInnerHTML={{ __html: inlineMd(it) }} />
            ))}
          </ListTag>
        )
      })}
    </div>
  )
}

/** Same as MarkdownText but progressively reveals characters — typing animation. */
function TypingMarkdown({ text, speed = 8 }: { text: string; speed?: number }) {
  const [shown, setShown] = useState('')
  useEffect(() => {
    setShown('')
    let i = 0
    const cancelled = { v: false }
    const tick = () => {
      if (cancelled.v) return
      const chunk = text.length > 600 ? 5 : text.length > 240 ? 3 : 2
      i = Math.min(text.length, i + chunk)
      setShown(text.slice(0, i))
      if (i < text.length) setTimeout(tick, speed)
    }
    tick()
    return () => { cancelled.v = true }
  }, [text, speed])
  return (
    <>
      <MarkdownText text={shown} />
      {shown.length < text.length && (
        <span className="inline-block w-1.5 h-3.5 bg-brand-500 ml-0.5 align-middle animate-pulse" />
      )}
    </>
  )
}

// ── Image preview helper ────────────────────────────────────────────────────

/** Walk a JSON object and collect every URL-like string that looks like an image. */
function findImageUrls(value: any, acc: { label: string; url: string }[] = [], path = ''): { label: string; url: string }[] {
  if (value == null) return acc
  if (typeof value === 'string') {
    if (/^https?:\/\//i.test(value)) {
      // Likely an image if path/url hints at one or extension matches
      const looksLikeImage =
        /imageUrl|image_url|logoUrl|logo|bannerImageUrl|heroImageUrl|photo|picture/i.test(path) ||
        /\.(png|jpe?g|webp|gif|svg|avif)(\?|$)/i.test(value) ||
        /unsplash\.com|picsum\.photos/i.test(value)
      if (looksLikeImage) acc.push({ label: path || 'image', url: value })
    }
    return acc
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => findImageUrls(v, acc, `${path}[${i}]`))
    return acc
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      findImageUrls(v, acc, path ? `${path}.${k}` : k)
    }
  }
  return acc
}

// ── Inline pending action card (shown next to the AI turn) ──────────────────

function InlinePendingActionCard({ action: a, onConfirm, onCancel }: {
  action: Action
  onConfirm: (id: number) => void
  onCancel: (id: number) => void
}) {
  const [showDetails, setShowDetails] = useState(false)
  // Parse args once and extract any image URLs for preview
  const { parsedArgs, imageUrls } = (() => {
    try {
      const obj = JSON.parse(a.argsJson ?? '{}')
      return { parsedArgs: obj, imageUrls: findImageUrls(obj) }
    } catch {
      return { parsedArgs: null, imageUrls: [] as { label: string; url: string }[] }
    }
  })()

  return (
    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
      className="rounded-2xl border-2 border-amber-500/50 bg-amber-500/5 p-3">
      <div className="flex items-start gap-2 mb-2">
        <Zap className="h-3.5 w-3.5 mt-0.5 text-amber-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-foreground leading-tight">Action à confirmer</p>
          <p className="text-sm font-semibold text-foreground mt-0.5">{a.title}</p>
        </div>
      </div>

      {/* Image preview grid — shows actual photos before the admin confirms */}
      {imageUrls.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
            Aperçu des images ({imageUrls.length})
          </p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {imageUrls.map((img, i) => (
              <ImageThumb key={i} url={img.url} label={img.label} />
            ))}
          </div>
        </div>
      )}

      {a.argsJson && (
        <button type="button" onClick={() => setShowDetails((v) => !v)}
          className="text-[10px] text-brand-600 hover:underline mb-1">
          {showDetails ? '▼ Masquer les détails' : '▶ Voir les détails'}
        </button>
      )}
      {showDetails && (
        <pre className="rounded-md bg-muted/40 p-2 text-[10px] overflow-x-auto whitespace-pre-wrap break-words text-muted-foreground mb-2">
          {parsedArgs ? JSON.stringify(parsedArgs, null, 2) : a.argsJson}
        </pre>
      )}
      <div className="flex gap-1.5 mt-2">
        <Button size="sm" className="h-8 gap-1 text-xs flex-1 bg-green-600 hover:bg-green-700 text-white"
          onClick={() => onConfirm(a.id)}>
          <Check className="h-3 w-3" />Confirmer
        </Button>
        <Button size="sm" variant="outline" className="h-8 gap-1 text-xs"
          onClick={() => onCancel(a.id)}>
          <X className="h-3 w-3" />Refuser
        </Button>
      </div>
    </motion.div>
  )
}

/** Single image thumbnail with load/error states + label tooltip. */
function ImageThumb({ url, label }: { url: string; label: string }) {
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-muted aspect-video group">
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground p-1 text-center">
          <X className="h-4 w-4 text-red-500" />
          <p className="text-[9px] mt-1">Image indisponible</p>
        </div>
      )}
      <img src={url} alt={label}
        onLoad={() => setStatus('ok')}
        onError={() => setStatus('error')}
        className={`h-full w-full object-cover transition-opacity ${status === 'ok' ? 'opacity-100' : 'opacity-0'}`} />
      {status === 'ok' && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <p className="text-[9px] text-white truncate" title={label}>{label}</p>
        </div>
      )}
    </div>
  )
}

// ── ActionCard for the right-side panel ──────────────────────────────────────

function ActionCard({ action: a, onConfirm, onCancel, onRevert }: {
  action: Action
  onConfirm?: (id: number) => void
  onCancel?: (id: number) => void
  onRevert?: (id: number) => void
}) {
  const meta = STATUS_META[a.status] ?? STATUS_META.PENDING
  const [showArgs, setShowArgs] = useState(false)
  return (
    <MagicCard className="p-3">
      <div className="flex items-start gap-2 mb-2">
        <Zap className="h-3.5 w-3.5 mt-0.5 text-brand-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground leading-tight">{a.title}</p>
          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${meta.bg}`}>{meta.label}</span>
            <span className="text-[9px] text-muted-foreground">{a.tool}</span>
          </div>
        </div>
      </div>

      {a.argsJson && (
        <button type="button" onClick={() => setShowArgs((v) => !v)}
          className="text-[10px] text-brand-600 hover:underline">
          {showArgs ? '▼' : '▶'} Détails
        </button>
      )}
      {showArgs && (
        <pre className="mt-1 rounded-md bg-muted/40 p-2 text-[10px] overflow-x-auto whitespace-pre-wrap break-words text-muted-foreground">
          {(() => { try { return JSON.stringify(JSON.parse(a.argsJson!), null, 2) } catch { return a.argsJson } })()}
        </pre>
      )}

      {a.errorMessage && (
        <div className="mt-2 rounded-md bg-red-500/10 px-2 py-1 text-[10px] text-red-600 flex items-start gap-1">
          <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
          <span>{a.errorMessage}</span>
        </div>
      )}

      <div className="mt-2 flex gap-1.5">
        {a.status === 'PENDING' && onConfirm && (
          <>
            <Button size="sm" className="h-7 gap-1 text-xs flex-1 bg-green-600 hover:bg-green-700 text-white" onClick={() => onConfirm(a.id)}>
              <Check className="h-3 w-3" />Confirmer
            </Button>
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => onCancel?.(a.id)}>
              <X className="h-3 w-3" />Refuser
            </Button>
          </>
        )}
        {a.status === 'EXECUTED' && onRevert && (
          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs flex-1" onClick={() => onRevert(a.id)}>
            <RotateCcw className="h-3 w-3" />Annuler
          </Button>
        )}
      </div>
    </MagicCard>
  )
}
