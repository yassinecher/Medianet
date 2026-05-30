'use client'
import { useEffect, useRef } from 'react'
import createGlobe from 'cobe'
import { cn } from '@/lib/utils'

export function Globe({ className, markers = [] }: { className?: string; markers?: { location: [number, number]; size: number }[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const phi = useRef(0)

  useEffect(() => {
    const c = canvasRef.current; if (!c) return
    const g = createGlobe(c, {
      devicePixelRatio: 2, width: 500, height: 500, phi: 0, theta: 0.3, dark: 1, diffuse: 1.2,
      mapSamples: 16000, mapBrightness: 6, baseColor: [0.2, 0.2, 0.4], markerColor: [0.4, 0.45, 1], glowColor: [0.3, 0.3, 0.8],
      markers: markers.length ? markers : [{ location: [36.7538, 3.0588], size: 0.07 }, { location: [48.8566, 2.3522], size: 0.04 }],
      onRender: (s) => { s.phi = phi.current; phi.current += 0.003 },
    })
    return () => g.destroy()
  }, [markers])

  return (
    <div className={cn('flex items-center justify-center', className)}>
      <canvas ref={canvasRef} style={{ width: 500, height: 500, maxWidth: '100%', aspectRatio: '1' }} />
    </div>
  )
}
