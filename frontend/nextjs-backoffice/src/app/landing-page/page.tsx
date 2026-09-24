'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle, CheckCircle2, Copy, Eye, EyeOff, Home, Loader2, MoreHorizontal, PanelRightClose,
  PanelRightOpen, RotateCcw, Send, Trash2, Undo2, Wand2, Crosshair,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { adminAiApi, landingPageApi } from '@/lib/api'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { setBrandLogoUrl } from '@/components/brand/useBrandLogo'
import { BlockOutline, SETTINGS_ID } from '@/components/landing-editor/BlockOutline'
import { BlockPicker } from '@/components/landing-editor/BlockPicker'
import { BlockEditor } from '@/components/landing-editor/BlockEditor'
import { SiteSettingsPanel } from '@/components/landing-editor/SiteSettingsPanel'
import { PreviewPane } from '@/components/landing-editor/PreviewPane'
import {
  BLOCK_TYPES, blockTitle, cloneBlock, mapAiSuggestion, newBlockId,
  type CatalogEntry, type LandingBlock, type LandingDoc,
} from '@/components/landing-editor/schema'
import { cn } from '@/lib/utils'

type SaveState = 'idle' | 'pending' | 'saving' | 'error'

const fmtTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''

/**
 * Landing page editor.
 *
 * Left: "Réglages du site" + the page's blocks (reorder, hide, duplicate, delete,
 * add any block type — several of the same type are allowed). Middle: the
 * selected block's form. Right: live preview of the working copy.
 *
 * Edits autosave to a server-side DRAFT; visitors only see them after
 * « Publier ». « Annuler les modifications » drops the draft.
 */
