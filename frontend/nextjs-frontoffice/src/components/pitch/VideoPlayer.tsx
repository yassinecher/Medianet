'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Play, Pause, Maximize, PictureInPicture2, Volume1, Volume2, VolumeX, SkipBack, SkipForward } from 'lucide-react'
import { fmtTime, SEVERITY_STYLE, type Highlight } from './types'

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]

/**
 * Pitch video player with AI findings pinned to the timeline.
 * Markers are colour-coded by severity; clicking one jumps to that moment.
 * Hovering the timeline scrubs a hidden <video> to show a frame preview.
 */
export function VideoPlayer({ src, highlights = [], currentTime, onTime, seekTo }: {
  src: string
  highlights?: Highlight[]
  currentTime: number
  onTime: (t: number) => void
  /** Increment this (or set a new value) to request a seek from outside. */
  seekTo?: { t: number; nonce: number } | null
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const previewRef = useRef<HTMLVideoElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [hover, setHover] = useState<{ x: number; t: number } | null>(null)

  // Pitch audio is often recorded far too quietly (one real submission came in
  // at -30 LUFS), so the level control matters more here than in a normal player.
  const applyVolume = useCallback((v: number) => {
    const el = videoRef.current
    const next = Math.min(1, Math.max(0, v))
    setVolume(next)
    if (el) {
      el.volume = next
      // Nudging the slider up should unmute — otherwise it looks broken.
      el.muted = next === 0
      setMuted(el.muted)
    }
  }, [])

  const toggleMute = useCallback(() => {
    const el = videoRef.current; if (!el) return
    const next = !el.muted
    el.muted = next
    setMuted(next)
    // Coming back from mute at volume 0 would still be silent.
    if (!next && el.volume === 0) applyVolume(0.5)
  }, [applyVolume])

  // External seek requests (transcript / highlight clicks).
  useEffect(() => {
    if (!seekTo || !videoRef.current) return
    videoRef.current.currentTime = seekTo.t
    videoRef.current.play().catch(() => {})
  }, [seekTo?.nonce, seekTo?.t])

  const toggle = useCallback(() => {
    const v = videoRef.current; if (!v) return
    if (v.paused) v.play().catch(() => {}); else v.pause()
  }, [])

  const skip = (d: number) => { const v = videoRef.current; if (v) v.currentTime = Math.max(0, v.currentTime + d) }

  // Keyboard: space play/pause, ←/→ skip 5s, ↑/↓ volume, m mute.
  const onKey = (e: React.KeyboardEvent) => {
    // Don't hijack arrows while the user is dragging the volume slider itself.
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return
    if (e.key === ' ') { e.preventDefault(); toggle() }
    if (e.key === 'ArrowLeft') { e.preventDefault(); skip(-5) }
    if (e.key === 'ArrowRight') { e.preventDefault(); skip(5) }
    if (e.key === 'ArrowUp') { e.preventDefault(); applyVolume(volume + 0.1) }
    if (e.key === 'ArrowDown') { e.preventDefault(); applyVolume(volume - 0.1) }
    if (e.key === 'm' || e.key === 'M') { e.preventDefault(); toggleMute() }
  }

  const seekFromEvent = (e: React.MouseEvent) => {
    const bar = barRef.current, v = videoRef.current
    if (!bar || !v || !duration) return
    const r = bar.getBoundingClientRect()
    v.currentTime = Math.min(duration, Math.max(0, ((e.clientX - r.left) / r.width) * duration))
  }

  const onHover = (e: React.MouseEvent) => {
    const bar = barRef.current
    if (!bar || !duration) return
    const r = bar.getBoundingClientRect()
    const x = Math.min(r.width, Math.max(0, e.clientX - r.left))
    const t = (x / r.width) * duration
    setHover({ x, t })
    if (previewRef.current) previewRef.current.currentTime = t
  }

  const pct = duration ? (currentTime / duration) * 100 : 0

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-black/95 focus:outline-none focus:ring-2 focus:ring-brand-500"
      tabIndex={0} onKeyDown={onKey} aria-label="Lecteur vidéo du pitch">
      <div className="relative">
        <video ref={videoRef} src={src} className="aspect-video w-full bg-black" playsInline
          onClick={toggle}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
          onTimeUpdate={(e) => onTime(e.currentTarget.currentTime)}
          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
        {/* Hidden twin used only to render timeline frame previews */}
        <video ref={previewRef} src={src} className="hidden" muted preload="metadata" />
        {!playing && (
          <button type="button" onClick={toggle} aria-label="Lire"
            className="absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity hover:bg-black/40">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 shadow-xl">
              <Play className="ml-1 h-7 w-7 text-black" />
            </span>
          </button>
        )}
      </div>

      {/* Timeline with AI markers */}
      <div className="px-3 pt-3">
        <div className="relative">
          {hover && (
            <div className="pointer-events-none absolute -top-24 z-20 -translate-x-1/2"
              style={{ left: hover.x }}>
              <video src={src} className="h-20 w-36 rounded-lg border border-white/20 object-cover shadow-xl"
                muted preload="metadata"
                ref={(el) => { if (el && Math.abs(el.currentTime - hover.t) > 0.4) el.currentTime = hover.t }} />
              <p className="mt-0.5 text-center text-[10px] font-bold text-white">{fmtTime(hover.t)}</p>
            </div>
          )}
          <div ref={barRef} onClick={seekFromEvent} onMouseMove={onHover} onMouseLeave={() => setHover(null)}
            className="group relative h-2.5 cursor-pointer rounded-full bg-white/20"
            role="slider" aria-label="Progression" aria-valuemin={0} aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(currentTime)} tabIndex={0}>
            <div className="h-full rounded-full bg-brand-500 transition-[width]" style={{ width: `${pct}%` }} />
            <div className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-white shadow"
              style={{ left: `calc(${pct}% - 7px)` }} />
            {/* AI findings pinned on the timeline */}
            {duration > 0 && highlights.map((h, i) => (
              <button key={i} type="button" title={`${fmtTime(h.timeSec)} — ${h.topic}`}
                aria-label={`${h.topic} à ${fmtTime(h.timeSec)}`}
                onClick={(e) => { e.stopPropagation(); const v = videoRef.current; if (v) { v.currentTime = h.timeSec; v.play().catch(() => {}) } }}
                className="absolute -top-1 h-4.5 w-1.5 rounded-full ring-1 ring-black/40 transition-transform hover:scale-y-150"
                style={{ left: `calc(${(h.timeSec / duration) * 100}% - 3px)`, height: 18,
                         background: SEVERITY_STYLE[h.severity]?.dot ?? '#94a3b8' }} />
            ))}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-white">
        <button onClick={toggle} aria-label={playing ? 'Pause' : 'Lire'} className="rounded p-1 hover:bg-white/10">
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button onClick={() => skip(-5)} aria-label="Reculer 5s" className="rounded p-1 hover:bg-white/10"><SkipBack className="h-4 w-4" /></button>
        <button onClick={() => skip(5)} aria-label="Avancer 5s" className="rounded p-1 hover:bg-white/10"><SkipForward className="h-4 w-4" /></button>
        {/* Volume: the slider expands on hover/focus so it never crowds the bar */}
        <div className="group/vol flex items-center">
          <button onClick={toggleMute} aria-label={muted ? 'Activer le son' : 'Couper le son'}
            className="rounded p-1 hover:bg-white/10">
            {muted || volume === 0 ? <VolumeX className="h-4 w-4" />
              : volume < 0.5 ? <Volume1 className="h-4 w-4" />
              : <Volume2 className="h-4 w-4" />}
          </button>
          <input type="range" min={0} max={1} step={0.05}
            value={muted ? 0 : volume}
            onChange={(e) => applyVolume(Number(e.target.value))}
            aria-label="Volume"
            title={`Volume ${Math.round((muted ? 0 : volume) * 100)}%`}
            className="h-1 w-0 cursor-pointer appearance-none rounded-full bg-white/25 opacity-0 transition-all
                       group-hover/vol:ml-1.5 group-hover/vol:w-16 group-hover/vol:opacity-100
                       focus:ml-1.5 focus:w-16 focus:opacity-100 focus:outline-none
                       [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-2.5
                       [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full
                       [&::-webkit-slider-thumb]:bg-white
                       [&::-moz-range-thumb]:h-2.5 [&::-moz-range-thumb]:w-2.5
                       [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:rounded-full
                       [&::-moz-range-thumb]:bg-white" />
        </div>
        <span className="ml-1 font-mono text-xs tabular-nums text-white/80">{fmtTime(currentTime)} / {fmtTime(duration)}</span>
        <div className="ml-auto flex items-center gap-1.5">
          <select value={speed} aria-label="Vitesse de lecture"
            onChange={(e) => { const s = Number(e.target.value); setSpeed(s); if (videoRef.current) videoRef.current.playbackRate = s }}
            className="rounded bg-white/10 px-1.5 py-1 text-xs text-white outline-none">
            {SPEEDS.map((s) => <option key={s} value={s} className="text-black">{s}×</option>)}
          </select>
          <button aria-label="Picture-in-picture" className="rounded p-1 hover:bg-white/10"
            onClick={() => { const v = videoRef.current as any; if (v?.requestPictureInPicture) v.requestPictureInPicture().catch(() => {}) }}>
            <PictureInPicture2 className="h-4 w-4" />
          </button>
          <button aria-label="Plein écran" className="rounded p-1 hover:bg-white/10"
            onClick={() => videoRef.current?.requestFullscreen?.().catch(() => {})}>
            <Maximize className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
