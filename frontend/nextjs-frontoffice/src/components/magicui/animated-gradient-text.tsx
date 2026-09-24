import { cn } from '@/lib/utils'

export function AnimatedGradientText({ children, className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn('animate-gradient bg-[length:200%_auto] bg-clip-text text-transparent', className)}
      style={{ backgroundImage: 'linear-gradient(90deg, rgb(var(--brand-accent, 204 134 4)), rgb(var(--brand-500)), rgb(var(--brand-400)), rgb(var(--brand-accent, 204 134 4)))' }}
      {...props}>
      {children}
    </span>
  )
}
