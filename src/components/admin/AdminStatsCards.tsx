'use client'

import { useDict } from '@/components/I18nProvider'
import { Users, FileText, MessageSquare, Globe } from 'lucide-react'

interface Stats {
  totalUsers: number
  totalPosts: number
  totalComments: number
  totalCommunities: number
}

export function AdminStatsCards({ stats }: { stats: Stats }) {
  const dict = useDict()

  const cards = [
    { label: dict.admin.totalUsers, value: stats.totalUsers, icon: Users, color: 'bg-blue-50 text-blue-700' },
    { label: dict.admin.totalPosts, value: stats.totalPosts, icon: FileText, color: 'bg-emerald-50 text-emerald-700' },
    { label: dict.admin.totalComments, value: stats.totalComments, icon: MessageSquare, color: 'bg-amber-50 text-amber-700' },
    { label: dict.admin.totalCommunities, value: stats.totalCommunities, icon: Globe, color: 'bg-purple-50 text-purple-700' },
  ]

  return (
    <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <div
            key={card.label}
            className='bg-white rounded-lg border border-zinc-200 p-5 hover:border-zinc-300 transition-colors'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm text-zinc-500'>{card.label}</p>
                <p className='text-3xl font-bold text-zinc-900 mt-1'>{card.value}</p>
              </div>
              <div className={`p-2.5 rounded-lg ${card.color}`}>
                <Icon className='h-5 w-5' />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
