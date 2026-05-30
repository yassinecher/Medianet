'use client'
import { useRef, useState } from 'react'
import { Upload, Loader2, X, Image as ImageIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import { filesApi } from '@/lib/api'
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
}

/**
 * Drop-in image picker. Either upload a file (POST → /api/files/upload)
 * or paste a URL — both produce a URL string the parent can save.
 */
export function ImageUpload({
  value,
  onChange,
  folder = 'uploads',
  previewHeight = 80,
  showUrlField = true,
  compact = false,
  placeholder = 'https://…',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

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

  const clear = async () => {
    if (!value) return
    const url = value
    onChange('')
    // Best-effort cleanup — don't block UX on failure
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
      </div>

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
