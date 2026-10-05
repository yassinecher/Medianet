'use client'
/**
 * AvatarUpload — a compact image picker for the front-office, backed by the same
 * MinIO file service as the back-office (POST /api/files/upload). Shows a round
 * (or square) preview, an upload button, a remove button, and a collapsible
 * "paste a link" option (POST /api/files/import — the server stores a copy;
 * Google Drive / Dropbox share links work). Emits the resulting URL via onChange.
 */
import { useEffect, useRef, useState } from 'react'
import { Upload, Loader2, X, ImageIcon, Link2, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { filesApi } from '@/lib/api'
import { importImageLink } from '@/lib/imageLink'
import { Input } from '@/components/ui/input'
import { getInitials } from '@/lib/utils'

interface Props {
  value?: string
  onChange: (url: string) => void
  /** MinIO sub-folder (avatars, logos…). */
  folder?: string
  /** Fallback initials shown when there's no image. */
  initials?: string
  /** Round (avatars) vs rounded-square (logos). */
  shape?: 'circle' | 'square'
  /** Preview size in px (default 64). */
  size?: number
  /** Show the "paste a URL" fallback (default true). */
  showUrlField?: boolean
}

export function AvatarUpload({
  value, onChange, folder = 'avatars', initials = '?', shape = 'circle', size = 64, showUrlField = true,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const radius = shape === 'circle' ? 'rounded-full' : 'rounded-xl'

  const onFile = async (f: File | undefined) => {
    if (!f) return
    if (!f.type.startsWith('image/')) { toast.error('Veuillez choisir une image'); return }
    if (f.size > 10 * 1024 * 1024) { toast.error("L'image dépasse 10 MB"); return }
    setUploading(true)
    try {
      const url = await filesApi.uploadImage(f, folder)
      onChange(url)
      toast.success('Photo téléversée')
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Téléversement échoué')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  // Only forget the URL: the form may still be cancelled, and the saved record
  // must never point at a deleted file.
  const clear = () => { if (value) onChange('') }

  const [link, setLink] = useState('')
  const [importing, setImporting] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [broken, setBroken] = useState(false)
  useEffect(() => { setBroken(false) }, [value])

  const importLink = async () => {
    if (!link.trim() || importing) return
    setImporting(true)
    setLinkError(null)
    try {
      const { url, copied } = await importImageLink(link, folder)
      onChange(url)
      setLink('')
      toast.success(copied ? 'Image importée' : 'Image liée depuis son site d’origine')
    } catch (e: any) {
      setLinkError(e.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          {value ? (
            <>
              {broken ? (
                <div title="Image introuvable : remplacez-la"
                  className={`flex h-full w-full items-center justify-center border border-amber-500/40 bg-amber-500/10 text-amber-600 ${radius}`}>
                  <AlertTriangle className="h-5 w-5" />
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={value} alt="" onError={() => setBroken(true)}
                  className={`h-full w-full border border-border bg-white ${shape === 'square' ? 'object-contain' : 'object-cover'} ${radius}`} />
              )}
              <button type="button" onClick={clear} title="Retirer"
                className="absolute -top-1.5 -right-1.5 rounded-full bg-destructive text-destructive-foreground p-0.5 shadow hover:scale-110 transition-transform">
                <X className="h-3 w-3" />
              </button>
            </>
          ) : (
            <div className={`flex h-full w-full items-center justify-center border border-dashed border-border bg-muted text-muted-foreground ${radius}`}>
              {initials && initials !== '?' ? <span className="text-sm font-bold">{getInitials(initials)}</span> : <ImageIcon className="h-5 w-5 opacity-50" />}
            </div>
          )}
        </div>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-50">
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {uploading ? 'Envoi…' : value ? 'Remplacer' : 'Téléverser une photo'}
        </button>
      </div>

      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])} />

      {broken && <p className="text-[11px] text-amber-600 dark:text-amber-400">L’image actuelle ne s’affiche plus : remplacez-la.</p>}

      {showUrlField && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
            …ou coller un lien (Google Drive, Dropbox, site web…)
          </summary>
          <div className="mt-1.5 flex gap-1.5">
            <Input className="h-8" placeholder="https://…" value={link}
              onChange={(e) => { setLink(e.target.value); setLinkError(null) }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); importLink() } }} />
            <button type="button" onClick={importLink} disabled={importing || !link.trim()}
              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50">
              {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
              Importer
            </button>
          </div>
          {linkError && (
            <p className="mt-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">{linkError}</p>
          )}
        </details>
      )}
    </div>
  )
}