export default function LandingPageEditor() {
  const [doc, setDoc] = useState<LandingDoc | null>(null)
  const [hasDraft, setHasDraft] = useState(false)
  const [draftUpdatedAt, setDraftUpdatedAt] = useState<string | null>(null)
  const [publishedAt, setPublishedAt] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [publishing, setPublishing] = useState(false)
  const [selectedId, setSelectedId] = useState<string>(SETTINGS_ID)
  const [focusKey, setFocusKey] = useState(0)
  const [picker, setPicker] = useState<{ open: boolean; afterId?: string }>({ open: false })
  const [previewOpen, setPreviewOpen] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)

  /** JSON of the last state the server has — autosave skips identical content. */
  const savedJson = useRef<string>('')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const applyServer = useCallback((r: { page: LandingDoc; hasDraft: boolean; draftUpdatedAt?: string; publishedAt?: string }) => {
    const page = { ...r.page, blocks: r.page.blocks ?? [] }
    savedJson.current = JSON.stringify(page)
    setDoc(page)
    setHasDraft(r.hasDraft)
    setDraftUpdatedAt(r.draftUpdatedAt ?? null)
    setPublishedAt(r.publishedAt ?? null)
    setSaveState('idle')
  }, [])

  useEffect(() => {
    landingPageApi.getDraft()
      .then((r) => {
        applyServer(r.data)
        const first = r.data.page?.blocks?.[0]
        if (first) setSelectedId(first.id)
      })
      .catch(() => toast.error('Impossible de charger la page d’accueil'))
  }, [applyServer])

  // ── Autosave to the draft ───────────────────────────────────────────────
  useEffect(() => {
    if (!doc) return
    const json = JSON.stringify(doc)
    if (json === savedJson.current) return
    setSaveState('pending')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaveState('saving')
      try {
        const r = await landingPageApi.saveDraft(doc)
        savedJson.current = json
        setHasDraft(r.data.hasDraft)
        setDraftUpdatedAt(r.data.draftUpdatedAt ?? null)
        setSaveState((s) => (s === 'saving' ? 'idle' : s))
      } catch (err: any) {
        setSaveState('error')
        toast.error(err?.response?.data?.message ?? 'Brouillon non enregistré', { id: 'landing-save' })
      }
    }, 900)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [doc])

  // Warn before leaving with an unsaved edit.
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (saveState === 'pending' || saveState === 'saving' || saveState === 'error') { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [saveState])

  // ── Document / block operations ─────────────────────────────────────────
  const setBlocks = (fn: (blocks: LandingBlock[]) => LandingBlock[]) =>
    setDoc((d) => (d ? { ...d, blocks: fn(d.blocks) } : d))
  const patchBlock = (id: string, patch: Record<string, any>) =>
    setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, data: { ...b.data, ...patch } } : b)))
  const select = useCallback((id: string) => {
    setSelectedId(id)
    setFocusKey((n) => n + 1)
    // Stacked layout (< lg): the form sits below the outline — bring it into view.
    if (window.innerWidth < 1024) {
      requestAnimationFrame(() => document.getElementById('landing-block-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    }
  }, [])

  const addBlock = (entry: CatalogEntry) => {
    const block: LandingBlock = { id: newBlockId(), type: entry.type, visible: true, data: entry.create() }
    setBlocks((bs) => {
      const at = picker.afterId ? bs.findIndex((b) => b.id === picker.afterId) + 1 : bs.length
      return [...bs.slice(0, at), block, ...bs.slice(at)]
    })
    setPicker({ open: false })
    select(block.id)
    toast.success(`Bloc « ${entry.label} » ajouté`, { id: 'block-added' })
  }
  const duplicate = (id: string) => {
    if (!doc) return
    const i = doc.blocks.findIndex((b) => b.id === id)
    if (i < 0) return
    const copy = cloneBlock(doc.blocks[i])
    setBlocks((bs) => {
      const at = bs.findIndex((b) => b.id === id)
      return [...bs.slice(0, at + 1), copy, ...bs.slice(at + 1)]
    })
    select(copy.id)
    toast.success('Bloc dupliqué', { id: 'block-duplicated' })
  }
  const remove = (id: string) => {
    if (!doc) return
    const before = doc.blocks
    const i = before.findIndex((b) => b.id === id)
    if (i < 0) return
    const name = blockTitle(before[i])
    setBlocks((bs) => bs.filter((b) => b.id !== id))
    if (selectedId === id) setSelectedId(before[i + 1]?.id ?? before[i - 1]?.id ?? SETTINGS_ID)
    toast((t) => (
      <span className="flex items-center gap-3 text-sm">
        Bloc « {name} » supprimé
        <button type="button" className="inline-flex items-center gap-1 rounded-md bg-brand-500/10 px-2 py-1 text-xs font-semibold text-brand-700 dark:text-brand-300"
          onClick={() => { setBlocks(() => before); select(id); toast.dismiss(t.id) }}>
          <Undo2 className="h-3 w-3" />Annuler
        </button>
      </span>
    ), { id: 'block-removed', duration: 7000 })
  }
  const toggle = (id: string) => setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, visible: b.visible === false } : b)))
  const move = (id: string, dir: -1 | 1) => setBlocks((bs) => {
    const i = bs.findIndex((b) => b.id === id)
    const t = i + dir
    if (i < 0 || t < 0 || t >= bs.length) return bs
    const next = [...bs]
    ;[next[i], next[t]] = [next[t], next[i]]
    return next
  })
  const reorder = (from: number, to: number) => setBlocks((bs) => {
    const next = [...bs]
    const [b] = next.splice(from, 1)
    next.splice(to, 0, b)
    return next
  })

  // ── Publish / discard / reset ───────────────────────────────────────────
  const publish = async () => {
    if (!doc) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setPublishing(true)
    try {
      const r = await landingPageApi.publish(doc)
      savedJson.current = JSON.stringify(doc)
      setHasDraft(false)
      setDraftUpdatedAt(null)
      setPublishedAt(r.data.publishedAt ?? new Date().toISOString())
      setSaveState('idle')
      setBrandLogoUrl(r.data.logoUrl)
      toast.success('Page d’accueil publiée — visible par tous les visiteurs')
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Publication échouée')
    } finally { setPublishing(false) }
  }
  const discard = async () => {
    setMenuOpen(false)
    if (!confirm('Annuler toutes les modifications non publiées et revenir à la version en ligne ?')) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    try {
      const r = await landingPageApi.discardDraft()
      applyServer(r.data)
      setSelectedId((id) => (r.data.page.blocks.some((b: LandingBlock) => b.id === id) ? id : SETTINGS_ID))
      toast.success('Modifications annulées')
    } catch { toast.error('Erreur') }
  }
  const resetContent = async () => {
    setMenuOpen(false)
    if (!confirm('Remplacer tous les blocs par le contenu par défaut ? (logo, couleurs et pied de page sont conservés — rien n’est publié tant que vous ne cliquez pas sur « Publier »)')) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    try {
      const r = await landingPageApi.reset()
      applyServer(r.data)
      setSelectedId(r.data.page.blocks[0]?.id ?? SETTINGS_ID)
      toast.success('Contenu par défaut chargé dans le brouillon')
    } catch { toast.error('Erreur') }
  }

  // ── AI generation for the selected block ────────────────────────────────
  const generate = async (block: LandingBlock) => {
    const section = BLOCK_TYPES[block.type].ai
    if (!section) return
    const brief = window.prompt('Brief facultatif (laisser vide = contenu par défaut Medianet) :', '')
    if (brief === null) return
    setAiBusy(true)
    const id = toast.loading('Génération du contenu…')
    try {
      const r = await adminAiApi.landingSuggest({ section, brief: brief.trim() || undefined, locale: 'fr' })
      if (r.data?.error) { toast.error(r.data.error, { id }); return }
      const patch = mapAiSuggestion(block.type, r.data ?? {})
      if (Object.keys(patch).length === 0) { toast.error('Réponse IA inattendue', { id }); return }
      patchBlock(block.id, patch)
      toast.success('Contenu généré — relisez avant de publier', { id })
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Échec de la génération IA', { id })
    } finally { setAiBusy(false) }
  }

  if (!doc) {
    return (
      <AdminLayout>
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <Skeleton className="h-[60vh] rounded-2xl" />
          <Skeleton className="h-[60vh] rounded-2xl" />
        </div>
      </AdminLayout>
    )
  }

  const selected = doc.blocks.find((b) => b.id === selectedId) ?? null
  const dirty = hasDraft || saveState !== 'idle'
  const canAi = !!selected && !!BLOCK_TYPES[selected.type].ai
    && (selected.type !== 'media' || (selected.data.layout ?? 'text-image') === 'text-image')

  const status = saveState === 'saving' ? { cls: 'border-brand-500/30 bg-brand-500/10 text-brand-700 dark:text-brand-300', icon: <Loader2 className="h-3 w-3 animate-spin" />, text: 'Enregistrement…' }
    : saveState === 'pending' ? { cls: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300', icon: <Loader2 className="h-3 w-3 animate-spin" />, text: 'Modifications…' }
    : saveState === 'error' ? { cls: 'border-destructive/40 bg-destructive/10 text-destructive', icon: <AlertTriangle className="h-3 w-3" />, text: 'Non enregistré' }
    : hasDraft ? { cls: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300', icon: <AlertTriangle className="h-3 w-3" />, text: `Brouillon non publié${draftUpdatedAt ? ` · ${fmtTime(draftUpdatedAt)}` : ''}` }
    : { cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300', icon: <CheckCircle2 className="h-3 w-3" />, text: `Publié${publishedAt ? ` · ${fmtTime(publishedAt)}` : ''}` }

  const Icon = selected ? BLOCK_TYPES[selected.type].icon : null
  const iconBtn = 'inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50'

  return (
    <AdminLayout>
      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 -mx-4 mb-4 border-b border-border bg-background/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <Home className="h-4 w-4 text-brand-500" />
          <h1 className="text-sm font-bold text-foreground">Page d’accueil</h1>
          <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold', status.cls)}>
            {status.icon}{status.text}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" className="hidden gap-1.5 xl:inline-flex" onClick={() => setPreviewOpen((v) => !v)}>
              {previewOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
              {previewOpen ? 'Masquer l’aperçu' : 'Aperçu'}
            </Button>
            <div className="relative">
              <Button variant="ghost" size="sm" onClick={() => setMenuOpen((v) => !v)} title="Plus d’actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
              {menuOpen && (
                <div className="absolute right-0 top-full z-40 mt-1 w-72 overflow-hidden rounded-lg border border-border bg-popover py-1 shadow-xl"
                  onMouseLeave={() => setMenuOpen(false)}>
                  <button type="button" disabled={!hasDraft} onClick={discard}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left text-xs hover:bg-accent disabled:opacity-40 disabled:hover:bg-transparent">
                    <Undo2 className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                    <span><span className="block font-semibold text-foreground">Annuler les modifications</span>
                      <span className="text-muted-foreground">Revenir à la version publiée</span></span>
                  </button>
                  <button type="button" onClick={resetContent}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left text-xs hover:bg-accent">
                    <RotateCcw className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                    <span><span className="block font-semibold text-foreground">Contenu par défaut</span>
                      <span className="text-muted-foreground">Recharger les blocs d’exemple dans le brouillon</span></span>
                  </button>
                </div>
              )}
            </div>
            <Button size="sm" className="gap-1.5" onClick={publish} disabled={publishing || !dirty}
              title={dirty ? 'Mettre en ligne le brouillon' : 'Aucune modification à publier'}>
              {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Publier
            </Button>
          </div>
        </div>
      </div>

      <div className={cn('grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]',
        previewOpen && 'xl:grid-cols-[270px_minmax(360px,0.85fr)_minmax(0,1.15fr)]')}>
        {/* ── Outline ─────────────────────────────────────────────── */}
        <aside className="lg:sticky lg:top-16 lg:max-h-[calc(100vh-5rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
          <BlockOutline blocks={doc.blocks} selectedId={selectedId} onSelect={select}
            onMove={move} onReorder={reorder} onToggle={toggle} onDuplicate={duplicate} onDelete={remove}
            onAdd={(afterId) => setPicker({ open: true, afterId })} />
        </aside>

        {/* ── Selected block / settings ───────────────────────────── */}
        <main id="landing-block-form" className="min-w-0 scroll-mt-16 space-y-3">
          {selectedId === SETTINGS_ID || !selected ? (
            <>
              <header>
                <h2 className="text-base font-bold text-foreground">Réglages du site</h2>
                <p className="text-xs text-muted-foreground">Logo, couleurs et pied de page, partagés par toute la page.</p>
              </header>
              <SiteSettingsPanel doc={doc} set={(patch) => setDoc((d) => (d ? { ...d, ...patch } : d))} />
            </>
          ) : (
            <>
              <header className="flex flex-wrap items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
                  {Icon && <Icon className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-bold text-foreground">{blockTitle(selected)}</h2>
                  <p className="text-xs text-muted-foreground">
                    {BLOCK_TYPES[selected.type].label}
                    {selected.visible === false && <span className="ml-1.5 font-semibold text-amber-600 dark:text-amber-400">· masqué pour les visiteurs</span>}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {canAi && (
                    <button type="button" className={iconBtn} disabled={aiBusy} onClick={() => generate(selected)} title="Générer le contenu avec l’IA">
                      {aiBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}IA
                    </button>
                  )}
                  <button type="button" className={cn(iconBtn, 'hidden xl:inline-flex')} onClick={() => setFocusKey((n) => n + 1)} title="Afficher dans l’aperçu">
                    <Crosshair className="h-3.5 w-3.5" />Voir
                  </button>
                  <button type="button" className={iconBtn} onClick={() => toggle(selected.id)}>
                    {selected.visible === false ? <><Eye className="h-3.5 w-3.5" />Afficher</> : <><EyeOff className="h-3.5 w-3.5" />Masquer</>}
                  </button>
                  <button type="button" className={iconBtn} onClick={() => duplicate(selected.id)}>
                    <Copy className="h-3.5 w-3.5" />Dupliquer
                  </button>
                  <button type="button" className={cn(iconBtn, 'hover:border-destructive/50 hover:text-destructive')} onClick={() => remove(selected.id)}>
                    <Trash2 className="h-3.5 w-3.5" />Supprimer
                  </button>
                </div>
              </header>
              <BlockEditor key={selected.id} block={selected} onChange={(patch) => patchBlock(selected.id, patch)} />
            </>
          )}
        </main>

        {/* ── Live preview ────────────────────────────────────────── */}
        {previewOpen && (
          <div className="hidden xl:block xl:sticky xl:top-16 xl:h-[calc(100vh-5.5rem)] xl:self-start">
            <PreviewPane doc={doc} selectedId={selectedId === SETTINGS_ID ? null : selectedId}
              focusKey={focusKey} onSelectBlock={select} />
          </div>
        )}
      </div>

      <BlockPicker open={picker.open} blocks={doc.blocks}
        afterLabel={picker.afterId ? (() => { const b = doc.blocks.find((x) => x.id === picker.afterId); return b ? blockTitle(b) : undefined })() : undefined}
        onPick={addBlock} onClose={() => setPicker({ open: false })} />
    </AdminLayout>
  )
}
