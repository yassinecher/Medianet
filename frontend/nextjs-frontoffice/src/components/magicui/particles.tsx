'use client'
import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface Particle { x: number; y: number; vx: number; vy: number; size: number; alpha: number }

/** "#rrggbb" → "r g b" (null when not a 6-digit hex). */
function hexTriplet(hex: string): string | null {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim())
  return m ? m.slice(1).map((x) => parseInt(x, 16)).join(' ') : null
}

/**
 * Canvas particles. Without `color`, the dots use the current brand color
 * (`--brand-500`, i.e. the admin's theme incl. light/dark), re-read periodically
 * so a theme or mode switch is picked up.
 */
export function Particles({ className, quantity = 80, color, ease = 0.05 }: {
  className?: string; quantity?: number; color?: string; ease?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouse = useRef({ x: 0, y: 0 })
  const raf = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let w = canvas.offsetWidth, h = canvas.offsetHeight
    canvas.width = w; canvas.height = h

    const particles: Particle[] = Array.from({ length: quantity }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
      size: Math.random() * 1.8 + 0.4, alpha: Math.random() * 0.5 + 0.1,
    }))

    // "r g b" of the dots: explicit hex prop, else the themed --brand-500.
    const readRgb = () => (color && hexTriplet(color))
      || getComputedStyle(canvas).getPropertyValue('--brand-500').trim()
      || '0 163 224'
    let rgb = readRgb()
    let frame = 0

    const draw = () => {
      if (!color && ++frame % 60 === 0) rgb = readRgb()
      ctx.clearRect(0, 0, w, h)
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy
        const dx = mouse.current.x - p.x, dy = mouse.current.y - p.y
        const d = Math.sqrt(dx * dx + dy * dy)
        if (d < 100) { p.vx += (dx / d) * ease * 0.1; p.vy += (dy / d) * ease * 0.1 }
        p.vx *= 0.99; p.vy *= 0.99
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgb(${rgb} / ${p.alpha.toFixed(3)})`
        ctx.fill()
      }
      raf.current = requestAnimationFrame(draw)
    }
    draw()

    const onResize = () => { w = canvas.offsetWidth; h = canvas.offsetHeight; canvas.width = w; canvas.height = h }
    const onMouse = (e: MouseEvent) => { const r = canvas.getBoundingClientRect(); mouse.current = { x: e.clientX - r.left, y: e.clientY - r.top } }
    window.addEventListener('resize', onResize)
    canvas.addEventListener('mousemove', onMouse)
    return () => { cancelAnimationFrame(raf.current); window.removeEventListener('resize', onResize); canvas.removeEventListener('mousemove', onMouse) }
  }, [quantity, color, ease])

  return <canvas ref={canvasRef} className={cn('pointer-events-auto h-full w-full', className)} />
}
