'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, FileText, Sparkles, ArrowDownToLine } from 'lucide-react'
import { fmtTime, type Segment } from './types'

/**
 * Timestamped transcript (from Whisper segments).
 * Auto-scrolls with playback, highlights the sentence currently spoken, is
 * searchable, and any line jumps the video to that moment.
 */
export function TranscriptPanel({ segments, currentTime, onSeek, auto }: {
  segments: Segment[]
  currentTime: number
  onSeek: (t: number) => void
  auto?: boolean
}) {
  const [q, setQ] = useState('')
  const [follow, setFollow] = useState(true)
  const listRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)

  const activeIdx = useMemo(() => {
    if (!segments.length) return -1
    // Last segment whose start is <= currentTime.
    let idx = -1
    for (let i = 0; i < segments.length; i++) {
      if (segments[i].start <= currentTime + 0.05) idx = i; else break
    }
    return idx
  }, [segments, currentTime])

  const filtered = useMemo(() => {
    if (!q.trim()) return segments.map((s, i) => ({ s, i }))
    const needle = q.toLowerCase()
    return segments.map((s, i) => ({ s, i })).filter(({ s }) => s.text.toLowerCase().includes(needle))
  }, [segments, q])

  // Keep the spoken line in view while following.
  // NB: scrollIntoView() scrolls every ancestor — it was yanking the whole PAGE
  // down while the video played. Scroll the list container itself instead.
  useEffect(() => {
    if (!follow || q.trim() || !activeRef.current || !listRef.current) return
    const list = listRef.current
    const el = activeRef.current
    const target = el.offsetTop - list.clientHeight / 2 + el.clientHeight / 2
    list.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })
  }, [activeIdx, follow, q])

  const mark = (text: string) => {
    if (!q.trim()) return text
    const i = text.toLowerCase().indexOf(q.toLowerCase())
    if (i < 0) return text
    return (<>
      {text.slice(0, i)}
      <mark className="rounded bg-amber-300/60 px-0.5 text-foreground dark:bg-amber-500/40">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>)
  }

  if (!segments.length) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <FileText className="mx-auto mb-2 h-7 w-7 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">La transcription apparaîtra ici après l’analyse.</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border p-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <FileText className="h-4 w-4 text-brand-500" />Transcription
          {auto && <span className="flex items-center gap-0.5 rounded-full bg-brand-500/10 px-1.5 py-0.5 text-[9px] font-bold text-brand-600 dark:text-brand-400"><Sparkles className="h-2.5 w-2.5" />auto</span>}
        </p>
        <div className="relative ml-auto w-40">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…"
            aria-label="Rechercher dans la transcription"
            className="h-8 w-full rounded-lg border border-input bg-background pl-7 pr-2 text-xs outline-none focus:ring-2 focus:ring-brand-500/40" />
        </div>
        <button type="button" onClick={() => setFollow((f) => !f)} title="Suivre la lecture"
          aria-pressed={follow}
          className={`rounded-lg p-1.5 transition-colors ${follow ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400' : 'text-muted-foreground hover:bg-accent'}`}>
          <ArrowDownToLine className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Height follows the content (no dead space on short pitches) but is
          capped so long transcripts stay scrollable instead of stretching. */}
      <div ref={listRef} className="max-h-[380px] min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
        {filtered.length === 0 && <p className="p-4 text-center text-xs text-muted-foreground">Aucun résultat pour « {q} »</p>}
        {filtered.map(({ s, i }) => {
          const active = i === activeIdx && !q.trim()
          return (
            <button key={i} ref={active ? activeRef : undefined} type="button"
              onClick={() => onSeek(s.start)}
              className={`flex w-full gap-2 rounded-lg p-2 text-left transition-colors ${
                active ? 'bg-brand-500/10 ring-1 ring-brand-500/30' : 'hover:bg-accent'}`}>
              <span className={`shrink-0 font-mono text-[11px] tabular-nums ${active ? 'text-brand-600 dark:text-brand-400' : 'text-muted-foreground'}`}>
                {fmtTime(s.start)}
              </span>
              <span className={`text-xs leading-relaxed ${active ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                {mark(s.text.trim())}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
