import { cn } from '@/lib/utils'

export function AnimatedGradientText({ children, className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn('animate-gradient bg-[length:200%_auto] bg-clip-text text-transparent', className)}
      style={{ backgroundImage: 'linear-gradient(90deg, #a78bfa, #6272f6, #818cf8, #a78bfa)' }}
      {...props}>
      {children}
    </span>
  )
}
