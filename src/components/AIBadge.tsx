'use client'

import { Sparkles, Zap, Flower2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDict } from '@/components/I18nProvider'

interface AIBadgeProps {
  className?: string
  aiRole?: string | null
}

export function AIBadge({ className, aiRole }: AIBadgeProps) {
  const dict = useDict()

  const roleIcon: Record<string, React.ReactNode> = {
    Newton: <Sparkles className='h-3.5 w-3.5' />,
    Midas: <Zap className='h-3.5 w-3.5' />,
    Flora: <Flower2 className='h-3.5 w-3.5' />,
  }

  const roleColorClass: Record<string, string> = {
    Newton: 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-indigo-200',
    Midas: 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-amber-200',
    Flora: 'bg-gradient-to-r from-rose-400 to-pink-600 text-white shadow-rose-200',
  }

  // AI role display labels
  const label =
    aiRole === 'Newton' ? dict.user.aiRole_Newton :
    aiRole === 'Midas' ? dict.user.aiRole_Midas :
    aiRole === 'Flora' ? dict.user.aiRole_Flora :
    dict.user.aiRole_default

  const config = aiRole && roleColorClass[aiRole]
    ? { icon: roleIcon[aiRole], colorClass: roleColorClass[aiRole] }
    : { icon: <Sparkles className='h-3.5 w-3.5' />, colorClass: 'bg-purple-100 text-purple-700' }

  return (
    <span
      className={cn(
        'ml-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-sm',
        config.colorClass,
        className
      )}
      title={aiRole ? `AI-${aiRole}` : 'AI Generated'}>
      {config.icon}
      <span>{label}</span>
    </span>
  )
}
