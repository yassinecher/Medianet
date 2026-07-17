'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UploadCloud, Loader2 } from 'lucide-react'
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
  const router = useRouter()

  const onPick = async (file?: File | null) => {
    if (!file) return
    setUploading(true); setPct(0)
    try {
      const up = await filesApi.uploadVideo(file, 'pitch-videos', setPct)
      const saved = await pitchApi.upsert({
        programmeId: ctx.programmeId, sessionId, kind,
        organizationId: ctx.organizationId, companyName: ctx.companyName, projectName: ctx.projectName,
        videoUrl: up.url, videoFilename: up.filename, status: 'SUBMITTED',
      })
      toast.success('Vidéo envoyée — ouverture de l’analyse…')
      onSaved?.()
      router.push(`/presentations/${saved.data.id}?autostart=1`)
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? e.message ?? "Échec de l'envoi")
      setUploading(false)
    }
  }

  return (
    <label className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border py-5 transition-colors hover:border-brand-400 ${uploading ? 'pointer-events-none opacity-60' : ''}`}>
      {uploading ? (
        <><Loader2 className="h-5 w-5 animate-spin text-brand-500" /><span className="text-xs text-muted-foreground">Envoi… {pct}%</span></>
      ) : (
        <>
          <UploadCloud className="h-5 w-5 text-muted-foreground" />
          <span className="text-xs font-medium text-foreground">{label}</span>
          <span className="text-[10px] text-muted-foreground">MP4, WebM, MOV — max 2 Go · transcription automatique</span>
        </>
      )}
      <input type="file" accept="video/*" className="hidden" disabled={uploading}
        onChange={(e) => onPick(e.target.files?.[0])} />
    </label>
  )
}
