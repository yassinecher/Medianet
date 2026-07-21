'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { UploadCloud, Loader2, Trophy, AlertTriangle, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { pitchApi, filesApi } from '@/lib/api'

export interface PitchContext {
  programmeId: number
  organizationId?: number
  companyName?: string
  projectName?: string
}

/**
 * Drop a video into a phase. On success it goes straight to that video's
 * analysis workspace, which is where the analysis actually runs and streams —
 * so the upload itself never blocks this page.
 *
 * FINAL pitches are the real, once-only submission: picking a file opens a
 * confirmation panel that plays the chosen video first. Only on explicit
 * confirmation is it sent — after which training closes and it can't be replaced.
 */
export function PitchUpload({ ctx, sessionId, kind, label, onSaved }: {
  ctx: PitchContext
  sessionId: number
  kind: 'TRAINING' | 'FINAL'
  label: string
  onSaved?: () => void
}) {
  const [uploading, setUploading] = useState(false)
  const [pct, setPct] = useState(0)
  // FINAL: the picked file awaiting confirmation (with a local preview URL).
  const [pending, setPending] = useState<{ file: File; url: string } | null>(null)
  const router = useRouter()

  // Revoke the object URL when the confirmation panel closes.
  useEffect(() => () => { if (pending) URL.revokeObjectURL(pending.url) }, [pending])

  const doUpload = async (file: File) => {
    setUploading(true); setPct(0)
    try {
      const up = await filesApi.uploadVideo(file, 'pitch-videos', setPct)
      const saved = await pitchApi.upsert({
        programmeId: ctx.programmeId, sessionId, kind,
        organizationId: ctx.organizationId, companyName: ctx.companyName, projectName: ctx.projectName,
        videoUrl: up.url, videoFilename: up.filename, status: 'SUBMITTED',
      })
      toast.success(kind === 'FINAL' ? 'Pitch final envoyé — ouverture de l’analyse…' : 'Vidéo envoyée — ouverture de l’analyse…')
      onSaved?.()
      router.push(`/presentations/${saved.data.id}?autostart=1`)
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? e.message ?? "Échec de l'envoi")
      setUploading(false)
    }
  }

  const onPick = (file?: File | null) => {
    if (!file) return
    if (kind === 'FINAL') {
      // Don't send yet — let the porteur watch it and confirm it's the right take.
      setPending({ file, url: URL.createObjectURL(file) })
    } else {
      doUpload(file)
    }
  }

  const confirmFinal = async () => {
    if (!pending) return
    const { file } = pending
    setPending(null)
    await doUpload(file)
  }

  return (
    <>
      <label className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed py-5 transition-colors ${
        kind === 'FINAL' ? 'border-purple-400/60 hover:border-purple-500' : 'border-border hover:border-brand-400'
      } ${uploading ? 'pointer-events-none opacity-60' : ''}`}>
        {uploading ? (
          <><Loader2 className="h-5 w-5 animate-spin text-brand-500" /><span className="text-xs text-muted-foreground">Envoi… {pct}%</span></>
        ) : (
          <>
            {kind === 'FINAL' ? <Trophy className="h-5 w-5 text-purple-500" /> : <UploadCloud className="h-5 w-5 text-muted-foreground" />}
            <span className="text-xs font-medium text-foreground">{label}</span>
            <span className="text-[10px] text-muted-foreground">MP4, WebM, MOV — max 2 Go · transcription automatique</span>
          </>
        )}
        <input type="file" accept="video/*" className="hidden" disabled={uploading}
          onChange={(e) => { onPick(e.target.files?.[0]); e.currentTarget.value = '' }} />
      </label>

      {/* FINAL confirmation — play the chosen take before committing to it. */}
      {pending && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPending(null)} />
          <div className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                <Trophy className="h-4 w-4 text-purple-500" />Confirmer votre pitch final
              </h3>
              <button onClick={() => setPending(null)} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 p-4">
              <video src={pending.url} controls autoPlay className="max-h-[45vh] w-full rounded-lg bg-black" />
              <p className="truncate text-xs text-muted-foreground">{pending.file.name}</p>
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <p className="text-[11px] text-amber-800 dark:text-amber-200">
                  C’est votre <b>pitch final</b> : une seule soumission est autorisée. Une fois envoyé, il ne pourra
                  <b> plus être remplacé</b> et la phase d’<b>entraînement sera clôturée</b> pour cette session.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
              <button onClick={() => setPending(null)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent">
                Changer de vidéo
              </button>
              <button onClick={confirmFinal}
                className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-700">
                <Trophy className="h-3.5 w-3.5" />Confirmer et envoyer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
