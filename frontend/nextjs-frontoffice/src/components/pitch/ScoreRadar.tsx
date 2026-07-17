'use client'
import { useMemo, useState } from 'react'
import type { Dimension } from './types'

/**
 * Multi-dimension pitch profile as a hand-rolled SVG radar (no chart dep).
 * Uses currentColor-friendly tokens so it reads in light and dark mode.
 */
export function ScoreRadar({ dimensions, size = 260 }: { dimensions: Dimension[]; size?: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const dims = dimensions?.filter((d) => d?.name) ?? []
  const n = dims.length
  const cx = size / 2, cy = size / 2, r = size / 2 - 34

  const points = useMemo(() => dims.map((d, i) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2
    const v = Math.max(0, Math.min(10, Number(d.score) || 0)) / 10
    return { x: cx + Math.cos(a) * r * v, y: cy + Math.sin(a) * r * v, a, d }
  }), [dims, n, cx, cy, r])

  if (n < 3) return null
  const poly = points.map((p) => `${p.x},${p.y}`).join(' ')

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} role="img" aria-label="Profil du pitch par dimension">
        {/* rings */}
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <circle key={f} cx={cx} cy={cy} r={r * f} fill="none" stroke="currentColor"
            className="text-border" strokeWidth={1} />
        ))}
        {/* axes + labels */}
        {dims.map((d, i) => {
          const a = (Math.PI * 2 * i) / n - Math.PI / 2
          const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r
          const lx = cx + Math.cos(a) * (r + 16), ly = cy + Math.sin(a) * (r + 16)
          return (
            <g key={i}>
              <line x1={cx} y1={cy} x2={x} y2={y} stroke="currentColor" className="text-border" strokeWidth={1} />
              <text x={lx} y={ly} textAnchor={Math.abs(Math.cos(a)) < 0.3 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end'}
                dominantBaseline="middle" className="fill-muted-foreground"
                style={{ fontSize: 8.5, fontWeight: hover === i ? 700 : 500 }}>
                {d.name.length > 18 ? d.name.slice(0, 17) + '…' : d.name}
              </text>
            </g>
          )
        })}
        {/* value polygon */}
        <polygon points={poly} fill="rgb(99 102 241 / 0.25)" stroke="rgb(99 102 241)" strokeWidth={2} />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={hover === i ? 5 : 3.5} fill="rgb(99 102 241)"
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} style={{ cursor: 'pointer' }} />
        ))}
      </svg>
      {hover != null && dims[hover] && (
        <div className="mt-1 max-w-xs rounded-lg border border-border bg-card px-2.5 py-1.5 text-center shadow-lg">
          <p className="text-xs font-bold text-foreground">{dims[hover].name} — {dims[hover].score}/10</p>
          {dims[hover].comment && <p className="text-[10px] text-muted-foreground">{dims[hover].comment}</p>}
        </div>
      )}
    </div>
  )
}
