'use client'
import { useRef, useState } from 'react'
import { Upload, Loader2, X, Image as ImageIcon, Search, Sparkles, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import { filesApi, adminAiApi } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface Props {
  /** Current image URL (controlled). */
  value?: string
  /** Called with the new URL whenever a file is uploaded or the URL field changes. */
  onChange: (url: string) => void
  /** Logical sub-folder in MinIO (logos, banners, partners, hero…) */
  folder?: string
  /** Preview height in pixels (default 80). */
  previewHeight?: number
  /** Whether to show the textual URL field as a fallback. */
  showUrlField?: boolean
  /** Compact mode — smaller buttons, less padding (for inline use). */
  compact?: boolean
  /** Optional placeholder for the URL field. */
  placeholder?: string
  /**
   * Enable the "🔍 Rechercher" stock-photo search (Pexels/Unsplash/OpenVerse).
   * Default true. The `searchContext` tunes the aspect ratio / framing.
   */
  enableSearch?: boolean
  /** Photo context for sizing: hero | feature | partner_logo | team | abstract | generic. */
  searchContext?: 'hero' | 'feature' | 'partner_logo' | 'team' | 'abstract' | 'generic'
  /** Seed query prefilled in the search box (e.g. the section topic). */
  defaultQuery?: string
}

interface PhotoResult {
  url: string
  thumbnail?: string
  credit?: string
  title?: string
  size?: string
}

/**
 * Drop-in image picker. Three ways to set an image:
 *   1. Upload a file        (POST → /api/files/upload)
 *   2. 🔍 Search stock photos (POST → /api/admin-ai/search-photos — same chain as the AI)
 *   3. Paste an external URL
 * All three produce a URL string the parent saves via onChange.
 */
export function ImageUpload({
  value,
  onChange,
  folder = 'uploads',
  previewHeight = 80,
  showUrlField = true,
  compact = false,
  placeholder = 'https://…',
  enableSearch = true,
  searchContext = 'generic',
  defaultQuery = '',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  // ── Stock-photo search state ──────────────────────────────────────────────
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState(defaultQuery)
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<PhotoResult[]>([])
  const [source, setSource] = useState<string>('')

  const onFile = async (f: File | undefined) => {
    if (!f) return
    if (!f.type.startsWith('image/')) {
      toast.error('Veuillez choisir une image')
      return
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error("L'image dépasse 10 MB")
      return
    }
    setUploading(true)
    try {
      const url = await filesApi.uploadImage(f, folder)
      onChange(url)
      toast.success('Image téléversée')
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Upload échoué')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const runSearch = async () => {
    const q = query.trim()
    if (q.length < 2) { toast.error('Tape au moins 2 mots-clés'); return }
    setSearching(true)
    try {
      const r = await adminAiApi.searchPhotos({ query: q, context: searchContext, count: 8 })
      const items = r.data?.items ?? []
      setResults(items)
      setSource(r.data?.source ?? '')
      if (items.length === 0) toast.error('Aucune image trouvée — essaie d\'autres mots-clés')
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Recherche d\'images échouée')
    } finally {
      setSearching(false)
    }
  }

  const pick = (url: string) => {
    onChange(url)
    setSearchOpen(false)
    toast.success('Image sélectionnée')
  }

  const clear = async () => {
    if (!value) return
    const url = value
    onChange('')
    // Best-effort cleanup — don't block UX on failure. Only delete our own uploads.
    try { await filesApi.delete(url) } catch {}
  }

  return (
    <div className="space-y-2">
      {/* Preview */}
      {value ? (
        <div className="relative inline-block rounded-lg border border-border bg-muted/30 p-1">
          <img src={value} alt=""
            style={{ height: previewHeight }}
            className="rounded object-contain bg-white" />
          <button type="button" onClick={clear}
            className="absolute -top-2 -right-2 rounded-full bg-destructive text-destructive-foreground p-1 shadow-md hover:scale-110 transition-transform"
            title="Retirer">
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-muted/20 hover:bg-muted/40 hover:border-brand-400 cursor-pointer transition-colors text-muted-foreground
            ${compact ? 'p-3' : 'p-6'}`}
          style={{ minHeight: previewHeight + 16 }}>
          <ImageIcon className={`${compact ? 'h-5 w-5' : 'h-7 w-7'} opacity-60`} />
          <p className={`${compact ? 'text-[10px]' : 'text-xs'}`}>Cliquez pour téléverser une image</p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant={compact ? 'ghost' : 'outline'}
          size={compact ? 'sm' : 'default'}
          onClick={() => inputRef.current?.click()}
          disabled={uploading} className="gap-1.5">
          {uploading
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Envoi…</>
            : <><Upload className="h-3.5 w-3.5" />{value ? 'Remplacer' : 'Téléverser'}</>}
        </Button>

        {enableSearch && (
          <Button type="button" variant={compact ? 'ghost' : 'outline'}
            size={compact ? 'sm' : 'default'}
            onClick={() => { setSearchOpen((v) => !v); if (!searchOpen && results.length === 0 && query.trim()) runSearch() }}
            className="gap-1.5">
            <Search className="h-3.5 w-3.5" />Rechercher
          </Button>
        )}
      </div>

      {/* ── Stock-photo search panel ─────────────────────────────────────── */}
      {enableSearch && searchOpen && (
        <div className="rounded-xl border-2 border-brand-500/30 bg-brand-500/5 p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-brand-700 dark:text-brand-300">
            <Sparkles className="h-3.5 w-3.5" />
            Recherche d'images libres de droits
            <span className="ml-auto text-[9px] font-normal text-muted-foreground uppercase tracking-wider">
              {searchContext}
            </span>
          </div>
          <div className="flex gap-1.5">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); runSearch() } }}
              placeholder="ex. modern coworking office tunisia"
              className="h-8 text-xs" />
            <Button type="button" size="sm" onClick={runSearch} disabled={searching} className="gap-1 shrink-0">
              {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              Go
            </Button>
          </div>
          <p className="text-[9px] text-muted-foreground">
            💡 Utilise des mots-clés en <strong>anglais</strong>, 3+ mots, précis : « african startup team laptop bright ».
          </p>

          {searching && (
            <div className="grid grid-cols-4 gap-1.5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-[4/3] rounded-md bg-muted animate-pulse" />
              ))}
            </div>
          )}

          {!searching && results.length > 0 && (
            <>
              <div className="grid grid-cols-4 gap-1.5">
                {results.map((p, i) => (
                  <button key={i} type="button" onClick={() => pick(p.url)}
                    title={(p.title ? p.title + ' — ' : '') + (p.credit ?? '')}
                    className="group relative aspect-[4/3] overflow-hidden rounded-md border border-border hover:ring-2 hover:ring-brand-500 transition-all">
                    <img src={p.thumbnail || p.url} alt={p.title ?? ''}
                      loading="lazy"
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                    <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1 py-0.5 text-[7px] text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      {p.credit ?? 'Sélectionner'}
                    </span>
                  </button>
                ))}
              </div>
              {source && (
                <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                  <ExternalLink className="h-2.5 w-2.5" />Source : {source} · clique une vignette pour l'appliquer
                </p>
              )}
            </>
          )}
        </div>
      )}

      {showUrlField && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
            …ou coller une URL externe
          </summary>
          <Input className="mt-2"
            placeholder={placeholder}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)} />
        </details>
      )}
    </div>
  )
}
