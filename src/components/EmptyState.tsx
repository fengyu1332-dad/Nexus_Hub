import { cn } from '@/lib/utils'
import { type LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  className?: string
}

export function EmptyState({ icon: Icon, title, description, className }: EmptyStateProps) {
  return (
    <div className={cn('text-center py-12', className)}>
      {Icon && (
        <Icon className='w-12 h-12 mx-auto mb-3 text-zinc-300' />
      )}
      <p className='text-sm font-medium text-zinc-600'>{title}</p>
      {description && (
        <p className='text-xs text-zinc-400 mt-1'>{description}</p>
      )}
    </div>
  )
}
