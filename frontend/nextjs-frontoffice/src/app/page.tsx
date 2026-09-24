'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { EyeOff, Loader2, PlusCircle } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { Navbar } from '@/components/layout/Navbar'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { MedianetLogo } from '@/components/brand/MedianetLogo'
import { setBrandLogoUrl } from '@/components/brand/useBrandLogo'
import { BlockView, blockHasContent } from '@/components/landing/LandingBlocks'
import { programmesApi } from '@/lib/api'
import { fetchSiteSettings } from '@/lib/siteSettings'
import { buildLandingThemeCss } from '@/lib/landingTheme'
import { FALLBACK_DOC, isEditorOrigin, type LandingDoc } from '@/lib/landingBlocks'
import { cn } from '@/lib/utils'
import type { Programme } from '@/types'

/**
 * Public landing page ("/"): renders the published block list.
 *
 * With `?edit=1` it is the live preview of the back-office editor: the editor
 * pushes its working copy with postMessage (`landing-preview`) on every change —
 * no save/reload round-trip — and clicking a block selects it in the editor.
 */
export default function LandingPage() {
  const router = useRouter()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [hydrated, setHydrated] = useState(false)
  const [editMode] = useState(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('edit') === '1')
  const [doc, setDoc] = useState<LandingDoc | null>(null)
  const [programmes, setProgrammes] = useState<Programme[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const editorOrigin = useRef<string | null>(null)
  /** Editor preview: visible pane height (unscaled) — drives full-screen sections. */
  const [previewVh, setPreviewVh] = useState<number | null>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const reportedHeight = useRef(0)

  // Editor preview: report the page's real height so the editor sizes the iframe
  // to fit it (its pane scrolls, with a normal scrollbar, instead of the iframe).
  // Re-attached every render: the page element only exists once content arrived.
  useEffect(() => {
    if (!editMode || !pageRef.current || window.parent === window) return
    const el = pageRef.current
    const report = () => {
      const height = Math.ceil(el.getBoundingClientRect().height)
      if (height === reportedHeight.current) return
      reportedHeight.current = height
      window.parent.postMessage({ type: 'landing-preview-height', height }, editorOrigin.current ?? '*')
    }
    report()
    const ro = new ResizeObserver(report)
    ro.observe(el)
    return () => ro.disconnect()
  })

  // Logged-in visitors go to their dashboard (never inside the editor preview).
  useEffect(() => {
    setHydrated(true)
    if (isAuthenticated && !editMode) router.replace('/dashboard')
  }, [isAuthenticated, editMode, router])

  useEffect(() => {
    programmesApi.list({ status: 'OPEN', size: 12 })
      .then((r) => setProgrammes(r.data?.content ?? r.data ?? []))
      .catch(() => {})
  }, [])

  // Published page for visitors. The page stays hidden until it's loaded so the
  // default content/colors never flash; after 6 s we fall back regardless.
  useEffect(() => {
    if (editMode) return
    let done = false
    const show = (d: LandingDoc) => {
      if (done) return
      done = true
      setBrandLogoUrl(d.logoUrl)
      setDoc(d)
    }
    const timer = setTimeout(() => show(FALLBACK_DOC), 6000)
    fetchSiteSettings()
      .then((d) => show(d?.blocks ? d : FALLBACK_DOC))
      .finally(() => clearTimeout(timer))
    return () => clearTimeout(timer)
  }, [editMode])

  // Editor preview: announce readiness, then render whatever the editor sends.
  useEffect(() => {
    if (!editMode) return
    const onMsg = (e: MessageEvent) => {
      if (!isEditorOrigin(e.origin)) return
      const m = e.data
      if (!m || typeof m !== 'object') return
      editorOrigin.current = e.origin
      if (m.type === 'landing-preview' && m.doc?.blocks) {
        setBrandLogoUrl(m.doc.logoUrl, { persist: false })
        setDoc(m.doc)
      } else if (m.type === 'landing-preview-viewport' && typeof m.height === 'number') {
        setPreviewVh(m.height)
      } else if (m.type === 'select-block') {
        setSelectedId(m.id ?? null)
        if (m.scroll && m.id) {
          requestAnimationFrame(() => {
            const el = document.querySelector(`[data-block="${CSS.escape(m.id)}"]`)
            if (!el) return
            if (window.parent === window) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return }
            // The iframe is as tall as the page: the EDITOR's pane scrolls, not us.
            const top = el.getBoundingClientRect().top + window.scrollY
            window.parent.postMessage({ type: 'landing-preview-scroll', top }, editorOrigin.current ?? '*')
          })
        }
      }
    }
    window.addEventListener('message', onMsg)
    window.parent?.postMessage({ type: 'landing-preview-ready' }, '*') // carries no data
    // Opened outside the editor (or editor too slow): show the published page.
    const timer = setTimeout(() => {
      fetchSiteSettings().then((d) => setDoc((cur) => cur ?? (d?.blocks ? d : FALLBACK_DOC)))
    }, 2500)
    return () => { window.removeEventListener('message', onMsg); clearTimeout(timer) }
  }, [editMode])

  if (!hydrated || (isAuthenticated && !editMode)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (!doc) {
    // Neutral splash (no brand color yet — it isn't known until the page loads).
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background">
        <MedianetLogo size="lg" />
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Admin colors → brand palette for light AND dark mode (lib/landingTheme.ts).
  const themeCss = buildLandingThemeCss(doc.primaryColor, doc.accentColor)
  const blocks = doc.blocks.filter((b) => editMode || b.visible !== false)

  const onBlockClick = (id: string) => (e: React.MouseEvent) => {
    if (!editMode) return
    const target = e.target as HTMLElement
    const link = target.closest('a[href]') as HTMLAnchorElement | null
    if (link) {
      // Keep the preview in place: follow links in a new tab.
      e.preventDefault(); e.stopPropagation()
      const href = link.getAttribute('href') || ''
      window.open(href.startsWith('/') ? window.location.origin + href : href, '_blank', 'noopener,noreferrer')
      return
    }
    if (target.closest('button, input, select, textarea, [role="button"]')) return
    setSelectedId(id)
    window.parent?.postMessage({ type: 'edit-section', section: id }, editorOrigin.current ?? '*')
  }

  return (
    <motion.div ref={pageRef} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }}
      // In the preview the page must measure its CONTENT height: no min-h-screen
      // (the iframe is sized from that height, which would then only ever grow).
      className={cn('landing-theme bg-background', !editMode && 'min-h-screen')}
      style={editMode && previewVh ? ({ '--landing-vh': `${previewVh}px` } as React.CSSProperties) : undefined}>
      {themeCss && <style>{themeCss}</style>}
      <Navbar />

      {blocks.map((block) => {
        const empty = !blockHasContent(block, programmes)
        if (!editMode) return empty ? null : <div key={block.id} data-block={block.id}><BlockView block={block} programmes={programmes} /></div>
        const hidden = block.visible === false
        return (
          <div key={block.id} data-block={block.id} onClick={onBlockClick(block.id)}
            className={cn('relative cursor-pointer outline outline-2 -outline-offset-2 transition-[outline-color]',
              selectedId === block.id ? 'outline-brand-500' : 'outline-transparent hover:outline-brand-500/50')}>
            {hidden && (
              <span className="pointer-events-none absolute right-3 top-3 z-20 inline-flex items-center gap-1 rounded-full bg-slate-900/85 px-2.5 py-1 text-[11px] font-semibold text-white shadow">
                <EyeOff className="h-3 w-3" />Masqué — invisible pour les visiteurs
              </span>
            )}
            <div className={cn(hidden && 'opacity-40')}>
              {empty ? (
                <div className="flex items-center justify-center gap-2 border-y border-dashed border-border bg-muted/20 px-4 py-10 text-sm text-muted-foreground">
                  <PlusCircle className="h-4 w-4" />Bloc vide — ajoutez du contenu dans l&apos;éditeur
                </div>
              ) : (
                <BlockView block={block} programmes={programmes} />
              )}
            </div>
          </div>
        )
      })}

      <SiteFooter footerText={doc.footerText} />
    </motion.div>
  )
}
