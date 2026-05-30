'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Key, Save, Eye, EyeOff, Loader2, Check, X, RefreshCw,
  Search, Sparkles, ExternalLink, AlertCircle, Filter, Cpu, Wrench,
  Image as ImageIcon, DollarSign, Zap, TrendingUp,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { adminAiApi } from '@/lib/api'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { MagicCard } from '@/components/magicui/magic-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Model {
  id: string
  name: string
  description?: string
  context_length?: number
  pricing?: { prompt?: string; completion?: string }
  promptPriceM?: number
  completionPriceM?: number
  provider?: string
  isFree?: boolean
  supportsTools?: boolean
  /** True when the model reliably uses native OpenAI tool_calls (70B+ class). */
  reliableTools?: boolean
  supportsVision?: boolean
  architecture?: { modality?: string; tokenizer?: string }
  supported_parameters?: string[]
  top_provider?: { max_completion_tokens?: number; context_length?: number; is_moderated?: boolean }
}

type ProviderId = 'HUGGINGFACE' | 'CUSTOM'

interface Settings {
  provider?: ProviderId
  maskedApiKey?: string
  configured: boolean
  model?: string
  baseUrl?: string
  temperature?: number
  maxTokens?: number
  /** CSV of model ids tried in order when the primary returns 429. */
  fallbackModels?: string
  /** Masked Unsplash key (last 4 chars visible). */
  maskedUnsplashKey?: string
  /** True when an Unsplash Access Key is saved — enables curated photo search. */
  unsplashConfigured?: boolean
  /** Masked Pexels key. */
  maskedPexelsKey?: string
  /** True when a Pexels key is saved — preferred over Unsplash. */
  pexelsConfigured?: boolean
  updatedAt?: string
  updatedByAdminName?: string
}

const PROVIDERS: Record<ProviderId, {
  label: string
  icon: string
  description: string
  signupUrl: string
  signupLabel: string
  defaultBaseUrl: string
  defaultModel: string
  keyPrefix?: string
  keyPattern?: RegExp
}> = {
  HUGGINGFACE: {
    label: 'HuggingFace',
    icon: '🤗',
    description: 'Free Inference Providers — 1000+ modèles, niveau gratuit généreux, pas de quota journalier strict.',
    signupUrl: 'https://huggingface.co/settings/tokens',
    signupLabel: 'Créer un token HF',
    defaultBaseUrl: 'https://router.huggingface.co/v1',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct',
    keyPrefix: 'hf_',
    keyPattern: /^hf_[A-Za-z0-9]{20,}$/,
  },
  CUSTOM: {
    label: 'Personnalisé',
    icon: '🔧',
    description: 'Tout endpoint OpenAI-compatible (Groq, Together, OpenAI, Ollama distant, etc.).',
    signupUrl: '#',
    signupLabel: 'Configuration manuelle',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
  },
}

