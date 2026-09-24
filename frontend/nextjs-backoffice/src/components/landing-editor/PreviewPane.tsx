'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, Monitor, RotateCcw, Smartphone, Tablet } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LandingDoc } from './schema'

const DEVICES = {
  desktop: { label: 'Bureau', w: 1280, icon: Monitor },
  tablet: { label: 'Tablette', w: 820, icon: Tablet },
  mobile: { label: 'Mobile', w: 390, icon: Smartphone },
} as const
type Device = keyof typeof DEVICES

/**
 * Front-office base URL for the preview iframe and the "open site" link.
 * Prefers the build-time env; otherwise derives it from the admin host with the
 * SAME protocol (an http://localhost URL would be blocked as mixed content on
 * the HTTPS admin site).
 */
export function frontofficeBase(): string {
  const env = process.env.NEXT_PUBLIC_FRONTOFFICE_URL
  if (env) return env.replace(/\/+$/, '')
  if (typeof window === 'undefined') return 'http://localhost:3000'
  const { protocol, host } = window.location
  let fo = host
    .replace('incubatoradmin', 'incubator')   // medianetincubatoradmin.duckdns.org → medianetincubator…
    .replace('backoffice', 'frontoffice')
    .replace(/(^|\.)admin\./, '$1app.')        // admin.medianet.dz → app.medianet.dz
  if (fo === host && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) fo = host.replace(/:\d+$/, '') + ':3000' // dev
  return `${protocol}//${fo}`
}

/**
 * Live preview: the front-office landing in an iframe (`?edit=1`), fed with the
 * editor's working copy over postMessage on every change — instant, no save or
 * reload. Clicking a block in the preview selects it in the editor.
 *
 * Layout: the iframe is rendered at the device's real width and the page's FULL
 * height (reported by the preview), then scaled down to fit the column. So the
 * page never scrolls inside the iframe — where its scrollbar would be scaled to
 * a sliver — the pane itself scrolls, with a normal scrollbar.
 */
export function PreviewPane({ doc, selectedId, focusKey, onSelectBlock }: {
  doc: LandingDoc
  selectedId: string | null
  /** Changes whenever the preview should scroll to the selected block. */
  focusKey: number
  onSelectBlock: (id: string) => void
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [device, setDevice] = useState<Device>('desktop')
  const [box, setBox] = useState({ w: 0, h: 0 })          // visible area of the pane (px)
  const [pageHeight, setPageHeight] = useState<number | null>(null) // unscaled page height
  const [reloadKey, setReloadKey] = useState(0)
  const docRef = useRef(doc)
  docRef.current = doc
  const selectedRef = useRef(selectedId)
  selectedRef.current = selectedId

  const base = useMemo(() => frontofficeBase(), [])
  const targetOrigin = useMemo(() => {
    try { return new URL(base).origin } catch { return '*' }
  }, [base])

  const deviceWidth = DEVICES[device].w
  // Scale so the device width fits the pane (never enlarge).
  const fit = box.w > 0 ? Math.min(1, box.w / deviceWidth) : 1
  // The "screen height" the page believes it has = the visible pane height, unscaled —
  // so a full-height hero fills exactly what the admin sees, like on a real screen.
  const viewportHeight = box.h > 0 ? Math.round(box.h / fit) : 800
  const frameHeight = Math.max(pageHeight ?? viewportHeight, viewportHeight)

  const post = useCallback((msg: unknown) => {
    iframeRef.current?.contentWindow?.postMessage(msg, targetOrigin)
  }, [targetOrigin])

  // Track the pane's visible size (scrollbar gutter is reserved, so the width is stable).
  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Messages FROM the preview: only trust our own iframe.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (!iframeRef.current || e.source !== iframeRef.current.contentWindow) return
      const m = e.data
      if (m?.type === 'landing-preview-ready') {
        post({ type: 'landing-preview-viewport', height: viewportHeight })
        post({ type: 'landing-preview', doc: docRef.current })
        if (selectedRef.current) post({ type: 'select-block', id: selectedRef.current, scroll: true })
      } else if (m?.type === 'landing-preview-height' && typeof m.height === 'number') {
        setPageHeight(Math.ceil(m.height))
      } else if (m?.type === 'landing-preview-scroll' && typeof m.top === 'number') {
        const y = m.top * fit - 8
        // First block(s): go to the very top so the site header stays in view.
        scrollerRef.current?.scrollTo({ top: y < 48 ? 0 : y, behavior: 'smooth' })
      } else if (m?.type === 'edit-section' && typeof m.section === 'string') {
        onSelectBlock(m.section)
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [post, onSelectBlock, fit, viewportHeight])

  // Push the working copy (lightly debounced while typing).
  useEffect(() => {
    const t = setTimeout(() => post({ type: 'landing-preview', doc }), 120)
    return () => clearTimeout(t)
  }, [doc, post])

  useEffect(() => {
    post({ type: 'select-block', id: selectedId, scroll: true })
  }, [selectedId, focusKey, post])

  useEffect(() => {
    post({ type: 'landing-preview-viewport', height: viewportHeight })
  }, [viewportHeight, post])

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5">
          {(Object.entries(DEVICES) as [Device, (typeof DEVICES)[Device]][]).map(([k, d]) => (
            <button key={k} type="button" onClick={() => setDevice(k)} title={d.label}
              className={cn('flex h-7 w-7 items-center justify-center rounded-md transition-colors',
                device === k ? 'bg-brand-500/15 text-brand-600 dark:text-brand-400' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}>
              <d.icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
        <span className="text-[11px] text-muted-foreground">{deviceWidth}px · {Math.round(fit * 100)}%</span>
        <button type="button" onClick={() => setReloadKey((n) => n + 1)} title="Recharger l’aperçu"
          className="ml-auto flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground">
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        <a href={base} target="_blank" rel="noopener noreferrer" title="Ouvrir le site public (version publiée)"
          className="flex h-7 items-center gap-1 rounded-md border border-border bg-card px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground">
          <ExternalLink className="h-3 w-3" />Site
        </a>
      </div>

      {/* The pane scrolls (normal scrollbar); the scaled page is a fixed-size box inside. */}
      <div ref={scrollerRef}
        className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden rounded-xl border border-border bg-muted/30 [scrollbar-gutter:stable]">
        <div className="relative mx-auto overflow-hidden bg-background shadow-sm"
          style={{ width: deviceWidth * fit, height: frameHeight * fit }}>
          <iframe key={reloadKey} ref={iframeRef} src={`${base}/?edit=1`} title="Aperçu de la page d’accueil"
            scrolling="no"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            style={{
              position: 'absolute', top: 0, left: 0,
              width: deviceWidth,
              height: frameHeight,
              transform: `scale(${fit})`,
              transformOrigin: 'top left',
              border: 0,
              display: 'block',
            }} />
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Aperçu du brouillon en direct — cliquez un bloc pour le modifier. Les visiteurs ne voient les changements qu’après « Publier ».
      </p>
    </div>
  )
}
