'use client'
import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export function MagicCard({ children, className, gradientColor = '#6272f6', gradientOpacity = 0.1, ...props }: React.HTMLAttributes<HTMLDivElement> & { gradientColor?: string; gradientOpacity?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: -300, y: -300 })
  const [hovered, setHovered] = useState(false)

  return (
    <div ref={ref}
      onMouseMove={(e) => { const r = ref.current!.getBoundingClientRect(); setPos({ x: e.clientX - r.left, y: e.clientY - r.top }) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPos({ x: -300, y: -300 }) }}
      className={cn('relative overflow-hidden rounded-xl border border-border bg-card transition-shadow duration-200', hovered && 'shadow-md shadow-brand-500/10', className)} {...props}>
      <div className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-300" style={{ opacity: hovered ? 1 : 0, background: `radial-gradient(180px circle at ${pos.x}px ${pos.y}px, ${gradientColor}${Math.round(gradientOpacity * 255).toString(16).padStart(2, '0')}, transparent 80%)` }} />
      <div className="relative z-10">{children}</div>
    </div>
  )
}
