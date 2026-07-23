'use client'
import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

const Star = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
    <path d="M6 0c0 0 .6 4.2 1.5 4.5C8.4 4.8 12 6 12 6s-3.6 1.2-4.5 1.5C6.6 7.8 6 12 6 12s-.6-4.2-1.5-4.5C3.6 7.2 0 6 0 6s3.6-1.2 4.5-1.5C5.4 4.2 6 0 6 0Z" />
  </svg>
)

export const ShimmerButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    shimmerColor?: string
    background?: string
    borderRadius?: string
    duration?: number
  }
>(
  (
    {
      shimmerColor,
background = 'linear-gradient(90deg, #fbb431 0%, #0a8fb1 55%, #14c8f3 100%)', 
borderRadius = '9999px',
duration = 2,
      className,
      children,
      style,
      ...props
    },
    ref,
  ) => {
    const [hovered, setHovered] = useState(false)

    return (
      <motion.button
        ref={ref}
        initial={{ '--x': '100%' } as any}
        animate={{ '--x': '-100%' } as any}
        whileTap={{ scale: 0.97 } as any}
        transition={{
          '--x': {
            duration,
            repeat: Infinity,
            repeatType: 'loop',
            repeatDelay: 0.8,
            ease: 'easeInOut',
          },
          scale: { type: 'spring', stiffness: 300, damping: 20 },
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ background, borderRadius, ...style } as React.CSSProperties}
        className={cn(
          'group relative inline-flex items-center justify-center gap-2',
  'overflow-hidden whitespace-nowrap rounded-full',
  'px-7 py-3 font-semibold text-white',
  'border border-white/20',
  'shadow-[0_10px_30px_rgba(12,179,215,0.35)]',
  'transition-all duration-300 ease-out',
  'hover:scale-[1.03]',
  'hover:border-white/40',
  'hover:shadow-[0_15px_40px_rgba(12,179,215,0.45)]',
  'active:scale-[0.97]',
          className,
        )}
        {...(props as any)}
      >
        {/* ── Sparkles on hover ─────────────────────────────────────────── */}
        <Star style={{ position:'absolute', left:14, top:'28%', width:14, height:14, color:'#fff',
          opacity: hovered ? 1 : 0, transform: hovered ? 'scale(1)' : 'scale(0)',
          transition: 'all 0.3s', transitionDelay: hovered ? '40ms' : '0ms', pointerEvents:'none' }} />
        <Star style={{ position:'absolute', left:26, bottom:'22%', width:8, height:8, color:'#e9d5ff',
          opacity: hovered ? 0.85 : 0, transform: hovered ? 'scale(1)' : 'scale(0)',
          transition: 'all 0.3s', transitionDelay: hovered ? '120ms' : '0ms', pointerEvents:'none' }} />
        <Star style={{ position:'absolute', right:18, top:'22%', width:6, height:6, color:'#fff',
          opacity: hovered ? 0.7 : 0, transform: hovered ? 'scale(1)' : 'scale(0)',
          transition: 'all 0.3s', transitionDelay: hovered ? '200ms' : '0ms', pointerEvents:'none' }} />

        {/* ── Gloss shine — transparent diagonal sweep, inset from border ── */}
        {/* inset:3px keeps it away from the border so border stays static   */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute rounded-[inherit]"
          style={{
            inset: 3,
            background: [
              'linear-gradient(',
              '  -75deg,',
              '  transparent            calc(var(--x) + 20%),',
              '  rgba(255,255,255,0.22) calc(var(--x) + 30%),',
              '  transparent            calc(var(--x) + 100%)',
              ')',
            ].join(''),
          }}
        />

        {/* ── Text — solid white, always ────────────────────────────────── */}
        <span className="relative z-10 flex items-center gap-2 text-white">
          {children}
        </span>
      </motion.button>
    )
  },
)
ShimmerButton.displayName = 'ShimmerButton'
