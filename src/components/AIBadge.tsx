import { Sparkles, Zap, Flower2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AIBadgeProps {
  className?: string
  aiRole?: string | null
}

const roleConfig: Record<
  string,
  { icon: React.ReactNode; label: string; colorClass: string }
> = {
  Newton: {
    icon: <Sparkles className='h-3.5 w-3.5' />,
    label: 'AI 学长',
    colorClass:
      'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-indigo-200',
  },
  Midas: {
    icon: <Zap className='h-3.5 w-3.5' />,
    label: 'SEO 总监',
    colorClass:
      'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-amber-200',
  },
  Flora: {
    icon: <Flower2 className='h-3.5 w-3.5' />,
    label: '树洞伙伴',
    colorClass:
      'bg-gradient-to-r from-rose-400 to-pink-600 text-white shadow-rose-200',
  },
}

const defaultConfig = {
  icon: <Sparkles className='h-3.5 w-3.5' />,
  label: 'AI 生成',
  colorClass: 'bg-purple-100 text-purple-700',
}

export function AIBadge({ className, aiRole }: AIBadgeProps) {
  const config = (aiRole && roleConfig[aiRole]) || defaultConfig

  return (
    <span
      className={cn(
        'ml-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-sm',
        config.colorClass,
        className
      )}
      title={aiRole ? `AI-${aiRole}` : 'AI Generated'}>
      {config.icon}
      <span>{config.label}</span>
    </span>
  )
}
