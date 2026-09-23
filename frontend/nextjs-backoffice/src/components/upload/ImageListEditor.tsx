'use client'
import { useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, ImagePlus, Loader2, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { filesApi } from '@/lib/api'
import { ImageUpload } from '@/components/upload/ImageUpload'

export interface ListImage { url?: string; caption?: string }

/**
 * Ordered list of photos: bulk upload (several files at once), stock-photo
 * search / URL via ImageUpload, reorder, remove and optional captions.
 */
export function ImageListEditor({ images, onChange, folder = 'landing', captions = false, searchQuery = '' }: {
  images: ListImage[]
  onChange: (next: ListImage[]) => void
  folder?: string
  /** Show a caption field under each photo. */
  captions?: boolean
  searchQuery?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(0)

  const onFiles = async (files: FileList | null) => {
    const list = Array.from(files ?? []).filter((f) => f.type.startsWith('image/'))
    if (list.length === 0) return
    const tooBig = list.filter((f) => f.size > 10 * 1024 * 1024)
    if (tooBig.length) toast.error(`${tooBig.length} image(s) > 10 MB ignorée(s)`)
    const ok = list.filter((f) => f.size <= 10 * 1024 * 1024)
    setUploading(ok.length)
    const added: ListImage[] = []
    for (const f of ok) {
      try {
        added.push({ url: await filesApi.uploadImage(f, folder), caption: '' })
      } catch (err: any) {
        toast.error(err.response?.data?.message ?? `Échec de l'envoi de ${f.name}`)
      } finally {
        setUploading((n) => n - 1)
      }
    }
    if (added.length) {
      onChange([...images, ...added])
      toast.success(`${added.length} photo(s) ajoutée(s)`)
    }
    if (inputRef.current) inputRef.current.value = ''
  }

  const move = (i: number, d: -1 | 1) => {
    const t = i + d
    if (t < 0 || t >= images.length) return
    const next = [...images]
    ;[next[i], next[t]] = [next[t], next[i]]
    onChange(next)
  }
  const update = (i: number, patch: Partial<ListImage>) =>
    onChange(images.map((img, k) => (k === i ? { ...img, ...patch } : img)))
  const remove = (i: number) => onChange(images.filter((_, k) => k !== i))

  return (
    <div className="space-y-3">
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {images.map((img, i) => (
            <div key={`${img.url}-${i}`} className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="group relative aspect-[4/3] bg-muted">
                {img.url && <img src={img.url} alt="" className="h-full w-full object-cover" />}
                <div className="absolute inset-x-0 top-0 flex justify-between p-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="flex gap-1">
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} title="Déplacer à gauche"
                      className="flex h-6 w-6 items-center justify-center rounded bg-black/60 text-white disabled:opacity-30">
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === images.length - 1} title="Déplacer à droite"
                      className="flex h-6 w-6 items-center justify-center rounded bg-black/60 text-white disabled:opacity-30">
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </span>
                  <button type="button" onClick={() => remove(i)} title="Retirer"
                    className="flex h-6 w-6 items-center justify-center rounded bg-red-600/90 text-white">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 text-[10px] font-bold text-white">{i + 1}</span>
              </div>
              {captions && (
                <input value={img.caption ?? ''} placeholder="Légende (optionnelle)"
                  onChange={(e) => update(i, { caption: e.target.value })}
                  className="w-full border-t border-border bg-background px-2 py-1.5 text-xs outline-none" />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => onFiles(e.target.files)} />
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading > 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-brand-500/50 bg-brand-500/5 px-3 py-2 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-500/10 disabled:opacity-60 dark:text-brand-300">
          {uploading > 0 ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
          {uploading > 0 ? `Envoi… (${uploading})` : 'Ajouter des photos'}
        </button>
        <span className="text-[10px] text-muted-foreground">Sélection multiple possible · 10 MB max par image</span>
      </div>

      {/* Single add via URL / stock-photo search */}
      <ImageUpload key={images.length} value="" folder={folder} previewHeight={60} compact
        searchContext="feature" defaultQuery={searchQuery}
        onChange={(url) => { if (url) onChange([...images, { url, caption: '' }]) }} />
    </div>
  )
}
