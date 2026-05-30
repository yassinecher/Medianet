'use client'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export function NumberTicker({ value, suffix = '', prefix = '', decimals = 0, duration = 1200, className }: {
  value: number; suffix?: string; prefix?: string; decimals?: number; duration?: number; className?: string
}) {
  const [display, setDisplay] = useState(0)
  const start = useRef<number | null>(null)
  const raf = useRef(0)

  useEffect(() => {
    start.current = null
    const step = (ts: number) => {
      if (!start.current) start.current = ts
      const p = Math.min((ts - start.current) / duration, 1)
      setDisplay(value * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  }, [value, duration])

  return <span className={cn('tabular-nums', className)}>{prefix}{display.toFixed(decimals)}{suffix}</span>
}