interface CatalogResponse {
  items: Model[]
  total: number
  matched: number
  facets: { providers: Record<string, number>; freeCount: number; toolsCount: number; visionCount: number }
  cachedAt?: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AiSettingsPage() {
  // Settings state
  const [settings, setSettings] = useState<Settings | null>(null)
  const [provider, setProvider] = useState<ProviderId>('HUGGINGFACE')
  const [apiKeyInput, setApiKeyInput] = useState('')         // raw text input (empty = keep)
  const [showKey,  setShowKey]   = useState(false)
  const [baseUrl,  setBaseUrl]   = useState('')
  const [temperature, setTemperature] = useState<number | undefined>()
  const [maxTokens,   setMaxTokens]   = useState<number | undefined>()
  /** Ordered list of fallback model ids tried when the primary returns 429. */
  const [fallbacks,   setFallbacks]   = useState<string[]>([])
  /** Optional Unsplash Access Key (used by search_photos for curated images). */
  const [unsplashInput, setUnsplashInput] = useState('')
  const [showUnsplash, setShowUnsplash]   = useState(false)
  const [pexelsInput,   setPexelsInput]   = useState('')
  const [showPexels,    setShowPexels]    = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [debug, setDebug] = useState<any | null>(null)
  const [showDebug, setShowDebug] = useState(false)

  // Catalog state
  const [catalog,  setCatalog]  = useState<CatalogResponse | null>(null)
  const [loadingCatalog, setLoadingCatalog] = useState(true)
  const [query, setQuery] = useState('')
  const [freeOnly,   setFreeOnly]   = useState(true)
  const [toolsOnly,  setToolsOnly]  = useState(true)
  const [visionOnly, setVisionOnly] = useState(false)
  /** Catalog filter — model author (Meta, Qwen, DeepSeek…). NOT the LLM provider above. */
  const [modelAuthor, setModelAuthor] = useState<string>('')
  const [minContext, setMinContext] = useState<number | undefined>()
  const [selectedModel, setSelectedModel] = useState<string | undefined>()
  const [previewModel,  setPreviewModel]  = useState<Model | null>(null)

  // ── Effects ─────────────────────────────────────────────────────────────
  useEffect(() => { loadSettings() }, [])
  useEffect(() => {
    const t = setTimeout(loadCatalog, 250)
    return () => clearTimeout(t)
  // When the admin switches provider the catalog endpoint returns a different set of models.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, freeOnly, toolsOnly, visionOnly, modelAuthor, minContext, provider])

  const loadSettings = async () => {
    try {
      const r = await adminAiApi.getSettings()
      const s: Settings = r.data
      setSettings(s)
      setProvider((s.provider as ProviderId) ?? 'HUGGINGFACE')
      setSelectedModel(s.model)
      setBaseUrl(s.baseUrl ?? '')
      setTemperature(s.temperature ?? undefined)
      setMaxTokens(s.maxTokens ?? undefined)
      setFallbacks(s.fallbackModels
        ? s.fallbackModels.split(',').map((x) => x.trim()).filter(Boolean)
        : [])
    } catch (err: any) {
      toast.error("Impossible de charger les paramètres")
    }
  }

  const loadCatalog = async (refresh = false) => {
    setLoadingCatalog(true)
    try {
      const r = await adminAiApi.models({
        q: query || undefined,
        freeOnly, toolsOnly, visionOnly,
        provider: modelAuthor || undefined,  // catalog filter (Meta, Qwen, …)
        minContext,
        refresh,
      })
      setCatalog(r.data)
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Erreur lors du chargement des modèles')
    } finally { setLoadingCatalog(false) }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload: any = {
        provider,
        model: selectedModel,
        baseUrl: baseUrl || undefined,
        temperature, maxTokens,
        // Send "" to clear, otherwise comma-join the chain
        fallbackModels: fallbacks.length > 0 ? fallbacks.join(',') : '',
      }
      // Only send apiKey if the input is non-empty (empty = keep existing)
      if (apiKeyInput.trim()) payload.apiKey = apiKeyInput.trim()
      // Same logic for the optional Unsplash key
      if (unsplashInput.trim()) payload.unsplashAccessKey = unsplashInput.trim()
      if (pexelsInput.trim())   payload.pexelsApiKey      = pexelsInput.trim()

      const r = await adminAiApi.updateSettings(payload)
      setSettings(r.data)
      setApiKeyInput('')
      setUnsplashInput('')
      setPexelsInput('')
      toast.success('Paramètres sauvegardés ✓')
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Erreur')
    } finally { setSaving(false) }
  }

  // ── Fallback chain helpers ──────────────────────────────────────────────
  const addFallback = (id: string) => {
    if (!id || id === selectedModel || fallbacks.includes(id)) return
    setFallbacks([...fallbacks, id])
  }
  const removeFallback = (id: string) => setFallbacks(fallbacks.filter((x) => x !== id))
  const moveFallback = (id: string, dir: -1 | 1) => {
    const i = fallbacks.indexOf(id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= fallbacks.length) return
    const next = [...fallbacks]
    ;[next[i], next[j]] = [next[j], next[i]]
    setFallbacks(next)
  }

  const handleRunDebug = async () => {
    try {
      const r = await adminAiApi.debug()
      setDebug(r.data)
      setShowDebug(true)
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Diagnostic échoué')
    }
  }

  const handleClearKey = async () => {
    if (!confirm("Supprimer la clé API enregistrée ?")) return
    setSaving(true)
    try {
      await adminAiApi.updateSettings({ apiKey: '' })
      setApiKeyInput('')
      await loadSettings()
      toast.success('Clé supprimée')
    } catch { toast.error('Erreur') } finally { setSaving(false) }
  }

  const handleTest = async () => {
    setTesting(true)
    try {
      const r = await adminAiApi.testConnection({
        apiKey: apiKeyInput || undefined,   // empty → server uses stored key
        model: selectedModel,
      })
      if (r.data?.ok) {
        const using = apiKeyInput ? 'la clé saisie (non encore enregistrée)' : 'la clé enregistrée'
        toast.success(`✓ Test réussi avec ${using} sur ${r.data.model}. N'oubliez pas de cliquer Enregistrer pour que l'Assistant l'utilise.`, { duration: 7000 })
      } else if (r.data?.rateLimited) {
        toast.error(
          `⏱ Modèle saturé (réessayez dans ${r.data.retryAfterSeconds}s) — pensez à ajouter des modèles de secours.`,
          { duration: 6000 }
        )
      } else if (r.data?.outOfCredits) {
        toast.error(
          `💸 Quota épuisé sur ${selectedModel}. Choisissez un autre modèle ou ajoutez-en un comme secours.`,
          { duration: 9000 }
        )
      } else {
        toast.error(r.data?.error ?? `Échec (${r.data?.status})`)
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Erreur')
    } finally { setTesting(false) }
  }

  // Track unsaved changes
  const hasUnsavedKey = !!apiKeyInput.trim() || !!unsplashInput.trim() || !!pexelsInput.trim()
  const hasUnsavedChanges = hasUnsavedKey
    || (settings && settings.provider !== provider)
    || (settings && settings.model !== selectedModel)
    || (settings && (settings.fallbackModels ?? '') !== fallbacks.join(','))

  // Switching provider: clear the entered key + reset selected model to provider default
  const switchProvider = (next: ProviderId) => {
    if (next === provider) return
    setProvider(next)
    setApiKeyInput('')
    setSelectedModel(PROVIDERS[next].defaultModel)
    setBaseUrl('') // will fall back to provider default on save
    setFallbacks([])
  }

  // Validate key shape per provider (warn, don't block)
  const providerCfg = PROVIDERS[provider]
  const keyShapeInvalid = apiKeyInput.trim().length > 0
    && providerCfg.keyPattern
    && !providerCfg.keyPattern.test(apiKeyInput.trim())

  // Generic "looks like a password not an API key" heuristic — fires regardless of provider.
  // Real API keys are long (30+ chars), no whitespace, no @ or ! mid-string.
  // Common mistake: pasting an admin password into the key field.
  const keyLooksLikePassword = (() => {
    const k = apiKeyInput.trim()
    if (!k) return false
    if (k.length >= 25) return false             // long enough = probably real key
    if (/\s/.test(k)) return true                // any whitespace = wrong
    if (/^[A-Za-z]+\d+!?$/.test(k)) return true  // e.g. "Admin1234!" / "Hello42"
    if (k.length < 15) return true               // short non-key
    return false
  })()

  // ── Derived ──────────────────────────────────────────────────────────────
  const providers = useMemo(() => {
    const facets = catalog?.facets.providers ?? {}
    return Object.entries(facets).sort(([, a], [, b]) => b - a)
  }, [catalog])

  const selectedModelData = useMemo(() => {
    if (!selectedModel || !catalog) return null
    return catalog.items.find((m) => m.id === selectedModel) ?? null
  }, [selectedModel, catalog])

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <Link href="/ai-assistant">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-brand-500" />Paramètres Assistant IA
            </h1>
            <p className="text-sm text-muted-foreground">Configurez votre clé API et choisissez le modèle qu'utilisera l'agent.</p>
          </div>
          <a href={providerCfg.signupUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent">
            {providerCfg.signupLabel} <ExternalLink className="h-3 w-3" />
          </a>
        </motion.div>

        {/* Provider selector — big visual cards */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Fournisseur LLM</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {(Object.keys(PROVIDERS) as ProviderId[]).map((p) => {
              const cfg = PROVIDERS[p]
              const active = provider === p
              return (
                <button key={p} type="button" onClick={() => switchProvider(p)}
                  className={`text-left rounded-xl border-2 p-3 transition-all
                    ${active ? 'border-brand-500 bg-brand-500/5 shadow-sm'
                             : 'border-border bg-card hover:border-brand-400'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{cfg.icon}</span>
                    <span className={`text-sm font-bold ${active ? 'text-brand-700 dark:text-brand-300' : 'text-foreground'}`}>{cfg.label}</span>
                    {active && <Check className="h-3.5 w-3.5 text-brand-600 ml-auto" />}
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-snug">{cfg.description}</p>
                </button>
              )
            })}
          </div>
          {settings && settings.provider !== provider && (
            <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-400">
              ⚠ Changement de fournisseur : la clé API et le modèle actuels seront remplacés.
              Cliquez « Enregistrer » pour valider.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-3 text-xs text-foreground flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 text-blue-600 shrink-0" />
          <div className="flex-1">
            {provider === 'HUGGINGFACE' ? (
              <>
                <p className="font-bold">À propos de HuggingFace Inference Providers</p>
                <ul className="mt-1 space-y-0.5 text-muted-foreground leading-snug list-disc list-inside">
                  <li>1000+ modèles, accès gratuit via les <em>Inference Providers</em> (Together, Fireworks, Novita…).</li>
                  <li>Crédits gratuits mensuels, pas de quota journalier strict.</li>
                  <li>API 100% OpenAI-compatible — tool calling supporté nativement sur les modèles 70B+.</li>
                  <li>Token : <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">huggingface.co/settings/tokens</a> (rôle <code>Read</code> suffit)</li>
                </ul>
              </>
            ) : (
              <>
                <p className="font-bold">Endpoint personnalisé</p>
                <p className="text-muted-foreground mt-1">
                  Tout endpoint OpenAI-compatible fonctionne : Groq, Together, OpenAI, Fireworks, Ollama distant…
                  Précisez l'URL de base dans « Paramètres avancés » et l'id du modèle dans le catalogue.
                </p>
              </>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* ── LEFT (1/3): API key + advanced ─────────────────────────────── */}
          <div className="space-y-4">
            <MagicCard className="p-5 space-y-4">
              <h2 className="flex items-center gap-2 font-bold text-foreground">
                <Key className="h-4 w-4 text-brand-500" />
                Clé API {providerCfg.label} <span className="text-base">{providerCfg.icon}</span>
              </h2>

              {settings?.configured ? (
                <div className="flex items-center gap-2 rounded-lg bg-green-500/10 px-3 py-2 text-xs text-green-700 dark:text-green-400">
                  <Check className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-bold">Clé configurée</span>
                  <code className="ml-auto text-[10px] opacity-80 truncate">{settings.maskedApiKey}</code>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-bold">Pas de clé enregistrée</span>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  {settings?.configured ? 'Remplacer la clé' : 'Saisissez votre clé'}
                </label>
                <div className="relative">
                  <Input
                    type={showKey ? 'text' : 'password'}
                    placeholder={providerCfg.keyPrefix ? `${providerCfg.keyPrefix}…` : 'API key'}
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    className={`pr-10 font-mono text-xs ${keyShapeInvalid || keyLooksLikePassword ? 'border-red-500 focus-visible:ring-red-500' : ''}`} />
                  <button type="button" onClick={() => setShowKey((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                {keyLooksLikePassword ? (
                  <p className="mt-1.5 text-[10px] text-red-600 dark:text-red-400 font-semibold">
                    ⚠ Ça ressemble à un mot de passe, pas à une clé API. Une vraie clé fait 30+ caractères
                    et commence souvent par un préfixe (<code>nvapi-</code>, <code>sk-</code>, <code>hf_</code>, etc.).
                  </p>
                ) : keyShapeInvalid ? (
                  <p className="mt-1.5 text-[10px] text-red-600 dark:text-red-400">
                    ⚠ Ce ne ressemble pas à une clé {providerCfg.label}.
                    {providerCfg.keyPrefix && ` Elle devrait commencer par "${providerCfg.keyPrefix}".`}
                  </p>
                ) : (
                  <p className="mt-1.5 text-[10px] text-muted-foreground">
                    La clé reste côté serveur — le navigateur ne voit qu'un masque.
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleTest} disabled={testing} className="gap-1.5 flex-1"
                  title="Vérifie que la clé est valide sans la sauvegarder">
                  {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                  Tester (sans sauver)
                </Button>
                {settings?.configured && (
                  <Button variant="ghost" size="sm" onClick={handleClearKey}
                    className="text-destructive hover:text-destructive">
                    <X className="h-3.5 w-3.5" />Effacer
                  </Button>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground -mt-2">
                💡 Tester vérifie la clé mais ne l'enregistre pas. Cliquez <strong>Enregistrer</strong> en bas pour que l'Assistant l'utilise.
              </p>

              {/* Diagnostic — debug what's actually stored */}
              <details className="text-xs border-t border-border pt-3">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none flex items-center gap-1.5">
                  🩺 Diagnostic (en cas de 401)
                </summary>
                <div className="mt-2 space-y-2">
                  <Button type="button" variant="outline" size="sm" onClick={handleRunDebug} className="w-full gap-1.5 text-xs">
                    <Zap className="h-3 w-3" />Lancer le diagnostic
                  </Button>
                  {showDebug && debug && (
                    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1 font-mono text-[10px]">
                      <DebugRow label="Provider" value={debug.provider} />
                      <DebugRow label="Base URL" value={debug.baseUrl} mono />
                      <DebugRow label="Model" value={debug.model} mono />
                      <DebugRow label="Clé présente"
                        value={debug.apiKeyPresent ? '✓ Oui' : '✗ Non'}
                        good={debug.apiKeyPresent} />
                      <DebugRow label="Longueur clé"
                        value={debug.apiKeyLength}
                        good={debug.apiKeyLength > 10} />
                      <DebugRow label="Préfixe clé"
                        value={debug.apiKeyPrefix ?? '—'}
                        mono
                        good={(provider === 'HUGGINGFACE' && debug.apiKeyPrefix?.startsWith('hf_')) ||
                              (provider === 'CUSTOM')} />
                      {debug.apiKeyHasWhitespace && (
                        <p className="text-red-600 dark:text-red-400 text-[10px] pt-1 font-sans">
                          ⚠ La clé contient des espaces parasites !
                        </p>
                      )}
                      {!debug.apiKeyPresent && (
                        <p className="text-amber-700 dark:text-amber-400 text-[10px] pt-1 font-sans">
                          → Aucune clé enregistrée. Saisissez-la ci-dessus puis cliquez <strong>Enregistrer</strong> en bas.
                        </p>
                      )}
                      {debug.apiKeyPresent && provider === 'HUGGINGFACE' && !debug.apiKeyPrefix?.startsWith('hf_') && (
                        <p className="text-red-600 dark:text-red-400 text-[10px] pt-1 font-sans">
                          ⚠ La clé enregistrée ne commence pas par <code>hf_</code> — ce n'est pas un token HuggingFace.
                        </p>
                      )}
                      {debug.apiKeyPresent && provider === 'HUGGINGFACE' && debug.apiKeyPrefix?.startsWith('hf_') && (
                        <p className="text-blue-700 dark:text-blue-400 text-[10px] pt-1 font-sans">
                          ℹ La clé est enregistrée et a le bon format. Voir le ping live ci-dessous pour savoir si elle marche.
                        </p>
                      )}

                      {/* Live ping result */}
                      {debug.livePing && (
                        <div className="border-t border-border mt-2 pt-2 space-y-1">
                          <p className="font-sans font-bold text-[10px] uppercase tracking-wide text-muted-foreground">
                            🛰 Ping live vers {debug.provider}
                          </p>
                          {debug.livePing.ok ? (
                            <p className="font-sans text-emerald-700 dark:text-emerald-400">
                              ✓ La clé fonctionne ! Le modèle <code>{debug.livePing.model}</code> a répondu.
                            </p>
                          ) : debug.livePing.rateLimited ? (
                            <p className="font-sans text-amber-700 dark:text-amber-400">
                              ⏱ Rate-limited (réessayez dans {debug.livePing.retryAfterSeconds}s) — mais la clé est VALIDE.
                            </p>
                          ) : debug.livePing.outOfCredits ? (
                            <p className="font-sans text-amber-700 dark:text-amber-400">
                              💸 Quota épuisé — la clé est VALIDE mais le modèle est saturé.
                            </p>
                          ) : (
                            <>
                              <p className="font-sans text-red-700 dark:text-red-400">
                                ✗ {debug.livePing.status ? `HTTP ${debug.livePing.status}` : 'Échec'}
                              </p>
                              <pre className="whitespace-pre-wrap break-words text-[9px] text-muted-foreground bg-card border border-border rounded px-2 py-1 mt-1">
                                {debug.livePing.error}
                              </pre>
                              {provider === 'HUGGINGFACE' && debug.livePing.error?.includes('Authentication') && (
                                <p className="font-sans text-amber-700 dark:text-amber-400 text-[10px] mt-1">
                                  → Le token est rejeté par HuggingFace. Causes possibles :
                                  <br />1. Token expiré ou révoqué
                                  <br />2. Token <strong>Fine-grained</strong> sans la permission « <em>Make calls to Inference Providers</em> »
                                  <br />3. Compte HuggingFace pas encore validé par email
                                  <br /><br />→ <strong>Solution rapide</strong> : supprimez ce token, créez-en un nouveau de type « <strong>Read</strong> » (le simple), collez-le ici puis cliquez Enregistrer.
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </details>
            </MagicCard>

            {/* ── Unsplash key (optional) — improves photo quality ────── */}
            <MagicCard className="p-5 space-y-3">
              <div className="flex items-start gap-2">
                <span className="text-xl">📷</span>
                <div className="flex-1">
                  <h2 className="font-bold text-foreground text-sm">Clé Unsplash (optionnelle)</h2>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Active la recherche de photos <strong>curatées de haute qualité</strong> pour la page d'accueil.
                    Sans clé, on utilise OpenVerse (CC) — résultats variables.
                  </p>
                </div>
              </div>

              {settings?.unsplashConfigured ? (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
                  <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Clé Unsplash active</span>
                  <code className="ml-auto text-[10px] opacity-80 truncate">{settings.maskedUnsplashKey}</code>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 px-3 py-2 text-[11px] text-foreground">
                  Pas de clé → photos via OpenVerse (qualité documentaire variable).
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">
                  {settings?.unsplashConfigured ? 'Remplacer la clé' : 'Coller votre Access Key'}
                </label>
                <div className="flex gap-1.5">
                  <input
                    type={showUnsplash ? 'text' : 'password'}
                    value={unsplashInput}
                    onChange={(e) => setUnsplashInput(e.target.value)}
                    placeholder="Access Key (32 caractères)"
                    className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                  <Button variant="outline" size="sm" onClick={() => setShowUnsplash((v) => !v)} title={showUnsplash ? 'Masquer' : 'Afficher'}>
                    {showUnsplash ? '🙈' : '👁'}
                  </Button>
                </div>
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  Gratuit · 50 requêtes/heure ·{' '}
                  <a href="https://unsplash.com/developers" target="_blank" rel="noopener"
                    className="text-brand-600 hover:underline">
                    unsplash.com/developers
                  </a>
                  {' → '}New Application → Copier <em>Access Key</em>.
                </p>
              </div>
            </MagicCard>

            {/* ── Pexels key (preferred when set — bigger free tier than Unsplash) ── */}
            <MagicCard className="p-5 space-y-3">
              <div className="flex items-start gap-2">
                <span className="text-xl">🖼️</span>
                <div className="flex-1">
                  <h2 className="font-bold text-foreground text-sm">Clé Pexels (recommandée)</h2>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Catalogue plus large qu'Unsplash + quota plus généreux (<strong>200 req/heure, 20K/mois gratuits</strong>).
                    Si configurée, Pexels est <strong>utilisée en priorité</strong>.
                  </p>
                </div>
              </div>

              {settings?.pexelsConfigured ? (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
                  <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Clé Pexels active</span>
                  <code className="ml-auto text-[10px] opacity-80 truncate">{settings.maskedPexelsKey}</code>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-emerald-500/40 bg-emerald-500/5 px-3 py-2 text-[11px] text-foreground">
                  Pas de clé Pexels — fallback Unsplash ou OpenVerse.
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">
                  {settings?.pexelsConfigured ? 'Remplacer la clé' : 'Coller votre API Key Pexels'}
                </label>
                <div className="flex gap-1.5">
                  <input
                    type={showPexels ? 'text' : 'password'}
                    value={pexelsInput}
                    onChange={(e) => setPexelsInput(e.target.value)}
                    placeholder="API key (commence par 563492…)"
                    className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                  <Button variant="outline" size="sm" onClick={() => setShowPexels((v) => !v)} title={showPexels ? 'Masquer' : 'Afficher'}>
                    {showPexels ? '🙈' : '👁'}
                  </Button>
                </div>
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  Gratuit ·{' '}
                  <a href="https://www.pexels.com/api/" target="_blank" rel="noopener"
                    className="text-brand-600 hover:underline">
                    pexels.com/api
                  </a>
                  {' → '}S'inscrire → Copier la clé.
                </p>
              </div>
            </MagicCard>

            <MagicCard className="p-5 space-y-3">
              <h2 className="font-bold text-foreground">Modèle sélectionné</h2>
              {selectedModelData ? (
                <div className="rounded-xl border border-brand-500/30 bg-brand-500/5 p-3">
                  <p className="text-sm font-bold text-foreground">{selectedModelData.name}</p>
                  <code className="text-[10px] text-muted-foreground break-all">{selectedModelData.id}</code>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {selectedModelData.isFree && <Badge color="emerald">Gratuit</Badge>}
                    {selectedModelData.supportsTools && <Badge color="brand">Tools</Badge>}
                    {selectedModelData.supportsVision && <Badge color="purple">Vision</Badge>}
                    {selectedModelData.context_length && (
                      <Badge color="muted">{(selectedModelData.context_length / 1000).toFixed(0)}K ctx</Badge>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">Aucun modèle sélectionné — choisissez-en un dans la liste à droite.</p>
              )}
            </MagicCard>

            {/* ── Fallback chain ────────────────────────────────── */}
            <MagicCard className="p-5 space-y-3">
              <div className="flex items-start gap-2">
                <RefreshCw className="h-4 w-4 mt-0.5 text-brand-500 shrink-0" />
                <div className="flex-1">
                  <h2 className="font-bold text-foreground text-sm">Modèles de secours</h2>
                  <p className="text-[10px] text-muted-foreground leading-snug">
                    Essayés dans l'ordre quand le modèle principal renvoie 429 (rate-limited).
                    Cliquez "+ Secours" sur n'importe quel modèle pour l'ajouter ici.
                  </p>
                </div>
              </div>

              {fallbacks.length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic text-center py-2">
                  Aucun modèle de secours — recommandé pour éviter les 429.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {fallbacks.map((id, i) => {
                    const m = catalog?.items.find((x) => x.id === id)
                    return (
                      <div key={id} className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-2 py-1.5">
                        <span className="rounded-full bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold text-brand-700 dark:text-brand-300 shrink-0">
                          #{i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold text-foreground truncate">
                            {m?.name ?? id.split('/').pop()}
                          </p>
                          <code className="text-[9px] text-muted-foreground truncate block">{id}</code>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button type="button" onClick={() => moveFallback(id, -1)} disabled={i === 0}
                            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-card disabled:opacity-30 disabled:cursor-not-allowed">
                            <span className="text-xs">↑</span>
                          </button>
                          <button type="button" onClick={() => moveFallback(id, 1)} disabled={i === fallbacks.length - 1}
                            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-card disabled:opacity-30 disabled:cursor-not-allowed">
                            <span className="text-xs">↓</span>
                          </button>
                          <button type="button" onClick={() => removeFallback(id)}
                            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-destructive">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {fallbacks.length === 0 && catalog && (
                <button type="button"
                  onClick={() => {
                    // Suggest 3 free + tool-capable models that aren't already the primary
                    const suggestions = catalog.items
                      .filter((m) => m.isFree && m.supportsTools && m.id !== selectedModel)
                      .slice(0, 3)
                      .map((m) => m.id)
                    setFallbacks(suggestions)
                  }}
                  className="w-full text-xs text-brand-600 hover:underline flex items-center justify-center gap-1">
                  <Sparkles className="h-3 w-3" />Suggérer 3 modèles de secours
                </button>
              )}
            </MagicCard>

            <MagicCard className="p-5 space-y-3">
              <h2 className="font-bold text-foreground text-sm">Paramètres avancés</h2>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Température (0-2)</label>
                <Input type="number" min={0} max={2} step={0.1}
                  value={temperature ?? ''} placeholder="0.3"
                  onChange={(e) => setTemperature(e.target.value ? Number(e.target.value) : undefined)} />
                <p className="mt-1 text-[10px] text-muted-foreground">Plus bas = plus déterministe.</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Max tokens par réponse</label>
                <Input type="number" min={100} step={100}
                  value={maxTokens ?? ''} placeholder="2048"
                  onChange={(e) => setMaxTokens(e.target.value ? Number(e.target.value) : undefined)} />
              </div>
              {/* URL de base — visible-by-default for CUSTOM (required), collapsed for HUGGINGFACE (sensible default) */}
              {provider === 'CUSTOM' ? (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    URL de base <span className="text-red-600">*</span>
                  </label>
                  <Input className="font-mono text-xs" value={baseUrl}
                    placeholder="https://integrate.api.nvidia.com/v1"
                    onChange={(e) => setBaseUrl(e.target.value)} />
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Ex : NVIDIA NIM → <code>https://integrate.api.nvidia.com/v1</code> ·
                    Ollama local → <code>http://ollama:11434/v1</code> ·
                    OpenAI → <code>https://api.openai.com/v1</code>
                  </p>
                </div>
              ) : (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">URL de base avancée</summary>
                  <Input className="mt-2 font-mono text-xs" value={baseUrl} placeholder="https://router.huggingface.co/v1"
                    onChange={(e) => setBaseUrl(e.target.value)} />
                </details>
              )}
            </MagicCard>

            {hasUnsavedChanges && (
              <div className="rounded-lg border-2 border-amber-500/50 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold">Modifications non enregistrées</p>
                  <p className="opacity-80 mt-0.5">Le bouton <em>Tester</em> ne sauvegarde pas. Cliquez <em>Enregistrer</em> pour que l'Assistant utilise cette configuration.</p>
                </div>
              </div>
            )}

            <Button variant="brand" onClick={handleSave} disabled={saving}
              className={`w-full gap-1.5 ${hasUnsavedChanges ? 'ring-2 ring-amber-500/50 ring-offset-2 ring-offset-background' : ''}`}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Sauvegarde...' : hasUnsavedChanges ? 'Enregistrer les modifications' : 'Enregistré'}
            </Button>

            {settings?.updatedAt && (
              <p className="text-[10px] text-muted-foreground text-center">
                Dernière modification : {new Date(settings.updatedAt).toLocaleString('fr-FR')}
                {settings.updatedByAdminName && ` · ${settings.updatedByAdminName}`}
              </p>
            )}
          </div>

          {/* ── RIGHT (2/3): Catalog ──────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="font-bold text-foreground flex items-center gap-2">
                <Cpu className="h-4 w-4 text-brand-500" />
                Catalogue de modèles
                {catalog && <span className="text-xs font-normal text-muted-foreground">
                  ({catalog.matched} / {catalog.total} modèles)
                </span>}
              </h2>
              <Button variant="ghost" size="sm" onClick={() => loadCatalog(true)} className="gap-1.5 text-xs">
                <RefreshCw className="h-3 w-3" />Actualiser
              </Button>
            </div>

            {/* Search + filters */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" placeholder="Rechercher un modèle (nom, id, description)…"
                  value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <div className="flex flex-wrap gap-2">
                <FilterChip active={freeOnly} onClick={() => setFreeOnly((v) => !v)}
                  icon={DollarSign} label="Gratuit" count={catalog?.facets.freeCount} />
                <FilterChip active={toolsOnly} onClick={() => setToolsOnly((v) => !v)}
                  icon={Wrench} label="Tool calling" count={catalog?.facets.toolsCount} />
                <FilterChip active={visionOnly} onClick={() => setVisionOnly((v) => !v)}
                  icon={ImageIcon} label="Vision" count={catalog?.facets.visionCount} />
                <select value={modelAuthor} onChange={(e) => setModelAuthor(e.target.value)}
                  className="h-9 rounded-lg border border-input bg-background px-3 text-xs">
                  <option value="">Tous auteurs</option>
                  {providers.map(([p, n]) => <option key={p} value={p}>{p} ({n})</option>)}
                </select>
                <select value={minContext ?? ''} onChange={(e) => setMinContext(e.target.value ? Number(e.target.value) : undefined)}
                  className="h-9 rounded-lg border border-input bg-background px-3 text-xs">
                  <option value="">Tout contexte</option>
                  <option value="8000">≥ 8K</option>
                  <option value="32000">≥ 32K</option>
                  <option value="128000">≥ 128K</option>
                  <option value="200000">≥ 200K</option>
                  <option value="1000000">≥ 1M</option>
                </select>
              </div>
            </div>

            {/* Model list */}
            <div className="grid gap-2 sm:grid-cols-2">
              {loadingCatalog ? (
                Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)
              ) : (catalog?.items ?? []).length === 0 ? (
                <div className="sm:col-span-2 py-10 text-center text-muted-foreground text-sm">
                  Aucun modèle ne correspond aux filtres.
                </div>
              ) : (catalog?.items ?? []).slice(0, 60).map((m) => (
                <ModelCard key={m.id} m={m}
                  selected={selectedModel === m.id}
                  isFallback={fallbacks.includes(m.id)}
                  onSelect={() => setSelectedModel(m.id)}
                  onAddFallback={() => addFallback(m.id)}
                  onRemoveFallback={() => removeFallback(m.id)}
                  onPreview={() => setPreviewModel(m)} />
              ))}
            </div>

            {(catalog?.items?.length ?? 0) > 60 && (
              <p className="text-xs text-center text-muted-foreground">
                {catalog!.items.length - 60} autres modèles non affichés — affinez les filtres.
              </p>
            )}
          </div>
        </div>

        {/* Detail drawer */}
        {previewModel && (
          <ModelPreviewModal m={previewModel} onClose={() => setPreviewModel(null)}
            onSelect={() => { setSelectedModel(previewModel.id); setPreviewModel(null) }} />
        )}
      </div>
    </AdminLayout>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DebugRow({ label, value, good, mono }: {
  label: string; value: any; good?: boolean; mono?: boolean
}) {
  const valueClass = good === true  ? 'text-emerald-700 dark:text-emerald-400'
                   : good === false ? 'text-red-700 dark:text-red-400'
                   : 'text-foreground'
  return (
    <div className="flex items-center justify-between gap-3 font-sans">
      <span className="text-muted-foreground">{label} :</span>
      <span className={`${mono ? 'font-mono' : ''} ${valueClass}`}>{String(value ?? '—')}</span>
    </div>
  )
}

function Badge({ color, children }: { color: 'emerald' | 'brand' | 'purple' | 'muted' | 'amber'; children: React.ReactNode }) {
  const map = {
    emerald: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    brand:   'bg-brand-500/10 text-brand-700 dark:text-brand-400',
    purple:  'bg-purple-500/10 text-purple-700 dark:text-purple-400',
    amber:   'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    muted:   'bg-muted text-muted-foreground',
  }
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${map[color]}`}>{children}</span>
}

function FilterChip({ active, onClick, icon: Icon, label, count }: {
  active: boolean; onClick: () => void; icon: any; label: string; count?: number
}) {
  return (
    <button type="button" onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg border-2 px-3 py-1.5 text-xs font-medium transition-colors
        ${active ? 'border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-300'
                 : 'border-border bg-card text-muted-foreground hover:border-brand-400'}`}>
      <Icon className="h-3 w-3" />{label}
      {count !== undefined && (
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">{count}</span>
      )}
    </button>
  )
}

function ModelCard({ m, selected, isFallback, onSelect, onAddFallback, onRemoveFallback, onPreview }: {
  m: Model
  selected: boolean
  isFallback: boolean
  onSelect: () => void
  onAddFallback: () => void
  onRemoveFallback: () => void
  onPreview: () => void
}) {
  return (
    <div className={`group rounded-xl border-2 p-3 transition-all cursor-pointer relative
        ${selected ? 'border-brand-500 bg-brand-500/5 shadow-md'
                   : isFallback ? 'border-amber-500/50 bg-amber-500/5'
                   : 'border-border bg-card hover:border-brand-400'}`}
      onClick={onSelect}>
      {isFallback && (
        <span className="absolute -top-1.5 -right-1.5 rounded-full bg-amber-500 text-white px-1.5 py-0.5 text-[9px] font-bold">
          Secours
        </span>
      )}
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-sm font-bold text-foreground line-clamp-1 flex-1">{m.name}</p>
        {selected && <Check className="h-4 w-4 text-brand-600 shrink-0" />}
      </div>
      <code className="text-[10px] text-muted-foreground break-all line-clamp-1">{m.id}</code>
      <div className="mt-2 flex flex-wrap gap-1">
        {m.isFree && <Badge color="emerald">Gratuit</Badge>}
        {m.supportsTools && <Badge color="brand">Tools</Badge>}
        {m.supportsVision && <Badge color="purple">Vision</Badge>}
        {m.context_length && (
          <Badge color="muted">
            {m.context_length >= 1_000_000 ? `${(m.context_length / 1_000_000).toFixed(1)}M` :
             m.context_length >= 1000 ? `${(m.context_length / 1000).toFixed(0)}K` : m.context_length} ctx
          </Badge>
        )}
        {!m.isFree && m.promptPriceM !== undefined && m.promptPriceM > 0 && (
          <Badge color="amber">${m.promptPriceM.toFixed(2)}/M in</Badge>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-1">
        <span className="text-[10px] text-muted-foreground">{m.provider}</span>
        <div className="flex items-center gap-1">
          {!selected && (
            isFallback ? (
              <button type="button" onClick={(e) => { e.stopPropagation(); onRemoveFallback() }}
                className="text-[10px] font-medium text-amber-700 dark:text-amber-400 hover:underline">
                − Secours
              </button>
            ) : (
              <button type="button" onClick={(e) => { e.stopPropagation(); onAddFallback() }}
                className="text-[10px] font-medium text-amber-700 dark:text-amber-400 hover:underline">
                + Secours
              </button>
            )
          )}
          <button type="button" onClick={(e) => { e.stopPropagation(); onPreview() }}
            className="text-[10px] text-brand-600 hover:underline">Détails →</button>
        </div>
      </div>
    </div>
  )
}

function ModelPreviewModal({ m, onClose, onSelect }: { m: Model; onClose: () => void; onSelect: () => void }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl">
          <div className="border-b border-border p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-black text-foreground">{m.name}</h2>
                <code className="text-xs text-muted-foreground break-all">{m.id}</code>
              </div>
              <button onClick={onClose}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {m.isFree && <Badge color="emerald">Gratuit</Badge>}
              {m.supportsTools && <Badge color="brand">Tool calling</Badge>}
              {m.supportsVision && <Badge color="purple">Vision</Badge>}
              <Badge color="muted">{m.provider}</Badge>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {m.description && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">Description</h3>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{m.description}</p>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-3">
              {m.context_length && (
                <DetailRow label="Contexte max" value={`${m.context_length.toLocaleString()} tokens`} icon={TrendingUp} />
              )}
              {m.top_provider?.max_completion_tokens && (
                <DetailRow label="Réponse max" value={`${m.top_provider.max_completion_tokens.toLocaleString()} tokens`} icon={Zap} />
              )}
              {m.promptPriceM !== undefined && (
                <DetailRow label="Prix entrée"
                  value={m.promptPriceM === 0 ? 'Gratuit' : `$${m.promptPriceM.toFixed(3)} / 1M tokens`}
                  icon={DollarSign} />
              )}
              {m.completionPriceM !== undefined && (
                <DetailRow label="Prix sortie"
                  value={m.completionPriceM === 0 ? 'Gratuit' : `$${m.completionPriceM.toFixed(3)} / 1M tokens`}
                  icon={DollarSign} />
              )}
              {m.architecture?.modality && (
                <DetailRow label="Modalité" value={m.architecture.modality} icon={ImageIcon} />
              )}
              {m.architecture?.tokenizer && (
                <DetailRow label="Tokenizer" value={m.architecture.tokenizer} icon={Cpu} />
              )}
            </div>

            {m.supported_parameters && m.supported_parameters.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">Paramètres supportés</h3>
                <div className="flex flex-wrap gap-1">
                  {m.supported_parameters.map((p) => (
                    <code key={p} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-foreground">{p}</code>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-lg bg-muted/30 p-3 text-xs">
              <a href={`https://huggingface.co/${m.id}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-brand-600 hover:underline">
                Fiche officielle sur HuggingFace <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          <div className="sticky bottom-0 border-t border-border bg-card p-4 flex gap-2 justify-end">
            <Button variant="ghost" onClick={onClose}>Fermer</Button>
            <Button variant="brand" onClick={onSelect} className="gap-1.5">
              <Check className="h-4 w-4" />Utiliser ce modèle
            </Button>
          </div>
        </div>
      </motion.div>
    </>
  )
}

function DetailRow({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" />{label}
      </div>
      <p className="mt-0.5 text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}
