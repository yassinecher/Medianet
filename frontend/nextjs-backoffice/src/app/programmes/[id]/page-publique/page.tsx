'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  AlertTriangle, ArrowLeft, CheckCircle2, Copy, Crosshair, ExternalLink, Eye, EyeOff, LayoutTemplate, Loader2,
  MoreHorizontal, PanelRightClose, PanelRightOpen, RotateCcw, Save, Trash2, Undo2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { programmesApi } from '@/lib/api'
import { frontofficeBase } from '@/lib/frontoffice'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { BlockOutline, type OutlineBlock } from '@/components/landing-editor/BlockOutline'
import { BlockPicker } from '@/components/landing-editor/BlockPicker'
import { PreviewPane } from '@/components/landing-editor/PreviewPane'
import { HeroEditor, ProgrammeBlockEditor, type EditorContext } from '@/components/programme-page-editor/ProgrammeBlockEditor'
import {
  BLOCK_META, HERO_ID, PROGRAMME_CATALOG, SINGLE_TYPES, blockTitle, defaultProgrammePage, fieldsOf, newBlockId,
  parseProgrammePage, type PageFields, type ProgrammeBlock, type ProgrammeCatalogEntry, type ProgrammePage,
} from '@/components/programme-page-editor/schema'
import { useCan } from '@/hooks/useCan'
import { cn } from '@/lib/utils'
import type { Programme } from '@/types'

/**
 * « Page publique » builder of one programme — same layout as the home-page
 * editor: the hero + the page's sections (reorder, hide, duplicate, delete,
 * add), the selected section's form, and a live preview of the front-office
 * page fed with the working copy.
 *
 * Changes are kept locally until « Enregistrer »; only the programme fields
 * that were actually changed are sent, so edits made meanwhile in the
 * programme's other screens are never overwritten.
 */
export default function ProgrammePageBuilder() {
  const { id } = useParams<{ id: string }>()
  const programmeId = Number(id)
  const { can } = useCan()
  const canEdit = can('programmes:update')

  const [programme, setProgramme] = useState<Programme | null>(null)
  const [base, setBase] = useState<{ fields: PageFields; page: string } | null>(null)
  const [fields, setFieldsState] = useState<PageFields | null>(null)
  const [page, setPage] = useState<ProgrammePage | null>(null)
  const [selectedId, setSelectedId] = useState<string>(HERO_ID)
  const [focusKey, setFocusKey] = useState(0)
  const [picker, setPicker] = useState<{ open: boolean; afterId?: string }>({ open: false })
  const [previewOpen, setPreviewOpen] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await programmesApi.get(programmeId)
      const p: Programme = r.data
      const f = fieldsOf(p)
      const pg = parseProgrammePage((p as any).pageJson)
      setProgramme(p)
      setFieldsState(f)
      setPage(pg)
      setBase({ fields: f, page: JSON.stringify(pg) })
    } catch {
      toast.error('Programme introuvable')
    }
  }, [programmeId])
  useEffect(() => { load() }, [load])

  // Block anchors from the URL (?block=gallery) — e.g. « Ajouter des photos ».
  useEffect(() => {
    if (!page) return
    const wanted = new URLSearchParams(window.location.search).get('block')
    if (wanted) {
      const b = page.blocks.find((x) => x.id === wanted || x.type === wanted)
      if (b) { setSelectedId(b.id); setFocusKey((n) => n + 1) }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!page])

  const dirtyFields = useMemo(() => {
    if (!base || !fields) return [] as (keyof PageFields)[]
    return (Object.keys(fields) as (keyof PageFields)[])
      .filter((k) => JSON.stringify(fields[k]) !== JSON.stringify(base.fields[k]))
  }, [base, fields])
  const layoutDirty = !!base && !!page && JSON.stringify(page) !== base.page
  const dirty = dirtyFields.length > 0 || layoutDirty

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [dirty])

  const save = useCallback(async () => {
    if (!fields || !page || !base || !dirty || saving) return
    if (!fields.title.trim()) { toast.error('Le titre du programme est obligatoire'); setSelectedId(HERO_ID); return }
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {}
      for (const k of dirtyFields) payload[k] = fields[k]
      if (layoutDirty) payload.pageJson = JSON.stringify(page)
      const r = await programmesApi.update(programmeId, payload)
      const p: Programme = r.data
      setProgramme(p)
      setBase({ fields, page: JSON.stringify(page) })
      toast.success('Page publique enregistrée')
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Enregistrement impossible')
    } finally { setSaving(false) }
  }, [fields, page, base, dirty, dirtyFields, layoutDirty, saving, programmeId])

  // Ctrl/Cmd + S
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [save])

  // ── Working-copy operations ─────────────────────────────────────────────
  const setFields = (patch: Partial<PageFields>) => setFieldsState((f) => (f ? { ...f, ...patch } : f))
  const setBlocks = (fn: (blocks: ProgrammeBlock[]) => ProgrammeBlock[]) =>
    setPage((p) => (p ? { ...p, blocks: fn(p.blocks) } : p))
  const patchBlock = (bid: string, patch: Record<string, any>) =>
    setBlocks((bs) => bs.map((b) => (b.id === bid ? { ...b, data: { ...b.data, ...patch } } : b)))
  const select = useCallback((bid: string) => {
    setSelectedId(bid)
    setFocusKey((n) => n + 1)
    if (window.innerWidth < 1024) {
      requestAnimationFrame(() => document.getElementById('page-block-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    }
  }, [])

  const addBlock = (entry: ProgrammeCatalogEntry) => {
    const existing = entry.single ? page?.blocks.find((b) => b.type === entry.type) : undefined
    if (existing) { setPicker({ open: false }); select(existing.id); return }
    const block: ProgrammeBlock = { id: entry.single ? entry.type : newBlockId(), type: entry.type, visible: true, data: entry.create() }
    setBlocks((bs) => {
      const at = picker.afterId ? bs.findIndex((b) => b.id === picker.afterId) + 1 : bs.length
      return [...bs.slice(0, at), block, ...bs.slice(at)]
    })
    setPicker({ open: false })
    select(block.id)
    toast.success(`Bloc « ${entry.label} » ajouté`, { id: 'block-added' })
  }
  const duplicate = (bid: string) => {
    const b = page?.blocks.find((x) => x.id === bid)
    if (!b || SINGLE_TYPES.has(b.type)) return
    const copy: ProgrammeBlock = { ...structuredClone(b), id: newBlockId() }
    setBlocks((bs) => {
      const at = bs.findIndex((x) => x.id === bid)
      return [...bs.slice(0, at + 1), copy, ...bs.slice(at + 1)]
    })
    select(copy.id)
  }
  const remove = (bid: string) => {
    if (!page) return
    const before = page.blocks
    const i = before.findIndex((b) => b.id === bid)
    if (i < 0) return
    const name = blockTitle(before[i])
    setBlocks((bs) => bs.filter((b) => b.id !== bid))
    if (selectedId === bid) setSelectedId(before[i + 1]?.id ?? before[i - 1]?.id ?? HERO_ID)
    toast((t) => (
      <span className="flex items-center gap-3 text-sm">
        Bloc « {name} » retiré
        <button type="button" className="inline-flex items-center gap-1 rounded-md bg-brand-500/10 px-2 py-1 text-xs font-semibold text-brand-700 dark:text-brand-300"
          onClick={() => { setBlocks(() => before); select(bid); toast.dismiss(t.id) }}>
          <Undo2 className="h-3 w-3" />Annuler
        </button>
      </span>
    ), { id: 'block-removed', duration: 7000 })
  }
  const toggle = (bid: string) => setBlocks((bs) => bs.map((b) => (b.id === bid ? { ...b, visible: b.visible === false } : b)))
  const move = (bid: string, dir: -1 | 1) => setBlocks((bs) => {
    const i = bs.findIndex((b) => b.id === bid)
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

  const revert = () => {
    setMenuOpen(false)
    if (!base || !confirm('Annuler toutes les modifications non enregistrées ?')) return
    setFieldsState(base.fields)
    setPage(JSON.parse(base.page))
    toast.success('Modifications annulées')
  }
  const resetLayout = () => {
    setMenuOpen(false)
    if (!confirm('Revenir à la mise en page par défaut ? Les sections libres (FAQ, vidéo, témoignages…) seront retirées ; la description, les objectifs, les photos… sont conservés. Rien n’est enregistré avant « Enregistrer ».')) return
    setPage(defaultProgrammePage())
    setSelectedId(HERO_ID)
  }

  // ── Render ──────────────────────────────────────────────────────────────
  if (!programme || !fields || !page) {
    return (
      <AdminLayout>
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <Skeleton className="h-[60vh] rounded-2xl" />
          <Skeleton className="h-[60vh] rounded-2xl" />
        </div>
      </AdminLayout>
    )
  }

  const ctx: EditorContext = {
    programmeId,
    sessions: ((programme.phases ?? []) as any[]),
    criteriaCount: (programme.criteria ?? []).filter((c: any) => c.active !== false).length,
    partnersCount: (programme.partners ?? []).length,
    sectors: programme.sectors ?? [],
    acceptingApplications: (programme as any).acceptingApplications ?? programme.status === 'OPEN',
  }
  const selected = page.blocks.find((b) => b.id === selectedId) ?? null
  const status = saving
    ? { cls: 'border-brand-500/30 bg-brand-500/10 text-brand-700 dark:text-brand-300', icon: <Loader2 className="h-3 w-3 animate-spin" />, text: 'Enregistrement…' }
    : dirty
      ? { cls: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300', icon: <AlertTriangle className="h-3 w-3" />, text: 'Modifications non enregistrées' }
      : { cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300', icon: <CheckCircle2 className="h-3 w-3" />, text: 'Enregistré · visible sur le site' }
  const hiddenFromSite = programme.type === 'PRIVATE' || ['DRAFT', 'ARCHIVED', 'CANCELLED'].includes(programme.status)
  const Icon = selected ? BLOCK_META[selected.type]?.icon : LayoutTemplate
  const iconBtn = 'inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50'
  const siteUrl = `${frontofficeBase()}/programmes/${programmeId}`

  return (
    <AdminLayout>
      <div className="flex flex-col lg:h-full">
        {/* ── Toolbar ─────────────────────────────────────────────── */}
        <div className="sticky top-0 z-30 -mx-4 mb-4 shrink-0 border-b border-border bg-background/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/programmes/${programmeId}?tab=info`} title="Retour au programme"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold text-foreground">Page publique</h1>
              <p className="truncate text-[11px] text-muted-foreground">{fields.title || programme.title}</p>
            </div>
            <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold', status.cls)}>
              {status.icon}{status.text}
            </span>
            {hiddenFromSite && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300"
                title="Les visiteurs ne voient pas ce programme tant qu’il est brouillon, archivé, annulé ou privé.">
                <EyeOff className="h-3 w-3" />{programme.type === 'PRIVATE' ? 'Programme privé' : 'Programme non publié'}
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" size="sm" className="hidden gap-1.5 xl:inline-flex" onClick={() => setPreviewOpen((v) => !v)}>
                {previewOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
                {previewOpen ? 'Masquer l’aperçu' : 'Aperçu'}
              </Button>
              <a href={siteUrl} target="_blank" rel="noopener noreferrer" className={iconBtn} title="Ouvrir la page publiée">
                <ExternalLink className="h-3.5 w-3.5" />Voir sur le site
              </a>
              <div className="relative">
                <Button variant="ghost" size="sm" onClick={() => setMenuOpen((v) => !v)} title="Plus d’actions">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
                {menuOpen && (
                  <div className="absolute right-0 top-full z-40 mt-1 w-72 overflow-hidden rounded-lg border border-border bg-popover py-1 shadow-xl"
                    onMouseLeave={() => setMenuOpen(false)}>
                    <button type="button" disabled={!dirty} onClick={revert}
                      className="flex w-full items-start gap-2 px-3 py-2 text-left text-xs hover:bg-accent disabled:opacity-40 disabled:hover:bg-transparent">
                      <Undo2 className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                      <span><span className="block font-semibold text-foreground">Annuler les modifications</span>
                        <span className="text-muted-foreground">Revenir à la dernière version enregistrée</span></span>
                    </button>
                    <button type="button" onClick={resetLayout}
                      className="flex w-full items-start gap-2 px-3 py-2 text-left text-xs hover:bg-accent">
                      <RotateCcw className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                      <span><span className="block font-semibold text-foreground">Mise en page par défaut</span>
                        <span className="text-muted-foreground">Sections standard dans l’ordre d’origine</span></span>
                    </button>
                  </div>
                )}
              </div>
              <Button size="sm" className="gap-1.5" onClick={save} disabled={!canEdit || saving || !dirty}
                title={!canEdit ? 'Permission programmes:update requise' : dirty ? 'Enregistrer (Ctrl+S)' : 'Aucune modification'}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Enregistrer
              </Button>
            </div>
          </div>
        </div>

        <div className={cn('grid gap-5 lg:min-h-0 lg:flex-1 lg:grid-cols-[280px_minmax(0,1fr)] lg:grid-rows-1',
          previewOpen && 'xl:grid-cols-[270px_minmax(360px,0.85fr)_minmax(0,1.15fr)]')}>
          {/* ── Outline ─────────────────────────────────────────────── */}
          <aside className="lg:min-h-0 lg:overflow-y-auto lg:pr-1">
            <BlockOutline blocks={page.blocks as OutlineBlock[]} selectedId={selectedId} onSelect={select}
              onMove={move} onReorder={reorder} onToggle={toggle} onDuplicate={duplicate} onDelete={remove}
              onAdd={(afterId) => setPicker({ open: true, afterId })}
              pinnedId={HERO_ID}
              pinned={{ title: 'Bannière & infos clés', subtitle: 'Titre, accroche, photo, boutons', icon: LayoutTemplate }}
              describe={(b) => {
                const pb = b as ProgrammeBlock
                return { title: blockTitle(pb), subtitle: BLOCK_META[pb.type]?.label ?? pb.type, icon: BLOCK_META[pb.type]?.icon }
              }}
              canDuplicate={(b) => !SINGLE_TYPES.has(b.type)} />
          </aside>

          {/* ── Selected block / hero ───────────────────────────────── */}
          <main id="page-block-form" className="min-w-0 scroll-mt-16 space-y-3 lg:min-h-0 lg:overflow-y-auto lg:pb-2 lg:pr-1">
            <header className="flex flex-wrap items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
                {Icon && <Icon className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-bold text-foreground">{selected ? blockTitle(selected) : 'Bannière & infos clés'}</h2>
                <p className="text-xs text-muted-foreground">
                  {selected ? BLOCK_META[selected.type]?.label : 'Le haut de la page, toujours affiché en premier'}
                  {selected?.visible === false && <span className="ml-1.5 font-semibold text-amber-600 dark:text-amber-400">· masqué pour les visiteurs</span>}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button type="button" className={cn(iconBtn, 'hidden xl:inline-flex')} onClick={() => setFocusKey((n) => n + 1)} title="Afficher dans l’aperçu">
                  <Crosshair className="h-3.5 w-3.5" />Voir
                </button>
                {selected && (
                  <>
                    <button type="button" className={iconBtn} onClick={() => toggle(selected.id)}>
                      {selected.visible === false ? <><Eye className="h-3.5 w-3.5" />Afficher</> : <><EyeOff className="h-3.5 w-3.5" />Masquer</>}
                    </button>
                    {!SINGLE_TYPES.has(selected.type) && (
                      <button type="button" className={iconBtn} onClick={() => duplicate(selected.id)}>
                        <Copy className="h-3.5 w-3.5" />Dupliquer
                      </button>
                    )}
                    <button type="button" className={cn(iconBtn, 'hover:border-destructive/50 hover:text-destructive')} onClick={() => remove(selected.id)}>
                      <Trash2 className="h-3.5 w-3.5" />Retirer
                    </button>
                  </>
                )}
              </div>
            </header>
            {selected ? (
              <ProgrammeBlockEditor key={selected.id} block={selected} onChange={(patch) => patchBlock(selected.id, patch)}
                fields={fields} setFields={setFields} ctx={ctx} />
            ) : (
              <HeroEditor hero={page.hero ?? {}} setHero={(patch) => setPage((p) => (p ? { ...p, hero: { ...(p.hero ?? {}), ...patch } } : p))}
                fields={fields} setFields={setFields} ctx={ctx} />
            )}
          </main>

          {/* ── Live preview ────────────────────────────────────────── */}
          {previewOpen && (
            <div className="hidden min-h-0 xl:block">
              <PreviewPane doc={{ fields, page }} selectedId={selectedId} focusKey={focusKey} onSelectBlock={select}
                path={`/programmes/${programmeId}`} messageType="programme-preview" />
            </div>
          )}
        </div>
      </div>

      <BlockPicker<ProgrammeCatalogEntry> open={picker.open} blocks={page.blocks} catalog={PROGRAMME_CATALOG}
        countFor={(entry, blocks) => blocks.filter((b) => b.type === entry.type
          && (entry.type !== 'media' || (b.data?.layout ?? 'text-image') === entry.create().layout)).length}
        afterLabel={picker.afterId ? (() => { const b = page.blocks.find((x) => x.id === picker.afterId); return b ? blockTitle(b) : undefined })() : undefined}
        onPick={addBlock} onClose={() => setPicker({ open: false })} />
    </AdminLayout>
  )
}
